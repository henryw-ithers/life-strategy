/**
 * The working-hours editor's draft (spec §5.3.1, ADR-0039 §1).
 */
import { describe, expect, it } from "vitest";

import {
  draftFrom,
  nextRange,
  nextSchedule,
  rangesOn,
  restOfWeek,
  takenElsewhere,
  weekHasBegun,
} from "../hoursDraft";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
/** Wednesday 21 October 2026; its week runs Sunday 18 to Saturday 24. */
const WED = "2026-10-21";

describe("draftFrom", () => {
  it("starts from the hours in force, or weekdays nine to five", () => {
    expect(draftFrom([], WED).schedules).toEqual([
      { weekdays: [1, 2, 3, 4, 5], ranges: [{ start: h(9), end: h(17) }] },
    ]);
    const version = {
      from: "2026-10-01",
      schedules: [{ weekdays: [6, 7] as const, ranges: [{ start: h(10), end: h(14) }] }],
      gaps: [],
    };
    const later = { ...version, from: "2026-11-01" };
    expect(draftFrom([version, later], WED).schedules).toBe(version.schedules);
  });
});

describe("groups and ranges", () => {
  const schedules = [
    { weekdays: [1, 2, 3, 4, 5] as const, ranges: [{ start: h(9), end: h(12) }] },
    { weekdays: [6] as const, ranges: [{ start: h(10), end: h(14) }] },
  ];

  it("greys out days another group has", () => {
    expect(takenElsewhere(schedules, 1)).toEqual([1, 2, 3, 4, 5]);
    expect(takenElsewhere(schedules, 0)).toEqual([6]);
  });

  it("adds a range a quarter hour after the last", () => {
    expect(nextRange([{ start: h(9), end: h(12) }])).toEqual({ start: h(12, 15), end: h(13, 15) });
    expect(nextRange([{ start: h(9), end: h(23, 30) }])).toBeNull();
  });

  it("adds a group with the days left", () => {
    expect(nextSchedule(schedules)?.weekdays).toEqual([7]);
    expect(nextSchedule([{ weekdays: [1, 2, 3, 4, 5, 6, 7], ranges: [] }])).toBeNull();
  });
});

describe("Just this week", () => {
  it("gives a date its group's ranges less its named gaps", () => {
    const draft = {
      schedules: [{ weekdays: [3] as const, ranges: [{ start: h(9), end: h(17) }] }],
      gaps: [{ weekdays: [3] as const, range: { start: h(12), end: h(13) }, name: "Lunch" }],
    };
    expect(rangesOn(draft, WED)).toEqual([
      { start: h(9), end: h(12) },
      { start: h(13), end: h(17) },
    ]);
    expect(rangesOn(draft, "2026-10-22")).toEqual([]);
  });

  it("covers today to Saturday, and only asks once the week has begun", () => {
    expect(restOfWeek(WED)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]);
    expect(weekHasBegun(WED)).toBe(true);
    expect(weekHasBegun("2026-10-18")).toBe(false);
  });
});
