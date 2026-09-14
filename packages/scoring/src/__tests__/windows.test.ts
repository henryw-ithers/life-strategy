import { describe, expect, it } from "vitest";

import {
  formatMinutes,
  gridExtent,
  windowsFor,
  MIN_WINDOW_MINUTES,
  PART_OF_DAY_BOUNDS,
  type Block,
} from "../windows";

const at = (taskId: string, from: string, to: string): Block => {
  const mins = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  return { taskId, startMinute: mins(from), endMinute: mins(to) };
};

describe("a day with no commitments — ADR-0033 §1", () => {
  it("is the three parts of day, in order", () => {
    const w = windowsFor([]);
    expect(w.map((x) => x.partOfDay)).toEqual([
      "morning",
      "afternoon",
      "evening",
    ]);
    expect(w.every((x) => x.afterTaskId === null)).toBe(true);
  });

  it("needs no special case — a weekend is today's app", () => {
    expect(windowsFor([]).length).toBe(3);
  });
});

describe("a day with commitments — the gaps between them", () => {
  const day = [at("lecture", "09:00", "11:00"), at("lab", "13:00", "15:00")];

  it("puts a window between two blocks, cued to the earlier one", () => {
    const gap = windowsFor(day).find((w) => w.afterTaskId === "lecture");
    expect(gap).toEqual({
      start: 11 * 60,
      end: 13 * 60,
      afterTaskId: "lecture",
      partOfDay: null,
    });
  });

  it("opens a window before the first block and after the last", () => {
    const w = windowsFor(day);
    expect(w[0]).toMatchObject({ start: 0, end: 9 * 60, afterTaskId: null });
    expect(w[w.length - 1]).toMatchObject({
      start: 15 * 60,
      end: 24 * 60,
      afterTaskId: "lab",
    });
  });

  it("carries no part of day — those belong to uncommitted days", () => {
    expect(windowsFor(day).every((w) => w.partOfDay === null)).toBe(true);
  });
});

describe("buffer is not free time — ADR-0033 §1", () => {
  it("drops a gap shorter than the minimum", () => {
    const tight = [at("a", "09:00", "10:00"), at("b", "10:15", "11:00")];
    expect(
      windowsFor(tight).some((w) => w.start === 10 * 60 && w.end === 10 * 60 + 15),
    ).toBe(false);
  });

  it("keeps a gap exactly at the minimum", () => {
    const exact = [at("a", "09:00", "10:00"), at("b", "10:30", "11:00")];
    expect(windowsFor(exact).some((w) => w.afterTaskId === "a")).toBe(true);
  });

  it("honours a caller's own minimum", () => {
    const tight = [at("a", "09:00", "10:00"), at("b", "10:15", "11:00")];
    expect(windowsFor(tight, 10).some((w) => w.afterTaskId === "a")).toBe(true);
    expect(MIN_WINDOW_MINUTES).toBe(30);
  });
});

describe("overlapping blocks", () => {
  it("merges them, so a gap is a real gap", () => {
    const overlap = [at("a", "09:00", "11:00"), at("b", "10:00", "12:00")];
    const w = windowsFor(overlap);
    // One window after the merged pair, cued to whichever ends last.
    expect(w.filter((x) => x.afterTaskId !== null)).toHaveLength(1);
    expect(w.find((x) => x.afterTaskId !== null)).toMatchObject({
      start: 12 * 60,
      afterTaskId: "b",
    });
  });

  it("ignores a zero-length block rather than emitting a phantom gap", () => {
    expect(windowsFor([at("bad", "09:00", "09:00")])).toEqual(windowsFor([]));
  });
});

describe("gridExtent — ADR-0033 §4", () => {
  it("spans the windows, not just the blocks", () => {
    // One 9am lecture: the extent must reach past 10:00, or the grid
    // draws a single hour on a tall screen.
    const blocks = [at("lecture", "09:00", "10:00")];
    const extent = gridExtent(blocks, windowsFor(blocks));
    expect(extent.start).toBe(0);
    expect(extent.end).toBe(24 * 60);
  });

  it("falls back to the parts of day when there is nothing at all", () => {
    expect(gridExtent([], [])).toEqual({
      start: PART_OF_DAY_BOUNDS.morning.start,
      end: PART_OF_DAY_BOUNDS.evening.end,
    });
  });
});

describe("formatMinutes", () => {
  it("renders a zero-padded 24-hour clock", () => {
    expect(formatMinutes(540)).toBe("09:00");
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(23 * 60 + 59)).toBe("23:59");
  });

  it("wraps rather than producing nonsense", () => {
    expect(formatMinutes(24 * 60)).toBe("00:00");
    expect(formatMinutes(-60)).toBe("23:00");
  });
});
