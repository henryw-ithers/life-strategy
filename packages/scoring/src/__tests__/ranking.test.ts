import { describe, expect, it } from "vitest";
import { combineHierarchicalRank, rankToScore } from "../ranking";

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
