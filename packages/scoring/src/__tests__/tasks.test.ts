import { describe, expect, it } from "vitest";
import { rankShares, taskPointValues } from "../tasks";

describe("rankShares", () => {
  it("n = 3 gives the 3:2:1 split from ADR-0003", () => {
    expect(rankShares(3)).toEqual([3 / 6, 2 / 6, 1 / 6]);
  });

  it("shares always sum to 1", () => {
    for (let n = 1; n <= 10; n++) {
      const sum = rankShares(n).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });
});

describe("taskPointValues — ADR-0003 worked example", () => {
  it("splits 53 points across 3 ranked tasks as 26 / 18 / 9", () => {
    expect(taskPointValues(53, 3)).toEqual([26, 18, 9]);
  });
});

describe("taskPointValues — invariants", () => {
  it("task points always sum to exactly the unit weight", () => {
    for (let weight = 0; weight <= 60; weight++) {
      for (let n = 1; n <= 5; n++) {
        const points = taskPointValues(weight, n);
        expect(points.reduce((a, b) => a + b, 0)).toBe(weight);
      }
    }
  });

  it("higher rank never earns fewer points", () => {
    for (let weight = 1; weight <= 60; weight += 7) {
      for (let n = 2; n <= 5; n++) {
        const points = taskPointValues(weight, n);
        for (let i = 1; i < points.length; i++) {
          expect(points[i - 1]!).toBeGreaterThanOrEqual(points[i]!);
        }
      }
    }
  });

  it("a single task takes the whole unit weight", () => {
    expect(taskPointValues(14, 1)).toEqual([14]);
  });
});
