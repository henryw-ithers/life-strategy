import { DAILY_BUDGET, WEIGHT_SPREAD } from "./constants";
import { largestRemainder } from "./rounding";
import type { DerivedWeight, UnitRating } from "./types";

/** Importance may be an absolute 1–10 rating or a rank-derived
 *  continuous score (`rankToScore`) — both live in the same [1, 10]
 *  range, so the contract only checks range, not integrality. */
function assertImportance(value: number, unitId: string): void {
  if (!Number.isFinite(value) || value < 1 || value > 10) {
    throw new Error(
      `deriveWeights: importance for unit "${unitId}" must be a number 1–10, got ${value}`,
    );
  }
}

/**
 * Formula v8 (ADR-0028 §§1–2):
 *
 *   raw(u)    = 1 + (WEIGHT_SPREAD − 1) × (importance − 1) / 9
 *   weight(u) = DAILY_BUDGET × raw(u) / Σ raw
 *
 * **Priority is the only input.** Satisfaction is diagnosed on the same
 * screen, stored on the same row, and read by the portfolio graph and
 * `unitProfile` — but it no longer moves a single point. ADR-0003 §1's
 * gap term (`+ g × max(0, I − S)`) and its `GAP_COEFFICIENT` are
 * withdrawn.
 *
 * The reasoning, from ADR-0028: the gap term made weight a function of
 * two answers given at the same moment about the same unit, and the
 * second one is the app's own outcome measure. A unit you are neglecting
 * got more of your day *because* you were neglecting it, which then
 * raised your satisfaction with it, which then quietly took the points
 * away again. Calibration (ADR-0008) needs satisfaction to be an
 * independent read on whether the plan is working; it cannot be that
 * and an input to the plan at once.
 *
 * `raw` is the flattened rank score rather than importance itself —
 * see `WEIGHT_SPREAD` for why the 10:1 shape it replaces was wrong.
 * The map is affine and strictly increasing, so the diagnostic's order
 * survives intact; only the distance between neighbours changes.
 *
 * Integer weights sum to exactly DAILY_BUDGET via largest remainder.
 */
export function deriveWeights(ratings: readonly UnitRating[]): DerivedWeight[] {
  if (ratings.length === 0) return [];

  const raws = ratings.map((r) => {
    assertImportance(r.importance, r.unitId);
    return 1 + ((WEIGHT_SPREAD - 1) * (r.importance - 1)) / 9;
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

/**
 * `spendableWeights` **retired 2026-08-26 (ADR-0028 §3, ADR-0029 §1).**
 *
 * ADR-0003 §5 shared the weight of a task-less unit out among the units
 * that had tasks; ADR-0027 §2 withdrew that and let the weight sit
 * unearnable instead; this function survived both decisions unused,
 * because ADR-0027's action item 2 removed the *call sites* and left
 * the code.
 *
 * ADR-0028 §3 brought redistribution back at the band level, and
 * ADR-0029 removed the question entirely. A unit's weight divides
 * across the tasks it holds (`taskWeights`); what a *day* asks for is
 * worked out from what is actually due on it (`dayLoad.ts`). There is
 * no portfolio-level notion of "spendable weight" left to want.
 */
