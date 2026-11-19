/**
 * How completed work counts toward effort share (ADR-0041 §5).
 */
import { describe, expect, it } from "vitest";

import { activityMinutes, doneMinutes } from "../workShareRules";

describe("time spent", () => {
  const tick = { kind: "task" as const, size: null, startMinute: null, endMinute: null, fraction: 1 };

  it("counts a task by its size, Normal when unsized, times how much was done", () => {
    expect(doneMinutes(tick)).toBe(60);
    expect(doneMinutes({ ...tick, size: "big" })).toBe(120);
    expect(doneMinutes({ ...tick, size: "quick", fraction: 0.5 })).toBe(15);
  });

  it("counts an event by its length", () => {
    expect(doneMinutes({ ...tick, kind: "event", startMinute: 600, endMinute: 690 })).toBe(90);
  });

  it("shares an activity across its units, and a sizeless note counts nothing", () => {
    expect(activityMinutes("normal", ["a", "b"])).toEqual([
      { unitId: "a", minutes: 30 },
      { unitId: "b", minutes: 30 },
    ]);
    expect(activityMinutes(null, ["a"])).toEqual([]);
    expect(activityMinutes("big", [])).toEqual([]);
  });
});
