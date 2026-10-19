import { describe, expect, it } from "vitest";

import { tieredUnits, tiersFromOrder, type TierRow } from "../tierRules";

const row = (id: string, over: Partial<TierRow> = {}): TierRow => ({
  id,
  tier: "important",
  tierOrder: 0,
  sortOrder: 0,
  includeInScoring: true,
  ...over,
});

describe("tiersFromOrder", () => {
  it("splits 18 ranked units into thirds, keeping their places", () => {
    const order = Array.from({ length: 18 }, (_, i) => `u${i}`);
    const tiers = tiersFromOrder(order, new Set(order));
    const count = (t: string) => [...tiers.values()].filter((v) => v.tier === t).length;
    expect([count("top"), count("important"), count("background")]).toEqual([6, 6, 6]);
    expect(tiers.get("u6")).toEqual({ tier: "important", tierOrder: 0 });
    expect(tiers.get("u17")).toEqual({ tier: "background", tierOrder: 5 });
  });

  it("puts units not in the plan in Not now and leaves them out of the thirds", () => {
    const tiers = tiersFromOrder(["a", "x", "b", "c"], new Set(["a", "b", "c"]));
    expect(tiers.get("x")).toEqual({ tier: "notNow", tierOrder: 0 });
    expect([tiers.get("a")?.tier, tiers.get("b")?.tier, tiers.get("c")?.tier]).toEqual([
      "top",
      "important",
      "background",
    ]);
  });
});

describe("tieredUnits", () => {
  it("is null before any unit has a tier", () => {
    expect(tieredUnits([row("a", { tier: null })])).toBeNull();
  });

  it("orders by tier, then place, and treats 'Not in my plan' as Not now", () => {
    const units = tieredUnits([
      row("bg", { tier: "background" }),
      row("top2", { tier: "top", tierOrder: 1 }),
      row("top1", { tier: "top", tierOrder: 0 }),
      row("off", { tier: "top", includeInScoring: false }),
    ]);
    expect(units).toEqual([
      { unitId: "top1", tier: "top" },
      { unitId: "top2", tier: "top" },
      { unitId: "bg", tier: "background" },
      { unitId: "off", tier: "notNow" },
    ]);
  });

  it("gives a unit back in the plan with no tier the last Background place", () => {
    const units = tieredUnits([
      row("new", { tier: null, tierOrder: null }),
      row("back", { tier: "notNow" }),
      row("bg", { tier: "background", tierOrder: 3 }),
    ]);
    expect(units?.map((u) => [u.unitId, u.tier])).toEqual([
      ["bg", "background"],
      ["back", "background"],
      ["new", "background"],
    ]);
  });
});
