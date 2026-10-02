import {
  addDays,
  combineHierarchicalRank,
  deriveEffort,
  deriveWeights,
  FORMULA_VERSION,
  rankToScore,
  recommendedTaskRange,
} from "@glide/scoring";
import { and, asc, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { isCommitmentUnit } from "./commitmentPlan";
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
  taskCompletionTag,
  unitWeight,
} from "./schema";
import { currentLocalDate } from "../lib/calendar";
import { recacheAllDayScores } from "./dayGrades";
import { loadPlan, recomputeAllUnitPoints } from "./tasks";

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
      // Commitments and their parts are not among the 18 and are never
      // diagnosed (ADR-0035): their share of a day is the band the user
      // sets, not a rank. Without this they were listed to be ranked
      // and rated beside the life units.
      .filter((u) => u.areaId === area.id && !isCommitmentUnit(u))
      .map((u) => ({
        id: u.id,
        name: u.name,
        includeInScoring: u.includeInScoring,
      })),
  }));
}

/**
 * The priority order the last diagnostic saved, highest first, or null
 * before the first one — the seed for carry-over prefill
 * (`carryOverOrder`). Read back from `rating.importance`, which is
 * `rankToScore` of each unit's rank and so sorts exactly as the ranking
 * did.
 */
export async function loadPreviousPriorityOrder(): Promise<string[] | null> {
  const [latest] = await db
    .select()
    .from(snapshot)
    .orderBy(desc(snapshot.takenAt))
    .limit(1);
  if (!latest) return null;
  const rows = await db.select().from(rating).where(eq(rating.snapshotId, latest.id));
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => b.importance - a.importance).map((r) => r.unitId);
}

export interface DiagnosticEntry {
  unitId: string;
  importance: number;
  satisfaction: number;
  includeInScoring: boolean;
}

/**
 * The app's proposed priority order: every unit in one list, area rank
 * primary and taxonomy order within each area secondary. This is what
 * the priority step opens with, and what the user then drags into shape
 * if the composition got something wrong.
 *
 * Priority only. Satisfaction is rated, not ranked (ADR-0022) — it has
 * no order to seed.
 */
export function suggestOverallOrder(
  areas: DiagnosticArea[],
  areaOrder: string[] | undefined,
): string[] {
  const areaIds = areaOrder ?? areas.map((a) => a.id);
  const areaRanks = areaIds.map((areaId, i) => ({ areaId, rank: i + 1 }));
  const unitRanksByArea: Record<string, { unitId: string; rank: number }[]> = {};
  for (const area of areas) {
    unitRanksByArea[area.id] = area.units.map((u, i) => ({
      unitId: u.id,
      rank: i + 1,
    }));
  }
  return combineHierarchicalRank(areaRanks, unitRanksByArea).map((o) => o.unitId);
}

/**
 * Turns a finished diagnostic into the `DiagnosticEntry` shape
 * `saveDiagnostic` has always taken. The two axes arrive by different
 * routes now (ADR-0022):
 *
 * - **Importance** comes from `priorityOrder` via `rankToScore` —
 *   priority is a preference, and only means anything relative to the
 *   rest of the list.
 * - **Satisfaction** comes straight through as the 1–10 the user
 *   rated. It is an assessment with an absolute referent, and the gap
 *   term subtracts it as if it were one.
 *
 * `deriveWeights`, the `rating`/`unit_weight` tables, and the portfolio
 * graph are unchanged: both numbers still land in the same 1–10 range.
 */
export function buildEntries(
  areas: DiagnosticArea[],
  priorityOrder: string[],
  satisfaction: Readonly<Record<string, number>>,
): DiagnosticEntry[] {
  const importance = new Map<string, number>();
  const total = priorityOrder.length;
  priorityOrder.forEach((unitId, i) => {
    importance.set(unitId, rankToScore(i + 1, total));
  });

  return areas.flatMap((area) =>
    area.units.map((u) => {
      const i = importance.get(u.id) ?? 1;
      return {
        unitId: u.id,
        importance: i,
        // An unrated unit falls back to its own importance, which makes
        // the gap exactly 0: no boost, no penalty. The flow gates on all
        // units being rated, so this should never fire — but of the
        // available wrong answers, the neutral one is the only one that
        // neither manufactures a crisis nor hides one.
        satisfaction: satisfaction[u.id] ?? i,
        includeInScoring: u.includeInScoring,
      };
    }),
  );
}

/**
 * ADR-0005 §3: points earned per unit over the trailing 28 days —
 * task completions plus activity credit — normalized so the busiest
 * unit is 1. Null when nothing is logged yet (first snapshot:
 * bubbles render uniform and small until life gets logged).
 */
async function trailingEffort(
  weights: ReadonlyMap<string, number>,
): Promise<Map<string, number> | null> {
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

  // Distinct days a unit was tagged, from either route (ADR-0025 §8).
  // Days rather than occurrences, so the bubble and the grade tell the
  // same story — §3 settles a day's worth at one tag.
  const completionTagDays = await db
    .selectDistinct({
      unitId: taskCompletionTag.unitId,
      localDate: taskCompletion.localDate,
    })
    .from(taskCompletionTag)
    .innerJoin(taskCompletion, eq(taskCompletionTag.completionId, taskCompletion.id))
    .where(
      and(gte(taskCompletion.localDate, start), lte(taskCompletion.localDate, today)),
    );

  const activityTagDays = await db
    .selectDistinct({ unitId: activityTag.unitId, localDate: activity.localDate })
    .from(activityTag)
    .innerJoin(activity, eq(activityTag.activityId, activity.id))
    .where(and(gte(activity.localDate, start), lte(activity.localDate, today)));

  const daysByUnit = new Map<string, Set<string>>();
  for (const row of [...completionTagDays, ...activityTagDays]) {
    const set = daysByUnit.get(row.unitId) ?? new Set<string>();
    set.add(row.localDate);
    daysByUnit.set(row.unitId, set);
  }

  const points = new Map<string, number>();
  for (const row of [...completions, ...credits]) {
    points.set(row.unitId, (points.get(row.unitId) ?? 0) + (row.pts ?? 0));
  }

  const unitIds = new Set([
    ...points.keys(),
    ...daysByUnit.keys(),
    ...weights.keys(),
  ]);
  return deriveEffort(
    [...unitIds].map((unitId) => ({
      unitId,
      points: points.get(unitId) ?? 0,
      taggedDays: daysByUnit.get(unitId)?.size ?? 0,
      weight: weights.get(unitId) ?? 0,
    })),
  );
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
  // Satisfaction is stored on every `rating` row and read by the
  // portfolio graph, `unitProfile` and calibration — it just does not
  // derive a weight any more (ADR-0028 §1), so it is not passed here.
  const weights = deriveWeights(
    entries
      .filter((e) => e.includeInScoring)
      .map((e) => ({ unitId: e.unitId, importance: e.importance })),
  );

  /**
   * Effort now needs weights, to price a tagged day against a scored
   * unit's points on one scale (ADR-0025 §8) — so it runs after
   * derivation rather than beside it.
   *
   * These are *this* snapshot's weights applied to the previous 28
   * days, which were lived under the last ones. Deliberate: effort is
   * a bubble size, not a stored score, and reaching back for the prior
   * snapshot's weights would price the window correctly while making
   * the chart disagree with the axes it is drawn against.
   */
  const effort = await trailingEffort(
    new Map(weights.map((w) => [w.unitId, w.weight])),
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
    // New weights mean new task points. `loadPlan` and `loadDay` read
    // the stored `task.point_value`, so without this the checklist
    // keeps scoring against the previous diagnostic until some
    // unrelated task edit happens to refresh the unit.
    await recomputeAllUnitPoints(tx);
  });

  // And the cached day scores those points feed — the calendar, the
  // week and the month all read the cache, not the live computation.
  await recacheAllDayScores();

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
