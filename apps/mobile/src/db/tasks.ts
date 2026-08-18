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
  bandPointValues,
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
 * Re-derive every task's point value across the whole plan at once
 * (ADR-0027 §1). Runs whenever weights move (a new diagnostic, a
 * manual re-rank) **and whenever any task is added, archived, restored,
 * re-ranked, or re-homed** — the variable band is one pool shared by
 * every non-daily task in the portfolio, so adding a weekly task in one
 * unit can move what a weekly task in another unit is worth.
 *
 * Each membership (`task_unit` row) is priced separately and keyed by
 * `taskId::unitId`, since a task serving two units takes a rank and
 * earns a share in each (ADR-0019). Ranks are normalized to 1..n first
 * — closing the gap a delete or a unit change leaves — because
 * `bandPointValues` reads rank order, not the stored numbers.
 *
 * **No reallocation** (ADR-0027 §2): a unit's weight is 0 the moment it
 * is excluded, never scaled up because some other unit has nothing to
 * spend its own weight on. A unit with no tasks simply prices nothing.
 *
 * `loadPlan` and `loadDay` both read the stored `task.point_value`, so
 * anything that skips this leaves the checklist scoring against a plan
 * that no longer exists.
 */
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
  const timesPerWeekByTask = new Map(
    (await tx.select({ id: task.id, timesPerWeek: task.timesPerWeek }).from(task)).map(
      (t) => [t.id, t.timesPerWeek],
    ),
  );

  // Normalize each unit's ranks to 1..n before pricing, so a gap left
  // by an archive or a unit change never reaches `bandPointValues`.
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
  const bandTasks: BandTask[] = memberships.map((m) => ({
    id: `${m.taskId}::${m.unitId}`,
    unitId: m.unitId,
    timesPerWeek: timesPerWeekByTask.get(m.taskId) ?? 7,
    rankInUnit: normalizedRank.get(`${m.taskId}::${m.unitId}`) ?? m.rankInUnit,
  }));
  const points = bandPointValues(bandUnits, bandTasks);

  const touched = new Set<string>();
  for (const m of memberships) {
    const key = `${m.taskId}::${m.unitId}`;
    await tx
      .update(taskUnit)
      .set({
        pointValue: points.get(key) ?? 0,
        rankInUnit: normalizedRank.get(key) ?? m.rankInUnit,
      })
      .where(and(eq(taskUnit.taskId, m.taskId), eq(taskUnit.unitId, m.unitId)));
    touched.add(m.taskId);
  }
  for (const taskId of touched) await refreshTaskTotal(tx, taskId);
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
export async function addTask(
  unitIds: string[],
  title: string,
  timesPerWeek: number,
  plannedWeekdays: string | null = null,
  partOfDay: "morning" | "afternoon" | "evening" | null = null,
  goalId: string | null = null,
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
      timesPerWeek,
      plannedWeekdays,
      partOfDay,
      goalId,
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
export async function setTaskFortnightOffset(
  taskId: string,
  offset: 0 | 1,
): Promise<void> {
  await db.update(task).set({ fortnightOffset: offset }).where(eq(task.id, taskId));
}
