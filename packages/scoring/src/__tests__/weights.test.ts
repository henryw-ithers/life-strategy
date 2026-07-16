import { describe, expect, it } from "vitest";
import { DAILY_BUDGET } from "../constants";
import { deriveWeights } from "../weights";
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
      deriveWeights([{ unitId: "a", importance: 5.5, satisfaction: 5 }]),
    ).toThrow();
  });

  it("returns [] for an empty portfolio", () => {
    expect(deriveWeights([])).toEqual([]);
  });
});
