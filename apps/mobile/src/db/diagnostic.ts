import { deriveWeights, FORMULA_VERSION } from "@life-strategy/scoring";
import { asc, desc, eq, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { lifeArea, lifeUnit, rating, snapshot, unitWeight } from "./schema";

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
 * The snapshot transaction (ADR-0002): snapshot header, all 16 rating
 * rows (excluded units included — they're diagnosed, just not scored),
 * and unit_weight rows from the scoring engine for included units
 * only (ADR-0003 §2). All-or-nothing.
 *
 * `derived` stores the integer weight (the displayed, task-priceable
 * value); `effort_points` stays null until the trailing-effort query
 * ships (ADR-0005 §3 — the graph renders uniform bubbles meanwhile).
 */
export async function saveDiagnostic(entries: DiagnosticEntry[]): Promise<string> {
  const snapshotId = Crypto.randomUUID();
  const takenAt = new Date().toISOString();

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
