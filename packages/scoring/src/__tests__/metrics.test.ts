import { describe, expect, it } from "vitest";

import {
  barFraction,
  metricState,
  milestonesReached,
  type MetricProgress,
} from "../metrics";

const e = (localDate: string, value: number): MetricProgress => ({ localDate, value });

describe("cumulative goals", () => {
  const books = { kind: "cumulative" as const, targetValue: 24 };

  it("sums entries toward the target", () => {
    const s = metricState(books, [e("2026-01-05", 3), e("2026-02-01", 2)]);
    expect(s.current).toBe(5);
    expect(s.fraction).toBeCloseTo(5 / 24);
    expect(s.met).toBe(false);
    expect(s.direction).toBeNull();
  });

  it("draws from zero rather than waiting for a first entry", () => {
    // Unlike a target reading, "0 of 24" is a real reading — there is
    // no starting point to invent (ADR-0015 §1).
    const s = metricState(books, []);
    expect(s.current).toBe(0);
    expect(s.fraction).toBe(0);
    expect(s.met).toBe(false);
  });

  it("is met on reaching the target, and reports overshoot honestly", () => {
    const s = metricState(books, [e("2026-06-01", 26)]);
    expect(s.met).toBe(true);
    expect(s.fraction).toBeGreaterThan(1);
    // The bar clamps; the number does not.
    expect(barFraction(s)).toBe(1);
  });

  it("does not divide by a zero target", () => {
    const s = metricState({ kind: "cumulative", targetValue: 0 }, []);
    expect(s.fraction).toBe(1);
    expect(s.met).toBe(true);
  });
});

describe("target readings, ascending", () => {
  const bench = { kind: "target" as const, targetValue: 225 };

  it("has nothing to draw before the first reading", () => {
    // A bar with no readings would be inventing a starting point.
    const s = metricState(bench, []);
    expect(s.current).toBeNull();
    expect(s.fraction).toBeNull();
    expect(s.direction).toBeNull();
    expect(barFraction(s)).toBeNull();
  });

  it("infers direction from the earliest reading", () => {
    const s = metricState(bench, [e("2026-01-01", 135), e("2026-03-01", 185)]);
    expect(s.direction).toBe("up");
    expect(s.current).toBe(185);
    expect(s.fraction).toBeCloseTo((185 - 135) / (225 - 135));
  });

  it("keeps a met target after a lighter session", () => {
    // "I benched 225" stays true, which is why reaching a target
    // invites completion rather than performing it (ADR-0015 §3).
    const s = metricState(bench, [
      e("2026-01-01", 135),
      e("2026-05-01", 225),
      e("2026-05-08", 205),
    ]);
    expect(s.met).toBe(true);
    expect(s.current).toBe(205);
  });
});

describe("target readings, descending", () => {
  const weight = { kind: "target" as const, targetValue: 80 };

  it("infers a downward direction without being asked", () => {
    // Losing and gaining share one metric kind and one input.
    const s = metricState(weight, [e("2026-01-01", 90), e("2026-02-01", 85)]);
    expect(s.direction).toBe("down");
    expect(s.fraction).toBeCloseTo((85 - 90) / (80 - 90));
    expect(s.fraction).toBeCloseTo(0.5);
  });

  it("is met when a reading drops to the target", () => {
    const s = metricState(weight, [e("2026-01-01", 90), e("2026-06-01", 79)]);
    expect(s.met).toBe(true);
  });

  it("shows the bar going backwards when it should", () => {
    // For a current-value metric, regression is the truth and hiding
    // it would be the falsification.
    const s = metricState(weight, [
      e("2026-01-01", 90),
      e("2026-02-01", 84),
      e("2026-03-01", 87),
    ]);
    expect(s.current).toBe(87);
    expect(s.fraction).toBeCloseTo(0.3);
    expect(s.met).toBe(false);
  });
});

describe("ordering and edge cases", () => {
  it("orders by date, not by insertion", () => {
    const s = metricState({ kind: "target", targetValue: 225 }, [
      e("2026-05-01", 205),
      e("2026-01-01", 135),
    ]);
    expect(s.direction).toBe("up");
    expect(s.current).toBe(205);
  });

  it("keeps same-day readings in entry order", () => {
    const s = metricState({ kind: "target", targetValue: 100 }, [
      e("2026-01-01", 50),
      e("2026-01-01", 70),
    ]);
    expect(s.current).toBe(70);
  });

  it("treats starting at the target as already met", () => {
    const s = metricState({ kind: "target", targetValue: 80 }, [e("2026-01-01", 80)]);
    expect(s.met).toBe(true);
    expect(s.fraction).toBe(1);
    expect(s.direction).toBeNull();
  });
});

describe("milestonesReached", () => {
  const rungs = [
    { id: "a", targetValue: 135 },
    { id: "b", targetValue: 185 },
    { id: "c", targetValue: 225 },
    { id: "untimed", targetValue: null },
  ];

  it("reports rungs the reading has passed, ascending", () => {
    const def = { kind: "target" as const, targetValue: 225 };
    const s = metricState(def, [e("2026-01-01", 100), e("2026-03-01", 190)]);
    expect(milestonesReached(def, s, rungs)).toEqual(["a", "b"]);
  });

  it("inverts for a descending goal", () => {
    const def = { kind: "target" as const, targetValue: 80 };
    const s = metricState(def, [e("2026-01-01", 95), e("2026-02-01", 86)]);
    expect(milestonesReached(def, s, [{ id: "x", targetValue: 90 }])).toEqual(["x"]);
  });

  it("ignores rungs with no threshold", () => {
    const def = { kind: "cumulative" as const, targetValue: 24 };
    const s = metricState(def, [e("2026-01-01", 300)]);
    expect(milestonesReached(def, s, rungs)).not.toContain("untimed");
  });

  it("reports nothing before the first reading", () => {
    const def = { kind: "target" as const, targetValue: 225 };
    expect(milestonesReached(def, metricState(def, []), rungs)).toEqual([]);
  });
});
