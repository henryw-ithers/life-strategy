/**
 * Your priorities as a board (ADR-0041 §1, on Life since ADR-0048):
 * every unit in a tier, in your order inside it. Pure, so the moves
 * are tested off-device.
 *
 * A first run starts with every unit **Unsorted**, a section above Top
 * that isn't a tier: you sort each one yourself (Henry, 2026-10-21;
 * ADR-0041 §1 as amended), and nothing saves until all are sorted.
 */
import { TIERS, type Tier, type TieredUnit } from "@glide/scoring";

/** A section of the board: a tier, or Unsorted on a first run. */
export type Slot = Tier | "unsorted";

/** A unit's place on the board, sorted or not yet. */
export interface BoardUnit {
  unitId: string;
  tier: Slot;
}

/** The sections, top to bottom. */
const SLOTS: readonly Slot[] = ["unsorted", ...TIERS];

/** Every unit is in a tier: the board can be saved. */
export function sortedPlacement(placement: readonly BoardUnit[]): TieredUnit[] | null {
  const out: TieredUnit[] = [];
  for (const p of placement) {
    if (p.tier === "unsorted") return null;
    out.push({ unitId: p.unitId, tier: p.tier });
  }
  return out;
}

/** The units in a tier so far, for the weights while you sort. */
export function inTiers(placement: readonly BoardUnit[]): TieredUnit[] {
  return placement.flatMap((p) => (p.tier === "unsorted" ? [] : [{ unitId: p.unitId, tier: p.tier }]));
}

/**
 * Drop a unit into a section at a place among the units already there
 * (Life's drag): `index` counts that section's units without the one
 * being moved. Sections stay in order, top first.
 */
export function moveTo(
  placement: readonly BoardUnit[],
  unitId: string,
  slot: Slot,
  index: number,
): BoardUnit[] {
  if (!placement.some((p) => p.unitId === unitId)) return [...placement];
  const rest = placement.filter((p) => p.unitId !== unitId);
  return SLOTS.flatMap((t) => {
    const here = rest.filter((p) => p.tier === t);
    if (t !== slot) return here;
    const at = Math.max(0, Math.min(index, here.length));
    return [...here.slice(0, at), { unitId, tier: slot }, ...here.slice(at)];
  });
}
