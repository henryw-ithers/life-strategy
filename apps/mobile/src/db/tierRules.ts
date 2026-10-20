/**
 * Tiers as the data layer stores and reads them (ADR-0041), as pure
 * functions. Split out from `tasks.ts` and `ranking.ts` so they can be
 * tested without React Native.
 *
 * Weights come from **tier and order within the tier, and nothing
 * else** (`deriveTierWeights`). This file decides which units go in and
 * in what order; the engine does the arithmetic.
 */
import {
  applyWeightOverrides,
  deriveTierWeights,
  hasPlannedUnit,
  overrideProblem,
  type Tier,
  type TieredUnit,
} from "@glide/scoring";

export interface TierRow {
  id: string;
  tier: Tier | null;
  tierOrder: number | null;
  sortOrder: number;
  includeInScoring: boolean;
}

const TIER_RANK: Readonly<Record<Tier, number>> = {
  top: 0,
  important: 1,
  background: 2,
  notNow: 3,
};

/**
 * The life units in Priorities order, each with the tier its weight is
 * derived from.
 *
 * "Not in my plan" (`include_in_scoring = false`) is Not now, whatever
 * the stored tier says (ADR-0041 §3). Saving Priorities keeps the two
 * together; a unit back in the plan some other way, without a tier of
 * its own or still marked Not now, counts as the last Background unit,
 * so it carries a weight rather than silently none.
 *
 * Null when no unit has a tier yet: there is no plan to weigh, as
 * before the first diagnostic.
 */
export function tieredUnits(rows: readonly TierRow[]): TieredUnit[] | null {
  if (!rows.some((r) => r.tier !== null)) return null;
  const effective = rows.map((r) => {
    const tier: Tier = !r.includeInScoring
      ? "notNow"
      : r.tier === null || r.tier === "notNow"
        ? "background"
        : r.tier;
    // Untiered and re-included units sort after the tier's own.
    const late = r.includeInScoring && (r.tier === null || r.tier === "notNow");
    return { row: r, tier, late };
  });
  effective.sort(
    (a, b) =>
      TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
      Number(a.late) - Number(b.late) ||
      (a.row.tierOrder ?? Number.MAX_SAFE_INTEGER) - (b.row.tierOrder ?? Number.MAX_SAFE_INTEGER) ||
      a.row.sortOrder - b.row.sortOrder,
  );
  return effective.map((e) => ({ unitId: e.row.id, tier: e.tier }));
}

/**
 * Each unit's place inside its own tier, 0 first, from a placement in
 * Priorities order: what `tier_order` stores.
 */
export function tierOrderOf(placement: readonly TieredUnit[]): Map<string, number> {
  const next = new Map<Tier, number>();
  const out = new Map<string, number>();
  for (const p of placement) {
    const i = next.get(p.tier) ?? 0;
    out.set(p.unitId, i);
    next.set(p.tier, i + 1);
  }
  return out;
}

export interface BoardWeights {
  /** Each planned unit's recommended weight (`deriveTierWeights`). */
  recommended: Map<string, number>;
  /** What scores: the recommended weights with your overrides
   *  (`applyWeightOverrides`). Empty when there's a problem. */
  weights: Map<string, number>;
  /** Why Priorities can't save as it stands, or null. */
  problem: string | null;
}

/**
 * The weights a Priorities board gives (ADR-0041 §2): recommended from
 * tier and order alone, then your overrides. Overrides on Not now units
 * are ignored; they hold no weight to override. What the screen shows
 * while you drag and what saving stores, so the two can't disagree.
 */
export function boardWeights(
  placement: readonly TieredUnit[],
  overrides: ReadonlyMap<string, number>,
): BoardWeights {
  if (!hasPlannedUnit(placement)) {
    return {
      recommended: new Map(),
      weights: new Map(),
      problem: "Keep at least one unit in your plan.",
    };
  }
  const recommended = new Map(
    deriveTierWeights(placement)
      .filter((w) => w.weight > 0)
      .map((w) => [w.unitId, w.weight] as const),
  );
  const problem = overrideProblem(recommended, overrides);
  return {
    recommended,
    weights: problem ? new Map() : applyWeightOverrides(recommended, overrides),
    problem,
  };
}
