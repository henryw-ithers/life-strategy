import { describe, expect, it } from "vitest";

import {
  computeStreak,
  habitRungsReached,
  rungReachedOn,
  HABIT_LADDER,
} from "../streak";

/** A run of consecutive dates, oldest first. */
const run = (from: string, days: number): string[] => {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  for (let i = 0; i < days; i++) {
    const t = new Date(Date.UTC(y!, m! - 1, d! + i));
    out.push(t.toISOString().slice(0, 10));
  }
  return out;
};

describe("computeStreak", () => {
  it("counts a run ending today", () => {
    const s = computeStreak({ done: run("2026-08-10", 7), today: "2026-08-16" });
    expect(s.current).toBe(7);
    expect(s.longest).toBe(7);
  });

  it("does not break on a today that hasn't happened yet", () => {
    // The day isn't over. A number that dropped to zero every morning
    // would be reporting the clock rather than the person.
    const s = computeStreak({ done: run("2026-08-10", 6), today: "2026-08-16" });
    expect(s.current).toBe(6);
  });

  it("resets on a single miss", () => {
    // Strict consecutive, per the 2026-08-16 decision.
    const s = computeStreak({
      done: [...run("2026-08-01", 10), "2026-08-15", "2026-08-16"],
      today: "2026-08-16",
    });
    expect(s.current).toBe(2);
    expect(s.longest).toBe(10);
  });

  it("is zero when nothing has been done", () => {
    expect(computeStreak({ done: [], today: "2026-08-16" })).toEqual({
      current: 0,
      longest: 0,
    });
  });

  it("is zero after two missed days, even with a long history", () => {
    const s = computeStreak({ done: run("2026-07-01", 20), today: "2026-08-16" });
    expect(s.current).toBe(0);
    expect(s.longest).toBe(20);
  });
});

describe("days off", () => {
  it("bridges a streak rather than breaking it", () => {
    // ADR-0004 §3: a declared day off is "no grade, no penalty, no
    // streak break". It is not a done day either.
    const s = computeStreak({
      done: ["2026-08-12", "2026-08-13", "2026-08-15", "2026-08-16"],
      daysOff: ["2026-08-14"],
      today: "2026-08-16",
    });
    expect(s.current).toBe(4);
  });

  it("does not itself count toward the number", () => {
    // Four done days across five calendar days reads as four, not
    // five: the day off leaves the sequence entirely, exactly as it
    // leaves the grade.
    const s = computeStreak({
      done: ["2026-08-12", "2026-08-13", "2026-08-15", "2026-08-16"],
      daysOff: ["2026-08-14"],
      today: "2026-08-16",
    });
    expect(s.current).not.toBe(5);
  });

  it("bridges the longest run too", () => {
    const s = computeStreak({
      done: ["2026-08-01", "2026-08-02", "2026-08-04", "2026-08-05"],
      daysOff: ["2026-08-03"],
      today: "2026-08-16",
    });
    expect(s.longest).toBe(4);
  });

  it("survives a day off falling on today", () => {
    const s = computeStreak({
      done: run("2026-08-10", 6),
      daysOff: ["2026-08-16"],
      today: "2026-08-16",
    });
    expect(s.current).toBe(6);
  });

  it("terminates when the whole tail is days off", () => {
    // The loop walks backwards; without a bound at the earliest done
    // date this would not stop.
    const s = computeStreak({
      done: ["2026-08-01"],
      daysOff: run("2026-08-02", 15),
      today: "2026-08-16",
    });
    expect(s.current).toBe(1);
  });
});

describe("habitRungsReached", () => {
  it("is the ladder itself, not a table of rows (ADR-0030 §5)", () => {
    expect(HABIT_LADDER).toEqual([7, 30, 66]);
  });

  it("reports rungs the run has passed", () => {
    const s = computeStreak({ done: run("2026-07-25", 23), today: "2026-08-16" });
    expect(habitRungsReached(s)).toEqual([7]);
  });

  it("reads the longest run, not the current one", () => {
    // Hitting 30 and then missing a day must not take the rung back.
    const s = computeStreak({
      done: [...run("2026-06-01", 30), "2026-08-16"],
      today: "2026-08-16",
    });
    expect(s.current).toBe(1);
    expect(habitRungsReached(s)).toEqual([7, 30]);
  });

  it("reports the whole ladder once automaticity is passed", () => {
    const s = computeStreak({ done: run("2026-01-01", 300), today: "2026-08-16" });
    expect(habitRungsReached(s)).toEqual([7, 30, 66]);
  });

  it("reports nothing on an empty history", () => {
    expect(habitRungsReached({ current: 0, longest: 0 })).toEqual([]);
  });
});

describe("rungReachedOn", () => {
  it("returns the day a run first stood at that length", () => {
    // Seven days from the 1st: the seventh is the 7th.
    expect(rungReachedOn({ done: run("2026-07-01", 20), today: "2026-08-16" }, 7)).toBe(
      "2026-07-07",
    );
  });

  it("returns null when the run never got there", () => {
    expect(rungReachedOn({ done: run("2026-07-01", 5), today: "2026-08-16" }, 7)).toBeNull();
  });

  it("counts the first time, not the best time", () => {
    // A later, longer run must not restate when the rung was passed.
    const done = [...run("2026-01-01", 10), ...run("2026-06-01", 40)];
    expect(rungReachedOn({ done, today: "2026-08-16" }, 7)).toBe("2026-01-07");
  });

  it("bridges declared days off, exactly as the streak does", () => {
    const done = [...run("2026-07-01", 3), ...run("2026-07-05", 4)];
    const reached = rungReachedOn(
      { done, daysOff: ["2026-07-04"], today: "2026-08-16" },
      7,
    );
    expect(reached).toBe("2026-07-08");
  });

  it("is null for a nonsense rung", () => {
    expect(rungReachedOn({ done: run("2026-07-01", 20), today: "2026-08-16" }, 0)).toBeNull();
  });
});
