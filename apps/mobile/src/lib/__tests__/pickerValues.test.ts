import { describe, expect, it } from "vitest";

import {
  dateToLocalDate,
  dateToMinutes,
  hhmmToMinutes,
  localDateToDate,
  minutesToDate,
} from "../pickerValues";

describe("clock times", () => {
  it("round-trips minutes through a Date", () => {
    for (const m of [0, 9 * 60, 13 * 60 + 35, 1439]) {
      expect(dateToMinutes(minutesToDate(m))).toBe(m);
    }
  });

  it("reads a web time input", () => {
    expect(hhmmToMinutes("09:30")).toBe(570);
    expect(hhmmToMinutes("23:59")).toBe(1439);
    expect(hhmmToMinutes("")).toBeNull();
    expect(hhmmToMinutes("25:00")).toBeNull();
  });
});

describe("days", () => {
  it("round-trips a local date", () => {
    for (const d of ["2026-01-01", "2026-03-29", "2026-10-04", "2026-12-31"]) {
      expect(dateToLocalDate(localDateToDate(d))).toBe(d);
    }
  });

  it("does not roll back a day picked just after midnight", () => {
    // The 3am rollover applies to "what day is it", not to a day you pick.
    expect(dateToLocalDate(new Date(2026, 9, 14, 1, 0))).toBe("2026-10-14");
  });
});
