/**
 * The Priorities board as one draggable list (ADR-0041 §1). The four
 * tier headers are fixed rows among the units; dragging a unit past a
 * header moves it into that tier, and a unit's tier is the header above
 * it. Pure, so the mapping is tested off-device.
 *
 * A first run starts with every unit **Unsorted**, a section above Top
 * that isn't a tier: you sort each one yourself before Done (Henry,
 * 2026-10-21; ADR-0041 §1 as amended). It shows only while it holds a
 * unit.
 */
import { isTier, TIERS, type Tier, type TieredUnit } from "@glide/scoring";

const HEADER = "tier:";

/** A section of the board: a tier, or Unsorted on a first run. */
export type Slot = Tier | "unsorted";

/** A unit's place on the board, sorted or not yet. */
export interface BoardUnit {
  unitId: string;
  tier: Slot;
}

/** The sections, top to bottom. */
const SLOTS: readonly Slot[] = ["unsorted", ...TIERS];

/** A header row's id. */
export const headerId = (tier: Slot) => `${HEADER}${tier}`;

/** The section a header row stands for, or null for a unit's row. */
export function headerTier(rowId: string): Slot | null {
  if (!rowId.startsWith(HEADER)) return null;
  const tier = rowId.slice(HEADER.length);
  return tier === "unsorted" || isTier(tier) ? tier : null;
}

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

/** The rows for a placement: Unsorted's header while it holds a unit,
 *  then each tier's header, even an empty one, each with its units in
 *  order. */
export function boardRows(placement: readonly BoardUnit[]): string[] {
  return SLOTS.flatMap((tier) => {
    const units = placement.filter((p) => p.tier === tier).map((p) => p.unitId);
    if (tier === "unsorted" && units.length === 0) return [];
    return [headerId(tier), ...units];
  });
}

/** The placement a row order gives. A unit above every header is Top. */
export function placementFromRows(rowIds: readonly string[]): BoardUnit[] {
  let tier: Slot = "top";
  const out: BoardUnit[] = [];
  for (const id of rowIds) {
    const header = headerTier(id);
    if (header) tier = header;
    else out.push({ unitId: id, tier });
  }
  // Rows can arrive with a header moved out of place; sections are
  // listed top first whatever the rows said.
  return SLOTS.flatMap((t) => out.filter((p) => p.tier === t));
}

/** Move a unit to the end of a tier: VoiceOver's Move to tier. */
export function moveToTier(
  placement: readonly BoardUnit[],
  unitId: string,
  tier: Tier,
): BoardUnit[] {
  const unit = placement.find((p) => p.unitId === unitId);
  if (!unit || unit.tier === tier) return [...placement];
  const rest = placement.filter((p) => p.unitId !== unitId);
  return SLOTS.flatMap((t) => [
    ...rest.filter((p) => p.tier === t),
    ...(t === tier ? [{ unitId, tier }] : []),
  ]);
}

/**
 * Swap a unit with its neighbour inside its own tier: Move up and Move
 * down in the unit's sheet, for anyone who can't drag (WCAG 2.2 SC
 * 2.5.7). It never crosses into another tier; changing tier is its own
 * choice.
 */
export function moveWithinTier(
  placement: readonly BoardUnit[],
  unitId: string,
  delta: -1 | 1,
): BoardUnit[] {
  const i = placement.findIndex((p) => p.unitId === unitId);
  const j = i + delta;
  const unit = placement[i];
  const other = placement[j];
  if (!unit || !other || other.tier !== unit.tier) return [...placement];
  const next = [...placement];
  next[i] = other;
  next[j] = unit;
  return next;
}
