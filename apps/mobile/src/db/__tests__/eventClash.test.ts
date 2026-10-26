/**
 * Which events a new event or window lands on, and what replacing each
 * means: end a series from today, archive a one-time event, or skip one
 * day of a series. Never the past.
 */
import { describe, expect, it } from "vitest";

import { clashesOn, eventClashes, type ExistingEvent } from "../eventClash";

/** Monday 26 October 2026. */
const TODAY = "2026-10-26";

const shift = (over: Partial<ExistingEvent> = {}): ExistingEvent => ({
  id: "shift",
  title: "Shift",
  plannedWeekdays: "1,3",
  oneOffDate: null,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
  repeatFrom: "2026-09-01",
  repeatUntil: null,
  ...over,
});

const input = (over: Partial<Parameters<typeof eventClashes>[0]> = {}) => ({
  title: "Class",
  weekdays: [1],
  date: null,
  startMinute: 10 * 60,
  endMinute: 12 * 60,
  ...over,
});

describe("eventClashes", () => {
  it("ends a running series that a new weekly event lands on", () => {
    expect(eventClashes(input(), null, [shift()], TODAY)).toEqual([
      { id: "shift", title: "Shift", action: "end" },
    ]);
  });

  it("archives a series that hasn't started yet", () => {
    const later = shift({ repeatFrom: "2026-11-02" });
    expect(eventClashes(input(), null, [later], TODAY)[0]?.action).toBe("archive");
  });

  it("leaves events on other days or at other times alone", () => {
    expect(eventClashes(input({ weekdays: [2] }), null, [shift()], TODAY)).toEqual([]);
    expect(eventClashes(input({ startMinute: 18 * 60, endMinute: 19 * 60 }), null, [shift()], TODAY)).toEqual([]);
  });

  it("leaves a series that has already ended alone", () => {
    expect(eventClashes(input(), null, [shift({ repeatUntil: "2026-10-20" })], TODAY)).toEqual([]);
  });

  it("skips one day of a series under a one-time event", () => {
    const once = input({ weekdays: [], date: "2026-10-28" });
    expect(eventClashes(once, null, [shift()], TODAY)).toEqual([
      { id: "shift", title: "Shift", action: "skip", date: "2026-10-28" },
    ]);
  });

  it("archives a one-time event that a new weekly event lands on", () => {
    const dentist = shift({ id: "d", title: "Dentist", plannedWeekdays: null, oneOffDate: "2026-11-02" });
    expect(eventClashes(input(), null, [dentist], TODAY)).toEqual([
      { id: "d", title: "Dentist", action: "archive" },
    ]);
  });
});

describe("clashesOn", () => {
  it("finds the event a new window lands on, as a skip for that day", () => {
    expect(clashesOn("2026-10-26", { start: 16 * 60, end: 18 * 60 }, [shift()])).toEqual([
      { id: "shift", title: "Shift", action: "skip", date: "2026-10-26" },
    ]);
  });

  it("finds nothing on a day the series doesn't run", () => {
    expect(clashesOn("2026-10-27", { start: 16 * 60, end: 18 * 60 }, [shift()])).toEqual([]);
  });
});
