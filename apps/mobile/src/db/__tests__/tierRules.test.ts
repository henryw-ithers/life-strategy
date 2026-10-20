import { describe, expect, it } from "vitest";

import { boardWeights, tieredUnits, tierOrderOf, tiersFromOrder, type TierRow } from "../tierRules";

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

describe("boardWeights (Phase 6)", () => {
  const placement = [
    { unitId: "exercise", tier: "top" as const },
    { unitId: "friends", tier: "important" as const },
    { unitId: "sleep", tier: "background" as const },
    { unitId: "rest", tier: "notNow" as const },
  ];

  it("gives recommended tier weights adding to 100, Not now left out", () => {
    const b = boardWeights(placement, new Map());
    expect(b.problem).toBeNull();
    expect([...b.recommended.values()].reduce((a, w) => a + w, 0)).toBe(100);
    expect(b.recommended.has("rest")).toBe(false);
    expect(b.weights).toEqual(b.recommended);
  });

  it("applies overrides beside the recommended weights", () => {
    const b = boardWeights(placement, new Map([["sleep", 30]]));
    expect(b.weights.get("sleep")).toBe(30);
    expect(b.recommended.get("sleep")).not.toBe(30);
    expect([...b.weights.values()].reduce((a, w) => a + w, 0)).toBe(100);
  });

  it("ignores an override on a Not now unit", () => {
    expect(boardWeights(placement, new Map([["rest", 20]])).weights).toEqual(
      boardWeights(placement, new Map()).weights,
    );
  });

  it("says so when every unit is Not now", () => {
    const b = boardWeights(
      placement.map((p) => ({ ...p, tier: "notNow" as const })),
      new Map(),
    );
    expect(b.problem).toBe("Keep at least one unit in your plan.");
    expect(b.weights.size).toBe(0);
  });

  it("says so when overrides don't fit", () => {
    expect(boardWeights(placement, new Map([["sleep", 100]])).problem).toMatch(/1 to 99/);
  });
});

describe("tierOrderOf (Phase 6)", () => {
  it("numbers each unit's place inside its own tier", () => {
    expect(
      tierOrderOf([
        { unitId: "a", tier: "top" },
        { unitId: "b", tier: "important" },
        { unitId: "c", tier: "top" },
      ]),
    ).toEqual(new Map([
      ["a", 0],
      ["b", 0],
      ["c", 1],
    ]));
  });
});
