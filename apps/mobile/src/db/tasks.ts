/**
 * The plan: units, their weights, and the tasks that spend them.
 *
 * A task's scoring membership lives in `task_unit`, one row per unit it
 * serves (ADR-0019). `task.unit_id` remains its **home** unit — where
 * it's grouped and listed — and always has a matching membership row.
 * `task.point_value` is kept as the sum of those rows so the scoring
 * engine and `task_completion` keep taking one number per task.
 */
import {
  taskWeights,
  DAILY_BUDGET,
  largestRemainder,
  type BandTask,
  type BandUnit,
} from "@glide/scoring";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import {
  lifeArea,
  lifeUnit,
  rating,
  snapshot,
  task,
  taskUnit,
  unitWeight,
} from "./schema";

export interface PlanTask {
  id: string;
  title: string;
  /** What the task involves; null when never written. Never scored. */
  description: string | null;
  /** Times per week: 1–7 (7 = daily); 0 = once every two weeks. */
  timesPerWeek: number;
  /** `"1,3,5"`, or null for flexible (ADR-0024). Never scored. */
  plannedWeekdays: string | null;
  /** Null is *Anytime*. Never scored. */
  partOfDay: "morning" | "afternoon" | "evening" | null;
  /** Which half of the fortnight a fortnightly task falls in. */
  fortnightOffset: number;
  /** The goal this serves, or null. A grouping, never a scoring
   *  input (ADR-0007) — points come from the unit either way. */
  goalId: string | null;
  /** Total across every unit this task serves. */
  pointValue: number;
  /** Rank within the unit it's being listed under. */
  rankInUnit: number;
  /** Every unit it serves, home unit first. */
  unitIds: string[];
  /** Names of the other units, for the "also counts toward" line. */
  otherUnitNames: string[];
  /** Non-null marks a one-off; the value is how it was sized. */
  oneOffSize: "quick" | "normal" | "big" | null;
  /** The day it is meant for, or null for no particular day. */
  oneOffDate: string | null;
  /** Its deadline, or null. */
  oneOffDue: string | null;
}

export interface PlanUnit {
  id: string;
  name: string;
  areaId: string;
  includeInScoring: boolean;
  /**
   * ADR-0025 §1, narrowed by ADR-0027 §4. A `communal` unit is still
   * editorial context — the Relationships units warrant a note that
   * planning them like a chore list has a cost — but it no longer
   * changes how anything is scored or whether it can hold a task.
   */
  motivationKind: "instrumental" | "communal";
  /**
   * Effective weight from the latest snapshot; null when excluded.
   *
   * **Not scaled by coverage** (ADR-0027 §2 withdraws ADR-0003 §5's
   * reallocation). A unit with no daily task keeps this number and
   * simply cannot earn it — nobody else receives it either — so it is
   * the same figure whether the unit holds ten tasks or none, and the
   * area and Tasks-screen totals sum to 100 again.
   */
  weight: number | null;
  tasks: PlanTask[];
}

export interface PlanArea {
  id: string;
  name: string;
  units: PlanUnit[];
}

export interface PlanData {
  hasSnapshot: boolean;
  areas: PlanArea[];
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The latest snapshot's weights, **renormalized over the units that are
 * currently in scoring** (ADR-0027 §2).
 *
 * Exclusion is a property of the unit, not of a snapshot, so this is
 * where it takes effect: the stored rows are never edited and the
 * portfolio history stays a record of what was diagnosed, while today's
 * plan reads the same weights spread across whatever is still included.
 * Without this step, excluding a 12-point unit would leave the plan
 * totalling 88 rather than handing those points to the rest — and §2
 * only works because "this doesn't apply to me" genuinely removes a
 * unit from the 100.
 *
 * Integer weights summing to exactly 100, via the same largest-remainder
 * rounding the derivation uses (ADR-0003 §3).
 */
export async function latestWeights(
  dbOrTx: Tx | typeof db,
): Promise<Map<string, number>> {
  const [latest] = await dbOrTx
    .select()
    .from(snapshot)
    .orderBy(desc(snapshot.takenAt))
    .limit(1);
  if (!latest) return new Map();
  const rows = await dbOrTx
    .select()
    .from(unitWeight)
    .where(eq(unitWeight.snapshotId, latest.id));
  const included = new Set(
    (
      await dbOrTx
        .select({ id: lifeUnit.id, includeInScoring: lifeUnit.includeInScoring })
        .from(lifeUnit)
    )
      .filter((u) => u.includeInScoring)
      .map((u) => u.id),
  );

  const kept = rows.filter((w) => included.has(w.unitId));
  const raw = kept.map((w) => w.override ?? w.derived);
  const total = raw.reduce((a, b) => a + b, 0);
  if (total <= 0) return new Map();

  const exacts = raw.map((v) => (DAILY_BUDGET * v) / total);
  const scaled = largestRemainder(exacts, DAILY_BUDGET);
  return new Map(kept.map((w, i) => [w.unitId, scaled[i] ?? 0]));
}

export async function loadPlan(): Promise<PlanData> {
  const weights = await latestWeights(db);
  const areas = await db
    .select()
    .from(lifeArea)
    .where(isNull(lifeArea.archivedAt))
    .orderBy(asc(lifeArea.sortOrder));
  const units = await db
    .select()
    .from(lifeUnit)
    .where(isNull(lifeUnit.archivedAt))
    .orderBy(asc(lifeUnit.sortOrder));
  const tasks = await db.select().from(task).where(eq(task.active, true));
  const memberships = tasks.length
    ? await db
        .select()
        .from(taskUnit)
        .where(
          inArray(
            taskUnit.taskId,
            tasks.map((t) => t.id),
          ),
        )
    : [];

  const unitName = new Map(units.map((u) => [u.id, u.name]));
  const byTask = new Map<string, typeof memberships>();
  for (const m of memberships) {
    byTask.set(m.taskId, [...(byTask.get(m.taskId) ?? []), m]);
  }

  return {
    hasSnapshot: weights.size > 0,
    areas: areas.map((area) => ({
      id: area.id,
      name: area.name,
      units: units
        .filter((u) => u.areaId === area.id)
        .map((u) => ({
          id: u.id,
          name: u.name,
          areaId: u.areaId,
          includeInScoring: u.includeInScoring,
          motivationKind: u.motivationKind,
          weight: u.includeInScoring ? (weights.get(u.id) ?? null) : null,
          // A task is listed under every unit it serves, ranked by that
          // unit's own membership — not only its home unit.
          tasks: memberships
            .filter((m) => m.unitId === u.id)
            .map((m) => {
              const t = tasks.find((x) => x.id === m.taskId)!;
              const mine = byTask.get(t.id) ?? [];
              return {
                id: t.id,
                title: t.title,
                description: t.description,
                timesPerWeek: t.timesPerWeek,
                plannedWeekdays: t.plannedWeekdays,
                partOfDay: t.partOfDay,
                fortnightOffset: t.fortnightOffset,
                oneOffSize: t.oneOffSize,
                oneOffDate: t.oneOffDate,
                oneOffDue: t.oneOffDue,
                goalId: t.goalId,
                pointValue: t.pointValue,
                rankInUnit: m.rankInUnit,
                unitIds: [
                  t.unitId,
                  ...mine.map((x) => x.unitId).filter((id) => id !== t.unitId),
                ],
                otherUnitNames: mine
                  .filter((x) => x.unitId !== u.id)
                  .map((x) => unitName.get(x.unitId) ?? x.unitId),
              };
            })
            .sort((a, b) => a.rankInUnit - b.rankInUnit),
        })),
    })),
  };
}

/**
 * Re-derive every task's **weight** across the whole plan at once
 * (ADR-0029 §1). Runs whenever weights move (a new diagnostic, a manual
 * re-rank) and whenever any task is added, archived, restored,
 * re-ranked, or re-homed — a unit divides its weight across the tasks
 * it holds, so adding one changes what its siblings are worth.
 *
 * **`point_value` stores a weight now, not points.** A task's worth in
 * points is a property of the day it is done on — `PLANNED_BAND × its
 * weight ÷ that day's expected load` — because a day is graded on the
 * fraction of itself you got through. The column keeps its name (the
 * schema is forward-only, ADR-0002) and keeps summing to 100 across the
 * portfolio, which is what the Tasks screen's right column shows.
 *
 * Each membership (`task_unit` row) is priced separately and keyed by
 * `taskId::unitId`, since a task serving two units takes a rank and
 * earns a share in each (ADR-0019). Ranks are normalized to 1..n first
 * — closing the gap a delete or a unit change leaves — because
 * `taskWeights` reads rank order, not the stored numbers.
 *
 * **Cadence does not appear here at all** (ADR-0029 §2). A daily task
 * and a weekly one in the same unit are priced by rank alone; how often
 * each is *due* is the day loader's business. An **excluded** unit is
 * weight 0 and prices nothing — a statement about scope, not cadence.
 *
 * `loadPlan` and `loadDay` both read the stored `task.point_value`, so
 * anything that skips this leaves the checklist scoring against a plan
 * that no longer exists.
 */
/**
 * What share of its unit's weight a one-off run claims. The same three
 * ratios logged activities use, so the sizes mean the same thing
 * wherever they appear: a *big* errand is worth about what a week of
 * planned work in that unit is worth, and a *quick* one a quarter of
 * that.
 */
const ONE_OFF_SIZE_RATE: Record<"quick" | "normal" | "big", number> = {
  quick: 0.25,
  normal: 0.5,
  big: 1,
};

export async function recomputeAllUnitPoints(tx: Tx): Promise<void> {
  const weights = await latestWeights(tx);
  const units = await tx
    .select({ id: lifeUnit.id, includeInScoring: lifeUnit.includeInScoring })
    .from(lifeUnit);
  const memberships = await tx
    .select({
      taskId: taskUnit.taskId,
      unitId: taskUnit.unitId,
      rankInUnit: taskUnit.rankInUnit,
    })
    .from(taskUnit)
    .innerJoin(task, eq(task.id, taskUnit.taskId))
    .where(eq(task.active, true))
    .orderBy(asc(taskUnit.rankInUnit));
  // One read of the per-task columns this pass needs. `unitId` is the
  // home unit, which decides whose rank lands back on `task`.
  const taskRows = await tx
    .select({
      id: task.id,
      timesPerWeek: task.timesPerWeek,
      unitId: task.unitId,
      oneOffSize: task.oneOffSize,
    })
    .from(task);
  const oneOffSizeByTask = new Map(taskRows.map((t) => [t.id, t.oneOffSize]));
  const homeUnitByTask = new Map(taskRows.map((t) => [t.id, t.unitId]));

  // Normalize each unit's ranks to 1..n before pricing, so a gap left
  // by an archive or a unit change never reaches `taskWeights`.
  const normalizedRank = new Map<string, number>();
  for (const unitId of new Set(memberships.map((m) => m.unitId))) {
    memberships
      .filter((m) => m.unitId === unitId)
      .sort((a, b) => a.rankInUnit - b.rankInUnit)
      .forEach((m, i) => normalizedRank.set(`${m.taskId}::${m.unitId}`, i + 1));
  }

  const bandUnits: BandUnit[] = units.map((u) => ({
    unitId: u.id,
    weight: u.includeInScoring ? (weights.get(u.id) ?? 0) : 0,
  }));
  // One-offs never enter the recurring allocation. If they did, every
  // other non-daily task in their unit would lose value while an errand
  // sat on the list and regain it the moment it was ticked — the same
  // instability ADR-0027's amendment took out of the variable band,
  // reappearing over time instead of across units. They are priced
  // below instead, from the unit's own variable day rate.
  const bandTasks: BandTask[] = memberships
    .filter((m) => oneOffSizeByTask.get(m.taskId) == null)
    .map((m) => ({
      id: `${m.taskId}::${m.unitId}`,
      unitId: m.unitId,
      rankInUnit: normalizedRank.get(`${m.taskId}::${m.unitId}`) ?? m.rankInUnit,
    }));
  const points = taskWeights(bandUnits, bandTasks);

  /**
   * A one-off's weight: its size against **its unit's own weight**, so
   * a big errand carries about what a week of planned work in that part
   * of your life carries, and a quick one a quarter of it.
   *
   * Computed **outside `taskWeights`**, so a one-off appearing or being
   * ticked off never moves a recurring task's weight. That is the
   * property this whole design exists to protect: an errand on the list
   * must not quietly devalue the habits beside it.
   *
   * A floor of one, for ADR-0003 §5's reason — a zero-weight row cannot
   * move the number, so it is not a task.
   */
  for (const m of memberships) {
    const size = oneOffSizeByTask.get(m.taskId);
    if (size == null) continue;
    const weight = bandUnits.find((u) => u.unitId === m.unitId)?.weight ?? 0;
    points.set(
      `${m.taskId}::${m.unitId}`,
      weight > 0 ? Math.max(1, Math.round(ONE_OFF_SIZE_RATE[size] * weight)) : 0,
    );
  }

  // Totals are summed here rather than re-read per task. This used to
  // call `refreshTaskTotal` in a second loop, which cost three more
  // queries each (memberships, the task row, the update) to recompute
  // numbers this function had just produced. Against the 110-task
  // content library that was roughly 440 serial round trips inside one
  // transaction, on every add, edit, re-rank and goal change — all of
  // it derivable from `points` and `normalizedRank` without touching
  // the database again.
  const totalByTask = new Map<string, number>();
  for (const m of memberships) {
    const key = `${m.taskId}::${m.unitId}`;
    const value = points.get(key) ?? 0;
    await tx
      .update(taskUnit)
      .set({
        pointValue: value,
        rankInUnit: normalizedRank.get(key) ?? m.rankInUnit,
      })
      .where(and(eq(taskUnit.taskId, m.taskId), eq(taskUnit.unitId, m.unitId)));
    totalByTask.set(m.taskId, (totalByTask.get(m.taskId) ?? 0) + value);
  }

  for (const [taskId, total] of totalByTask) {
    const home = homeUnitByTask.get(taskId);
    const homeRank = home
      ? normalizedRank.get(`${taskId}::${home}`)
      : undefined;
    await tx
      .update(task)
      .set({ pointValue: total, ...(homeRank ? { rankInUnit: homeRank } : {}) })
      .where(eq(task.id, taskId));
  }
}

/** `task.point_value` = the sum of its memberships. */
async function refreshTaskTotal(tx: Tx, taskId: string): Promise<void> {
  const mine = await tx.select().from(taskUnit).where(eq(taskUnit.taskId, taskId));
  const total = mine.reduce((sum, m) => sum + m.pointValue, 0);
  const home = await tx.select().from(task).where(eq(task.id, taskId));
  const homeUnitId = home[0]?.unitId;
  const homeRank = mine.find((m) => m.unitId === homeUnitId)?.rankInUnit;
  await tx
    .update(task)
    .set({ pointValue: total, ...(homeRank ? { rankInUnit: homeRank } : {}) })
    .where(eq(task.id, taskId));
}

/** Append the task to each unit's ranking, then recompute those units. */
async function attachUnits(
  tx: Tx,
  taskId: string,
  unitIds: string[],
  rankByUnit?: Record<string, number>,
): Promise<void> {
  for (const unitId of unitIds) {
    const siblings = await tx
      .select()
      .from(taskUnit)
      .where(eq(taskUnit.unitId, unitId));
    const rank = rankByUnit?.[unitId] ?? siblings.length + 1;
    for (const s of siblings) {
      if (s.rankInUnit >= rank) {
        await tx
          .update(taskUnit)
          .set({ rankInUnit: s.rankInUnit + 1 })
          .where(and(eq(taskUnit.taskId, s.taskId), eq(taskUnit.unitId, unitId)));
      }
    }
    await tx
      .insert(taskUnit)
      .values({ taskId, unitId, rankInUnit: rank, pointValue: 0 });
  }
  await recomputeAllUnitPoints(tx);
}

/**
 * Create a task. `unitIds[0]` is the home unit, and the task appends to
 * the end of every unit's order.
 *
 * Rank is not asked for at creation. It used to be — a pairwise
 * comparison ran before the task existed — but ranking a thing you are
 * still in the middle of writing down is the wrong moment for it: the
 * cost lands on every single add, and capture is the part that has to
 * stay cheap. The task lands last, and the screen opens its unit with
 * the row's drag handle right there.
 *
 * The day plan arrives with the task (ADR-0024 §1 as amended
 * 2026-08-17) rather than being added on a later visit to the edit
 * sheet: `plannedWeekdays` is `"1,3,5"` or null for flexible, and
 * `partOfDay` null is *Anytime*. Both are presentation and defaults
 * only — neither reaches the grade, here or anywhere.
 *
 * Returns the new task's id so the caller can point at it; null when
 * there is no home unit to file it under.
 */
export interface OneOff {
  size: "quick" | "normal" | "big";
  /** The day you mean to do it. Null is "no particular day". */
  date: string | null;
  /** Optional deadline; informational only. */
  due: string | null;
}

export async function addTask(
  unitIds: string[],
  title: string,
  timesPerWeek: number,
  plannedWeekdays: string | null = null,
  partOfDay: "morning" | "afternoon" | "evening" | null = null,
  goalId: string | null = null,
  oneOff: OneOff | null = null,
): Promise<string | null> {
  const home = unitIds[0];
  if (!home) return null;
  const id = Crypto.randomUUID();
  await db.transaction(async (tx) => {
    const siblings = await tx
      .select()
      .from(taskUnit)
      .where(eq(taskUnit.unitId, home));
    await tx.insert(task).values({
      id,
      unitId: home,
      title,
      // A one-off has no cadence, but the column is NOT NULL. 1 is the
      // safe value to park it at: if anything ever reads it without
      // checking `oneOffSize`, it lands in the variable band rather
      // than being mistaken for a daily habit worth routine points.
      timesPerWeek: oneOff ? 1 : timesPerWeek,
      plannedWeekdays: oneOff ? null : plannedWeekdays,
      partOfDay,
      goalId,
      oneOffSize: oneOff?.size ?? null,
      oneOffDate: oneOff?.date ?? null,
      oneOffDue: oneOff?.due ?? null,
      pointValue: 0,
      rankInUnit: siblings.length + 1,
    });
    await attachUnits(tx, id, unitIds);
  });
  return id;
}

/** Replace a task's unit membership wholesale (from the edit sheet). */
export async function setTaskUnits(
  taskId: string,
  unitIds: string[],
): Promise<void> {
  const home = unitIds[0];
  if (!home) return;
  await db.transaction(async (tx) => {
    const current = await tx.select().from(taskUnit).where(eq(taskUnit.taskId, taskId));
    const currentIds = current.map((m) => m.unitId);
    const removed = currentIds.filter((id) => !unitIds.includes(id));
    const added = unitIds.filter((id) => !currentIds.includes(id));

    for (const unitId of removed) {
      await tx
        .delete(taskUnit)
        .where(and(eq(taskUnit.taskId, taskId), eq(taskUnit.unitId, unitId)));
    }
    await tx.update(task).set({ unitId: home }).where(eq(task.id, taskId));
    if (added.length) await attachUnits(tx, taskId, added);
    // Closes the rank gap in the units it left, and rescales the plan
    // if it left one of them with nothing.
    await recomputeAllUnitPoints(tx);
    await refreshTaskTotal(tx, taskId);
  });
}

/** Reorder one unit's tasks; `orderedTaskIds` is rank 1 first. */
export async function reorderUnitTasks(
  unitId: string,
  orderedTaskIds: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [i, taskId] of orderedTaskIds.entries()) {
      await tx
        .update(taskUnit)
        .set({ rankInUnit: i + 1 })
        .where(and(eq(taskUnit.taskId, taskId), eq(taskUnit.unitId, unitId)));
    }
    await recomputeAllUnitPoints(tx);
  });
}

/** Title and description are edited in the same sheet, so they save
 *  together — two calls would be two writes for one gesture. An empty
 *  description stores as null: "" and "never written" mean the same
 *  thing here, and only one of them needs representing. */
export async function setTaskDetails(
  taskId: string,
  title: string,
  description: string | null,
): Promise<void> {
  await db
    .update(task)
    .set({ title, description: description?.trim() ? description.trim() : null })
    .where(eq(task.id, taskId));
}

export async function archiveTask(taskId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(task)
      .set({ active: false, archivedAt: new Date().toISOString() })
      .where(eq(task.id, taskId));
    // Deleting the last task in a unit hands its weight to the rest of
    // the plan, so this reaches past the units the task belonged to.
    await recomputeAllUnitPoints(tx);
  });
}

/** Undo an archive — the same rank slots reopen (ADR-0002 soft delete). */
export async function restoreTask(taskId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(task)
      .set({ active: true, archivedAt: null })
      .where(eq(task.id, taskId));
    await recomputeAllUnitPoints(tx);
  });
}

/**
 * Frequency now decides which **band** a task is paid from (ADR-0027
 * §1), so this rescales the whole plan rather than just writing a
 * column. Under formula v6 frequency only moved the denominator and
 * this was a bare update; leaving it that way meant promoting a weekly
 * task to daily changed nothing about what it was worth, because its
 * stored `point_value` still came from the variable band.
 */
export async function setTaskFrequency(
  taskId: string,
  timesPerWeek: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(task).set({ timesPerWeek }).where(eq(task.id, taskId));
    await recomputeAllUnitPoints(tx);
  });
}

/**
 * Weekday pins and part of day (ADR-0024 §1).
 *
 * Presentation and defaults only — this never reaches the grade.
 * `times_per_week` stays the sole scoring input, so doing three runs on
 * three days you did not plan is a perfect week. Nothing here is read
 * by `computeDayScore`, and no adherence statistic is derived from it
 * anywhere (ADR-0024 §2, which makes that an invariant).
 */
export async function setTaskPlanning(
  taskId: string,
  plannedWeekdays: string | null,
  partOfDay: "morning" | "afternoon" | "evening" | null,
): Promise<void> {
  await db
    .update(task)
    .set({ plannedWeekdays, partOfDay })
    .where(eq(task.id, taskId));
}

/**
 * Put a unit in or out of scoring — the exclusion valve (ADR-0027 §2).
 *
 * This is the whole answer to "my ceiling is 64 and I can't reach it".
 * Since §2 withdrew the reallocation, a unit you hold no tasks in keeps
 * its weight and nobody earns it, so the app has to let you say *this
 * one doesn't apply to me* — the difference between "I'm ignoring
 * Friendship" and "I don't have a partner". Excluding drops the unit
 * from the 100 and the remaining weights re-derive over what's left;
 * including it puts the weight back.
 *
 * The consequence is recorded rather than hidden: this makes the
 * ceiling **as hard as the user chooses**, since anyone can exclude
 * their way back to a reachable 100. Scope is negotiable; the routine
 * band is not, so no amount of excluding buys a 100 for a plan of two
 * weekly tasks.
 *
 * `include_in_scoring` lives on the unit, not on a snapshot, so this
 * writes no snapshot and never edits one — the portfolio history stays
 * a record of what was diagnosed, and the graph keeps plotting an
 * excluded unit greyed and marked *not scored*.
 */
export async function setUnitScoring(
  unitId: string,
  includeInScoring: boolean,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(lifeUnit)
      .set({ includeInScoring })
      .where(eq(lifeUnit.id, unitId));
    // A unit joining or leaving the 100 rescales every task in the
    // plan — the routine band is a share of each unit's weight and the
    // variable band is one pool across all of them.
    await recomputeAllUnitPoints(tx);
  });
}

/**
 * Point a task at a goal, or detach it (`null`).
 *
 * `task.goal_id` has been in the schema since ADR-0002 and was read in
 * four places — the goal screen lists what serves it, abandonment and
 * completion detach it — but **nothing ever wrote it**, so a task
 * could only ever arrive at a goal by being created there. This is the
 * other half: an existing task can join one, or leave.
 *
 * Points do not move. A goal is a grouping, never a scoring input
 * (ADR-0007): a task earns from its unit's band share whether or not
 * it serves a goal, so there is nothing to recompute here.
 */
export async function setTaskGoal(
  taskId: string,
  goalId: string | null,
): Promise<void> {
  await db.update(task).set({ goalId }).where(eq(task.id, taskId));
}

/**
 * The latest diagnostic's raw ratings, for deciding a unit's profile
 * (ADR-0006 §1). Weights alone can't: two units on 12 points can be
 * "important and going badly" and "important and going well", which
 * want different suggestions.
 */
export async function latestRatings(): Promise<
  Map<string, { importance: number; satisfaction: number }>
> {
  const [latest] = await db
    .select()
    .from(snapshot)
    .orderBy(desc(snapshot.takenAt))
    .limit(1);
  if (!latest) return new Map();
  const rows = await db
    .select()
    .from(rating)
    .where(eq(rating.snapshotId, latest.id));
  return new Map(
    rows.map((r) => [
      r.unitId,
      { importance: r.importance, satisfaction: r.satisfaction },
    ]),
  );
}

/**
 * Persist the order the daily checklist shows, within one part of the
 * day (ADR-0024 §3 as amended 2026-08-18).
 *
 * `orderedTaskIds` is the section top-first. Writes `day_order` on the
 * task itself, so the arrangement survives into tomorrow — Henry's
 * requirement, and the reason this is not a `planned_occurrence`.
 *
 * Touches no points. `rank_in_unit` still prices the task; this only
 * decides where the row sits, and the two are deliberately separate.
 */
export async function reorderDayTasks(
  orderedTaskIds: readonly string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [i, taskId] of orderedTaskIds.entries()) {
      await tx.update(task).set({ dayOrder: i + 1 }).where(eq(task.id, taskId));
    }
  });
}

/**
 * Move a task to a different part of the day — permanently.
 *
 * The other half of the same gesture lives in `db/today.ts` as
 * `placeTaskForDay`, which changes only the day in front of you. Which
 * one runs is the user's answer to a prompt (Henry, 2026-08-18: "we can
 * have a quick prompt to ask if they want this scheduling to be
 * permanent or just for today").
 *
 * Presentation only, like everything else ADR-0024 added: the part of
 * day never reaches `computeDayScore`.
 */
export async function setTaskPartOfDay(
  taskId: string,
  partOfDay: "morning" | "afternoon" | "evening" | null,
): Promise<void> {
  await db.update(task).set({ partOfDay }).where(eq(task.id, taskId));
}

/**
 * Flip which week of the fortnight a fortnightly task falls on
 * (ADR-0024 §1 as amended 2026-08-18) — "this week" versus "next".
 *
 * Only meaningful for a task with `times_per_week` 0 and weekdays
 * pinned; everything else ignores the column. Presentation only: it
 * moves which day the row appears on and never what the task is worth.
 */
/**
 * Change a one-off's size, day, or deadline.
 *
 * Size is the reason this recomputes rather than writing one row: a
 * one-off's point value is its size against its unit's variable budget,
 * so moving Quick to Big has to reprice it. The dates are presentation
 * and change nothing about what it is worth, but they travel with the
 * size because a person edits all three in one sheet and one commit.
 *
 * Cadence is deliberately not editable. Converting a task with
 * completions between recurring and one-off would strand its history:
 * a recurring task turned one-off would count as already settled and
 * vanish the moment it was saved.
 */
export async function setTaskOneOff(
  taskId: string,
  size: "quick" | "normal" | "big",
  date: string | null,
  due: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(task)
      .set({ oneOffSize: size, oneOffDate: date, oneOffDue: due })
      .where(eq(task.id, taskId));
    await recomputeAllUnitPoints(tx);
  });
}

export async function setTaskFortnightOffset(
  taskId: string,
  offset: 0 | 1,
): Promise<void> {
  await db.update(task).set({ fortnightOffset: offset }).where(eq(task.id, taskId));
}
