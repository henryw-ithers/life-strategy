/**
 * Communal units earn by being tagged (ADR-0025 §3, formula v6).
 *
 * Kept separate from `grade.test.ts` because these assertions are about
 * one decision with an unusual shape — full weight, low bar — and the
 * reasoning for that shape is what the tests are really guarding.
 */
import { describe, expect, it } from "vitest";

import { computeDayScore } from "../grade";

const dailyTask = (unitId: string, pointValue: number) => ({
  unitId,
  pointValue,
  timesPerWeek: 7,
  completedToday: false,
});

describe("communal units in the day's number", () => {
  it("join the denominator even though they hold no tasks", () => {
    // Being task-less does not make them uncovered: tagging is always
    // available, so the weight the diagnostic gave them is genuinely
    // earnable and belongs in `possible`.
    const s = computeDayScore({
      kind: "normal",
      tasks: [dailyTask("exercise", 30)],
      communalUnits: [{ unitId: "friendship", share: 10, tagged: false }],
    });
    expect(s.possible).toBe(40);
    expect(s.earned).toBe(0);
  });

  it("earn their whole share from a single tag", () => {
    // Not proportional, deliberately. One real contact is
    // qualitatively different from none; the tenth is not much
    // different from the second.
    const s = computeDayScore({
      kind: "normal",
      tasks: [dailyTask("exercise", 30)],
      communalUnits: [{ unitId: "friendship", share: 10, tagged: true }],
    });
    expect(s.earned).toBe(10);
  });

  it("does not let a solo day be structurally capped below the top", () => {
    // The rule this guards against: weight that can only be earned by
    // being with people would cap every unsocial day, permanently, for
    // someone living alone — the shame surface AGENTS.md forbids,
    // arriving through arithmetic. Full weight plus a low bar is what
    // keeps the number honest without making solitude cost anything
    // it can avoid.
    const tasksDone = [
      { unitId: "exercise", pointValue: 30, timesPerWeek: 7, completedToday: true },
    ];
    const alone = computeDayScore({
      kind: "normal",
      tasks: tasksDone,
      communalUnits: [
        { unitId: "friendship", share: 10, tagged: false },
        { unitId: "family", share: 10, tagged: false },
      ],
    });
    const together = computeDayScore({
      kind: "normal",
      tasks: tasksDone,
      communalUnits: [
        { unitId: "friendship", share: 10, tagged: true },
        { unitId: "family", share: 10, tagged: true },
      ],
    });
    // A solo day still loses those points — that is the cost Henry
    // accepted knowingly (ADR-0025 §3) — but one tag apiece closes it.
    expect(alone.base).toBe(60);
    expect(together.base).toBe(100);
  });

  it("is unaffected by how many times a unit was tagged", () => {
    // The caller collapses tags to a boolean, so this is really a
    // guarantee about the interface: there is no count to inflate.
    const once = computeDayScore({
      kind: "normal",
      tasks: [dailyTask("exercise", 30)],
      communalUnits: [{ unitId: "family", share: 10, tagged: true }],
    });
    expect(once.earned).toBe(10);
  });

  it("earns nothing on a day off", () => {
    // A day off leaves the aggregate entirely (ADR-0023 §4), so
    // nothing about it is scored — tags included.
    const s = computeDayScore({
      kind: "rest",
      tasks: [dailyTask("exercise", 30)],
      communalUnits: [{ unitId: "friendship", share: 10, tagged: true }],
    });
    expect(s.possible).toBe(0);
    expect(s.earned).toBe(0);
    expect(s.base).toBeNull();
  });

  it("does not draw on the unplanned pool", () => {
    // Communal weight is planned work — the diagnostic assigned it —
    // so it must not compete with activities for the capped 25.
    const s = computeDayScore({
      kind: "normal",
      tasks: [dailyTask("exercise", 30)],
      communalUnits: [{ unitId: "friendship", share: 10, tagged: true }],
      activities: [[{ unitId: "exercise", pointsCredited: 25 }]],
    });
    expect(s.unplanned).toBe(25);
    expect(s.earned).toBe(35);
  });

  it("changes nothing when there are no communal units", () => {
    // Every pre-v6 caller omits the field; it must behave exactly as
    // it did, or history would restate.
    const withField = computeDayScore({
      kind: "normal",
      tasks: [dailyTask("exercise", 30)],
      communalUnits: [],
    });
    const without = computeDayScore({
      kind: "normal",
      tasks: [dailyTask("exercise", 30)],
    });
    expect(withField).toEqual(without);
    expect(without.possible).toBe(30);
  });
});
