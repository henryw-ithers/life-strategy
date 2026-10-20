/**
 * Repeating series (ADR-0040, Phase 7): their weeks for Skip weeks,
 * "This and following", archiving once ended, and bounds that take
 * today's run away.
 */
import { describe, expect, it } from "vitest";

import {
  archiveDue,
  boundsCutToday,
  commitmentWeeks,
  movedSkips,
  nextRun,
  pastChangedBy,
  seriesWeeks,
  splitSeries,
} from "../seriesRules";

/** Tuesday 20 October 2026; weeks start on Sunday. */
const TODAY = "2026-10-20";

describe("seriesWeeks", () => {
  it("lists the weeks from this one to the end, this week not skippable", () => {
    const weeks = seriesWeeks({ repeatFrom: "2026-10-05", repeatUntil: "2026-11-07" }, TODAY);
    expect(weeks.map((w) => [w.weekStart, w.skippable])).toEqual([
      ["2026-10-18", false],
      ["2026-10-25", true],
      ["2026-11-01", true],
    ]);
  });

  it("starts at the series' first week when that's still ahead", () => {
    expect(seriesWeeks({ repeatFrom: "2026-11-03", repeatUntil: "2026-11-14" }, TODAY).map((w) => w.weekStart)).toEqual([
      "2026-11-01",
      "2026-11-08",
    ]);
  });

  it("shows 26 weeks of a series with no end", () => {
    expect(seriesWeeks({ repeatFrom: null, repeatUntil: null }, TODAY)).toHaveLength(26);
  });

  it("is empty for a series that has ended", () => {
    expect(seriesWeeks({ repeatFrom: null, repeatUntil: "2026-10-10" }, TODAY)).toEqual([]);
  });
});

describe("commitmentWeeks", () => {
  it("lists the next 26 weeks, from next week (EC-25)", () => {
    const weeks = commitmentWeeks(TODAY);
    expect(weeks).toHaveLength(26);
    expect(weeks[0]).toBe("2026-10-25");
  });
});

describe("splitSeries (This and following)", () => {
  it("ends the old series the day before and starts the new one on the date", () => {
    expect(splitSeries({ repeatFrom: "2026-09-01", repeatUntil: "2026-12-01" }, "2026-10-27")).toEqual({
      old: { repeatFrom: "2026-09-01", repeatUntil: "2026-10-26" },
      next: { repeatFrom: "2026-10-27", repeatUntil: "2026-12-01" },
    });
  });

  it("is the whole series when the date is on or before its start", () => {
    expect(splitSeries({ repeatFrom: "2026-10-27", repeatUntil: null }, "2026-10-27")).toBeNull();
    expect(splitSeries({ repeatFrom: null, repeatUntil: null }, "2026-10-27")).toEqual({
      old: { repeatFrom: null, repeatUntil: "2026-10-26" },
      next: { repeatFrom: "2026-10-27", repeatUntil: null },
    });
  });
});

describe("movedSkips (EC-27)", () => {
  const skips = [
    { id: "a", kind: "occurrence" as const, localDate: "2026-10-26" },
    { id: "b", kind: "occurrence" as const, localDate: "2026-10-28" },
    { id: "c", kind: "taskWeek" as const, localDate: "2026-11-01" },
    { id: "d", kind: "taskWeek" as const, localDate: "2026-10-25" },
  ];

  it("moves skips from the date on, and copies the week the split falls in", () => {
    expect(movedSkips(skips, "2026-10-27")).toEqual({ move: ["b", "c"], copy: ["d"] });
  });
});

describe("archiveDue (EC-26)", () => {
  it("archives once the end is before the edit window, so its days have settled", () => {
    // The edit window starts last week's Sunday, 11 October.
    expect(archiveDue("2026-10-10", TODAY)).toBe(true);
    expect(archiveDue("2026-10-11", TODAY)).toBe(false);
    expect(archiveDue("2026-10-19", TODAY)).toBe(false);
    expect(archiveDue(null, TODAY)).toBe(false);
  });
});

describe("boundsCutToday", () => {
  const tuesday = { plannedWeekdays: "2", timesPerWeek: 1, fortnightOffset: 0 };

  it("is true when new bounds take away a run due today", () => {
    expect(
      boundsCutToday(tuesday, { repeatFrom: null, repeatUntil: null }, { repeatFrom: null, repeatUntil: "2026-10-19" }, TODAY),
    ).toBe(true);
  });

  it("is false when today wasn't due or still is", () => {
    expect(
      boundsCutToday(
        { ...tuesday, plannedWeekdays: "3" },
        { repeatFrom: null, repeatUntil: null },
        { repeatFrom: null, repeatUntil: "2026-10-19" },
        TODAY,
      ),
    ).toBe(false);
    expect(
      boundsCutToday(tuesday, { repeatFrom: null, repeatUntil: null }, { repeatFrom: null, repeatUntil: "2026-12-01" }, TODAY),
    ).toBe(false);
  });
});

describe("nextRun", () => {
  const tuesdays = { plannedWeekdays: "2", timesPerWeek: 1, fortnightOffset: 0 };

  it("is today when it runs today, else its next day in the schedule", () => {
    expect(nextRun({ ...tuesdays, repeatFrom: null, repeatUntil: null }, TODAY)).toBe(TODAY);
    expect(nextRun({ ...tuesdays, plannedWeekdays: "4", repeatFrom: null, repeatUntil: null }, TODAY)).toBe(
      "2026-10-22",
    );
  });

  it("skips skipped days and respects the series' start", () => {
    expect(
      nextRun({ ...tuesdays, repeatFrom: null, repeatUntil: null, skippedDates: new Set([TODAY]) }, TODAY),
    ).toBe("2026-10-27");
    expect(nextRun({ ...tuesdays, repeatFrom: "2026-11-01", repeatUntil: null }, TODAY)).toBe("2026-11-03");
  });

  it("is null once the series has ended", () => {
    expect(nextRun({ ...tuesdays, repeatFrom: null, repeatUntil: "2026-10-19" }, TODAY)).toBeNull();
  });
});

describe("pastChangedBy (no bounds edit rewrites a past day)", () => {
  const old = { repeatFrom: "2026-09-01", repeatUntil: "2026-12-01" };

  it("allows ending yesterday or later, and starting today or later", () => {
    expect(pastChangedBy(old, { ...old, repeatUntil: "2026-10-19" }, TODAY)).toBe(false);
    expect(pastChangedBy(old, { ...old, repeatUntil: "2026-12-20" }, TODAY)).toBe(false);
    expect(pastChangedBy({ repeatFrom: "2026-11-01", repeatUntil: null }, { repeatFrom: "2026-10-25", repeatUntil: null }, TODAY)).toBe(false);
  });

  it("refuses an end before yesterday, which would take runs off past days", () => {
    expect(pastChangedBy(old, { ...old, repeatUntil: "2026-10-15" }, TODAY)).toBe(true);
  });

  it("refuses moving a started series' first day later, or earlier into the past", () => {
    expect(pastChangedBy(old, { ...old, repeatFrom: "2026-10-01" }, TODAY)).toBe(true);
    expect(pastChangedBy(old, { ...old, repeatFrom: "2026-08-01" }, TODAY)).toBe(true);
    expect(pastChangedBy({ repeatFrom: null, repeatUntil: null }, { repeatFrom: TODAY, repeatUntil: null }, TODAY)).toBe(true);
  });

  it("doesn't care about an ended series whose past is unchanged", () => {
    expect(pastChangedBy({ repeatFrom: null, repeatUntil: "2026-10-01" }, { repeatFrom: null, repeatUntil: "2026-10-01" }, TODAY)).toBe(false);
  });
});
