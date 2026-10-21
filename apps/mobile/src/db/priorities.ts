/**
 * Priorities (ADR-0041): the 18 life units in four tiers, Top,
 * Important, Background and Not now, ordered within each. Weights come
 * from tier and order (`deriveTierWeights`), and any weight you set
 * replaces its unit's, the recommended value always kept beside it
 * (`applyWeightOverrides`).
 *
 * **One snapshot per save**, when you tap Done, never on each drag
 * (ADR-0041 §5). It records each unit's tier, place, recommended weight
 * and override (`unit_weight`); satisfaction isn't asked any more, so
 * it writes no `rating` rows, and older ones stay read-only (§4).
 *
 * **Not now is out of the plan** (§3): moving a unit there pauses its
 * tasks and drops their pins; moving it back up restores those tasks,
 * without the pins. Commitments aren't here: they have their own share
 * of the day (ADR-0044).
 */
import { FORMULA_VERSION, isTier, type Tier, type TieredUnit } from "@glide/scoring";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { isCommitmentUnit } from "./commitmentPlan";
import { recacheAllDayScores } from "./dayGrades";
import { forgetPinsOf } from "./pins";
import { lifeUnit, snapshot, task, unitWeight } from "./schema";
import { writeAndMarkStale } from "./settings";
import { latestOverrides, recomputeAllUnitPoints, type Tx } from "./tasks";
import { boardWeights, tieredUnits, tierOrderOf } from "./tierRules";

/** A unit's place on the board, in Priorities order. */
export type Placement = TieredUnit;

export interface PriorityUnit {
  unitId: string;
  name: string;
  areaId: string;
  tier: Tier;
  /** From tier and order. 0 in Not now. */
  recommended: number;
  /** A weight you set, or null. */
  override: number | null;
  /** What scores. 0 in Not now. */
  weight: number;
  /** Tasks in the plan homed here: what moving it to Not now pauses. */
  taskCount: number;
}

export interface PriorityBoard {
  /** In Priorities order: Top first, each tier in its own order. */
  units: PriorityUnit[];
  /** No Priorities saved yet. The screen then starts every unit
   *  Unsorted and you sort them all yourself (Henry, 2026-10-21), rather
   *  than from a guess that looks like the app has an opinion about your
   *  life. `units` still carry Important here, as a base to work from. */
  firstRun: boolean;
  /** Why the saved weights can't stand as they are, or null. */
  problem: string | null;
}

/** The life units Priorities shows: not archived, not commitments. */
function lifeUnits(tx: Tx | typeof db) {
  return tx
    .select()
    .from(lifeUnit)
    .where(isNull(lifeUnit.archivedAt))
    .all()
    .filter((u) => !isCommitmentUnit(u))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function latestSnapshotId(tx: Tx | typeof db): string | null {
  const [latest] = tx
    .select({ id: snapshot.id })
    .from(snapshot)
    .orderBy(desc(snapshot.takenAt))
    .limit(1)
    .all();
  return latest?.id ?? null;
}

/** The latest saved Priorities, or null if none ever were. Onboarding
 *  compares it before and after opening Priorities to see a save. */
export async function latestPriorities(): Promise<string | null> {
  return latestSnapshotId(db);
}

/** Whether tiers have ever been saved. */
export async function hasPriorities(): Promise<boolean> {
  return latestSnapshotId(db) !== null;
}

export async function loadPriorities(): Promise<PriorityBoard> {
  return db.transaction((tx) => {
    const units = lifeUnits(tx);
    const firstRun = latestSnapshotId(tx) === null;
    const placement: Placement[] = firstRun
      ? units.map((u) => ({ unitId: u.id, tier: "important" }))
      : (tieredUnits(
          units.map((u) => ({
            id: u.id,
            tier: isTier(u.tier) ? u.tier : null,
            tierOrder: u.tierOrder,
            sortOrder: u.sortOrder,
            includeInScoring: u.includeInScoring,
          })),
        ) ?? units.map((u) => ({ unitId: u.id, tier: "important" as const })));
    const overrides = firstRun ? new Map<string, number>() : latestOverrides(tx);
    const board = boardWeights(placement, overrides);
    const weights = board.problem ? board.recommended : board.weights;
    const counts = new Map<string, number>();
    for (const t of tx
      .select({ unitId: task.unitId })
      .from(task)
      .where(and(eq(task.active, true), isNull(task.archivedAt)))
      .all()) {
      counts.set(t.unitId, (counts.get(t.unitId) ?? 0) + 1);
    }
    const byId = new Map(units.map((u) => [u.id, u]));
    return {
      firstRun,
      problem: board.problem,
      units: placement.map((p) => {
        const u = byId.get(p.unitId)!;
        return {
          unitId: p.unitId,
          name: u.name,
          areaId: u.areaId,
          tier: p.tier,
          recommended: board.recommended.get(p.unitId) ?? 0,
          override: p.tier === "notNow" ? null : (overrides.get(p.unitId) ?? null),
          weight: weights.get(p.unitId) ?? 0,
          taskCount: counts.get(p.unitId) ?? 0,
        };
      }),
    };
  });
}

/** An override whose recommended weight moved with this save. */
export interface OverrideReview {
  unitId: string;
  name: string;
  override: number;
  recommendedBefore: number;
  recommendedNow: number;
}

/**
 * Save Priorities (ADR-0041 §5): every unit's tier and place, Not now
 * in and out of the plan with its tasks, and one snapshot holding the
 * tiers, recommended weights and your overrides. Then the plan is
 * repriced and grades marked stale, in the same transaction.
 *
 * Throws with the board's problem rather than save it: every unit in
 * Not now ("Keep at least one unit in your plan."), or overrides that
 * don't fit. Returns the overrides whose recommended weight changed, so
 * you can keep or reset each one (`clearOverrides`).
 */
export async function savePriorities(
  placement: readonly Placement[],
  overrides: ReadonlyMap<string, number>,
): Promise<{ snapshotId: string; review: OverrideReview[] }> {
  const board = boardWeights(placement, overrides);
  if (board.problem) throw new Error(board.problem);
  const snapshotId = Crypto.randomUUID();
  const result = writeAndMarkStale((tx) => {
    const units = lifeUnits(tx);
    const byId = new Map(units.map((u) => [u.id, u]));
    const placed = new Set(placement.map((p) => p.unitId));
    if (placed.size !== placement.length || units.some((u) => !placed.has(u.id))) {
      throw new Error("Priorities must place every unit exactly once.");
    }
    for (const p of placement) {
      if (!byId.has(p.unitId)) throw new Error(`No life unit ${p.unitId}`);
    }

    const previousId = latestSnapshotId(tx);
    const before = new Map(
      previousId === null
        ? []
        : tx
            .select({ unitId: unitWeight.unitId, derived: unitWeight.derived })
            .from(unitWeight)
            .where(eq(unitWeight.snapshotId, previousId))
            .all()
            .map((r) => [r.unitId, r.derived] as const),
    );

    const orderOf = tierOrderOf(placement);
    const leaving: string[] = [];
    const returning: string[] = [];
    for (const p of placement) {
      const wasIn = byId.get(p.unitId)!.includeInScoring;
      const isIn = p.tier !== "notNow";
      if (wasIn && !isIn) leaving.push(p.unitId);
      if (!wasIn && isIn) returning.push(p.unitId);
      tx.update(lifeUnit)
        .set({ tier: p.tier, tierOrder: orderOf.get(p.unitId) ?? 0, includeInScoring: isIn })
        .where(eq(lifeUnit.id, p.unitId))
        .run();
    }
    pauseTasksOf(tx, leaving);
    restoreTasksOf(tx, returning);

    // Strictly after the last snapshot, so "latest" is never a tie.
    const [last] =
      previousId === null
        ? []
        : tx.select({ takenAt: snapshot.takenAt }).from(snapshot).where(eq(snapshot.id, previousId)).all();
    const nowMs = Date.now();
    const takenAt = new Date(
      last ? Math.max(nowMs, Date.parse(last.takenAt) + 1) : nowMs,
    ).toISOString();
    tx.insert(snapshot).values({ id: snapshotId, takenAt, formulaVersion: FORMULA_VERSION }).run();
    tx.insert(unitWeight)
      .values(
        placement.map((p) => ({
          snapshotId,
          unitId: p.unitId,
          derived: board.recommended.get(p.unitId) ?? 0,
          override: p.tier === "notNow" ? null : (overrides.get(p.unitId) ?? null),
          tier: p.tier,
          tierOrder: orderOf.get(p.unitId) ?? 0,
        })),
      )
      .run();
    recomputeAllUnitPoints(tx);

    const review: OverrideReview[] = [];
    for (const p of placement) {
      const own = overrides.get(p.unitId);
      const was = before.get(p.unitId);
      const now = board.recommended.get(p.unitId);
      if (own === undefined || p.tier === "notNow" || was === undefined || now === undefined) continue;
      if (was !== now) {
        review.push({
          unitId: p.unitId,
          name: byId.get(p.unitId)!.name,
          override: own,
          recommendedBefore: was,
          recommendedNow: now,
        });
      }
    }
    return { snapshotId, review };
  });
  // The calendar, the week and the month read cached day scores.
  await recacheAllDayScores();
  return result;
}

/**
 * Pause the tasks homed in units going to Not now (ADR-0041 §3):
 * archived and marked, and their pins dropped. Tasks you archived
 * yourself aren't touched, so moving the unit back can't revive them.
 */
function pauseTasksOf(tx: Tx, unitIds: readonly string[]): void {
  if (unitIds.length === 0) return;
  const ids = tx
    .select({ id: task.id })
    .from(task)
    .where(and(inArray(task.unitId, [...unitIds]), eq(task.active, true), isNull(task.archivedAt)))
    .all()
    .map((t) => t.id);
  if (ids.length === 0) return;
  forgetPinsOf(tx, ids);
  tx.update(task)
    .set({ active: false, archivedAt: new Date().toISOString(), pausedForNotNow: true })
    .where(inArray(task.id, ids))
    .run();
}

/** Restore what `pauseTasksOf` paused, without the pins. */
function restoreTasksOf(tx: Tx, unitIds: readonly string[]): void {
  if (unitIds.length === 0) return;
  tx.update(task)
    .set({ active: true, archivedAt: null, pausedForNotNow: false })
    .where(and(inArray(task.unitId, [...unitIds]), eq(task.pausedForNotNow, true)))
    .run();
}

/**
 * Reset these units' overrides to their recommended weights, on the
 * latest snapshot: the "reset" half of the review after saving
 * (ADR-0041 §5). Reprices the plan in the same transaction.
 */
export async function clearOverrides(unitIds: readonly string[]): Promise<void> {
  if (unitIds.length === 0) return;
  writeAndMarkStale((tx) => {
    const latest = latestSnapshotId(tx);
    if (latest === null) throw new Error("No Priorities saved yet.");
    tx.update(unitWeight)
      .set({ override: null })
      .where(and(eq(unitWeight.snapshotId, latest), inArray(unitWeight.unitId, [...unitIds])))
      .run();
    recomputeAllUnitPoints(tx);
  });
  await recacheAllDayScores();
}
