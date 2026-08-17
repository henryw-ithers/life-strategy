import { describe, expect, it } from "vitest";

import { deriveEffort, rawEffort, type UnitEffortInput } from "../effort";

const unit = (over: Partial<UnitEffortInput> = {}): UnitEffortInput => ({
  unitId: "u",
  points: 0,
  taggedDays: 0,
  weight: 0,
  ...over,
});

describe("rawEffort", () => {
  it("measures a scoring unit by its points", () => {
    expect(rawEffort(unit({ points: 120, weight: 9 }))).toBe(120);
  });

  it("measures a note-shaped unit by tagged days priced at its weight", () => {
    // The comparability rule: a scored unit accrues roughly its weight
    // on a day it is fully done, so a tagged day is worth the same.
    expect(rawEffort(unit({ taggedDays: 6, weight: 9 }))).toBe(54);
  });

  it("ignores tags once a unit earns points", () => {
    // Keeps the two paths from double-counting, and means nothing here
    // changes when ADR-0025 §3 lands and communal units start earning.
    expect(rawEffort(unit({ points: 40, taggedDays: 10, weight: 9 }))).toBe(40);
  });

  it("is zero for a unit with no history at all", () => {
    expect(rawEffort(unit({ weight: 12 }))).toBe(0);
    expect(rawEffort(unit({ taggedDays: 5, weight: 0 }))).toBe(0);
  });

  it("never goes negative on malformed input", () => {
    expect(rawEffort(unit({ taggedDays: -3, weight: 9 }))).toBe(0);
    expect(rawEffort(unit({ taggedDays: 3, weight: -9 }))).toBe(0);
  });
});

describe("deriveEffort", () => {
  it("normalises to 0–1 against the busiest unit", () => {
    const out = deriveEffort([
      unit({ unitId: "exercise", points: 200 }),
      unit({ unitId: "finances", points: 50 }),
    ])!;
    expect(out.get("exercise")).toBe(1);
    expect(out.get("finances")).toBe(0.25);
  });

  it("puts a tagged unit on the same scale as a scored one", () => {
    // The bug this guards: without pricing tagged days, a communal
    // unit reads as zero effort and renders at minimum bubble size
    // forever, however much of the person's life involved it.
    const out = deriveEffort([
      unit({ unitId: "exercise", points: 100 }),
      unit({ unitId: "friendship", taggedDays: 10, weight: 10 }),
    ])!;
    expect(out.get("friendship")).toBe(1);
    expect(out.get("exercise")).toBe(1);
  });

  it("keeps a lightly-tagged unit visibly smaller, not absent", () => {
    const out = deriveEffort([
      unit({ unitId: "exercise", points: 100 }),
      unit({ unitId: "family", taggedDays: 2, weight: 10 }),
    ])!;
    expect(out.get("family")).toBe(0.2);
  });

  it("returns null when nothing has been logged", () => {
    // A first-ever snapshot must not claim every unit was neglected;
    // the caller stores null and the graph renders uniform bubbles.
    expect(deriveEffort([unit({ unitId: "a" }), unit({ unitId: "b" })])).toBeNull();
    expect(deriveEffort([])).toBeNull();
  });

  it("covers every unit it was given", () => {
    const out = deriveEffort([
      unit({ unitId: "a", points: 10 }),
      unit({ unitId: "b" }),
    ])!;
    expect([...out.keys()].sort()).toEqual(["a", "b"]);
    expect(out.get("b")).toBe(0);
  });
});
