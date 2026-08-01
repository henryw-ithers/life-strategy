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
  it("task points sum to exactly the unit weight", () => {
    for (let weight = 0; weight <= 60; weight++) {
      for (let n = 1; n <= 5; n++) {
        // Below `n` points there is no split that both floors every
        // task at 1 and sums to the weight; the floor wins and the
        // unit spends `n` (see taskPointValues).
        if (weight !== 0 && weight < n) continue;
        const points = taskPointValues(weight, n);
        expect(points.reduce((a, b) => a + b, 0)).toBe(weight);
      }
    }
  });

  it("never leaves a task worth zero in a scoring unit", () => {
    for (let weight = 1; weight <= 60; weight++) {
      for (let n = 1; n <= 8; n++) {
        for (const points of [taskPointValues(weight, n)]) {
          expect(Math.min(...points)).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("the 3-point unit with three tasks splits 1/1/1, not 2/1/0", () => {
    expect(taskPointValues(3, 3)).toEqual([1, 1, 1]);
    expect(taskPointValues(5, 4)).toEqual([2, 1, 1, 1]);
  });

  it("a unit outside scoring divides nothing, floor included", () => {
    expect(taskPointValues(0, 3)).toEqual([0, 0, 0]);
  });

  it("spends the task count when a unit holds more tasks than points", () => {
    expect(taskPointValues(2, 3)).toEqual([1, 1, 1]);
    expect(taskPointValues(1, 2)).toEqual([1, 1]);
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
