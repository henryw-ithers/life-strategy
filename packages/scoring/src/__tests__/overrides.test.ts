/**
 * Weight overrides on tier weights (ADR-0041 §2, AGENTS.md: every
 * derived value is overridable, and an override shows the recommended
 * value beside it). Henry, 2026-10-19: an overridden unit keeps exactly
 * the number you set, and the rest share what's left in proportion to
 * their recommended weights.
 */
import { describe, expect, it } from "vitest";

import { applyWeightOverrides, overrideProblem } from "../weights";

const recommended = new Map([
  ["exercise", 40],
  ["friends", 30],
  ["sleep", 20],
  ["money", 10],
]);
const total = (m: ReadonlyMap<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("applyWeightOverrides", () => {
  it("is the recommended weights when nothing is overridden", () => {
    expect(applyWeightOverrides(recommended, new Map())).toEqual(recommended);
  });

  it("keeps an override exactly, and shares the rest by recommended weight", () => {
    const w = applyWeightOverrides(recommended, new Map([["money", 40]]));
    expect(w.get("money")).toBe(40);
    // 60 left over 90 recommended: 40→26.7, 30→20, 20→13.3.
    expect(w.get("exercise")).toBe(27);
    expect(w.get("friends")).toBe(20);
    expect(w.get("sleep")).toBe(13);
    expect(total(w)).toBe(100);
  });

  it("always adds to exactly 100", () => {
    for (const o of [5, 17, 33, 61, 89]) {
      expect(total(applyWeightOverrides(recommended, new Map([["friends", o]])))).toBe(100);
    }
  });

  it("ignores an override for a unit that isn't in the plan", () => {
    expect(applyWeightOverrides(recommended, new Map([["rest", 50]]))).toEqual(recommended);
  });

  it("accepts every unit overridden when they add to 100", () => {
    const all = new Map([
      ["exercise", 25],
      ["friends", 25],
      ["sleep", 25],
      ["money", 25],
    ]);
    expect(applyWeightOverrides(recommended, all)).toEqual(all);
  });

  it("throws rather than invent weights when overrides leave no room", () => {
    expect(() => applyWeightOverrides(recommended, new Map([["money", 100]]))).toThrow();
  });
});

describe("overrideProblem", () => {
  it("is null for overrides that fit", () => {
    expect(overrideProblem(recommended, new Map([["money", 40]]))).toBeNull();
  });

  it("refuses overrides that leave nothing for the other units", () => {
    expect(
      overrideProblem(
        recommended,
        new Map([
          ["money", 60],
          ["sleep", 40],
        ]),
      ),
    ).toMatch(/room/);
  });

  it("refuses every unit overridden to something other than 100", () => {
    expect(
      overrideProblem(
        recommended,
        new Map([
          ["exercise", 20],
          ["friends", 20],
          ["sleep", 20],
          ["money", 20],
        ]),
      ),
    ).toMatch(/100/);
  });

  it("refuses a weight that isn't a whole number from 1 to 99", () => {
    expect(overrideProblem(recommended, new Map([["money", 0]]))).toMatch(/1 to 99/);
    expect(overrideProblem(recommended, new Map([["money", 12.5]]))).toMatch(/1 to 99/);
    expect(overrideProblem(recommended, new Map([["money", Number.NaN]]))).toMatch(/1 to 99/);
  });
});
