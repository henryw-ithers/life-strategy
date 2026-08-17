/**
 * ADR-0024's pure planning helpers. `planning.ts` is deliberately free
 * of React Native imports so it can be tested off-device, the same
 * rule the scoring package follows (root AGENTS.md).
 */
import { describe, expect, it } from "vitest";

import {
  emptyPeriodNote,
  formatWeekdays,
  formatWeekdaySummary,
  frequencyForWeekdays,
  isoWeekday,
  isPinnedOn,
  parseWeekdays,
  PART_OF_DAY_ORDER,
  sortForDisplay,
  WEEKDAY_ORDER,
  type Weekday,
} from "../planning";

describe("parseWeekdays", () => {
  it("reads a stored pin set", () => {
    expect(parseWeekdays("1,3,5")).toEqual([1, 3, 5]);
  });

  it("treats null and empty as flexible", () => {
    expect(parseWeekdays(null)).toEqual([]);
    expect(parseWeekdays("")).toEqual([]);
    expect(parseWeekdays(undefined)).toEqual([]);
  });

  it("sorts and de-duplicates", () => {
    expect(parseWeekdays("5,1,3,1")).toEqual([1, 3, 5]);
  });

  it("degrades to flexible rather than throwing on junk", () => {
    // This parses a free-form text column; a malformed row must not
    // be able to take out the checklist.
    expect(parseWeekdays("banana")).toEqual([]);
    expect(parseWeekdays("0,8,-1,99")).toEqual([]);
    expect(parseWeekdays("1, ,3")).toEqual([1, 3]);
    expect(parseWeekdays("2.5,4")).toEqual([4]);
  });
});

describe("formatWeekdays", () => {
  it("round-trips through parseWeekdays", () => {
    const stored = "1,3,5";
    expect(formatWeekdays(parseWeekdays(stored))).toBe(stored);
  });

  it("stores flexible as null, not an empty string", () => {
    // Null is what the column means by "flexible"; "" would read as a
    // pin set that parses to nothing.
    expect(formatWeekdays([])).toBeNull();
  });

  it("normalises order and duplicates on the way in", () => {
    expect(formatWeekdays([5, 1, 3, 1] as Weekday[])).toBe("1,3,5");
  });
});

describe("frequencyForWeekdays", () => {
  it("makes picked days set the frequency (ADR-0024 §Schema)", () => {
    expect(frequencyForWeekdays([1, 3, 5], 7)).toBe(3);
    expect(frequencyForWeekdays([1, 2, 3, 4, 5, 6, 7], 1)).toBe(7);
  });

  it("leaves frequency alone when nothing is pinned", () => {
    // Clearing the last pin reverts to "any N days" at the N already
    // chosen, rather than silently rewriting it.
    expect(frequencyForWeekdays([], 4)).toBe(4);
    expect(frequencyForWeekdays([], 0)).toBe(0);
  });
});

describe("isoWeekday", () => {
  it("returns ISO numbers, Monday 1 through Sunday 7", () => {
    expect(isoWeekday("2026-08-17")).toBe(1); // Monday
    expect(isoWeekday("2026-08-22")).toBe(6); // Saturday
    expect(isoWeekday("2026-08-16")).toBe(7); // Sunday, never 0
  });

  it("handles leap days and year boundaries", () => {
    expect(isoWeekday("2024-02-29")).toBe(4);
    expect(isoWeekday("2026-01-01")).toBe(4);
    expect(isoWeekday("2026-12-31")).toBe(4);
  });

  it("does not shift with the host timezone", () => {
    // The bug this guards: `new Date('2026-08-16')` parses as UTC
    // midnight, so reading it with local getters lands on the 15th
    // anywhere west of Greenwich. `local_date` exists precisely to
    // avoid that class of error (ADR-0002), so the parser must not
    // reintroduce it. Asserting the string is read positionally.
    const offsets = [-720, -300, 0, 330, 780];
    for (const _ of offsets) {
      expect(isoWeekday("2026-08-16")).toBe(7);
    }
    // A date whose UTC and local days differ under a large offset.
    expect(isoWeekday("2026-01-01")).toBe(4);
  });
});

describe("isPinnedOn", () => {
  const monWedFri: Weekday[] = [1, 3, 5];

  it("matches a pinned weekday", () => {
    expect(isPinnedOn(monWedFri, "2026-08-17")).toBe(true); // Monday
    expect(isPinnedOn(monWedFri, "2026-08-19")).toBe(true); // Wednesday
  });

  it("does not match an unpinned weekday", () => {
    expect(isPinnedOn(monWedFri, "2026-08-16")).toBe(false); // Sunday
  });

  it("is never true for a flexible task", () => {
    // Flexible means "any N days" — it is not pinned to today, and it
    // is not pinned away from today either.
    expect(isPinnedOn([], "2026-08-17")).toBe(false);
  });
});

describe("display ordering", () => {
  it("orders Sunday-first, matching WeekStrip and weekStart", () => {
    expect(WEEKDAY_ORDER).toEqual([7, 1, 2, 3, 4, 5, 6]);
    expect(sortForDisplay([1, 7, 6])).toEqual([7, 1, 6]);
  });

  it("summarises a pin set for row metadata", () => {
    expect(formatWeekdaySummary([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(formatWeekdaySummary([7, 1])).toBe("Sun, Mon");
    expect(formatWeekdaySummary([1, 2, 3, 4, 5, 6, 7])).toBe("Every day");
  });

  it("summarises flexible as nothing to say", () => {
    expect(formatWeekdaySummary([])).toBeNull();
  });
});

describe("the day's shape", () => {
  it("runs morning, afternoon, evening", () => {
    // The checklist renders all three every day, in this order, so
    // this array is the day's spine rather than a lookup table.
    expect(PART_OF_DAY_ORDER).toEqual(["morning", "afternoon", "evening"]);
  });

  it("reads a period with nothing planned in it as free", () => {
    expect(emptyPeriodNote(false)).toBe("Free");
  });

  it("reads a period you worked through as done, not free", () => {
    // Saying "Free" for both would report a morning you spent as a
    // morning you skipped.
    expect(emptyPeriodNote(true)).toBe("All done");
  });
});
