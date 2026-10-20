/**
 * The Priorities board as one draggable list (ADR-0041 §1). The four
 * tier headers are fixed rows among the units; dragging a unit past a
 * header moves it into that tier, and a unit's tier is the header above
 * it. Pure, so the mapping is tested off-device.
 */
import { isTier, TIERS, type Tier, type TieredUnit } from "@glide/scoring";

const HEADER = "tier:";

/** A header row's id. */
export const headerId = (tier: Tier) => `${HEADER}${tier}`;

/** The tier a header row stands for, or null for a unit's row. */
export function headerTier(rowId: string): Tier | null {
  if (!rowId.startsWith(HEADER)) return null;
  const tier = rowId.slice(HEADER.length);
  return isTier(tier) ? tier : null;
}

/** The rows for a placement: each tier's header, even an empty one,
 *  then its units in order. */
export function boardRows(placement: readonly TieredUnit[]): string[] {
  return TIERS.flatMap((tier) => [
    headerId(tier),
    ...placement.filter((p) => p.tier === tier).map((p) => p.unitId),
  ]);
}

/** The placement a row order gives. A unit above every header is Top. */
export function placementFromRows(rowIds: readonly string[]): TieredUnit[] {
  let tier: Tier = "top";
  const out: TieredUnit[] = [];
  for (const id of rowIds) {
    const header = headerTier(id);
    if (header) tier = header;
    else out.push({ unitId: id, tier });
  }
  // Rows can arrive with a header moved out of place; tiers are listed
  // top first whatever the rows said.
  return TIERS.flatMap((t) => out.filter((p) => p.tier === t));
}

/** Move a unit to the end of a tier: VoiceOver's Move to tier. */
export function moveToTier(
  placement: readonly TieredUnit[],
  unitId: string,
  tier: Tier,
): TieredUnit[] {
  const unit = placement.find((p) => p.unitId === unitId);
  if (!unit || unit.tier === tier) return [...placement];
  const rest = placement.filter((p) => p.unitId !== unitId);
  return TIERS.flatMap((t) => [
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
  placement: readonly TieredUnit[],
  unitId: string,
  delta: -1 | 1,
): TieredUnit[] {
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
