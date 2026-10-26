/**
 * Achievements (ADR-0047): ranks, runs that keep what they earned, and
 * the catalogue's shape.
 */
import { describe, expect, it } from "vitest";

import {
  clampTookAbout,
  gradeRuns,
  nextRank,
  ranksReached,
  RANKS,
  SERIES,
  tickMinutes,
  topRank,
  weekRuns,
  type Thresholds,
} from "../achievements";

const T: Thresholds = [20, 50, 100, 250, 1000];

describe("ranks", () => {
  it("climbs Bronze to Diamond", () => {
    expect(RANKS).toEqual(["bronze", "silver", "gold", "platinum", "diamond"]);
    expect(ranksReached(T, 19)).toBe(0);
    expect(topRank(T, 19)).toBeNull();
    expect(topRank(T, 20)).toBe("bronze");
    expect(topRank(T, 100)).toBe("gold");
    expect(topRank(T, 5000)).toBe("diamond");
  });

  it("says what the next rank needs, and nothing past Diamond", () => {
    expect(nextRank(T, 62)).toEqual({ rank: "gold", threshold: 100 });
    expect(nextRank(T, 1000)).toBeNull();
  });
});

describe("the catalogue", () => {
  it("has five rising thresholds per series, and peaks that take years", () => {
    for (const s of SERIES) {
      expect(s.thresholds).toHaveLength(5);
      for (let i = 1; i < 5; i++) expect(s.thresholds[i]!).toBeGreaterThan(s.thresholds[i - 1]!);
    }
    const peak = (id: string) => SERIES.find((s) => s.id === id)!.thresholds[4];
    expect(peak("taskCompletions")).toBe(1000);
    expect(peak("everyDayStreak")).toBe(1000);
  });

  it("holds about forty series, each once", () => {
    expect(SERIES).toHaveLength(40);
    expect(new Set(SERIES.map((s) => s.id)).size).toBe(SERIES.length);
  });

  it("counts nothing that's a rate or a miss", () => {
    for (const s of SERIES) expect(s.counts).not.toMatch(/%|percent|missed|rate/i);
  });
});

describe("weekRuns", () => {
  const w = (weekStart: string, met: boolean, skipped = false) => ({ weekStart, met, skipped });

  it("counts weeks met, and the current and longest run", () => {
    const r = weekRuns([w("a", true), w("b", true), w("c", false), w("d", true)]);
    expect(r).toEqual({ total: 3, current: 1, longest: 2 });
  });

  it("passes over a week with nothing asked: it neither counts nor breaks", () => {
    expect(weekRuns([w("a", true), w("b", false, true), w("c", true)])).toEqual({ total: 2, current: 2, longest: 2 });
  });

  it("keeps the longest run when the current one ends", () => {
    const r = weekRuns([w("a", true), w("b", true), w("c", true), w("d", false)]);
    expect(r.longest).toBe(3);
    expect(r.current).toBe(0);
  });
});

describe("gradeRuns", () => {
  it("counts days at the floor, and skips ungraded days", () => {
    const days = [
      { date: "1", grade: 92 },
      { date: "2", grade: null },
      { date: "3", grade: 95 },
      { date: "4", grade: 70 },
      { date: "5", grade: 90 },
    ];
    expect(gradeRuns(days, 90)).toEqual({ total: 3, current: 1, longest: 2 });
  });
});

describe("tickMinutes", () => {
  it("uses Took about, then an event's length, then the size", () => {
    expect(tickMinutes({ size: "big", tookMinutes: 45 })).toBe(45);
    expect(tickMinutes({ size: null, durationMinutes: 90 })).toBe(90);
    expect(tickMinutes({ size: "quick", fraction: 0.5 })).toBe(15);
    expect(clampTookAbout(10_000)).toBe(720);
  });
});
