/**
 * Goals the app can count (ADR-0042): times done, time spent, points
 * earned and streaks. The rules are `goalKinds.ts` in `@glide/scoring`;
 * this stores goals, the tasks they count and one entry per counted
 * tick.
 *
 * **A goal never grades a day and never prices a task** (ADR-0042 §4).
 * Nothing here touches weights, points or `task_unit`, so a goal on a
 * commitment can't make a scoring link into a life unit (EC-41).
 * Pausing or finishing a goal leaves its tasks exactly as they were:
 * the plan is the units' business, and a goal only watches it.
 *
 * A goal counts only its own unit's work, with a commitment's
 * sub-commitments (EC-41): the tasks it links must be there, so a goal
 * can't be left counting a task that another unit's change removed.
 *
 * The goal screens are hidden until Phase 10 rebuilds them, so for now
 * only ticks and the tests call this.
 */
import {
  clampTookAbout,
  entryFor,
  goalProblem,
  goalProgress,
  goalStreak,
  inScheduleOn,
  isDueOn,
  nextGoalStatus,
  streakShown,
  tickMinutes,
  type GoalAction,
  type GoalDefinition,
  type GoalKind,
  type GoalMeasure,
  type GoalStatus,
  type GoalTaskFacts,
  type GoalTick,
} from "@glide/scoring";
import { and, eq, inArray } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { assertEditable, currentLocalDate } from "../lib/calendar";
import { db } from "./client";
import {
  achievement,
  awayRange,
  dayGrade,
  goal,
  goalEntry,
  goalTask,
  lifeUnit,
  scheduleSkip,
  task,
  taskCompletion,
  taskUnit,
} from "./schema";
import type { Tx } from "./tasks";
import { awayDatesBetween, commitmentRoots, skippedDatesFor } from "./windowRules";

export type { GoalKind, GoalStatus };

const now = () => new Date().toISOString();

type GoalRow = typeof goal.$inferSelect;

/** What a tick's entries are built from. */
interface CompletionFacts {
  id: string;
  taskId: string;
  localDate: string;
  pointsEarned: number;
  fraction: number;
  actualMinutes: number | null;
}

// ── Reading a goal's definition ─────────────────────────────────────

/** Each unit with its sub-commitments: what a goal on it reads. */
function unitScopes(tx: Tx) {
  const rows = tx.select({ id: lifeUnit.id, parentUnitId: lifeUnit.parentUnitId }).from(lifeUnit).all();
  const scope = new Map<string, Set<string>>();
  for (const u of rows) scope.set(u.id, new Set([u.id]));
  for (const u of rows) if (u.parentUnitId) scope.get(u.parentUnitId)?.add(u.id);
  return scope;
}

function scopeOf(tx: Tx, unitId: string): Set<string> {
  const scope = unitScopes(tx).get(unitId);
  if (!scope) throw new Error(`No unit ${unitId}`);
  return scope;
}

/** A stored goal as the engine's `GoalDefinition`. */
export function definitionOf(
  row: Pick<GoalRow, "kind" | "targetValue" | "countsWholeUnit" | "unitId">,
  linkedTaskIds: readonly string[],
  unitIds: ReadonlySet<string>,
): GoalDefinition {
  // `createGoal` always stores a target above zero for these kinds. A
  // row without one can never read as reached: 0 would invite
  // completion with nothing done.
  const target = row.targetValue ?? Number.POSITIVE_INFINITY;
  const taskIds = new Set(linkedTaskIds);
  const measure: GoalMeasure =
    row.kind === "timesDone"
      ? { kind: "timesDone", taskIds, target }
      : row.kind === "timeSpent"
        ? { kind: "timeSpent", counts: row.countsWholeUnit ? "wholeUnit" : { taskIds }, target }
        : row.kind === "pointsEarned"
          ? { kind: "pointsEarned", target }
          : // Exactly one link: `unlinkGoalTask` won't remove a streak's.
            { kind: "streak", taskId: linkedTaskIds[0] ?? "" };
  return { measure, unitIds };
}

/** Goals with what each counts: these statuses, or these ids. */
function definitions(tx: Tx, which: { statuses: readonly GoalStatus[] } | { ids: readonly string[] }) {
  const rows =
    "ids" in which
      ? which.ids.length === 0
        ? []
        : tx.select().from(goal).where(inArray(goal.id, [...which.ids])).all()
      : tx.select().from(goal).where(inArray(goal.status, [...which.statuses])).all();
  if (rows.length === 0) return [];
  const links = tx
    .select()
    .from(goalTask)
    .where(inArray(goalTask.goalId, rows.map((g) => g.id)))
    .all();
  const scopes = unitScopes(tx);
  return rows.map((row) => {
    const linked = links.filter((l) => l.goalId === row.id).map((l) => l.taskId);
    const scope = scopes.get(row.unitId);
    if (!scope) throw new Error(`Goal ${row.id} is on a unit that's gone: ${row.unitId}`);
    return { row, linked, definition: definitionOf(row, linked, scope) };
  });
}

// ── Ticks ───────────────────────────────────────────────────────────

/**
 * What a tick earned in each unit it **scores** in (ADR-0042, clarified
 * 2026-10-17). `points_earned` is one number per tick, so it's divided
 * by the task's weight in each scoring unit, the way it was earned
 * (ADR-0019). A note tag isn't here at all, so it gives a unit's goal
 * nothing (ADR-0035 §3).
 */
export function pointsByUnit(
  pointsEarned: number,
  scoring: readonly { unitId: string; pointValue: number }[],
): Map<string, number> {
  const out = new Map<string, number>();
  if (scoring.length === 0) return out;
  const total = scoring.reduce((a, m) => a + Math.max(0, m.pointValue), 0);
  for (const m of scoring) {
    const share = total > 0 ? Math.max(0, m.pointValue) / total : 1 / scoring.length;
    out.set(m.unitId, (out.get(m.unitId) ?? 0) + pointsEarned * share);
  }
  return out;
}

/** A task's facts as a tick needs them. A tick without its task is a
 *  bug in the caller, so this throws rather than counting nothing. */
function tickFacts(tx: Tx, taskId: string) {
  const [t] = tx.select().from(task).where(eq(task.id, taskId)).all();
  if (!t) throw new Error(`A tick of a task that isn't there: ${taskId}`);
  const scoring = tx
    .select({ unitId: taskUnit.unitId, pointValue: taskUnit.pointValue })
    .from(taskUnit)
    .where(and(eq(taskUnit.taskId, taskId), eq(taskUnit.membership, "scoring")))
    .all();
  const durationMinutes =
    t.kind === "event" && t.startMinute != null && t.endMinute != null && t.endMinute > t.startMinute
      ? t.endMinute - t.startMinute
      : null;
  return { size: t.size ?? t.oneOffSize ?? null, durationMinutes, scoring };
}

function tickOf(tx: Tx, completion: CompletionFacts): GoalTick {
  const facts = tickFacts(tx, completion.taskId);
  return {
    taskId: completion.taskId,
    localDate: completion.localDate,
    pointsByUnit: pointsByUnit(completion.pointsEarned, facts.scoring),
    size: facts.size,
    durationMinutes: facts.durationMinutes,
    tookMinutes: completion.actualMinutes,
    fraction: completion.fraction,
  };
}

function insertEntries(
  tx: Tx,
  completionId: string,
  entries: readonly { goalId: string; taskId: string; localDate: string; minutes: number; points: number }[],
): void {
  if (entries.length === 0) return;
  const stamp = now();
  tx.insert(goalEntry)
    .values(
      entries.map((e) => ({
        id: Crypto.randomUUID(),
        completionId,
        ...e,
        createdAt: stamp,
        updatedAt: stamp,
      })),
    )
    .run();
}

/**
 * Write the entries a tick leaves on the active goals it counts toward
 * (ADR-0042 §1), inside the tick's own transaction. A tick counts if
 * its task is linked **now**, and the entry keeps it counted whatever
 * happens to the link or the task later (EC-36).
 *
 * Only active goals collect ticks: a paused, finished or set-aside goal
 * isn't being worked toward.
 *
 * Points are the tick's `points_earned`, the number the day's grade
 * stored for it (ADR-0002), so a goal's total and the days it came from
 * agree.
 */
export function recordGoalEntries(tx: Tx, completion: CompletionFacts): void {
  const goals = definitions(tx, { statuses: ["active"] });
  if (goals.length === 0) return;
  const tick = tickOf(tx, completion);
  insertEntries(
    tx,
    completion.id,
    goals.flatMap(({ row, definition }) => {
      const entry = entryFor(definition, tick);
      return entry ? [{ goalId: row.id, ...entry }] : [];
    }),
  );
}

/**
 * The goals a tick counted toward, and its "Took about…", before it's
 * taken back. Changing how much of a task was done rewrites its tick,
 * and the new one carries these so the change doesn't decide again
 * what it counts toward (`carryGoalEntries`).
 */
export interface CarriedTick {
  goalIds: string[];
  actualMinutes: number | null;
}

export function carriedFrom(
  tx: Tx,
  completions: readonly { id: string; actualMinutes: number | null }[],
): CarriedTick {
  const ids = completions.map((c) => c.id);
  const rows =
    ids.length === 0
      ? []
      : tx.select({ goalId: goalEntry.goalId }).from(goalEntry).where(inArray(goalEntry.completionId, ids)).all();
  return {
    goalIds: [...new Set(rows.map((r) => r.goalId))],
    actualMinutes: completions.find((c) => c.actualMinutes != null)?.actualMinutes ?? null,
  };
}

/**
 * Write a rewritten tick's entries on the goals the old tick counted
 * toward, whatever their status or links are now: the tick counted when
 * it was made, and a new fraction only changes by how much. Minutes and
 * points follow the new fraction and price.
 */
export function carryGoalEntries(tx: Tx, completion: CompletionFacts, goalIds: readonly string[]): void {
  const goals = definitions(tx, { ids: goalIds });
  if (goals.length === 0) return;
  const tick = tickOf(tx, completion);
  const minutes = tickMinutes(tick);
  insertEntries(
    tx,
    completion.id,
    goals.map(({ row, definition }) => {
      let points = 0;
      for (const [unitId, p] of tick.pointsByUnit) {
        if (definition.unitIds.has(unitId)) points += Math.max(0, p);
      }
      return { goalId: row.id, taskId: tick.taskId, localDate: tick.localDate, minutes, points };
    }),
  );
}

/** Remove the entries of ticks being taken back, before the ticks. */
export function forgetGoalEntries(tx: Tx, completionIds: readonly string[]): void {
  if (completionIds.length === 0) return;
  tx.delete(goalEntry).where(inArray(goalEntry.completionId, [...completionIds])).run();
}

/**
 * Set or clear "Took about…" on a day's tick (ADR-0042 §5), kept
 * between 1 minute and 12 hours. Only time goals read it: the entries'
 * minutes follow it, and **no points move**, so no day is re-scored.
 * Cleared, a tick counts its size or event length again.
 */
export async function setTookAbout(
  taskId: string,
  date: string,
  minutes: number | null,
): Promise<void> {
  assertEditable(date);
  if (minutes !== null && !Number.isFinite(minutes)) {
    throw new Error(`Not a length of time: ${minutes}`);
  }
  db.transaction((tx) => {
    const [completion] = tx
      .select()
      .from(taskCompletion)
      .where(and(eq(taskCompletion.taskId, taskId), eq(taskCompletion.localDate, date)))
      .all();
    if (!completion) throw new Error(`No tick of ${taskId} on ${date}`);
    const took = minutes === null ? null : clampTookAbout(minutes);
    tx.update(taskCompletion)
      .set({ actualMinutes: took, updatedAt: now() })
      .where(eq(taskCompletion.id, completion.id))
      .run();
    const tick = tickOf(tx, { ...completion, actualMinutes: took });
    tx.update(goalEntry)
      .set({ minutes: tickMinutes(tick), updatedAt: now() })
      .where(eq(goalEntry.completionId, completion.id))
      .run();
  });
}

// ── Making and changing goals ───────────────────────────────────────

export interface NewGoal {
  unitId: string;
  title: string;
  description?: string | null;
  measure: GoalMeasure;
  /** `'YYYY-MM'`, or null (ADR-0015 §4). */
  targetDate?: string | null;
}

/** A month, `'YYYY-MM'`: an end date is never a day (ADR-0015 §4). */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The tasks a measure links in `goal_task`. */
function linkedIds(measure: GoalMeasure): string[] {
  switch (measure.kind) {
    case "timesDone":
      return [...measure.taskIds];
    case "timeSpent":
      return measure.counts === "wholeUnit" ? [] : [...measure.counts.taskIds];
    case "pointsEarned":
      return [];
    case "streak":
      return [measure.taskId];
  }
}

/** The facts `goalProblem` checks a goal's tasks against. */
function taskFacts(tx: Tx, ids: readonly string[]): Map<string, GoalTaskFacts> {
  if (ids.length === 0) return new Map();
  const rows = tx.select().from(task).where(inArray(task.id, [...ids])).all();
  return new Map(
    rows.map((t) => [t.id, { taskId: t.id, timesPerWeek: t.timesPerWeek, isEvent: t.kind === "event" }]),
  );
}

/**
 * Throws unless every task is there and is the goal's unit's work: its
 * home, or a unit it scores in, is the goal's unit or one of its
 * sub-commitments (EC-41).
 */
function assertTasksInScope(tx: Tx, taskIds: readonly string[], scope: ReadonlySet<string>): void {
  if (taskIds.length === 0) return;
  const ids = [...new Set(taskIds)];
  const homes = tx.select({ id: task.id, unitId: task.unitId }).from(task).where(inArray(task.id, ids)).all();
  const scoring = tx
    .select({ taskId: taskUnit.taskId, unitId: taskUnit.unitId })
    .from(taskUnit)
    .where(and(inArray(taskUnit.taskId, ids), eq(taskUnit.membership, "scoring")))
    .all();
  for (const id of ids) {
    const home = homes.find((h) => h.id === id);
    if (!home) throw new Error(`No task ${id}`);
    const units = [home.unitId, ...scoring.filter((s) => s.taskId === id).map((s) => s.unitId)];
    if (!units.some((u) => scope.has(u))) {
      throw new Error("A goal counts only its own unit's tasks.");
    }
  }
}

/**
 * Make a goal (ADR-0042 §1). Throws with `goalProblem`'s message when
 * the answers can't make one; the sheet shows that message before
 * saving, so reaching it here is a bug in the caller.
 */
export async function createGoal(input: NewGoal): Promise<string> {
  const id = Crypto.randomUUID();
  db.transaction((tx) => {
    const scope = scopeOf(tx, input.unitId);
    const linked = linkedIds(input.measure);
    const problem = goalProblem(
      { measure: input.measure, unitIds: scope },
      taskFacts(tx, linked),
    );
    if (problem) throw new Error(problem);
    assertTasksInScope(tx, linked, scope);
    const m = input.measure;
    if (m.kind === "timesDone" && !Number.isInteger(m.target)) {
      throw new Error("Times done is a whole number.");
    }
    const title = input.title.trim();
    if (title.length === 0) throw new Error("A goal needs a name.");
    const targetDate = input.targetDate ?? null;
    if (targetDate !== null && !MONTH.test(targetDate)) {
      throw new Error(`An end date is a month, YYYY-MM: ${targetDate}`);
    }
    tx.insert(goal)
      .values({
        id,
        unitId: input.unitId,
        title,
        description: input.description ?? null,
        kind: m.kind,
        targetValue: m.kind === "streak" ? null : m.target,
        countsWholeUnit: m.kind === "timeSpent" && m.counts === "wholeUnit",
        targetDate,
        status: "active",
        statusChangedAt: now(),
      })
      .run();
    linkTasks(tx, id, linked);
  });
  return id;
}

function linkTasks(tx: Tx, goalId: string, taskIds: readonly string[]): void {
  if (taskIds.length === 0) return;
  tx.insert(goalTask)
    .values([...new Set(taskIds)].map((taskId) => ({ goalId, taskId })))
    .onConflictDoNothing()
    .run();
}

/** Whether a goal counts the tasks you chose: times done, or time spent
 *  not counting the whole unit. Only those take and lose links. */
const takesChosenTasks = (row: GoalRow) =>
  row.kind === "timesDone" || (row.kind === "timeSpent" && !row.countsWholeUnit);

/**
 * Count a task toward a times done or time spent goal from now on.
 * Past ticks of it aren't counted after the fact: a tick counts if its
 * task was linked when it was made (ADR-0042 §1).
 */
export async function linkGoalTask(goalId: string, taskId: string): Promise<void> {
  db.transaction((tx) => {
    const [row] = tx.select().from(goal).where(eq(goal.id, goalId)).all();
    if (!row) throw new Error(`No goal ${goalId}`);
    if (!takesChosenTasks(row)) throw new Error(`A ${row.kind} goal doesn't take chosen tasks.`);
    assertTasksInScope(tx, [taskId], scopeOf(tx, row.unitId));
    linkTasks(tx, goalId, [taskId]);
  });
}

/**
 * Stop counting a task. Its ticks so far stay counted. A goal is never
 * left counting nothing: its last chosen task stays until another is
 * added, and a streak's one task is the streak, so it can't be removed.
 */
export async function unlinkGoalTask(goalId: string, taskId: string): Promise<void> {
  db.transaction((tx) => {
    const [row] = tx.select().from(goal).where(eq(goal.id, goalId)).all();
    if (!row) throw new Error(`No goal ${goalId}`);
    if (!takesChosenTasks(row)) throw new Error(`A ${row.kind} goal's tasks can't be changed.`);
    const links = tx.select().from(goalTask).where(eq(goalTask.goalId, goalId)).all();
    if (!links.some((l) => l.taskId === taskId)) {
      throw new Error(`Goal ${goalId} doesn't count ${taskId}`);
    }
    if (links.length === 1) throw new Error("Choose another task to count first.");
    tx.delete(goalTask)
      .where(and(eq(goalTask.goalId, goalId), eq(goalTask.taskId, taskId)))
      .run();
  });
}

/**
 * Pause, resume, set aside or revive a goal (ADR-0007 §1). Its tasks
 * are untouched: they belong to their units, and a paused goal only
 * stops collecting ticks.
 */
export async function changeGoalStatus(
  goalId: string,
  action: Exclude<GoalAction, "complete">,
): Promise<void> {
  db.transaction((tx) => {
    const [row] = tx.select().from(goal).where(eq(goal.id, goalId)).all();
    if (!row) throw new Error(`No goal ${goalId}`);
    tx.update(goal)
      .set({ status: nextGoalStatus(row.status, action), statusChangedAt: now() })
      .where(eq(goal.id, goalId))
      .run();
  });
}

/**
 * Finish a goal (ADR-0042 §3, ADR-0007 §2). Reaching a target only
 * invites this; it never happens by itself. The achievement goes to the
 * monthly summary, never a daily grade.
 */
export async function completeGoal(goalId: string): Promise<void> {
  db.transaction((tx) => {
    const [row] = tx.select().from(goal).where(eq(goal.id, goalId)).all();
    if (!row) throw new Error(`No goal ${goalId}`);
    const at = now();
    tx.update(goal)
      .set({ status: nextGoalStatus(row.status, "complete"), statusChangedAt: at })
      .where(eq(goal.id, goalId))
      .run();
    tx.insert(achievement)
      .values({ id: Crypto.randomUUID(), goalId, titleSnapshot: row.title, achievedAt: at })
      .run();
  });
}

/**
 * Delete goals with their links and entries. Achievements stay,
 * detached: they're a record of something that happened, and
 * `title_snapshot` keeps their name.
 */
export function forgetGoals(tx: Tx, goalIds: readonly string[]): void {
  if (goalIds.length === 0) return;
  const ids = [...goalIds];
  tx.update(achievement).set({ goalId: null }).where(inArray(achievement.goalId, ids)).run();
  tx.update(goal).set({ linkedFromGoalId: null }).where(inArray(goal.linkedFromGoalId, ids)).run();
  tx.delete(goalEntry).where(inArray(goalEntry.goalId, ids)).run();
  tx.delete(goalTask).where(inArray(goalTask.goalId, ids)).run();
  tx.delete(goal).where(inArray(goal.id, ids)).run();
}

/** The goals on these units, for deleting a commitment. */
export function goalIdsOn(tx: Tx, unitIds: readonly string[]): string[] {
  if (unitIds.length === 0) return [];
  return tx
    .select({ id: goal.id })
    .from(goal)
    .where(inArray(goal.unitId, [...unitIds]))
    .all()
    .map((g) => g.id);
}

/**
 * Links to tasks that are going away, a deleted commitment's. Its own
 * goals go with it, and a goal links only its own unit's tasks, so this
 * catches only a task that scored in the commitment from another home.
 */
export function forgetGoalLinksOf(tx: Tx, taskIds: readonly string[]): void {
  if (taskIds.length === 0) return;
  tx.delete(goalTask).where(inArray(goalTask.taskId, [...taskIds])).run();
}

export async function deleteGoal(goalId: string): Promise<void> {
  db.transaction((tx) => forgetGoals(tx, [goalId]));
}

// ── Progress ────────────────────────────────────────────────────────

export interface GoalSummary {
  id: string;
  unitId: string;
  title: string;
  kind: GoalKind;
  status: GoalStatus;
  targetDate: string | null;
  /** Linked tasks still in the plan. An archived task's past ticks
   *  still count, but it isn't listed (EC-36). */
  taskIds: string[];
  /** The running total: times, hours or points. For a streak, the run
   *  to show, or null under 7 days (ADR-0042 §2). */
  value: number | null;
  /** Null for a streak. */
  target: number | null;
  /** Invites completion; never completes by itself. */
  reached: boolean;
}

/**
 * Whether a streak's task was due on a day (ADR-0042 §2): in its
 * schedule and not skipped (ADR-0040), and, for an every-day task,
 * every such day. A task that has since stopped being every day counts
 * only its own pinned days (Henry, 2026-10-17). `isDueOn` alone won't
 * do: it reads an unpinned every-day task as due on no particular day,
 * which let a missed day pass without ending the run.
 */
function streakDue(
  t: typeof task.$inferSelect,
  skippedDates: ReadonlySet<string> | undefined,
): (date: string) => boolean {
  const bounds = { repeatFrom: t.repeatFrom, repeatUntil: t.repeatUntil, skippedDates };
  return (date) => inScheduleOn(bounds, date) && (t.timesPerWeek === 7 || isDueOn({ ...t, ...bounds }, date));
}

/**
 * Every goal with its progress (ADR-0042 §3): a running total with no
 * pace line. A streak counts only the days its task is due (Henry,
 * 2026-10-17), and is bridged by days off and Away days; a cleared day
 * is not one (EC-51). Read in one transaction, so a tick landing
 * meanwhile can't leave a goal's total and its tasks disagreeing.
 */
export async function loadGoals(): Promise<GoalSummary[]> {
  const today = currentLocalDate();
  const read = db.transaction((tx) => {
    const goals = definitions(tx, {
      statuses: ["active", "paused", "completed", "abandoned", "revised"],
    });
    if (goals.length === 0) return null;
    const anyStreak = goals.some((g) => g.row.kind === "streak");
    return {
      goals,
      entries: tx
        .select()
        .from(goalEntry)
        .where(inArray(goalEntry.goalId, goals.map((g) => g.row.id)))
        .all(),
      live: tx.select().from(task).where(eq(task.active, true)).all(),
      rest: anyStreak
        ? tx.select({ localDate: dayGrade.localDate }).from(dayGrade).where(eq(dayGrade.kind, "rest")).all()
        : [],
      away: anyStreak
        ? tx.select({ startDate: awayRange.startDate, endDate: awayRange.endDate }).from(awayRange).all()
        : [],
      skips: anyStreak
        ? tx
            .select({
              kind: scheduleSkip.kind,
              taskId: scheduleSkip.taskId,
              unitId: scheduleSkip.unitId,
              localDate: scheduleSkip.localDate,
              madeOn: scheduleSkip.madeOn,
            })
            .from(scheduleSkip)
            .all()
        : [],
      units: anyStreak
        ? tx
            .select({
              id: lifeUnit.id,
              parentUnitId: lifeUnit.parentUnitId,
              isCustom: lifeUnit.isCustom,
              commitmentShare: lifeUnit.commitmentShare,
            })
            .from(lifeUnit)
            .all()
        : [],
    };
  });
  if (!read) return [];
  const daysOff = [
    ...read.rest.map((r) => r.localDate),
    ...awayDatesBetween(read.away, "0000-01-01", today),
  ];
  const liveById = new Map(read.live.map((t) => [t.id, t]));
  const roots = commitmentRoots(read.units);
  const skipped = skippedDatesFor(
    read.skips,
    new Map(read.live.map((t) => [t.id, roots.get(t.unitId) ?? null])),
  );
  return read.goals.map(({ row, linked, definition }) => {
    const own = read.entries.filter((e) => e.goalId === row.id);
    const streakTask = row.kind === "streak" ? liveById.get(linked[0] ?? "") : undefined;
    const progress = row.kind === "streak" ? null : goalProgress(definition, own);
    const shown =
      row.kind === "streak"
        ? streakShown(
            goalStreak(own, {
              today,
              daysOff,
              isDue: streakTask ? streakDue(streakTask, skipped.get(streakTask.id)) : undefined,
            }),
          )
        : null;
    return {
      id: row.id,
      unitId: row.unitId,
      title: row.title,
      kind: row.kind,
      status: row.status,
      targetDate: row.targetDate,
      taskIds: linked.filter((id) => liveById.has(id)),
      value: progress ? progress.value : shown,
      target: progress ? progress.target : null,
      reached: progress?.reached ?? false,
    };
  });
}

/**
 * Tasks linked to an active goal: they rank third in suggestions, after
 * due and carried work (ADR-0042 §4, `planDay`'s `goalLinked`). Points
 * never move.
 */
export async function loadGoalLinkedTaskIds(): Promise<Set<string>> {
  const rows = await db
    .select({ taskId: goalTask.taskId })
    .from(goalTask)
    .innerJoin(goal, eq(goal.id, goalTask.goalId))
    .where(eq(goal.status, "active"));
  return new Set(rows.map((r) => r.taskId));
}
