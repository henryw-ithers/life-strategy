/**
 * Rest days (ADR-0037).
 *
 * Henry, 2026-10-01: *"on a day where you have nothing scheduled …
 * a rest day which gives an automatic 70% and then gives points for any
 * one-time activities or early task completions you do that day"* —
 * and *"rest day should trigger automatically in the scenario we
 * described and should not appear otherwise."*
 */
import { describe, expect, it } from "vitest";

import { REST_DAY_BASE, REST_DAY_UNPLANNED } from "../constants";
import { averageDayExpected, computeDayLoad, type LoadTask } from "../dayLoad";
import {
  computeDayScore,
  isRestDay,
  restDayRunPoints,
  type DayScoreInput,
} from "../grade";

const date = "2026-07-17"; // Friday; the week opens Sunday 07-12

const weekly = (taskId: string, weight = 10, pinnedWeekdays: number[] = []): LoadTask => ({
  taskId,
  weight,
  timesPerWeek: 1,
  pinnedWeekdays,
});

/** A plan whose week is already done by Friday: one run each, Monday. */
const PLAN = [weekly("a"), weekly("b")];
const DONE_MONDAY = PLAN.map((t) => ({ taskId: t.taskId, localDate: "2026-07-13" }));
const AVERAGE = averageDayExpected(PLAN); // 20 / 7

const rest = (over: Partial<DayScoreInput> = {}, today: { taskId: string; localDate: string }[] = []) =>
  computeDayScore({
    kind: "normal",
    load: computeDayLoad(PLAN, [...DONE_MONDAY, ...today], date),
    restDay: { averageExpected: AVERAGE },
    ...over,
  });

describe("when a day is a rest day — §1", () => {
  const isRest = (tasks: LoadTask[], rows = DONE_MONDAY, band = 0) =>
    isRestDay(computeDayLoad(tasks, rows, date), band, averageDayExpected(tasks));

  it("on a day that asks nothing", () => {
    expect(isRest(PLAN)).toBe(true);
  });

  it("not while flexible work is still owed this week", () => {
    expect(isRest(PLAN, [])).toBe(false);
  });

  it("not on a day with an every-day task", () => {
    const daily: LoadTask = { taskId: "d", weight: 5, timesPerWeek: 7, pinnedWeekdays: [] };
    expect(isRest([...PLAN, daily])).toBe(false);
  });

  it("not on a day with commitment work scheduled", () => {
    expect(isRest(PLAN, DONE_MONDAY, 40)).toBe(false);
  });

  it("not without a plan — nothing to do is not the same as nothing due", () => {
    expect(isRest([], [])).toBe(false);
  });

  it("still, with a run pinned to another day — that run is early work here", () => {
    expect(isRest([...PLAN, weekly("sat", 10, [6])])).toBe(true);
  });
});

describe("it happens on its own", () => {
  it("scores a normal day with nothing due as a rest day", () => {
    expect(rest().base).toBe(REST_DAY_BASE);
  });

  it("leaves a day with nothing due ungraded when no plan is given", () => {
    // ADR-0029's rule, which a caller without a plan still gets.
    const s = computeDayScore({ kind: "normal", load: computeDayLoad(PLAN, DONE_MONDAY, date) });
    expect(s.base).toBeNull();
  });

  it("leaves a day off a day off", () => {
    const s = computeDayScore({
      kind: "rest",
      load: computeDayLoad(PLAN, DONE_MONDAY, date),
      restDay: { averageExpected: AVERAGE },
    });
    expect(s.base).toBeNull();
  });

  it("adds a special day's rating into the last 30", () => {
    const s = rest({ kind: "special", satisfactionRating: 8 });
    expect(s.earned).toBe(78);
  });
});

describe("what it scores — §2", () => {
  it("is 70 with nothing done", () => {
    expect(rest().earned).toBe(REST_DAY_BASE);
    expect(rest().base).toBe(70);
  });

  it("is graded out of 100", () => {
    expect(rest().possible).toBe(100);
  });

  it("lets activities fill the last 30, and no more", () => {
    const some = rest({ activities: [[{ unitId: "f", pointsCredited: 12 }]] });
    expect(some.earned).toBe(82);
    const lots = rest({ activities: [[{ unitId: "f", pointsCredited: 50 }]] });
    expect(lots.earned).toBe(REST_DAY_BASE + REST_DAY_UNPLANNED);
    expect(lots.unplannedForgone).toBe(20);
  });

  it("pays commitment work done ahead on top, uncapped", () => {
    const s = rest({
      offScheduleCredit: 15,
      activities: [[{ unitId: "f", pointsCredited: 30 }]],
    });
    expect(s.earned).toBe(115);
  });

  it("is an ordinary day once the day asks something", () => {
    // Flexible work still owed: graded on the fraction done, from 0.
    const s = computeDayScore({
      kind: "normal",
      load: computeDayLoad(PLAN, [], date),
      restDay: { averageExpected: AVERAGE },
    });
    expect(s.earned).toBe(0);
    expect(s.base).toBe(0);
  });
});

describe("early work is priced against an average day — §3", () => {
  it("averages the plan's weekly demand over seven", () => {
    const daily: LoadTask = { taskId: "d", weight: 7, timesPerWeek: 7, pinnedWeekdays: [] };
    const fortnightly: LoadTask = { taskId: "f", weight: 14, timesPerWeek: 0, pinnedWeekdays: [] };
    const errand: LoadTask = { ...weekly("e", 100), oneOff: true };
    expect(averageDayExpected([daily, fortnightly, errand])).toBe(8);
  });

  it("pays a run pinned to a later day, done early, a full run", () => {
    const sat = weekly("sat", 10, [6]);
    const plan = [...PLAN, sat];
    const average = averageDayExpected(plan);
    const s = computeDayScore({
      kind: "normal",
      load: computeDayLoad(plan, [...DONE_MONDAY, { taskId: "sat", localDate: date }], date),
      restDay: { averageExpected: average },
    });
    expect(s.earned).toBe(Math.round(70 + restDayRunPoints(10, average)));
  });

  it("pays a life one-off done ahead a full run", () => {
    const s = rest({ restDay: { averageExpected: AVERAGE, aheadWeight: 5 } });
    expect(s.earned).toBe(Math.round(70 + restDayRunPoints(5, AVERAGE)));
  });

  it("pays an extra run of a weekly task at the extra-run rate", () => {
    const s = rest({}, [{ taskId: "a", localDate: date }]);
    expect(s.earned).toBe(Math.round(70 + 0.5 * restDayRunPoints(10, AVERAGE)));
  });

  it("prices nothing when the plan holds nothing recurring", () => {
    expect(restDayRunPoints(10, 0)).toBe(0);
  });
});
