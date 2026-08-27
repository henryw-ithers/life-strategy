/**
 * ADR-0029 §2: the day splits 90 planned / 10 unplanned, and a task's
 * weight comes from its unit and its rank there — never from how often
 * it happens.
 */
import { describe, expect, it } from "vitest";

import {
  taskWeights,
  unitCoverage,
  PLANNED_BAND,
  UNPLANNED_BAND,
  type BandTask,
  type BandUnit,
} from "../bands";
import { DAILY_BUDGET } from "../constants";

const unit = (unitId: string, weight: number): BandUnit => ({ unitId, weight });
const task = (id: string, unitId: string, rankInUnit = 1): BandTask => ({
  id,
  unitId,
  rankInUnit,
});

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("the bands", () => {
  it("divide the day into 90 and 10", () => {
    expect(PLANNED_BAND + UNPLANNED_BAND).toBe(DAILY_BUDGET);
    expect(PLANNED_BAND).toBe(90);
    expect(UNPLANNED_BAND).toBe(10);
  });
});

describe("taskWeights", () => {
  it("gives a unit's lone task the unit's whole weight", () => {
    const weights = taskWeights([unit("u", 12)], [task("t", "u")]);
    expect(weights.get("t")).toBe(12);
  });

  it("splits a unit's weight across its tasks by rank", () => {
    const weights = taskWeights(
      [unit("u", 12)],
      [task("a", "u", 1), task("b", "u", 2)],
    );
    expect(sum(weights)).toBe(12);
    expect(weights.get("a")).toBeGreaterThan(weights.get("b")!);
  });

  it("never depends on how often a task happens", () => {
    // The whole of ADR-0029's break with ADR-0027: cadence decides how
    // often something is *due*, not what it is worth when it is. There
    // is no frequency field on the input any more, so this is enforced
    // by the type — the test records the intent.
    const weights = taskWeights(
      [unit("u", 20)],
      [task("daily", "u", 1), task("weekly", "u", 2)],
    );
    expect(sum(weights)).toBe(20);
  });

  it("keeps the portfolio's weights summing to 100", () => {
    const units = [unit("a", 50), unit("b", 30), unit("c", 20)];
    const tasks = [
      task("1", "a", 1),
      task("2", "a", 2),
      task("3", "b", 1),
      task("4", "c", 1),
      task("5", "c", 2),
      task("6", "c", 3),
    ];
    expect(sum(taskWeights(units, tasks))).toBe(DAILY_BUDGET);
  });

  it("does not change one unit's weights when another gains tasks", () => {
    const units = [unit("a", 60), unit("b", 40)];
    const alone = taskWeights(units, [task("a1", "a"), task("b1", "b")]);
    const crowded = taskWeights(units, [
      task("a1", "a"),
      ...Array.from({ length: 12 }, (_, i) => task(`b${i}`, "b", i + 1)),
    ]);
    expect(crowded.get("a1")).toBe(alone.get("a1"));
  });

  it("gives an excluded unit nothing to divide", () => {
    expect(taskWeights([unit("u", 0)], [task("t", "u")]).get("t")).toBe(0);
  });

  it("never leaves a task at zero while its unit can afford a point", () => {
    // ADR-0003 §5's floor: a zero-weight row cannot move the number, so
    // it is not a task.
    const weights = taskWeights(
      [unit("u", 5)],
      Array.from({ length: 5 }, (_, i) => task(`t${i}`, "u", i + 1)),
    );
    for (let i = 0; i < 5; i++) expect(weights.get(`t${i}`)).toBeGreaterThan(0);
  });

  it("returns a weight for every task, including unpriceable ones", () => {
    // A consumer reading `undefined` would find it at the point it
    // tried to add a number to a grade.
    const weights = taskWeights([], [task("orphan", "gone")]);
    expect(weights.get("orphan")).toBe(0);
  });
});

describe("unitCoverage", () => {
  it("counts a unit as covered when it holds any task at all", () => {
    // Not just a daily one. Cadence stopped deciding what a band pays.
    const units = [unit("a", 55), unit("b", 45)];
    expect(unitCoverage(units, [{ unitId: "a" }])).toEqual({
      covered: 55,
      total: 100,
    });
    expect(
      unitCoverage(units, [{ unitId: "a" }, { unitId: "b" }]),
    ).toEqual({ covered: 100, total: 100 });
  });

  it("reports nothing covered for an empty plan", () => {
    expect(unitCoverage([unit("a", 100)], [])).toEqual({
      covered: 0,
      total: 100,
    });
  });
});
