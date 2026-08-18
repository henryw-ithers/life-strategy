/**
 * ADR-0027 §1: the routine band is 80, the variable band is 20, and a
 * completion pays a fixed number from its own band rather than `7 ÷ f`
 * times its share of a day.
 */
import { describe, expect, it } from "vitest";

import {
  bandPointValues,
  dayCeiling,
  isRoutine,
  ROUTINE_BAND,
  VARIABLE_BAND,
  type BandTask,
  type BandUnit,
} from "../bands";

const unit = (unitId: string, weight: number): BandUnit => ({ unitId, weight });
const task = (
  id: string,
  unitId: string,
  timesPerWeek: number,
  rankInUnit = 1,
): BandTask => ({ id, unitId, timesPerWeek, rankInUnit });

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("the routine/variable line", () => {
  it("counts only every-day tasks as routine", () => {
    expect(isRoutine(7)).toBe(true);
    expect(isRoutine(6)).toBe(false);
    expect(isRoutine(1)).toBe(false);
  });

  it("treats fortnightly (0) as variable, not as zero", () => {
    // 0 encodes "once every two weeks" — the least frequent thing the
    // app offers, so it is the furthest from routine, not outside the
    // scale.
    expect(isRoutine(0)).toBe(false);
  });
});

describe("routine band", () => {
  it("pays a unit's daily tasks 80% of its weight", () => {
    const values = bandPointValues([unit("u", 50)], [task("t", "u", 7)]);
    expect(values.get("t")).toBe(40);
  });

  it("splits one unit's share across its daily tasks by rank", () => {
    const values = bandPointValues(
      [unit("u", 50)],
      [task("a", "u", 7, 1), task("b", "u", 7, 2)],
    );
    // 40 across 3:2 rank shares, with the one-point floor applied.
    expect(sum(values)).toBe(40);
    expect(values.get("a")!).toBeGreaterThan(values.get("b")!);
  });

  it("fills the whole band when every unit has a daily task", () => {
    const units = [unit("a", 40), unit("b", 35), unit("c", 25)];
    const tasks = [task("1", "a", 7), task("2", "b", 7), task("3", "c", 7)];
    expect(sum(bandPointValues(units, tasks))).toBe(ROUTINE_BAND);
  });

  it("leaves an uncovered unit's share unearnable rather than sharing it out", () => {
    // ADR-0027 §2, and the whole reason the ceiling means anything: the
    // 40 belonging to "b" does not reappear anywhere.
    const units = [unit("a", 60), unit("b", 40)];
    const values = bandPointValues(units, [task("1", "a", 7)]);
    expect(values.get("1")).toBe(48); // 0.8 × 60, not 0.8 × 100
    expect(sum(values)).toBe(48);
  });

  it("gives an excluded unit nothing to divide", () => {
    const values = bandPointValues([unit("u", 0)], [task("t", "u", 7)]);
    expect(values.get("t")).toBe(0);
  });
});

describe("variable band", () => {
  it("splits 20 across every non-daily task in the plan", () => {
    const units = [unit("a", 60), unit("b", 40)];
    const tasks = [task("1", "a", 3), task("2", "b", 1)];
    const values = bandPointValues(units, tasks);
    expect(sum(values)).toBe(VARIABLE_BAND);
  });

  it("is one pool for the whole plan, not one per unit", () => {
    // Four weekly tasks across four units still come to 20 between
    // them: the band's size does not depend on how many units are
    // involved, which is what stops a wide plan out-earning the cap.
    const units = [unit("a", 25), unit("b", 25), unit("c", 25), unit("d", 25)];
    const tasks = [
      task("1", "a", 1),
      task("2", "b", 1),
      task("3", "c", 1),
      task("4", "d", 1),
    ];
    expect(sum(bandPointValues(units, tasks))).toBe(VARIABLE_BAND);
  });

  it("weights the pool by unit weight and orders it by rank", () => {
    const units = [unit("big", 80), unit("small", 20)];
    const values = bandPointValues(units, [
      task("b", "big", 1),
      task("s", "small", 1),
    ]);
    expect(values.get("b")!).toBeGreaterThan(values.get("s")!);
    expect(sum(values)).toBe(VARIABLE_BAND);
  });

  it("never leaves a task worth nothing while the band can afford it", () => {
    // The floor ADR-0003 §5 set for the same reason: a row that cannot
    // move the number is worse than no row.
    const units = [unit("a", 95), unit("b", 5)];
    const values = bandPointValues(units, [
      task("1", "a", 1),
      task("2", "b", 1),
    ]);
    expect(values.get("2")).toBeGreaterThanOrEqual(1);
  });
});

describe("both bands together", () => {
  it("tops out at 100 for a plan with a daily task under every unit", () => {
    const units = [unit("a", 50), unit("b", 30), unit("c", 20)];
    const tasks = [
      task("1", "a", 7),
      task("2", "b", 7),
      task("3", "c", 7),
      task("4", "a", 1, 2),
    ];
    expect(sum(bandPointValues(units, tasks))).toBe(ROUTINE_BAND + VARIABLE_BAND);
  });

  it("cannot exceed 100 however the plan is shaped", () => {
    // The 112 this ADR exists to fix: every task completed used to pay
    // its full value against an amortized denominator. Nothing here can
    // pay more than its band holds.
    const units = [unit("a", 34), unit("b", 33), unit("c", 33)];
    const tasks: BandTask[] = [
      task("1", "a", 7),
      task("2", "a", 1, 2),
      task("3", "b", 7),
      task("4", "b", 2, 2),
      task("5", "c", 3),
      task("6", "c", 0, 2),
    ];
    expect(sum(bandPointValues(units, tasks))).toBeLessThanOrEqual(100);
  });

  it("puts a plan of two weekly tasks nowhere near 100", () => {
    // Henry, 2026-08-18: "we shouldn't give out 100s for plans
    // containing 1 or 2 weekly tasks."
    const units = [unit("a", 50), unit("b", 50)];
    const values = bandPointValues(units, [task("1", "a", 1), task("2", "b", 1)]);
    expect(sum(values)).toBe(VARIABLE_BAND);
  });
});

describe("dayCeiling", () => {
  it("is 0.8 × covered weight + 20", () => {
    const units = [unit("a", 55), unit("b", 45)];
    expect(dayCeiling(units, [task("1", "a", 7)])).toBe(64);
    expect(dayCeiling(units, [task("1", "a", 7), task("2", "b", 7)])).toBe(100);
  });

  it("counts a unit as covered only when something there is daily", () => {
    const units = [unit("a", 100)];
    expect(dayCeiling(units, [task("1", "a", 1)])).toBe(VARIABLE_BAND);
  });
});
