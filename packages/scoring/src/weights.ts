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

export interface UnitCoverage {
  unitId: string;
  /** Derived share of the 100; 0 for a unit outside scoring. */
  weight: number;
  /** True when the unit holds at least one active task. */
  covered: boolean;
}

/**
 * What each unit actually has in play today (ADR-0003 §5 amendment,
 * 2026-07-30).
 *
 * A unit with no tasks spends nothing: `dayShare` only counts tasks
 * that exist, so its weight sat outside the day's denominator entirely
 * — not lost, but not doing anything either, and a portfolio half
 * covered graded out of half a plan. Its weight is now shared among the
 * units that *do* have tasks, **in proportion to their own weight**, so
 * a covered plan always spends the full 100.
 *
 * Proportional to weight, deliberately not to task count. Routing
 * points toward whichever unit holds the most tasks would let the shape
 * of your execution outrank the diagnostic — a 5-point unit with three
 * tasks would matter more in a day than a 12-point unit with one — and
 * it would reward writing more tasks, the one lever entirely under the
 * user's hand. Scaling by weight keeps the strategy's order exactly as
 * the diagnostic set it; only the scale changes.
 *
 * One task covers a unit. Grading coverage against §6's recommended
 * counts was considered and rejected for now: it makes adding a task to
 * one unit quietly move points in another, which is a lot of motion to
 * explain for a nudge §6 already delivers in words.
 *
 * Units with no tasks come back as 0 — they have nothing to price. The
 * weight they hold is still theirs on the diagnostic; this is only the
 * question of what today's checklist is scored against.
 */
export function spendableWeights(
  units: readonly UnitCoverage[],
): Map<string, number> {
  const spendable = new Map(units.map((u) => [u.unitId, 0]));

  // Weight 0 is a unit outside scoring: it has no share to be scaled,
  // and including it here would let rounding hand it a stray point.
  const covered = units.filter((u) => u.covered && u.weight > 0);
  const total = covered.reduce((sum, u) => sum + u.weight, 0);
  if (total === 0) return spendable;

  const exacts = covered.map((u) => (DAILY_BUDGET * u.weight) / total);
  const scaled = largestRemainder(exacts, DAILY_BUDGET);
  covered.forEach((u, i) => spendable.set(u.unitId, scaled[i] ?? 0));
  return spendable;
}
