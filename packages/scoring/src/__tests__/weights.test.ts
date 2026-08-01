import { describe, expect, it } from "vitest";
import { DAILY_BUDGET } from "../constants";
import { deriveWeights, spendableWeights } from "../weights";
import type { UnitRating } from "../types";

/** Deterministic PRNG so property-style tests reproduce exactly. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomPortfolio(rand: () => number, unitCount: number): UnitRating[] {
  return Array.from({ length: unitCount }, (_, i) => ({
    unitId: `unit-${i}`,
    importance: 1 + Math.floor(rand() * 10),
    satisfaction: 1 + Math.floor(rand() * 10),
  }));
}

describe("deriveWeights — ADR-0003 worked example", () => {
  it("produces 53 / 33 / 14", () => {
    const weights = deriveWeights([
      { unitId: "physical-health", importance: 9, satisfaction: 4 },
      { unitId: "friendship", importance: 7, satisfaction: 7 },
      { unitId: "online-entertainment", importance: 3, satisfaction: 6 },
    ]);
    expect(weights.map((w) => w.weight)).toEqual([53, 33, 14]);
  });
});

describe("deriveWeights — invariants", () => {
  it("weights always sum to exactly DAILY_BUDGET", () => {
    const rand = lcg(42);
    for (let run = 0; run < 300; run++) {
      const unitCount = 1 + Math.floor(rand() * 16);
      const weights = deriveWeights(randomPortfolio(rand, unitCount));
      const sum = weights.reduce((a, w) => a + w.weight, 0);
      expect(sum).toBe(DAILY_BUDGET);
    }
  });

  it("raw score is monotone in importance (satisfaction fixed)", () => {
    for (let importance = 2; importance <= 10; importance++) {
      const [lower, higher] = deriveWeights([
        { unitId: "lo", importance: importance - 1, satisfaction: 5 },
        { unitId: "hi", importance, satisfaction: 5 },
      ]);
      expect(higher!.raw).toBeGreaterThan(lower!.raw);
    }
  });

  it("surplus satisfaction neither boosts nor penalizes (S > I ≡ S = I)", () => {
    const surplus = deriveWeights([
      { unitId: "a", importance: 4, satisfaction: 9 },
      { unitId: "b", importance: 8, satisfaction: 8 },
    ]);
    const level = deriveWeights([
      { unitId: "a", importance: 4, satisfaction: 4 },
      { unitId: "b", importance: 8, satisfaction: 8 },
    ]);
    expect(surplus.map((w) => w.weight)).toEqual(level.map((w) => w.weight));
  });

  it("the satisfaction gap boosts weight", () => {
    const [gapped, satisfied] = deriveWeights([
      { unitId: "gapped", importance: 8, satisfaction: 3 },
      { unitId: "satisfied", importance: 8, satisfaction: 8 },
    ]);
    expect(gapped!.weight).toBeGreaterThan(satisfied!.weight);
  });

  it("rejects out-of-range ratings", () => {
    expect(() =>
      deriveWeights([{ unitId: "a", importance: 0, satisfaction: 5 }]),
    ).toThrow();
    expect(() =>
      deriveWeights([{ unitId: "a", importance: 5, satisfaction: 11 }]),
    ).toThrow();
    expect(() =>
      deriveWeights([{ unitId: "a", importance: Number.NaN, satisfaction: 5 }]),
    ).toThrow();
  });

  it("accepts continuous, non-integer ratings (rank-derived scores)", () => {
    const weights = deriveWeights([
      { unitId: "a", importance: 8.5, satisfaction: 3.2 },
      { unitId: "b", importance: 5.5, satisfaction: 5.5 },
    ]);
    const sum = weights.reduce((a, w) => a + w.weight, 0);
    expect(sum).toBe(DAILY_BUDGET);
    expect(weights[0]!.weight).toBeGreaterThan(weights[1]!.weight);
  });

  it("returns [] for an empty portfolio", () => {
    expect(deriveWeights([])).toEqual([]);
  });
});

describe("spendableWeights — ADR-0003 §5 amendment", () => {
  const cover = (
    entries: [string, number, boolean][],
  ): { unitId: string; weight: number; covered: boolean }[] =>
    entries.map(([unitId, weight, covered]) => ({ unitId, weight, covered }));

  it("changes nothing when every unit has tasks", () => {
    const units = cover([
      ["a", 50, true],
      ["b", 30, true],
      ["c", 20, true],
    ]);
    const spendable = spendableWeights(units);
    expect([...spendable.values()]).toEqual([50, 30, 20]);
  });

  it("shares an uncovered unit's weight across the covered ones", () => {
    const units = cover([
      ["a", 12, true],
      ["b", 8, true],
      ["c", 5, true],
      ["uncovered", 75, false],
    ]);
    const spendable = spendableWeights(units);
    // 25 points of coverage scale ×4 to fill the day.
    expect(spendable.get("a")).toBe(48);
    expect(spendable.get("b")).toBe(32);
    expect(spendable.get("c")).toBe(20);
    expect(spendable.get("uncovered")).toBe(0);
  });

  it("always spends exactly the daily budget when anything is covered", () => {
    const rand = lcg(99);
    for (let trial = 0; trial < 200; trial++) {
      const derived = deriveWeights(randomPortfolio(rand, 18));
      const units = derived.map((w) => ({
        unitId: w.unitId,
        weight: w.weight,
        covered: rand() > 0.5,
      }));
      const spendable = spendableWeights(units);
      const total = [...spendable.values()].reduce((a, b) => a + b, 0);
      const anyCovered = units.some((u) => u.covered && u.weight > 0);
      expect(total).toBe(anyCovered ? DAILY_BUDGET : 0);
    }
  });

  it("preserves the diagnostic's order among covered units", () => {
    const units = cover([
      ["big", 20, true],
      ["small", 4, true],
      ["gone", 76, false],
    ]);
    const spendable = spendableWeights(units);
    expect(spendable.get("big")!).toBeGreaterThan(spendable.get("small")!);
  });

  it("gives a lone covered unit the whole budget", () => {
    const spendable = spendableWeights(
      cover([
        ["only", 3, true],
        ["rest", 97, false],
      ]),
    );
    expect(spendable.get("only")).toBe(DAILY_BUDGET);
  });

  it("spends nothing when no unit has a task", () => {
    const spendable = spendableWeights(
      cover([
        ["a", 60, false],
        ["b", 40, false],
      ]),
    );
    expect([...spendable.values()]).toEqual([0, 0]);
  });

  it("never scales a unit that is out of scoring", () => {
    const spendable = spendableWeights(
      cover([
        ["scored", 100, true],
        ["excluded", 0, true],
      ]),
    );
    expect(spendable.get("excluded")).toBe(0);
    expect(spendable.get("scored")).toBe(DAILY_BUDGET);
  });
});
