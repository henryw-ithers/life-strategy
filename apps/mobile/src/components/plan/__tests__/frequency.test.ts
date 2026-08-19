/**
 * The frequency range and its arithmetic.
 *
 * `0` meaning "once a fortnight" rather than "never" is the one thing
 * here a reader cannot guess, and it is the value most likely to be
 * broken by a well-meaning `Math.max(1, …)` somewhere. These pin it.
 */
import { describe, expect, it } from "vitest";

import {
  clampFrequency,
  formatFrequency,
  formatFrequencyShort,
  MAX_TIMES_PER_WEEK,
  MIN_TIMES_PER_WEEK,
  stepFrequency,
} from "../frequency";

describe("formatFrequency", () => {
  it("names every value in the range", () => {
    expect(formatFrequency(0)).toBe("Every 2 weeks");
    expect(formatFrequency(1)).toBe("Once a week");
    expect(formatFrequency(2)).toBe("Twice a week");
    expect(formatFrequency(3)).toBe("3× a week");
    expect(formatFrequency(7)).toBe("Every day");
  });
});

describe("formatFrequencyShort", () => {
  it("stays short enough for a task row", () => {
    expect(formatFrequencyShort(0)).toBe("2 wks");
    expect(formatFrequencyShort(4)).toBe("4×/wk");
    expect(formatFrequencyShort(7)).toBe("daily");
  });
});

describe("clampFrequency", () => {
  it("leaves a legal value alone", () => {
    for (let t = MIN_TIMES_PER_WEEK; t <= MAX_TIMES_PER_WEEK; t++) {
      expect(clampFrequency(t)).toBe(t);
    }
  });

  it("pulls out-of-range values to the nearest end", () => {
    expect(clampFrequency(-3)).toBe(MIN_TIMES_PER_WEEK);
    expect(clampFrequency(99)).toBe(MAX_TIMES_PER_WEEK);
  });

  it("rounds a fraction rather than truncating toward zero", () => {
    expect(clampFrequency(2.6)).toBe(3);
  });

  it("falls back to daily for a value that is not a number", () => {
    // A corrupt row must not render "NaN× a week" in the sheet.
    expect(clampFrequency(Number.NaN)).toBe(MAX_TIMES_PER_WEEK);
  });
});

describe("stepFrequency", () => {
  it("moves one step in the given direction", () => {
    expect(stepFrequency(3, 1)).toBe(4);
    expect(stepFrequency(3, -1)).toBe(2);
  });

  it("crosses the fortnight boundary without skipping it", () => {
    // 1 → 0 is "once a week" → "every 2 weeks", the one step where the
    // unit of the answer changes.
    expect(stepFrequency(1, -1)).toBe(MIN_TIMES_PER_WEEK);
    expect(stepFrequency(0, 1)).toBe(1);
  });

  it("stops at both ends instead of wrapping", () => {
    expect(stepFrequency(MIN_TIMES_PER_WEEK, -1)).toBe(MIN_TIMES_PER_WEEK);
    expect(stepFrequency(MAX_TIMES_PER_WEEK, 1)).toBe(MAX_TIMES_PER_WEEK);
  });

  it("brings an out-of-range value back into the range", () => {
    expect(stepFrequency(50, -1)).toBe(MAX_TIMES_PER_WEEK - 1);
  });
});
