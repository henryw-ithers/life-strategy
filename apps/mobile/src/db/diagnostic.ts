import {
  addDays,
  combineHierarchicalRank,
  deriveWeights,
  FORMULA_VERSION,
  rankToScore,
  recommendedTaskRange,
} from "@glide/scoring";
import { and, asc, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { loadGoals } from "./goals";
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
import { getGapCoefficientOverride } from "./settings";
import { currentLocalDate } from "./today";
import { loadPlan } from "./tasks";

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

export interface DiagnosticEntry {
  unitId: string;
  importance: number;
  satisfaction: number;
  includeInScoring: boolean;
}

/** "priority" ranks feed `importance`; "satisfaction" ranks feed
 *  `satisfaction` — both amended to rank-derived scores (ADR-0003
 *  amendment: ranked diagnostic). */
export type DiagnosticAxis = "priority" | "satisfaction";

const AXES: readonly DiagnosticAxis[] = ["priority", "satisfaction"];

/**
 * The app's proposed overall order for one axis: every unit in one
 * list, area rank primary and within-area rank secondary. This is what
 * the final review step opens with, and what the user then drags into
 * shape if the composition got something wrong.
 */
export function suggestOverallOrder(
  areas: DiagnosticArea[],
  unitOrderByArea: Record<string, Partial<Record<DiagnosticAxis, string[]>>>,
  areaOrder: Partial<Record<DiagnosticAxis, string[]>>,
  axis: DiagnosticAxis,
): string[] {
  const areaIds = areaOrder[axis] ?? areas.map((a) => a.id);
  const areaRanks = areaIds.map((areaId, i) => ({ areaId, rank: i + 1 }));
  const unitRanksByArea: Record<string, { unitId: string; rank: number }[]> = {};
  for (const area of areas) {
    const order = unitOrderByArea[area.id]?.[axis] ?? area.units.map((u) => u.id);
    unitRanksByArea[area.id] = order.map((unitId, i) => ({ unitId, rank: i + 1 }));
  }
  return combineHierarchicalRank(areaRanks, unitRanksByArea).map((o) => o.unitId);
}

/**
 * Turns a completed ranking into the same `DiagnosticEntry` shape
 * `saveDiagnostic` has always taken — `deriveWeights`, the
 * `rating`/`unit_weight` tables, and the portfolio graph never need to
 * know the numbers came from ranks rather than absolute dials.
 *
 * `finalOrder` is the reviewed overall order per axis. It is the
 * source of truth where present: the area and within-area rankings
 * build the *suggestion*, but what the user confirmed on the last
 * screen is what scores. Falling back to the composed order keeps this
 * correct for a snapshot saved without a review pass.
 */
export function buildEntriesFromRanking(
  areas: DiagnosticArea[],
  unitOrderByArea: Record<string, Partial<Record<DiagnosticAxis, string[]>>>,
  areaOrder: Partial<Record<DiagnosticAxis, string[]>>,
  finalOrder: Partial<Record<DiagnosticAxis, string[]>> = {},
): DiagnosticEntry[] {
  const scoreByAxis: Record<DiagnosticAxis, Map<string, number>> = {
    priority: new Map(),
    satisfaction: new Map(),
  };

  for (const axis of AXES) {
    if (!areaOrder[axis] && !finalOrder[axis]) continue;
    const ordered =
      finalOrder[axis] ??
      suggestOverallOrder(areas, unitOrderByArea, areaOrder, axis);
    const total = ordered.length;
    ordered.forEach((unitId, i) => {
      scoreByAxis[axis].set(unitId, rankToScore(i + 1, total));
    });
  }

  return areas.flatMap((area) =>
    area.units.map((u) => ({
      unitId: u.id,
      importance: scoreByAxis.priority.get(u.id) ?? 1,
      satisfaction: scoreByAxis.satisfaction.get(u.id) ?? 1,
      includeInScoring: u.includeInScoring,
    })),
  );
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
  const [effort, gapCoefficientOverride] = await Promise.all([
    trailingEffort(),
    getGapCoefficientOverride(),
  ]);

  const weights = deriveWeights(
    entries
      .filter((e) => e.includeInScoring)
      .map((e) => ({
        unitId: e.unitId,
        importance: e.importance,
        satisfaction: e.satisfaction,
      })),
    gapCoefficientOverride ?? undefined,
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

interface DiffRowBase {
  unitId: string;
  name: string;
  areaId: string;
}

export interface MovedRow extends DiffRowBase {
  oldWeight: number;
  newWeight: number;
  suggestAddTask: boolean;
}

export interface ExcludedRow extends DiffRowBase {
  /** Active goals on this unit — a "pause its goal?" prompt candidate. */
  goalIds: string[];
}

export interface IncludedRow extends DiffRowBase {
  newWeight: number;
  suggestAddTask: boolean;
}

export interface DiagnosticDiff {
  moved: MovedRow[];
  excluded: ExcludedRow[];
  included: IncludedRow[];
}

/** Below this, a weight change isn't worth surfacing (ADR-0005 §2). */
const MOVED_THRESHOLD = 2;

/**
 * Compares a snapshot's weights against the one before it (ADR-0005
 * §2: "diagnostics never destroy anything," a diff, not a rebuild).
 * Returns `null` when there's no prior snapshot — a first-ever
 * diagnostic has nothing to diff, so the caller should skip straight
 * to results. Overrides aren't diffed: `unit_weight.override` is
 * never written anywhere in the app yet (no override-editing UI
 * exists), so there's nothing there to compare.
 */
export async function loadDiagnosticDiff(
  newSnapshotId: string,
): Promise<DiagnosticDiff | null> {
  const [current] = await db
    .select()
    .from(snapshot)
    .where(eq(snapshot.id, newSnapshotId));
  if (!current) return null;

  const [previous] = await db
    .select()
    .from(snapshot)
    .where(lt(snapshot.takenAt, current.takenAt))
    .orderBy(desc(snapshot.takenAt))
    .limit(1);
  if (!previous) return null;

  const [oldWeights, newWeights, areas, plan, goals] = await Promise.all([
    db.select().from(unitWeight).where(eq(unitWeight.snapshotId, previous.id)),
    db.select().from(unitWeight).where(eq(unitWeight.snapshotId, newSnapshotId)),
    loadDiagnosticAreas(),
    loadPlan(),
    loadGoals(),
  ]);

  const oldByUnit = new Map(oldWeights.map((w) => [w.unitId, w]));
  const newByUnit = new Map(newWeights.map((w) => [w.unitId, w]));
  const unitMeta = new Map(
    areas.flatMap((a) =>
      a.units.map((u) => [u.id, { name: u.name, areaId: a.id }] as const),
    ),
  );
  const taskCountByUnit = new Map(
    plan.areas.flatMap((a) =>
      a.units.map((u) => [u.id, u.tasks.length] as const),
    ),
  );
  const activeGoalIdsByUnit = new Map(
    goals.areas.flatMap((a) =>
      a.units.map(
        (u) =>
          [
            u.id,
            u.goals.filter((g) => g.status === "active").map((g) => g.id),
          ] as const,
      ),
    ),
  );

  const moved: MovedRow[] = [];
  const excluded: ExcludedRow[] = [];
  const included: IncludedRow[] = [];

  const allUnitIds = new Set([...oldByUnit.keys(), ...newByUnit.keys()]);
  for (const unitId of allUnitIds) {
    const meta = unitMeta.get(unitId);
    if (!meta) continue; // archived since — nothing to show

    const oldW = oldByUnit.get(unitId);
    const newW = newByUnit.get(unitId);
    const taskCount = taskCountByUnit.get(unitId) ?? 0;

    if (oldW && newW) {
      const oldEffective = oldW.override ?? oldW.derived;
      const newEffective = newW.override ?? newW.derived;
      const delta = newEffective - oldEffective;
      if (Math.abs(delta) >= MOVED_THRESHOLD) {
        moved.push({
          unitId,
          name: meta.name,
          areaId: meta.areaId,
          oldWeight: Math.round(oldEffective),
          newWeight: Math.round(newEffective),
          suggestAddTask:
            delta > 0 && taskCount < recommendedTaskRange(newEffective).min,
        });
      }
    } else if (oldW && !newW) {
      excluded.push({
        unitId,
        name: meta.name,
        areaId: meta.areaId,
        goalIds: activeGoalIdsByUnit.get(unitId) ?? [],
      });
    } else if (!oldW && newW) {
      const newEffective = newW.override ?? newW.derived;
      included.push({
        unitId,
        name: meta.name,
        areaId: meta.areaId,
        newWeight: Math.round(newEffective),
        suggestAddTask: taskCount < recommendedTaskRange(newEffective).min,
      });
    }
  }

  return { moved, excluded, included };
}
