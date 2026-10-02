import { describe, expect, it } from "vitest";

import {
  isSettled,
  normalizeFraction,
  partialPoints,
  progressOf,
} from "../partial";

describe("normalizeFraction", () => {
  it("snaps to the offered fractions", () => {
    expect(normalizeFraction(0.25)).toBe(0.25);
    expect(normalizeFraction(0.3)).toBe(0.25);
    expect(normalizeFraction(0.4)).toBe(0.5);
    expect(normalizeFraction(0.9)).toBe(1);
    expect(normalizeFraction(2)).toBe(1);
    expect(normalizeFraction(Number.NaN)).toBe(1);
  });
});

describe("progressOf / isSettled", () => {
  it("sums fractions and caps at one", () => {
    expect(progressOf([])).toBe(0);
    expect(progressOf([0.25, 0.5])).toBe(0.75);
    expect(progressOf([0.75, 0.75])).toBe(1);
  });

  it("is settled only at a full task", () => {
    expect(isSettled([0.75])).toBe(false);
    expect(isSettled([0.25, 0.75])).toBe(true);
    expect(isSettled([1])).toBe(true);
  });
});

describe("partialPoints — ADR-0014 §3", () => {
  it("pays the rounded running total minus what is already paid", () => {
    // On a 3-point task the quarters pay 1, 1, 0, 1 — uneven, because
    // each step is the rounded total so far minus what has been paid
    // and `round(1.5)` is 2. An earlier draft of ADR-0014 claimed
    // 1, 0, 1, 1; the totals were right and the breakdown was not.
    expect(partialPoints(3, [], 0.25)).toBe(1);
    expect(partialPoints(3, [0.25], 0.25)).toBe(1);
    expect(partialPoints(3, [0.25, 0.25], 0.25)).toBe(0);
    expect(partialPoints(3, [0.25, 0.25, 0.25], 0.25)).toBe(1);
  });

  it("never pays more than the task is worth, however it is split", () => {
    for (const value of [1, 2, 3, 5, 8, 13, 20]) {
      for (const steps of [
        [0.25, 0.25, 0.25, 0.25],
        [0.5, 0.5],
        [0.25, 0.75],
        [0.75, 0.25],
        [1],
      ]) {
        let prior: number[] = [];
        let paid = 0;
        for (const f of steps) {
          paid += partialPoints(value, prior, f);
          prior = [...prior, f];
        }
        expect(paid).toBe(value);
      }
    }
  });

  it("is the fix for four quarter-marks on a 3-point task", () => {
    // Rounding each step independently would pay 1+1+1+1 = 4 here.
    const naive = [0.25, 0.25, 0.25, 0.25].reduce(
      (a, f) => a + Math.round(f * 3),
      0,
    );
    expect(naive).toBe(4);

    let prior: number[] = [];
    let paid = 0;
    for (const f of [0.25, 0.25, 0.25, 0.25]) {
      paid += partialPoints(3, prior, f);
      prior = [...prior, f];
    }
    expect(paid).toBe(3);
  });

  it("pays a whole completion in one step", () => {
    expect(partialPoints(8, [], 1)).toBe(8);
  });

  it("pays nothing once the task is already settled", () => {
    expect(partialPoints(8, [1], 0.5)).toBe(0);
  });
});
