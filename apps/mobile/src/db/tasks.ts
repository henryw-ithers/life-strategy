/**
 * The plan: units, their weights, and the tasks that spend them.
 *
 * A task's scoring membership lives in `task_unit`, one row per unit it
 * serves (ADR-0019). `task.unit_id` remains its **home** unit — where
 * it's grouped and listed — and always has a matching membership row.
 * `task.point_value` is kept as the sum of those rows so the scoring
 * engine and `task_completion` keep taking one number per task.
 */
import { taskPointValues } from "@life-strategy/scoring";
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
  /** Times per week: 1–7 (7 = daily); 0 = once every two weeks. */
  timesPerWeek: number;
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
  /** Effective weight from the latest snapshot; null when excluded. */
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
                timesPerWeek: t.timesPerWeek,
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
 * Re-derive one unit's task points from rank shares (ADR-0003), then
 * refresh the `task.point_value` cache for every task it touched — a
 * shared task's total is the sum of its memberships, so changing one
 * unit's ranking moves its total in the other unit's list too.
 */
export async function recomputeUnitPoints(tx: Tx, unitId: string): Promise<void> {
  const weights = await latestWeights(tx);
  const weight = weights.get(unitId) ?? 0;

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
  for (const unitId of unitIds) await recomputeUnitPoints(tx, unitId);
}

/**
 * Create a task. `unitIds[0]` is the home unit; `rank` places it in
 * that unit's order (from the comparison flow), and it appends to the
 * end of any additional units' orders.
 */
export async function addTask(
  unitIds: string[],
  title: string,
  timesPerWeek: number,
  rank: number,
): Promise<void> {
  const home = unitIds[0];
  if (!home) return;
  await db.transaction(async (tx) => {
    const id = Crypto.randomUUID();
    await tx.insert(task).values({
      id,
      unitId: home,
      title,
      timesPerWeek,
      pointValue: 0,
      rankInUnit: rank,
    });
    await attachUnits(tx, id, unitIds, { [home]: rank });
  });
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
    // Removing a task closes a rank gap in the units it left.
    for (const unitId of removed) await recomputeUnitPoints(tx, unitId);
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
    await recomputeUnitPoints(tx, unitId);
  });
}

export async function renameTask(taskId: string, title: string): Promise<void> {
  await db.update(task).set({ title }).where(eq(task.id, taskId));
}

export async function archiveTask(taskId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const mine = await tx.select().from(taskUnit).where(eq(taskUnit.taskId, taskId));
    await tx
      .update(task)
      .set({ active: false, archivedAt: new Date().toISOString() })
      .where(eq(task.id, taskId));
    for (const m of mine) await recomputeUnitPoints(tx, m.unitId);
  });
}

/** Undo an archive — the same rank slots reopen (ADR-0002 soft delete). */
export async function restoreTask(taskId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const mine = await tx.select().from(taskUnit).where(eq(taskUnit.taskId, taskId));
    await tx
      .update(task)
      .set({ active: true, archivedAt: null })
      .where(eq(task.id, taskId));
    for (const m of mine) await recomputeUnitPoints(tx, m.unitId);
  });
}

export async function setTaskFrequency(
  taskId: string,
  timesPerWeek: number,
): Promise<void> {
  await db.update(task).set({ timesPerWeek }).where(eq(task.id, taskId));
}
