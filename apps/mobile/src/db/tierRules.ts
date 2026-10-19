/**
 * Tiers as the data layer stores and reads them (ADR-0041), as pure
 * functions. Split out from `tasks.ts` and `ranking.ts` so they can be
 * tested without React Native.
 *
 * Weights come from **tier and order within the tier, and nothing
 * else** (`deriveTierWeights`). This file decides which units go in and
 * in what order; the engine does the arithmetic.
 */
import { deriveTierWeights, hasPlannedUnit, type Tier, type TieredUnit } from "@glide/scoring";

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
 * the stored tier says (ADR-0041 §3). Until Phase 6's Priorities screen
 * keeps the two together, a unit put back in the plan without a tier
 * of its own, or still marked Not now, counts as the last Background
 * unit, so it carries a weight rather than silently none.
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
 * Tiers from a ranked order, in thirds (Henry, 2026-10-17): the first
 * third Top, the next Important, the rest Background, each keeping its
 * place. Units not in the plan are Not now. Used once to seed tiers
 * from the old ranking, and by the old Priorities screen until Phase 6
 * replaces it.
 *
 * `order` lists every unit to place, most important first. Units in it
 * but not in `included` go to Not now, in their order.
 */
export function tiersFromOrder(
  order: readonly string[],
  included: ReadonlySet<string>,
): Map<string, { tier: Tier; tierOrder: number }> {
  const inPlan = order.filter((id) => included.has(id));
  const out = new Map<string, { tier: Tier; tierOrder: number }>();
  const n = inPlan.length;
  const topEnd = Math.ceil(n / 3);
  const importantEnd = Math.ceil((2 * n) / 3);
  inPlan.forEach((id, i) => {
    if (i < topEnd) out.set(id, { tier: "top", tierOrder: i });
    else if (i < importantEnd) out.set(id, { tier: "important", tierOrder: i - topEnd });
    else out.set(id, { tier: "background", tierOrder: i - importantEnd });
  });
  order
    .filter((id) => !included.has(id))
    .forEach((id, i) => out.set(id, { tier: "notNow", tierOrder: i }));
  return out;
}

/**
 * The weights a ranked order would give under the interim thirds rule:
 * `tiersFromOrder`, then `deriveTierWeights`. What the old Priorities
 * screen previews and what the diagnostic's results compare, so both
 * show the weights that actually score (ADR-0041). Empty with nothing
 * in the plan.
 */
export function tierWeightsForOrder(
  order: readonly string[],
  included: ReadonlySet<string>,
): Map<string, number> {
  const tiers = tiersFromOrder(order, included);
  const units = tieredUnits(
    order.map((id, i) => ({
      id,
      tier: tiers.get(id)?.tier ?? null,
      tierOrder: tiers.get(id)?.tierOrder ?? null,
      sortOrder: i,
      includeInScoring: included.has(id),
    })),
  );
  if (units === null || !hasPlannedUnit(units)) return new Map();
  return new Map(
    deriveTierWeights(units)
      .filter((w) => w.weight > 0)
      .map((w) => [w.unitId, w.weight]),
  );
}
