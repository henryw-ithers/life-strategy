import { addDays, deriveWeights, FORMULA_VERSION } from "@life-strategy/scoring";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import {
  activity,
  activityTag,
  lifeArea,
  lifeUnit,
  rating,
  snapshot,
  task,
  taskCompletion,
  unitWeight,
} from "./schema";
import { currentLocalDate } from "./today";

export interface DiagnosticUnit {
  id: string;
  name: string;
  includeInScoring: boolean;
}

export interface DiagnosticArea {
  id: string;
  name: string;
  units: DiagnosticUnit[];
}

export interface RatingDraft {
  importance: number | null;
  satisfaction: number | null;
}

export async function loadDiagnosticAreas(): Promise<DiagnosticArea[]> {
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

  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    units: units
      .filter((u) => u.areaId === area.id)
      .map((u) => ({
        id: u.id,
        name: u.name,
        includeInScoring: u.includeInScoring,
      })),
  }));
}

/** Latest snapshot's ratings, for prefilling the monthly re-run. */
export async function loadLatestRatings(): Promise<
  Record<string, { importance: number; satisfaction: number }>
> {
  const [latest] = await db
    .select()
    .from(snapshot)
    .orderBy(desc(snapshot.takenAt))
    .limit(1);
  if (!latest) return {};

  const rows = await db
    .select()
    .from(rating)
    .where(eq(rating.snapshotId, latest.id));
  return Object.fromEntries(
    rows.map((r) => [
      r.unitId,
      { importance: r.importance, satisfaction: r.satisfaction },
    ]),
  );
}

export interface DiagnosticEntry {
  unitId: string;
  importance: number;
  satisfaction: number;
  includeInScoring: boolean;
}

/**
 * ADR-0005 §3: points earned per unit over the trailing 28 days —
 * task completions plus activity credit — normalized so the busiest
 * unit is 1. Null when nothing is logged yet (first snapshot:
 * bubbles render uniform and small until life gets logged).
 */
async function trailingEffort(): Promise<Map<string, number> | null> {
  const today = currentLocalDate();
  const start = addDays(today, -28);

  const completions = await db
    .select({
      unitId: task.unitId,
      pts: sql<number>`sum(${taskCompletion.pointsEarned})`,
    })
    .from(taskCompletion)
    .innerJoin(task, eq(taskCompletion.taskId, task.id))
    .where(
      and(gte(taskCompletion.localDate, start), lte(taskCompletion.localDate, today)),
    )
    .groupBy(task.unitId);

  const credits = await db
    .select({
      unitId: activityTag.unitId,
      pts: sql<number>`sum(${activityTag.pointsCredited})`,
    })
    .from(activityTag)
    .innerJoin(activity, eq(activityTag.activityId, activity.id))
    .where(and(gte(activity.localDate, start), lte(activity.localDate, today)))
    .groupBy(activityTag.unitId);

  const totals = new Map<string, number>();
  for (const row of [...completions, ...credits]) {
    totals.set(row.unitId, (totals.get(row.unitId) ?? 0) + (row.pts ?? 0));
  }
  const max = Math.max(0, ...totals.values());
  if (max <= 0) return null;
  return new Map([...totals].map(([id, pts]) => [id, pts / max]));
}

/**
 * The snapshot transaction (ADR-0002): snapshot header, all 16 rating
 * rows (excluded units included — they're diagnosed, just not scored),
 * and unit_weight rows from the scoring engine for included units
 * only (ADR-0003 §2). All-or-nothing.
 *
 * `derived` stores the integer weight (the displayed, task-priceable
 * value); `effort_points` freezes the trailing-28-day effort at
 * snapshot time (ADR-0005 §3) — null on units with no history yet.
 */
export async function saveDiagnostic(entries: DiagnosticEntry[]): Promise<string> {
  const snapshotId = Crypto.randomUUID();
  const takenAt = new Date().toISOString();
  const effort = await trailingEffort();

  const weights = deriveWeights(
    entries
      .filter((e) => e.includeInScoring)
      .map((e) => ({
        unitId: e.unitId,
        importance: e.importance,
        satisfaction: e.satisfaction,
      })),
  );

  await db.transaction(async (tx) => {
    await tx.insert(snapshot).values({
      id: snapshotId,
      takenAt,
      formulaVersion: FORMULA_VERSION,
    });
    await tx.insert(rating).values(
      entries.map((e) => ({
        snapshotId,
        unitId: e.unitId,
        importance: e.importance,
        satisfaction: e.satisfaction,
        // With any history, unlogged units are honestly 0 — only a
        // history-free first snapshot leaves effort null (uniform).
        effortPoints: effort ? (effort.get(e.unitId) ?? 0) : null,
      })),
    );
    if (weights.length > 0) {
      await tx.insert(unitWeight).values(
        weights.map((w) => ({
          snapshotId,
          unitId: w.unitId,
          derived: w.weight,
        })),
      );
    }
  });

  return snapshotId;
}

export interface AreaWeightRow {
  unitId: string;
  name: string;
  /** null = rated but excluded from scoring. */
  weight: number | null;
}

export interface AreaWeightGroup {
  areaId: string;
  areaName: string;
  rows: AreaWeightRow[];
}

/** The saved snapshot's weights, grouped by area for the results screen. */
export async function loadWeightSummary(
  snapshotId: string,
): Promise<AreaWeightGroup[]> {
  const areas = await loadDiagnosticAreas();
  const weights = await db
    .select()
    .from(unitWeight)
    .where(eq(unitWeight.snapshotId, snapshotId));
  const byUnit = new Map(weights.map((w) => [w.unitId, w]));

  return areas.map((area) => ({
    areaId: area.id,
    areaName: area.name,
    rows: area.units.map((u) => {
      const w = byUnit.get(u.id);
      return {
        unitId: u.id,
        name: u.name,
        weight: w ? Math.round(w.override ?? w.derived) : null,
      };
    }),
  }));
}
