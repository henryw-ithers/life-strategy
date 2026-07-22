import { describe, expect, it } from "vitest";

import {
  addDays,
  editWindowStart,
  fortnightStart,
  isEditable,
  isFinalized,
  localDateOf,
  monthStart,
  nextMonthStart,
  weekStart,
} from "../days";

describe("localDateOf", () => {
  it("keeps a late night on the day it felt like (before 3am)", () => {
    // 2026-07-17 02:59 local belongs to the 16th.
    expect(localDateOf(new Date(2026, 6, 17, 2, 59))).toBe("2026-07-16");
  });

  it("rolls over at exactly 3am", () => {
    expect(localDateOf(new Date(2026, 6, 17, 3, 0))).toBe("2026-07-17");
  });

  it("respects a configured rollover hour", () => {
    expect(localDateOf(new Date(2026, 6, 17, 4, 30), 5)).toBe("2026-07-16");
  });
});

describe("week and fortnight boundaries", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-07-17")).toBe("2026-07-13"); // Fri → Mon
    expect(weekStart("2026-07-13")).toBe("2026-07-13"); // Mon → itself
    expect(weekStart("2026-07-19")).toBe("2026-07-13"); // Sun → prior Mon
  });

  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("fortnights are stable two-week blocks aligned to week starts", () => {
    const fs = fortnightStart("2026-07-17");
    expect([fs, addDays(fs, 7)]).toContain(weekStart("2026-07-17"));
    // Every day in the same fortnight maps to the same start.
    expect(fortnightStart(addDays(fs, 13))).toBe(fs);
    // The next fortnight starts exactly 14 days later.
    expect(fortnightStart(addDays(fs, 14))).toBe(addDays(fs, 14));
  });
});

describe("month boundaries", () => {
  it("monthStart is the 1st of the month containing date", () => {
    expect(monthStart("2026-07-17")).toBe("2026-07-01");
    expect(monthStart("2026-07-01")).toBe("2026-07-01");
    expect(monthStart("2026-07-31")).toBe("2026-07-01");
  });

  it("nextMonthStart rolls over within a year", () => {
    expect(nextMonthStart("2026-07-17")).toBe("2026-08-01");
  });

  it("nextMonthStart rolls over across a year boundary", () => {
    expect(nextMonthStart("2026-12-05")).toBe("2027-01-01");
    expect(monthStart("2026-12-05")).toBe("2026-12-01");
  });

  it("[monthStart, nextMonthStart) brackets every day in the month, none outside it", () => {
    const start = monthStart("2026-02-10");
    const end = nextMonthStart("2026-02-10");
    expect(start <= "2026-02-28" && "2026-02-28" < end).toBe(true);
    expect(start <= "2026-03-01" && "2026-03-01" < end).toBe(false);
  });
});

describe("edit window (ADR-0004 §1, week-aligned)", () => {
  const today = "2026-07-17"; // Friday; week starts 07-13

  it("opens on Monday of the previous week", () => {
    expect(editWindowStart(today)).toBe("2026-07-06");
  });

  it("the whole previous week is editable; before that is finalized", () => {
    expect(isEditable("2026-07-06", today)).toBe(true);
    expect(isEditable("2026-07-05", today)).toBe(false);
    expect(isFinalized("2026-07-05", today)).toBe(true);
    expect(isFinalized("2026-07-06", today)).toBe(false);
  });

  it("today is editable, the future is not", () => {
    expect(isEditable(today, today)).toBe(true);
    expect(isEditable("2026-07-18", today)).toBe(false);
    expect(isFinalized("2026-07-18", today)).toBe(false);
  });
});
