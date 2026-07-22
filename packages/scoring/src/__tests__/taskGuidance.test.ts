import { describe, expect, it } from "vitest";
import { recommendedTaskRange } from "../taskGuidance";

describe("recommendedTaskRange — ADR-0003 §6", () => {
  it("weight >= 10 recommends 2-3 tasks", () => {
    expect(recommendedTaskRange(10)).toEqual({ min: 2, max: 3 });
    expect(recommendedTaskRange(16)).toEqual({ min: 2, max: 3 });
  });

  it("weight 5-9 recommends 1-2 tasks", () => {
    expect(recommendedTaskRange(5)).toEqual({ min: 1, max: 2 });
    expect(recommendedTaskRange(9)).toEqual({ min: 1, max: 2 });
  });

  it("weight 3-4 recommends exactly 1 task", () => {
    expect(recommendedTaskRange(3)).toEqual({ min: 1, max: 1 });
    expect(recommendedTaskRange(4)).toEqual({ min: 1, max: 1 });
  });

  it("weight < 3 recommends 0-1 tasks", () => {
    expect(recommendedTaskRange(2)).toEqual({ min: 0, max: 1 });
    expect(recommendedTaskRange(0)).toEqual({ min: 0, max: 1 });
  });

  it("boundaries are exact (9.9 vs 10, 4.9 vs 5, 2.9 vs 3)", () => {
    expect(recommendedTaskRange(9.9)).toEqual({ min: 1, max: 2 });
    expect(recommendedTaskRange(4.9)).toEqual({ min: 1, max: 1 });
    expect(recommendedTaskRange(2.9)).toEqual({ min: 0, max: 1 });
  });
});
