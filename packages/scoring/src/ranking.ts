/**
 * Rank-derived diagnostic scores, for **priority only** (ADR-0022).
 *
 * Priority is ranked rather than rated because it fixes
 * ceiling-clustering: when most units genuinely feel important, most
 * dials land 6–10 and the gap term ends up doing all the differentiating
 * work. Ranking guarantees full-range spread every time.
 * `rankToScore` converts a rank position back into a continuous
 * 1–10-equivalent number so the weight formula, bubble chart, and
 * history views keep working unchanged.
 *
 * **Satisfaction is deliberately not ranked**, and since formula v8 it
 * does not reach weights at all (ADR-0028 §1). It arrives as an
 * absolute 1–10 rating, and stays a measure of whether the plan is
 * working rather than an input to it.
 */
import { deriveWeights } from "./weights";
import type { DerivedWeight } from "./types";

/** Rank 1 (highest attention) → 10; rank `total` (lowest) → 1. A
 *  single-item set has nothing to compare against, so it scores 10. */
export function rankToScore(rank: number, total: number): number {
  if (!Number.isInteger(total) || total < 1) {
    throw new Error(`rankToScore: total must be a positive integer, got ${total}`);
  }
  if (!Number.isInteger(rank) || rank < 1 || rank > total) {
    throw new Error(`rankToScore: rank must be an integer 1–${total}, got ${rank}`);
  }
  if (total === 1) return 10;
  return 10 - (9 * (rank - 1)) / (total - 1);
}

export interface PriorityOrderInput {
  /**
   * Every unit in priority order, most attention first — **including
   * ones excluded from scoring.** The diagnostic ranks the whole set
   * and filters afterwards, so dropping them here would shrink the
   * rank denominator and produce different weights than the diagnostic
   * would for the very same order.
   */
  order: readonly string[];
  /** Units that count toward the 100. */
  scored: ReadonlySet<string>;
}

/**
 * The weights a priority order produces, along the diagnostic's own
 * path: rank across everything → `rankToScore` → filter to scored →
 * `deriveWeights`. Lets a re-rank outside the diagnostic land on
 * exactly the numbers the diagnostic would have given.
 */
export function weightsForPriorityOrder(
  input: PriorityOrderInput,
): DerivedWeight[] {
  const total = input.order.length;
  if (total === 0) return [];

  const ratings = input.order
    .map((unitId, i) => ({ unitId, importance: rankToScore(i + 1, total) }))
    .filter((r) => input.scored.has(r.unitId));

  return deriveWeights(ratings);
}

export interface AreaRank {
  areaId: string;
  /** 1 = needs the most attention. */
  rank: number;
}

export interface UnitRank {
  unitId: string;
  /** 1 = needs the most attention, within its area. */
  rank: number;
}

export interface OverallUnitRank {
  unitId: string;
  /** 1 = needs the most attention, across every unit. */
  overallRank: number;
  total: number;
}

/**
 * Composes an area-level ranking with each area's within-area ranking
 * into one strict total order across every unit: area rank is
 * primary, within-area rank is secondary.
 */
export function combineHierarchicalRank(
  areaRanks: readonly AreaRank[],
  unitRanksByArea: Readonly<Record<string, readonly UnitRank[]>>,
): OverallUnitRank[] {
  const orderedAreas = [...areaRanks].sort((a, b) => a.rank - b.rank);
  const flattened: string[] = [];
  for (const area of orderedAreas) {
    const units = [...(unitRanksByArea[area.areaId] ?? [])].sort(
      (a, b) => a.rank - b.rank,
    );
    for (const u of units) flattened.push(u.unitId);
  }
  const total = flattened.length;
  return flattened.map((unitId, i) => ({
    unitId,
    overallRank: i + 1,
    total,
  }));
}
