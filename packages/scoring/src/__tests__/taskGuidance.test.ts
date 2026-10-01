import { describe, expect, it } from "vitest";
import { recommendedTaskRange } from "../taskGuidance";

/** ADR-0003 §6, rescaled for the flattened spread by ADR-0028 §2. */
describe("recommendedTaskRange", () => {
  it("weight >= 7 recommends 2-3 tasks", () => {
    expect(recommendedTaskRange(7)).toEqual({ min: 2, max: 3 });
    expect(recommendedTaskRange(16)).toEqual({ min: 2, max: 3 });
  });

  it("weight 4-6 recommends 1-2 tasks", () => {
    expect(recommendedTaskRange(4)).toEqual({ min: 1, max: 2 });
    expect(recommendedTaskRange(6)).toEqual({ min: 1, max: 2 });
  });

  it("weight 2-3 recommends exactly 1 task", () => {
    expect(recommendedTaskRange(2)).toEqual({ min: 1, max: 1 });
    expect(recommendedTaskRange(3)).toEqual({ min: 1, max: 1 });
  });

  it("weight < 2 recommends 0-1 tasks", () => {
    expect(recommendedTaskRange(1)).toEqual({ min: 0, max: 1 });
    expect(recommendedTaskRange(0)).toEqual({ min: 0, max: 1 });
  });

  it("boundaries are exact (6.9 vs 7, 3.9 vs 4, 1.9 vs 2)", () => {
    expect(recommendedTaskRange(6.9)).toEqual({ min: 1, max: 2 });
    expect(recommendedTaskRange(3.9)).toEqual({ min: 1, max: 1 });
    expect(recommendedTaskRange(1.9)).toEqual({ min: 0, max: 1 });
  });

  /**
   * The reason for the rescale. Every unit in a flattened 18-unit
   * portfolio lands at 4 or more, so none of them is written off as
   * light — the bottom of the list is quieter, not decorative.
   */
  it("calls nothing in a flattened 18-unit portfolio light", () => {
    for (const weight of [4, 5, 6, 7]) {
      expect(recommendedTaskRange(weight).max).toBeGreaterThan(1);
    }
  });
});
