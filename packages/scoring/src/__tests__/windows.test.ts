import { describe, expect, it } from "vitest";

import {
  formatMinutes,
  gridExtent,
  dayLoadHours,
  planLoadHours,
  fitsInWindow,
  windowCapacity,
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

describe("capacity and load — ADR-0026", () => {
  const twoHours = {
    start: 11 * 60,
    end: 13 * 60,
    afterTaskId: "lecture",
    partOfDay: null,
  };

  it("says roughly how many normal things a window holds", () => {
    expect(windowCapacity(twoHours)).toBe(4);
    expect(windowCapacity({ ...twoHours, end: 12 * 60 })).toBe(2);
  });

  it("fits work by size rather than by count", () => {
    expect(fitsInWindow(twoHours, ["big", "big"])).toBe(true);
    expect(fitsInWindow(twoHours, ["big", "big", "quick"])).toBe(false);
    expect(fitsInWindow(twoHours, ["quick", "quick", "quick", "quick"])).toBe(true);
  });

  it("treats an unsized task as normal, without writing that anywhere", () => {
    // A fit has to assume something and the middle is least wrong. The
    // assumption is local to this call — task.size stays null.
    expect(fitsInWindow(twoHours, [null, null, null, null])).toBe(true);
    expect(fitsInWindow(twoHours, [null, null, null, null, null])).toBe(false);
  });

  it("sums a day's load in hours, counting unsized work as nothing", () => {
    // Unsized work is *unknown*, not zero-effort — but a load meter
    // that invented an estimate would be guessing at the user.
    expect(dayLoadHours(["big", "normal", "quick"])).toBe(1.75);
    expect(dayLoadHours([null, null])).toBe(0);
    expect(dayLoadHours([])).toBe(0);
  });

  it("returns a bare number, with no threshold state to colour", () => {
    // ADR-0026 §3: shown, never warned about. If this ever returns an
    // object with a `tooFull` or a band, that rule has been broken.
    expect(typeof dayLoadHours(["big", "big", "big", "big", "big"])).toBe(
      "number",
    );
  });
});

describe("planLoadHours", () => {
  const t = (id: string, size: "quick" | "normal" | "big" | null) => ({ id, size });

  it("is dayLoadHours when there are no pools", () => {
    const tasks = [t("a", "big"), t("b", "normal"), t("c", "quick"), t("d", null)];
    expect(planLoadHours(tasks, [])).toBe(dayLoadHours(tasks.map((x) => x.size)));
  });

  it("counts a pool at its planned count, not its member count", () => {
    // Three big options you mean to do one of are an hour, not three.
    const tasks = [t("a", "big"), t("b", "big"), t("c", "big")];
    expect(
      planLoadHours(tasks, [{ taskIds: ["a", "b", "c"], plannedCount: 1 }]),
    ).toBe(1);
    expect(
      planLoadHours(tasks, [{ taskIds: ["a", "b", "c"], plannedCount: 2 }]),
    ).toBe(2);
  });

  it("uses the mean of the sized members", () => {
    // big (1h) and quick (0.25h) average 0.625h.
    const tasks = [t("a", "big"), t("b", "quick")];
    expect(
      planLoadHours(tasks, [{ taskIds: ["a", "b"], plannedCount: 1 }]),
    ).toBe(0.625);
  });

  it("ignores unsized members in the mean rather than counting them as zero", () => {
    const tasks = [t("a", "big"), t("b", null)];
    expect(
      planLoadHours(tasks, [{ taskIds: ["a", "b"], plannedCount: 1 }]),
    ).toBe(1);
  });

  it("adds nothing for a pool with no sized members", () => {
    const tasks = [t("a", null), t("b", null), t("c", "normal")];
    expect(
      planLoadHours(tasks, [{ taskIds: ["a", "b"], plannedCount: 2 }]),
    ).toBe(0.5);
  });

  it("does not count a pooled task twice", () => {
    // Pooled members leave the flat sum; only the pool counts them.
    const tasks = [t("a", "big"), t("b", "big"), t("c", "normal")];
    expect(
      planLoadHours(tasks, [{ taskIds: ["a", "b"], plannedCount: 1 }]),
    ).toBe(1.5);
  });

  it("never plans more slots than the pool has members on the day", () => {
    const tasks = [t("a", "normal")];
    expect(
      planLoadHours(tasks, [{ taskIds: ["a", "gone"], plannedCount: 3 }]),
    ).toBe(0.5);
  });

  it("returns a bare number, with no threshold state to colour", () => {
    expect(
      typeof planLoadHours(
        [t("a", "big"), t("b", "big")],
        [{ taskIds: ["a", "b"], plannedCount: 2 }],
      ),
    ).toBe("number");
  });
});
