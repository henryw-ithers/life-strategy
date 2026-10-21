/**
 * The weekly pass's rules (spec §5.3.2).
 */
import { describe, expect, it } from "vitest";

import {
  activityMinutes,
  daysLeft,
  doneMinutes,
  lastWeek,
  tiersDue,
} from "../weeklyPassRules";

/** Wednesday 21 October 2026; its week runs Sunday 18 to Saturday 24. */
const WED = "2026-10-21";

describe("weeks", () => {
  it("takes last week as the Sunday to Saturday before this one", () => {
    expect(lastWeek(WED)).toEqual({ start: "2026-10-11", end: "2026-10-17" });
    expect(lastWeek("2026-10-18")).toEqual({ start: "2026-10-11", end: "2026-10-17" });
  });

  it("plans today to Saturday", () => {
    expect(daysLeft(WED)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]);
  });
});

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

describe("the month's tiers", () => {
  it("are offered on the first pass of a month only", () => {
    expect(tiersDue(null, WED)).toBe(true);
    expect(tiersDue("2026-09", WED)).toBe(true);
    expect(tiersDue("2026-10", WED)).toBe(false);
  });
});
