/**
 * The day's windows from working hours (ADR-0039 §§1–3;
 * docs/design/windows-and-pins.md §1).
 */
import { describe, expect, it } from "vitest";

import {
  addedWindowPieces,
  currentWindow,
  dayHours,
  dayMinute,
  dayPhase,
  DEFAULT_RANGES,
  rangeError,
  type HoursVersion,
  type TimeRange,
} from "../hours";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const r = (start: number, end: number): TimeRange => ({ start, end });

// Wednesday 2026-07-15.
const WED = "2026-07-15";
const SAT = "2026-07-18";

const weekdays: HoursVersion = {
  from: "2026-01-01",
  schedules: [{ weekdays: [1, 2, 3, 4, 5], ranges: [r(h(8, 30), h(18))] }],
  gaps: [],
};

describe("where windows come from (§1.1)", () => {
  it("uses the three default windows before any hours are set (EC-13)", () => {
    const day = dayHours({ date: WED, versions: [] });
    expect(day.windows).toEqual(DEFAULT_RANGES);
    expect(day.usingDefaults).toBe(true);
  });

  it("gives a day in no schedule no windows (EC-14)", () => {
    const day = dayHours({ date: SAT, versions: [weekdays] });
    expect(day.windows).toEqual([]);
    expect(day.usingDefaults).toBe(false);
  });

  it("keeps earlier days on the hours they had (EC-15)", () => {
    const later: HoursVersion = {
      from: "2026-07-15",
      schedules: [{ weekdays: [3], ranges: [r(h(10), h(14))] }],
      gaps: [],
    };
    expect(dayHours({ date: "2026-07-08", versions: [weekdays, later] }).windows).toEqual([
      r(h(8, 30), h(18)),
    ]);
    expect(dayHours({ date: WED, versions: [weekdays, later] }).windows).toEqual([r(h(10), h(14))]);
  });

  it("uses that day's own hours when it has them, and none when they're empty", () => {
    expect(dayHours({ date: WED, versions: [weekdays], override: [r(h(13), h(15))] }).windows).toEqual([
      r(h(13), h(15)),
    ]);
    expect(dayHours({ date: WED, versions: [weekdays], override: [] }).windows).toEqual([]);
  });

  it("lets a range run past midnight up to the rollover, and no further (EC-01)", () => {
    expect(rangeError(r(h(20), h(25)))).toBeNull();
    expect(rangeError(r(h(20), h(27)))).toBeNull();
    expect(rangeError(r(h(20), h(28)))).toMatch(/rolls over/);
    expect(rangeError(r(h(10), h(9)))).toMatch(/after it starts/);
  });
});

describe("what's left after events (§1.2)", () => {
  it("takes each event out with 10 minutes either side", () => {
    const day = dayHours({ date: WED, versions: [weekdays], events: [r(h(11), h(12, 30))] });
    expect(day.windows).toEqual([r(h(8, 30), h(10, 50)), r(h(12, 40), h(18))]);
  });

  it("merges overlapping events (EC-09)", () => {
    const day = dayHours({
      date: WED,
      versions: [weekdays],
      events: [r(h(11), h(12)), r(h(11, 30), h(13))],
    });
    expect(day.windows).toEqual([r(h(8, 30), h(10, 50)), r(h(13, 10), h(18))]);
  });

  it("leaves no window where an event fills the range (EC-10)", () => {
    const day = dayHours({ date: WED, versions: [weekdays], events: [r(h(8), h(18, 30))] });
    expect(day.windows).toEqual([]);
  });

  it("leaves the windows alone for an event outside working hours", () => {
    const day = dayHours({ date: WED, versions: [weekdays], events: [r(h(19), h(20))] });
    expect(day.windows).toEqual([r(h(8, 30), h(18))]);
  });

  it("shows a piece under 30 minutes as a buffer, not a window (EC-11)", () => {
    const day = dayHours({ date: WED, versions: [weekdays], events: [r(h(9), h(10))] });
    // 8:30–8:50 is 20 minutes: a buffer.
    expect(day.buffers).toEqual([r(h(8, 30), h(8, 50))]);
    expect(day.windows).toEqual([r(h(10, 10), h(18))]);
  });

  it("takes a named gap out, and keeps its name", () => {
    const withLunch: HoursVersion = {
      ...weekdays,
      gaps: [{ weekdays: [3], range: r(h(12), h(13)), name: "Lunch" }],
    };
    const day = dayHours({ date: WED, versions: [withLunch] });
    expect(day.windows).toEqual([r(h(8, 30), h(12)), r(h(13), h(18))]);
    expect(day.gaps).toEqual([{ range: r(h(12), h(13)), name: "Lunch" }]);
  });

  it("reports the working hours the day started from, before events", () => {
    const day = dayHours({ date: WED, versions: [weekdays], events: [r(h(11), h(12))] });
    expect(day.working).toEqual([r(h(8, 30), h(18))]);
  });
});

describe("changing one day's windows (§1.4)", () => {
  it("adds a window outside working hours (EC-52)", () => {
    const day = dayHours({
      date: WED,
      versions: [weekdays],
      edits: [{ kind: "add", range: r(h(20), h(22)) }],
    });
    expect(day.windows).toEqual([r(h(8, 30), h(18)), r(h(20), h(22))]);
  });

  it("trims an added window around an event, and saves nothing if nothing's left (EC-53)", () => {
    expect(addedWindowPieces(r(h(19), h(22)), [r(h(20), h(21))])).toEqual([
      r(h(19), h(19, 50)),
      r(h(21, 10), h(22)),
    ]);
    expect(addedWindowPieces(r(h(20), h(21)), [r(h(19, 30), h(21, 30))])).toEqual([]);
    const day = dayHours({
      date: WED,
      versions: [],
      override: [],
      edits: [{ kind: "add", range: r(h(19), h(22)) }],
      events: [r(h(20), h(21))],
    });
    expect(day.windows).toEqual([r(h(19), h(19, 50)), r(h(21, 10), h(22))]);
  });

  it("splits a window an added one sits inside, keeping both edges (EC-55)", () => {
    const day = dayHours({
      date: WED,
      versions: [weekdays],
      edits: [{ kind: "add", range: r(h(12), h(14)) }],
    });
    expect(day.windows).toEqual([r(h(8, 30), h(12)), r(h(12), h(14)), r(h(14), h(18))]);
  });

  it("drops a piece under 30 minutes left by an added window (EC-55)", () => {
    const day = dayHours({
      date: WED,
      versions: [weekdays],
      edits: [{ kind: "add", range: r(h(8, 45), h(12)) }],
    });
    expect(day.windows).toEqual([r(h(8, 45), h(12)), r(h(12), h(18))]);
    expect(day.buffers).toEqual([r(h(8, 30), h(8, 45))]);
  });

  it("removes a window, and changes one's times", () => {
    const removed = dayHours({
      date: WED,
      versions: [weekdays],
      edits: [{ kind: "remove", range: r(h(8, 30), h(18)) }],
    });
    expect(removed.windows).toEqual([]);
    const changed = dayHours({
      date: WED,
      versions: [weekdays],
      edits: [{ kind: "change", from: r(h(8, 30), h(18)), to: r(h(9), h(12)) }],
    });
    expect(changed.windows).toEqual([r(h(9), h(12))]);
  });
});

describe("the current window (§1.3)", () => {
  const windows = [r(h(9), h(12)), r(h(13), h(17))];

  it("gives a boundary minute to the window starting there (EC-06)", () => {
    expect(dayPhase(windows, h(12))).toEqual({ kind: "gap", next: 1 });
    expect(dayPhase(windows, h(13))).toEqual({ kind: "in", index: 1 });
    expect(currentWindow(windows, h(9))).toEqual(r(h(9), h(12)));
  });

  it("knows before, between and after", () => {
    expect(dayPhase(windows, h(8))).toEqual({ kind: "before", next: 0 });
    expect(dayPhase(windows, h(18))).toEqual({ kind: "after" });
    expect(dayPhase([], h(10))).toEqual({ kind: "noWindows" });
    expect(currentWindow(windows, h(12, 30))).toBeNull();
  });

  it("counts the small hours as the day before (EC-07)", () => {
    expect(dayMinute(1, 30)).toBe(h(25, 30));
    expect(dayMinute(3, 0)).toBe(h(3));
    const late = [r(h(22), h(26))];
    expect(currentWindow(late, dayMinute(1, 30))).toEqual(r(h(22), h(26)));
  });
});

describe("what the reviews found", () => {
  it("takes nothing out for a cut of no length or one that runs backwards", () => {
    const day = dayHours({
      date: WED,
      versions: [weekdays],
      edits: [
        { kind: "remove", range: r(h(12), h(11)) },
        { kind: "remove", range: r(h(12), h(12)) },
      ],
    });
    expect(day.windows).toEqual([r(h(8, 30), h(18))]);
  });

  it("joins overlapping ranges, such as two groups claiming one weekday", () => {
    const clash: HoursVersion = {
      from: "2026-01-01",
      schedules: [
        { weekdays: [3], ranges: [r(h(9), h(13))] },
        { weekdays: [3], ranges: [r(h(12), h(15))] },
      ],
      gaps: [],
    };
    expect(dayHours({ date: WED, versions: [clash] }).windows).toEqual([r(h(9), h(15))]);
  });

  it("keeps ranges that only touch as two windows", () => {
    const touching = dayHours({ date: WED, versions: [], override: [r(h(9), h(12)), r(h(12), h(15))] });
    expect(touching.windows).toEqual([r(h(9), h(12)), r(h(12), h(15))]);
  });

  it("counts edits made ahead of time in the day's hours, and not those made on the day (EC-56)", () => {
    const day = dayHours({
      date: WED,
      versions: [weekdays],
      edits: [
        { kind: "add", range: r(h(19), h(21)) },
        { kind: "add", range: r(h(21), h(22)), onTheDay: true },
      ],
    });
    expect(day.working).toEqual([r(h(8, 30), h(18)), r(h(19), h(21))]);
    expect(day.windows).toEqual([r(h(8, 30), h(18)), r(h(19), h(21)), r(h(21), h(22))]);
  });

  it("drops the template's named gaps on a day with its own hours", () => {
    const withLunch: HoursVersion = {
      ...weekdays,
      gaps: [{ weekdays: [3], range: r(h(12), h(13)), name: "Lunch" }],
    };
    const day = dayHours({ date: WED, versions: [withLunch], override: [r(h(10), h(16))] });
    expect(day.windows).toEqual([r(h(10), h(16))]);
    expect(day.gaps).toEqual([]);
  });
});
