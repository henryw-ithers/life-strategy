/**
 * Life's list of units (spec §5.4): grouped by tier, in your order
 * inside each, each with its share of the time you spent in the last 4
 * weeks. The share is a bar with **no target** (ADR-0041 §5): it's
 * drawn against the largest share, never against a weight, so no unit
 * can read as falling short.
 */
import type { Tier } from "@glide/scoring";

export interface LifeUnitRow {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly tasks: number;
  /** Its share of the time, 0–1. */
  readonly share: number;
  /** The bar's length, against the largest share, 0–1. */
  readonly bar: number;
}

export interface TierGroup {
  readonly tier: Tier;
  readonly label: string;
  readonly units: readonly LifeUnitRow[];
}

const ORDER: readonly Tier[] = ["top", "important", "background", "notNow"];
const LABEL: Record<Tier, string> = {
  top: "Top",
  important: "Important",
  background: "Background",
  notNow: "Not now",
};

export function tierGroups(
  units: readonly {
    id: string;
    name: string;
    areaId: string;
    tier: Tier | null;
    tierOrder: number | null;
    tasks: readonly { kind: string }[];
  }[],
  shares: readonly { unitId: string; share: number }[],
): TierGroup[] {
  const shareOf = new Map(shares.map((s) => [s.unitId, s.share]));
  const most = Math.max(0, ...shares.map((s) => s.share));
  return ORDER.map((tier) => ({
    tier,
    label: LABEL[tier],
    units: units
      .filter((u) => (u.tier ?? "important") === tier)
      .sort((a, b) => (a.tierOrder ?? 0) - (b.tierOrder ?? 0) || a.name.localeCompare(b.name))
      .map((u) => {
        const share = shareOf.get(u.id) ?? 0;
        return {
          id: u.id,
          name: u.name,
          areaId: u.areaId,
          tasks: u.tasks.filter((t) => t.kind !== "event").length,
          share,
          bar: most > 0 ? share / most : 0,
        };
      }),
  })).filter((g) => g.units.length > 0);
}
