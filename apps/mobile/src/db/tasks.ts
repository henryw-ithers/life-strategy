/**
 * The plan: units, their weights, and the tasks that spend them.
 *
 * A task's scoring membership lives in `task_unit`, one row per unit it
 * serves (ADR-0019). `task.unit_id` remains its **home** unit — where
 * it's grouped and listed — and always has a matching membership row.
 * `task.point_value` is kept as the sum of those rows so the scoring
 * engine and `task_completion` keep taking one number per task.
 */
import { spendableWeights, taskPointValues } from "@glide/scoring";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import {
  lifeArea,
  lifeUnit,
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
   * ADR-0025 §1. A `communal` unit is a **dimension, not a
   * container**: it holds no tasks and cannot be a task's home unit.
   * Anything may tag it instead, per completion.
   */
  motivationKind: "instrumental" | "communal";
  /** Effective weight from the latest snapshot; null when excluded. */
  weight: number | null;
  /**
   * What the unit actually has in play — its share of the 100 once the
   * weight of task-less units has been shared out (ADR-0003 §5
   * amendment). 0 for a unit with no tasks: `weight` is what it would
   * bring, `spendable` is what it currently spends.
   */
  spendable: number;
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

async function latestWeights(
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
  return new Map(
    rows.map((w) => [w.unitId, Math.round(w.override ?? w.derived)]),
  );
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

  // Only active tasks reach `memberships`, so this is coverage as the
  // scoring engine sees it.
  const covered = new Set(memberships.map((m) => m.unitId));
  const spendable = spendableWeights(
    units.map((u) => ({
      unitId: u.id,
      weight: u.includeInScoring ? (weights.get(u.id) ?? 0) : 0,
      covered: covered.has(u.id),
    })),
  );

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
          spendable: spendable.get(u.id) ?? 0,
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
 * What each unit has in play: derived weights with the share held by
 * units that have no tasks divided among the ones that do (ADR-0003 §5
 * amendment). A unit with no tasks spent nothing — `dayShare` only
 * counts tasks that exist — so a half-covered portfolio graded against
 * half a plan.
 *
 * The consequence for this module: a unit's task points can no longer
 * be derived from that unit alone. Whether *any other* unit has a task
 * moves the scale, so every recompute is a whole-portfolio recompute.
 */
async function spendableWeightMap(tx: Tx): Promise<Map<string, number>> {
  const weights = await latestWeights(tx);
  const units = await tx.select({ id: lifeUnit.id }).from(lifeUnit);
  const covered = await tx
    .selectDistinct({ unitId: taskUnit.unitId })
    .from(taskUnit)
    .innerJoin(task, eq(task.id, taskUnit.taskId))
    .where(eq(task.active, true));
  const coveredIds = new Set(covered.map((c) => c.unitId));

  return spendableWeights(
    units.map((u) => ({
      unitId: u.id,
      // No weight row means the unit is out of scoring (or predates the
      // latest snapshot); `spendableWeights` leaves those at zero.
      weight: weights.get(u.id) ?? 0,
      covered: coveredIds.has(u.id),
    })),
  );
}

/**
 * Split one unit's spendable weight across its ranked tasks, then
 * refresh the `task.point_value` cache for every task it touched — a
 * shared task's total is the sum of its memberships, so changing one
 * unit's ranking moves its total in the other unit's list too.
 *
 * Private: callers can't be trusted to know whether the portfolio-wide
 * scale still holds, and it usually doesn't. Use `recomputeAllUnitPoints`.
 */
async function applyUnitPoints(
  tx: Tx,
  unitId: string,
  weight: number,
): Promise<void> {
  const rows = await tx
    .select({ taskId: taskUnit.taskId, rankInUnit: taskUnit.rankInUnit })
    .from(taskUnit)
    .innerJoin(task, eq(task.id, taskUnit.taskId))
    .where(and(eq(taskUnit.unitId, unitId), eq(task.active, true)))
    .orderBy(asc(taskUnit.rankInUnit));
  if (rows.length === 0) return;

  const points = taskPointValues(weight, rows.length);
  for (const [i, r] of rows.entries()) {
    await tx
      .update(taskUnit)
      .set({ pointValue: points[i] ?? 0, rankInUnit: i + 1 })
      .where(and(eq(taskUnit.taskId, r.taskId), eq(taskUnit.unitId, unitId)));
  }

  for (const r of rows) await refreshTaskTotal(tx, r.taskId);
}

/**
 * Re-derive every unit's task points. Runs whenever the weights move (a
 * new diagnostic, a manual re-rank via `applyPriorityOrder`) **and
 * whenever any task is added, archived, restored, re-ranked, or
 * re-homed** — since the amendment above, the first task in a unit and
 * the last one out both rescale the entire plan.
 *
 * `loadPlan` and `loadDay` both read the stored `task.point_value`, so
 * anything that skips this leaves the checklist scoring against a plan
 * that no longer exists.
 */
export async function recomputeAllUnitPoints(tx: Tx): Promise<void> {
  const spendable = await spendableWeightMap(tx);
  const units = await tx.select({ id: lifeUnit.id }).from(lifeUnit);
  for (const u of units) {
    await applyUnitPoints(tx, u.id, spendable.get(u.id) ?? 0);
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
 * Returns the new task's id so the caller can point at it; null when
 * there is no home unit to file it under.
 */
export async function addTask(
  unitIds: string[],
  title: string,
  timesPerWeek: number,
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

export async function setTaskFrequency(
  taskId: string,
  timesPerWeek: number,
): Promise<void> {
  await db.update(task).set({ timesPerWeek }).where(eq(task.id, taskId));
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
