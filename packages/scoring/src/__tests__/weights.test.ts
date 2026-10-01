/**
 * ADR-0028 §§1–2: weight is a function of priority rank and nothing
 * else, flattened so the bottom of the portfolio still holds points
 * worth spending.
 */
import { describe, expect, it } from "vitest";
import { DAILY_BUDGET, WEIGHT_SPREAD } from "../constants";
import { rankToScore } from "../ranking";
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

/** The real shape: 18 units ranked 1..18, as the diagnostic produces. */
function rankedPortfolio(unitCount = 18): UnitRating[] {
  return Array.from({ length: unitCount }, (_, i) => ({
    unitId: `unit-${i + 1}`,
    importance: rankToScore(i + 1, unitCount),
  }));
}

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

  it("raw score is monotone in importance", () => {
    for (let importance = 2; importance <= 10; importance++) {
      const [lower, higher] = deriveWeights([
        { unitId: "lo", importance: importance - 1 },
        { unitId: "hi", importance },
      ]);
      expect(higher!.raw).toBeGreaterThan(lower!.raw);
    }
  });

  it("rejects out-of-range importance", () => {
    expect(() => deriveWeights([{ unitId: "a", importance: 0 }])).toThrow();
    expect(() => deriveWeights([{ unitId: "a", importance: 11 }])).toThrow();
    expect(() =>
      deriveWeights([{ unitId: "a", importance: Number.NaN }]),
    ).toThrow();
  });

  it("accepts continuous, non-integer importance (rank-derived scores)", () => {
    const weights = deriveWeights([
      { unitId: "a", importance: 8.5 },
      { unitId: "b", importance: 5.5 },
    ]);
    expect(weights.reduce((a, w) => a + w.weight, 0)).toBe(DAILY_BUDGET);
    expect(weights[0]!.weight).toBeGreaterThan(weights[1]!.weight);
  });

  it("returns [] for an empty portfolio", () => {
    expect(deriveWeights([])).toEqual([]);
  });
});

describe("deriveWeights — satisfaction does not derive weight (§1)", () => {
  /**
   * The whole of ADR-0028 §1 in one assertion. Before formula v8 these
   * two portfolios produced different numbers, because
   * `raw = importance + g × max(0, importance − satisfaction)` read the
   * second column. Now nothing does.
   */
  it("is identical whatever satisfaction says", () => {
    const importances = [9, 7, 3];
    const at = (satisfactions: number[]) =>
      deriveWeights(
        importances.map((importance, i) => ({
          unitId: `u${i}`,
          importance,
          satisfaction: satisfactions[i]!,
        })),
      ).map((w) => w.weight);

    expect(at([1, 1, 1])).toEqual(at([10, 10, 10]));
    expect(at([4, 7, 6])).toEqual(at([10, 1, 5]));
  });

  it("does not need satisfaction at all", () => {
    expect(deriveWeights([{ unitId: "a", importance: 9 }])[0]!.weight).toBe(
      DAILY_BUDGET,
    );
  });

  it("does not validate a satisfaction it never reads", () => {
    // Before v8 this threw. Nothing downstream of here can be affected
    // by the value, so rejecting it would be theatre.
    expect(() =>
      deriveWeights([{ unitId: "a", importance: 5, satisfaction: 99 }]),
    ).not.toThrow();
  });
});

describe("deriveWeights — the spread is flattened (§2)", () => {
  it("makes the top unit WEIGHT_SPREAD times the bottom one", () => {
    const weights = deriveWeights(rankedPortfolio());
    const top = weights[0]!.exact;
    const bottom = weights[weights.length - 1]!.exact;
    expect(top / bottom).toBeCloseTo(WEIGHT_SPREAD, 10);
  });

  it("worked example: 18 units come out 7 at the top and 4 at the bottom", () => {
    // Pre-v8 the same portfolio ran 10 down to 1, and the bottom third
    // of someone's life was worth one, two and three points — less than
    // a single task in it could usefully carry.
    const weights = deriveWeights(rankedPortfolio());
    expect(weights[0]!.weight).toBe(7);
    expect(weights[17]!.weight).toBe(4);
    expect(weights.reduce((a, w) => a + w.weight, 0)).toBe(DAILY_BUDGET);
  });

  it("leaves no unit too small to hold a task worth having", () => {
    // `recommendedTaskRange` gives a 3-point unit one task; anything
    // under that is a row that cannot move the number.
    for (const w of deriveWeights(rankedPortfolio())) {
      expect(w.weight).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the diagnostic's order exactly", () => {
    const weights = deriveWeights(rankedPortfolio());
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]!.weight).toBeLessThanOrEqual(weights[i - 1]!.weight);
    }
    expect(weights[0]!.weight).toBeGreaterThan(weights[17]!.weight);
  });

  it("never spreads further than WEIGHT_SPREAD, at any portfolio size", () => {
    for (const size of [2, 5, 12, 18, 30]) {
      const exacts = deriveWeights(rankedPortfolio(size)).map((w) => w.exact);
      const top = Math.max(...exacts);
      const bottom = Math.min(...exacts);
      expect(top / bottom).toBeLessThanOrEqual(WEIGHT_SPREAD + 1e-9);
    }
  });
});
