import { taskPointValues } from "@life-strategy/scoring";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { lifeArea, lifeUnit, snapshot, task, unitWeight } from "./schema";

export interface PlanTask {
  id: string;
  title: string;
  /** Times per week: 1–7 (7 = daily); 0 = once every two weeks. */
  timesPerWeek: number;
  pointValue: number;
  rankInUnit: number;
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  const tasks = await db
    .select()
    .from(task)
    .where(eq(task.active, true))
    .orderBy(asc(task.rankInUnit));

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
          tasks: tasks
            .filter((t) => t.unitId === u.id)
            .map((t) => ({
              id: t.id,
              title: t.title,
              timesPerWeek: t.timesPerWeek,
              pointValue: t.pointValue,
              rankInUnit: t.rankInUnit,
            })),
        })),
    })),
  };
}

/** Re-derive every active task's points from rank shares (ADR-0003). */
async function recomputeUnitPoints(tx: Tx, unitId: string): Promise<void> {
  const weights = await latestWeights(tx);
  const weight = weights.get(unitId) ?? 0;
  const active = await tx
    .select()
    .from(task)
    .where(and(eq(task.unitId, unitId), eq(task.active, true)))
    .orderBy(asc(task.rankInUnit));
  if (active.length === 0) return;

  const points = taskPointValues(weight, active.length);
  for (const [i, t] of active.entries()) {
    await tx
      .update(task)
      .set({ pointValue: points[i] ?? 0, rankInUnit: i + 1 })
      .where(eq(task.id, t.id));
  }
}

/** Insert at `rank` (1-based, from the comparison flow), shift the rest. */
export async function addTask(
  unitId: string,
  title: string,
  timesPerWeek: number,
  rank: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const active = await tx
      .select()
      .from(task)
      .where(and(eq(task.unitId, unitId), eq(task.active, true)));
    for (const t of active) {
      if (t.rankInUnit >= rank) {
        await tx
          .update(task)
          .set({ rankInUnit: t.rankInUnit + 1 })
          .where(eq(task.id, t.id));
      }
    }
    await tx.insert(task).values({
      id: Crypto.randomUUID(),
      unitId,
      title,
      timesPerWeek,
      pointValue: 0,
      rankInUnit: rank,
    });
    await recomputeUnitPoints(tx, unitId);
  });
}

export async function archiveTask(taskId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(task).where(eq(task.id, taskId));
    if (!row) return;
    await tx
      .update(task)
      .set({ active: false, archivedAt: new Date().toISOString() })
      .where(eq(task.id, taskId));
    await recomputeUnitPoints(tx, row.unitId);
  });
}

export async function setTaskFrequency(
  taskId: string,
  timesPerWeek: number,
): Promise<void> {
  await db.update(task).set({ timesPerWeek }).where(eq(task.id, taskId));
}
