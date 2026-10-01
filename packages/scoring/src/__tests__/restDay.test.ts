/**
 * Rest days (ADR-0037).
 *
 * Henry, 2026-10-01: *"on a day where you have nothing scheduled …
 * a rest day which gives an automatic 70% and then gives points for any
 * one-time activities or early task completions you do that day"*;
 * *"rest day should trigger automatically … and should not appear
 * otherwise"*; *"having any open tasks should prevent rest day from
 * occurring"*; and doing Friday's task on an empty Tuesday makes Tuesday
 * *"70 + the task"*, the task worth *"as much as [it] would if [it was]
 * done on the day [it was] planned."*
 */
import { describe, expect, it } from "vitest";

import { REST_DAY_BASE, REST_DAY_UNPLANNED } from "../constants";
import { averageDayExpected, computeDayLoad, type LoadTask } from "../dayLoad";
import {
  computeDayScore,
  isRestDay,
  plannedDayRunPoints,
  restDayRunPoints,
  type DayScoreInput,
  type RestDayInput,
} from "../grade";

const date = "2026-07-15"; // Wednesday; the week opens Sunday 07-12

const weekly = (taskId: string, weight = 10, pinnedWeekdays: number[] = []): LoadTask => ({
  taskId,
  weight,
  timesPerWeek: 1,
  pinnedWeekdays,
});

/** A plan whose week is already done by Wednesday: one run each, Monday. */
const PLAN = [weekly("a"), weekly("b")];
const DONE_MONDAY = PLAN.map((t) => ({ taskId: t.taskId, localDate: "2026-07-13" }));
const AVERAGE = averageDayExpected(PLAN);
const EMPTY = computeDayLoad(PLAN, DONE_MONDAY, date);

const REST: RestDayInput = {
  averageExpected: AVERAGE,
  hasPlan: true,
  openThisWeek: false,
  earlyToday: false,
};

const score = (over: Partial<DayScoreInput> = {}, rest: Partial<RestDayInput> = {}) =>
  computeDayScore({ kind: "normal", load: EMPTY, restDay: { ...REST, ...rest }, ...over });

describe("when a day is a rest day — §1", () => {
  it("on a day that asks nothing, with nothing open this week", () => {
    expect(isRestDay(EMPTY, 0, REST)).toBe(true);
  });

  it("not while anything is due today", () => {
    expect(isRestDay(computeDayLoad(PLAN, [], date), 0, REST)).toBe(false);
  });

  it("not on a day with commitment work scheduled", () => {
    expect(isRestDay(EMPTY, 40, REST)).toBe(false);
  });

  it("not without a plan — nothing to do is not the same as nothing due", () => {
    expect(isRestDay(EMPTY, 0, { ...REST, hasPlan: false })).toBe(false);
  });

  it("not while something is still open later this week", () => {
    expect(isRestDay(EMPTY, 0, { ...REST, openThisWeek: true })).toBe(false);
  });

  it("but yes once something open is done early today", () => {
    expect(isRestDay(EMPTY, 0, { ...REST, openThisWeek: true, earlyToday: true })).toBe(true);
  });

  it("never without the inputs to decide it", () => {
    expect(isRestDay(EMPTY, 0, undefined)).toBe(false);
  });
});

describe("it happens on its own", () => {
  it("scores a normal day with nothing due and nothing open as 70", () => {
    expect(score().base).toBe(REST_DAY_BASE);
  });

  it("leaves an empty day with work still open, and none done, ungraded", () => {
    expect(score({}, { openThisWeek: true }).base).toBeNull();
  });

  it("leaves a day off a day off", () => {
    expect(score({ kind: "rest" }).base).toBeNull();
  });

  it("adds a special day's rating into the last 30", () => {
    expect(score({ kind: "special", satisfactionRating: 8 }).earned).toBe(78);
  });
});

describe("what it scores — §2", () => {
  it("is 70 with nothing done, out of 100", () => {
    expect(score().earned).toBe(70);
    expect(score().possible).toBe(100);
  });

  it("lets activities fill the last 30, and no more", () => {
    expect(score({ activities: [[{ unitId: "f", pointsCredited: 12 }]] }).earned).toBe(82);
    const lots = score({ activities: [[{ unitId: "f", pointsCredited: 50 }]] });
    expect(lots.earned).toBe(REST_DAY_BASE + REST_DAY_UNPLANNED);
    expect(lots.unplannedForgone).toBe(20);
  });

  it("is 70 + the task when the task done early is what made it one", () => {
    // Henry's Tuesday: work open, Friday's task done today.
    const s = score({}, { openThisWeek: true, earlyToday: true, earlyCredit: 20 });
    expect(s.earned).toBe(90);
  });

  it("pays commitment work done ahead on top, uncapped", () => {
    const s = score({
      offScheduleCredit: 15,
      activities: [[{ unitId: "f", pointsCredited: 30 }]],
    });
    expect(s.earned).toBe(115);
  });
});

describe("early work pays its planned day's worth — §3", () => {
  it("prices a run against the day it was pinned to, as that day stood", () => {
    // Pinned to Friday; Friday would have asked for it alone → 90.
    const fri = weekly("fri", 10, [5]);
    const plan = [...PLAN, fri];
    expect(plannedDayRunPoints(plan, DONE_MONDAY, fri, "2026-07-17")).toBe(90);
  });

  it("shares that day with what else it asks for", () => {
    const fri = weekly("fri", 10, [5]);
    const alsoFri = weekly("alsoFri", 30, [5]);
    const plan = [...PLAN, fri, alsoFri];
    expect(plannedDayRunPoints(plan, DONE_MONDAY, fri, "2026-07-17")).toBeCloseTo(22.5);
  });

  it("prices a one-off planned for later against its own day", () => {
    const errand: LoadTask = { ...weekly("errand", 6), oneOff: true };
    // Saturday, the last day of the week: the errand is the whole pool.
    expect(plannedDayRunPoints(PLAN, DONE_MONDAY, errand, "2026-07-18")).toBe(90);
  });

  it("scales by that day's life share when it carries a band", () => {
    const fri = weekly("fri", 10, [5]);
    expect(plannedDayRunPoints([...PLAN, fri], DONE_MONDAY, fri, "2026-07-17", 0.6)).toBe(54);
  });

  it("pays a run beyond the week's count the extra-run rate, on an average day", () => {
    const load = computeDayLoad(PLAN, [...DONE_MONDAY, { taskId: "a", localDate: date }], date);
    const s = computeDayScore({ kind: "normal", load, restDay: REST });
    expect(s.earned).toBe(Math.round(70 + 0.5 * restDayRunPoints(10, AVERAGE)));
  });

  it("averages the plan's weekly demand over seven for that", () => {
    const daily: LoadTask = { taskId: "d", weight: 7, timesPerWeek: 7, pinnedWeekdays: [] };
    const fortnightly: LoadTask = { taskId: "f", weight: 14, timesPerWeek: 0, pinnedWeekdays: [] };
    const errand: LoadTask = { ...weekly("e", 100), oneOff: true };
    expect(averageDayExpected([daily, fortnightly, errand])).toBe(8);
  });

  it("prices nothing when there is nothing to price against", () => {
    expect(restDayRunPoints(10, 0)).toBe(0);
  });
});
