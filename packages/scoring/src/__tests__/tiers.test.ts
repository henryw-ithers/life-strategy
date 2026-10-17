/**
 * ADR-0041: priorities are four tiers, and weights come from tier, then
 * order within the tier. Not now is out of the plan.
 */
import { describe, expect, it } from "vitest";

import { recommendedTaskRangeForTier } from "../taskGuidance";
import {
  deriveTierWeights,
  hasPlannedUnit,
  isTier,
  type Tier,
  type TieredUnit,
} from "../weights";

const units = (spec: [Tier, number][]): TieredUnit[] =>
  spec.flatMap(([tier, n]) =>
    Array.from({ length: n }, (_, i) => ({ unitId: `${tier}-${i}`, tier })),
  );

const sum = (ws: { weight: number }[]) => ws.reduce((a, w) => a + w.weight, 0);
const exactOf = (ws: { unitId: string; exact: number }[], id: string) =>
  ws.find((w) => w.unitId === id)?.exact ?? NaN;

describe("deriveTierWeights", () => {
  it("adds up to exactly 100", () => {
    const ws = deriveTierWeights(units([["top", 4], ["important", 6], ["background", 5], ["notNow", 3]]));
    expect(sum(ws)).toBe(100);
  });

  it("matches ADR-0041's worked example (4 / 6 / 5 / 3)", () => {
    const ws = deriveTierWeights(units([["top", 4], ["important", 6], ["background", 5], ["notNow", 3]]));
    const mean = (tier: Tier) => {
      const xs = ws.filter((w) => w.unitId.startsWith(tier)).map((w) => w.exact);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(mean("top")).toBeCloseTo(10.4, 1);
    expect(mean("important")).toBeCloseTo(6.5, 1);
    expect(mean("background")).toBeCloseTo(3.9, 1);
    // The last Background unit gets about 3.5%.
    expect(exactOf(ws, "background-4")).toBeCloseTo(3.5, 1);
  });

  it("gives Not now exactly nothing (EC-39)", () => {
    const ws = deriveTierWeights(units([["top", 3], ["notNow", 2]]));
    for (const w of ws.filter((x) => x.unitId.startsWith("notNow"))) {
      expect(w.weight).toBe(0);
      expect(w.exact).toBe(0);
    }
    expect(sum(ws)).toBe(100);
  });

  it("moves a unit into Not now and the others still add to 100 (EC-39)", () => {
    const before = units([["top", 2], ["important", 3], ["background", 2]]);
    const after = before.map((u) => (u.unitId === "important-1" ? { ...u, tier: "notNow" as const } : u));
    expect(sum(deriveTierWeights(after))).toBe(100);
    expect(deriveTierWeights(after).find((w) => w.unitId === "important-1")?.weight).toBe(0);
  });

  it("adds up to 100 with all 18 units in one tier, and shares by order (EC-40)", () => {
    const ws = deriveTierWeights(units([["important", 18]]));
    expect(sum(ws)).toBe(100);
    // First ×1.1 to last ×0.9: an 11:9 spread inside the tier.
    expect(exactOf(ws, "important-0") / exactOf(ws, "important-17")).toBeCloseTo(1.1 / 0.9, 6);
  });

  it("gives a lone unit in a tier ×1", () => {
    const ws = deriveTierWeights(units([["top", 1], ["important", 1]]));
    expect(exactOf(ws, "top-0") / exactOf(ws, "important-0")).toBeCloseTo(1.6, 6);
  });

  it("orders within a tier by place in the list, whatever else is between", () => {
    const list: TieredUnit[] = [
      { unitId: "a", tier: "top" },
      { unitId: "x", tier: "background" },
      { unitId: "b", tier: "top" },
    ];
    const ws = deriveTierWeights(list);
    expect(exactOf(ws, "a") / exactOf(ws, "b")).toBeCloseTo(1.1 / 0.9, 6);
  });

  it("can fall to about 2.3% at the bottom with most units in Top, with no floor", () => {
    const ws = deriveTierWeights(units([["top", 12], ["important", 3], ["background", 3]]));
    expect(exactOf(ws, "background-2")).toBeCloseTo(2.25, 2);
    expect(sum(ws)).toBe(100);
  });

  it("refuses a plan with every unit in Not now", () => {
    expect(() => deriveTierWeights(units([["notNow", 18]]))).toThrow(/at least one unit/);
  });

  it("refuses a value that isn't a tier", () => {
    const bad = [{ unitId: "a", tier: "middle" as Tier }];
    expect(() => deriveTierWeights(bad)).toThrow(/no tier/);
  });

  it("refuses a unit listed twice", () => {
    const twice: TieredUnit[] = [
      { unitId: "a", tier: "top" },
      { unitId: "a", tier: "important" },
    ];
    expect(() => deriveTierWeights(twice)).toThrow(/listed twice/);
  });

  it("gives different weights when the order inside a tier changes", () => {
    const list = units([["top", 3]]);
    const reordered = [list[2]!, list[0]!, list[1]!];
    expect(exactOf(deriveTierWeights(reordered), "top-2")).toBeGreaterThan(
      exactOf(deriveTierWeights(list), "top-2"),
    );
  });

  it("returns nothing for no units", () => {
    expect(deriveTierWeights([])).toEqual([]);
  });

  it("is decided by tier and order alone: the same input gives the same weights", () => {
    const list = units([["top", 3], ["important", 4], ["background", 4]]);
    expect(deriveTierWeights(list)).toEqual(deriveTierWeights([...list]));
  });
});

describe("recommendedTaskRangeForTier", () => {
  it("steps down by tier, and Not now holds nothing", () => {
    expect(recommendedTaskRangeForTier("top")).toEqual({ min: 2, max: 3 });
    expect(recommendedTaskRangeForTier("important")).toEqual({ min: 1, max: 2 });
    expect(recommendedTaskRangeForTier("background")).toEqual({ min: 1, max: 1 });
    expect(recommendedTaskRangeForTier("notNow")).toEqual({ min: 0, max: 0 });
  });
});

describe("hasPlannedUnit and isTier", () => {
  it("says whether Priorities can save", () => {
    expect(hasPlannedUnit(units([["notNow", 18]]))).toBe(false);
    expect(hasPlannedUnit(units([["notNow", 17], ["background", 1]]))).toBe(true);
  });

  it("knows a tier from a stored string", () => {
    expect(isTier("top")).toBe(true);
    expect(isTier("notNow")).toBe(true);
    expect(isTier("Top")).toBe(false);
    expect(isTier(null)).toBe(false);
  });
});
