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

// ── Tiers (ADR-0041) ────────────────────────────────────────────────

/**
 * The four tiers Priorities sorts the 18 units into (ADR-0041 §1).
 * `notNow` is out of the plan: no weight, no tasks, no points.
 */
export type Tier = "top" | "important" | "background" | "notNow";
/** The tiers that are in the plan. */
export type PlannedTier = Exclude<Tier, "notNow">;

/** The tiers, top first. */
export const TIERS: readonly Tier[] = ["top", "important", "background", "notNow"];
const PLANNED_TIERS: readonly PlannedTier[] = ["top", "important", "background"];

/** For the data layer, reading a text column: a stored value that isn't
 *  a tier must not reach the arithmetic as one. */
export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}

/** Each planned tier's base value (ADR-0041 §2). Only the ratios
 *  matter: the results are scaled to `DAILY_BUDGET`. Not now has no
 *  base; it is out of the plan. */
export const TIER_BASE: Readonly<Record<PlannedTier, number>> = {
  top: 1.6,
  important: 1.0,
  background: 0.6,
};

/** The first unit in a tier gets ×(1 + this) and the last ×(1 − this),
 *  spread evenly between; a lone unit gets ×1 (ADR-0041 §2). */
export const TIER_ORDER_SPREAD = 0.1;

export interface TieredUnit {
  readonly unitId: string;
  readonly tier: Tier;
}

/** Whether Priorities can save: at least one unit in the plan
 *  (ADR-0041 §3). The same rule `deriveTierWeights` enforces. */
export function hasPlannedUnit(units: readonly TieredUnit[]): boolean {
  return units.some((u) => u.tier !== "notNow");
}

/**
 * Weights from tiers, then order within the tier (ADR-0041 §2; the
 * next formula version, with ADR-0044):
 *
 *   raw(u)    = TIER_BASE[tier] × (1.1 down to 0.9 by place in the tier)
 *   weight(u) = DAILY_BUDGET × raw(u) / Σ raw
 *
 * **Tier and order are the only inputs**, as rank was for formula v8.
 * `units` is in Priorities order: a unit's place inside its tier is
 * where it stands among the units of that tier in this list. There is
 * no floor (Henry, 2026-10-13): a unit in Background has tasks worth a
 * little less, and that is the point of putting it there.
 *
 * Not now is out of the plan, so it gets exactly 0 and takes no part
 * in the scaling: the units in the plan still sum to exactly
 * `DAILY_BUDGET`, by largest remainder. At least one unit must be in
 * the plan (`hasPlannedUnit`; Priorities won't save otherwise,
 * ADR-0041 §3); with none, or with a value that isn't a tier, or a unit
 * listed twice, this throws rather than inventing weights. An empty
 * list returns no weights, as `deriveWeights` does; it is not a plan.
 *
 * Order is the list's order, so whatever stores tiers must store each
 * unit's place in its tier and read them back sorted.
 *
 * What the app scores with since formula v11 (`latestWeights` in the
 * data layer). `deriveWeights` still fills the diagnostic's stored
 * record and prices nothing.
 */
export function deriveTierWeights(units: readonly TieredUnit[]): DerivedWeight[] {
  if (units.length === 0) return [];
  const seen = new Set<string>();
  for (const u of units) {
    if (!isTier(u.tier)) {
      throw new Error(`deriveTierWeights: unit "${u.unitId}" has no tier, got ${String(u.tier)}`);
    }
    if (seen.has(u.unitId)) {
      throw new Error(`deriveTierWeights: unit "${u.unitId}" is listed twice`);
    }
    seen.add(u.unitId);
  }
  if (!hasPlannedUnit(units)) {
    throw new Error("deriveTierWeights: keep at least one unit in the plan");
  }

  const placeInTier = new Map<string, { index: number; count: number }>();
  for (const tier of PLANNED_TIERS) {
    const members = units.filter((u) => u.tier === tier);
    members.forEach((u, index) => placeInTier.set(u.unitId, { index, count: members.length }));
  }

  const raws = units.map((u) => {
    if (u.tier === "notNow") return 0;
    const place = placeInTier.get(u.unitId);
    const factor =
      !place || place.count === 1
        ? 1
        : 1 + TIER_ORDER_SPREAD - (2 * TIER_ORDER_SPREAD * place.index) / (place.count - 1);
    return TIER_BASE[u.tier] * factor;
  });

  const rawSum = raws.reduce((a, b) => a + b, 0);
  const exacts = raws.map((raw) => (DAILY_BUDGET * raw) / rawSum);
  const planIndexes = units.flatMap((u, i) => (u.tier === "notNow" ? [] : [i]));
  const rounded = largestRemainder(
    planIndexes.map((i) => exacts[i] ?? 0),
    DAILY_BUDGET,
  );
  const weights = new Map(planIndexes.map((i, k) => [i, rounded[k] ?? 0]));

  return units.map((u, i) => ({
    unitId: u.unitId,
    raw: raws[i] ?? 0,
    exact: exacts[i] ?? 0,
    weight: weights.get(i) ?? 0,
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

// ── Overrides (ADR-0041 §2) ─────────────────────────────────────────

/**
 * What's wrong with a set of weight overrides, or null if they fit.
 *
 * An override is a whole number from 1 to 99: 0 is what Not now is for,
 * and 100 would leave nothing for anything else. Overrides on units not
 * in `recommended` are ignored, as `applyWeightOverrides` ignores them.
 * Together they must leave room for the units you didn't override, or,
 * with every unit overridden, add up to exactly 100.
 */
export function overrideProblem(
  recommended: ReadonlyMap<string, number>,
  overrides: ReadonlyMap<string, number>,
): string | null {
  let sum = 0;
  let count = 0;
  for (const [unitId, w] of overrides) {
    if (!recommended.has(unitId)) continue;
    if (!Number.isInteger(w) || w < 1 || w > 99) {
      return "A weight is a whole number from 1 to 99.";
    }
    sum += w;
    count += 1;
  }
  if (count === 0) return null;
  if (count === recommended.size) {
    return sum === DAILY_BUDGET ? null : `Your weights add up to ${sum}, not ${DAILY_BUDGET}.`;
  }
  return sum < DAILY_BUDGET ? null : "Those weights leave no room for your other units.";
}

/**
 * Weights with your overrides (ADR-0041 §2; Henry, 2026-10-19): an
 * overridden unit keeps exactly the number you set, and the units you
 * didn't override share what's left in proportion to their recommended
 * weights, so the plan still adds to exactly `DAILY_BUDGET` by largest
 * remainder. The recommended weight is always kept beside an override
 * for the screen to show (AGENTS.md); this only works out what scores.
 *
 * `recommended` is `deriveTierWeights`' plan, unit to weight, Not now
 * left out. Throws with `overrideProblem`'s message rather than invent
 * weights.
 */
export function applyWeightOverrides(
  recommended: ReadonlyMap<string, number>,
  overrides: ReadonlyMap<string, number>,
): Map<string, number> {
  const problem = overrideProblem(recommended, overrides);
  if (problem) throw new Error(`applyWeightOverrides: ${problem}`);
  const fixed = new Map([...overrides].filter(([unitId]) => recommended.has(unitId)));
  if (fixed.size === 0) return new Map(recommended);
  const rest = [...recommended].filter(([unitId]) => !fixed.has(unitId));
  const left = DAILY_BUDGET - [...fixed.values()].reduce((a, b) => a + b, 0);
  const restSum = rest.reduce((a, [, w]) => a + w, 0);
  const shares = largestRemainder(
    rest.map(([, w]) => (restSum > 0 ? (left * w) / restSum : left / rest.length)),
    left,
  );
  const out = new Map<string, number>();
  for (const [unitId] of recommended) {
    const own = fixed.get(unitId);
    out.set(unitId, own ?? shares[rest.findIndex(([id]) => id === unitId)] ?? 0);
  }
  return out;
}
