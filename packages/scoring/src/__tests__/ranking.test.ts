import { describe, expect, it } from "vitest";
import { WEIGHT_SPREAD } from "../constants";
import {
  combineHierarchicalRank,
  rankToScore,
  weightsForPriorityOrder,
} from "../ranking";

describe("rankToScore", () => {
  it("rank 1 of n always maps to 10", () => {
    for (const total of [1, 2, 5, 16]) {
      expect(rankToScore(1, total)).toBe(10);
    }
  });

  it("the lowest rank always maps to 1 (n > 1)", () => {
    for (const total of [2, 5, 16]) {
      expect(rankToScore(total, total)).toBe(1);
    }
  });

  it("a single-item set scores 10, not some midpoint", () => {
    expect(rankToScore(1, 1)).toBe(10);
  });

  it("is monotonically decreasing as rank worsens", () => {
    const total = 10;
    const scores = Array.from({ length: total }, (_, i) => rankToScore(i + 1, total));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeLessThan(scores[i - 1]!);
    }
  });

  it("worked example: rank 3 of 5", () => {
    // 10 - 9 * (3-1)/(5-1) = 10 - 4.5 = 5.5
    expect(rankToScore(3, 5)).toBe(5.5);
  });

  it("rejects out-of-range or non-integer input", () => {
    expect(() => rankToScore(0, 5)).toThrow();
    expect(() => rankToScore(6, 5)).toThrow();
    expect(() => rankToScore(1.5, 5)).toThrow();
    expect(() => rankToScore(1, 0)).toThrow();
  });
});

describe("combineHierarchicalRank", () => {
  it("orders areas first, then units within each area", () => {
    const areaRanks = [
      { areaId: "a", rank: 2 },
      { areaId: "b", rank: 1 },
    ];
    const unitRanksByArea = {
      a: [
        { unitId: "a1", rank: 2 },
        { unitId: "a2", rank: 1 },
      ],
      b: [{ unitId: "b1", rank: 1 }],
    };
    const result = combineHierarchicalRank(areaRanks, unitRanksByArea);
    expect(result.map((r) => r.unitId)).toEqual(["b1", "a2", "a1"]);
    expect(result.every((r) => r.total === 3)).toBe(true);
    expect(result.map((r) => r.overallRank)).toEqual([1, 2, 3]);
  });

  it("produces a strict total order matching a manual worked example", () => {
    const areaRanks = [
      { areaId: "home", rank: 1 },
      { areaId: "work", rank: 2 },
    ];
    const unitRanksByArea = {
      home: [
        { unitId: "cleanliness", rank: 1 },
        { unitId: "cooking", rank: 2 },
      ],
      work: [
        { unitId: "career", rank: 1 },
        { unitId: "finances", rank: 2 },
      ],
    };
    const result = combineHierarchicalRank(areaRanks, unitRanksByArea);
    expect(result.map((r) => r.unitId)).toEqual([
      "cleanliness",
      "cooking",
      "career",
      "finances",
    ]);
  });

  it("handles an empty input", () => {
    expect(combineHierarchicalRank([], {})).toEqual([]);
  });
});

describe("weightsForPriorityOrder", () => {
  const allScored = new Set(["a", "b", "c", "d"]);

  it("weights sum to the daily budget", () => {
    const w = weightsForPriorityOrder({
      order: ["a", "b", "c", "d"],
      scored: allScored,
    });
    expect(w.reduce((s, x) => s + x.weight, 0)).toBe(100);
  });

  it("ranks higher priority above lower", () => {
    const w = weightsForPriorityOrder({
      order: ["a", "b", "c", "d"],
      scored: allScored,
    });
    const by = new Map(w.map((x) => [x.unitId, x.weight]));
    expect(by.get("a")!).toBeGreaterThan(by.get("b")!);
    expect(by.get("b")!).toBeGreaterThan(by.get("c")!);
    expect(by.get("c")!).toBeGreaterThan(by.get("d")!);
  });

  it("reversing the order reverses the weights", () => {
    const forward = weightsForPriorityOrder({
      order: ["a", "b", "c", "d"],
      scored: allScored,
    });
    const back = weightsForPriorityOrder({
      order: ["d", "c", "b", "a"],
      scored: allScored,
    });
    const f = new Map(forward.map((x) => [x.unitId, x.weight]));
    const b = new Map(back.map((x) => [x.unitId, x.weight]));
    expect(b.get("d")).toBe(f.get("a"));
    expect(b.get("a")).toBe(f.get("d"));
  });

  /* The rule this whole helper exists to protect: unscored units still
   * occupy a rank. Filtering them out before ranking would shrink the
   * denominator and hand the same order different numbers than the
   * diagnostic produced. */
  it("keeps unscored units in the rank denominator", () => {
    const withUnscored = weightsForPriorityOrder({
      order: ["a", "b", "c", "d"],
      scored: new Set(["a", "b"]),
    });
    const asIfDropped = weightsForPriorityOrder({
      order: ["a", "b"],
      scored: new Set(["a", "b"]),
    });
    expect(withUnscored.map((w) => w.unitId)).toEqual(["a", "b"]);
    // Both still total 100, but the split differs — that difference is
    // exactly what dropping them from the ranking would have hidden.
    expect(withUnscored.reduce((s, x) => s + x.weight, 0)).toBe(100);
    expect(asIfDropped.reduce((s, x) => s + x.weight, 0)).toBe(100);
    expect(withUnscored.map((w) => w.weight)).not.toEqual(
      asIfDropped.map((w) => w.weight),
    );
  });

  it("returns nothing for an empty order", () => {
    expect(
      weightsForPriorityOrder({ order: [], scored: allScored }),
    ).toEqual([]);
  });

  /* ADR-0028 §1: there is no second axis left to isolate. Priority
   * order is the entire input, so the same order is the same weights,
   * every time, for everyone. */
  it("is a pure function of the order", () => {
    const once = weightsForPriorityOrder({
      order: ["a", "b", "c", "d"],
      scored: allScored,
    });
    const again = weightsForPriorityOrder({
      order: ["a", "b", "c", "d"],
      scored: allScored,
    });
    expect(again).toEqual(once);
  });

  /* ADR-0028 §2: the flattening rides along here, because this is the
   * path a manual re-rank takes and it has to land on the same numbers
   * the diagnostic would give. */
  it("spreads the four units gently rather than 10:1", () => {
    const w = weightsForPriorityOrder({
      order: ["a", "b", "c", "d"],
      scored: allScored,
    });
    const top = w[0]!.exact;
    const bottom = w[3]!.exact;
    expect(top / bottom).toBeCloseTo(WEIGHT_SPREAD, 10);
  });
});
