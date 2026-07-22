import { DAILY_BUDGET, GAP_COEFFICIENT } from "./constants";
import { largestRemainder } from "./rounding";
import type { DerivedWeight, UnitRating } from "./types";

/** Ratings may now come from either an absolute 1–10 scale or a
 *  rank-derived continuous score (`rankToScore`) — both live in the
 *  same (0, 10] range, so the contract only checks range, not
 *  integrality. */
function assertRating(value: number, field: string, unitId: string): void {
  if (!Number.isFinite(value) || value < 1 || value > 10) {
    throw new Error(
      `deriveWeights: ${field} for unit "${unitId}" must be a number 1–10, got ${value}`,
    );
  }
}

/**
 * Formula v1 (ADR-0003 §1):
 *
 *   raw(u)    = importance + g × max(0, importance − satisfaction)
 *   weight(u) = DAILY_BUDGET × raw(u) / Σ raw
 *
 * Importance is the base; the satisfaction gap boosts linearly;
 * surplus satisfaction (S > I) neither boosts nor penalizes. Integer
 * weights sum to exactly DAILY_BUDGET via largest remainder.
 */
export function deriveWeights(
  ratings: readonly UnitRating[],
  gapCoefficient: number = GAP_COEFFICIENT,
): DerivedWeight[] {
  if (ratings.length === 0) return [];

  const raws = ratings.map((r) => {
    assertRating(r.importance, "importance", r.unitId);
    assertRating(r.satisfaction, "satisfaction", r.unitId);
    return r.importance + gapCoefficient * Math.max(0, r.importance - r.satisfaction);
  });

  const rawSum = raws.reduce((a, b) => a + b, 0);
  const exacts = raws.map((raw) => (DAILY_BUDGET * raw) / rawSum);
  const weights = largestRemainder(exacts, DAILY_BUDGET);

  return ratings.map((r, i) => ({
    unitId: r.unitId,
    raw: raws[i] ?? 0,
    exact: exacts[i] ?? 0,
    weight: weights[i] ?? 0,
  }));
}
