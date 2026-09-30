/**
 * A partial completion has to reach the grade (ADR-0014 §3).
 *
 * `partialPoints` works out what a fraction pays and `task_completion`
 * records it — but the day's number is built by `computeDayScore`,
 * which sums what completed tasks are *worth*. Without
 * `DayTaskInput.earnedToday` those two disagree: the row says the
 * quarter paid 1 and the grade credits 4.
 */
import { describe, expect, it } from "vitest";

import { ROUTINE_BAND, VARIABLE_BAND } from "../bands";
import { computeDayScore } from "../grade";
import { partialPoints } from "../partial";

const habit = (pointValue: number, earnedToday?: number) => ({
  unitId: "hygiene",
  pointValue,
  timesPerWeek: 7,
  completedToday: true,
  extraToday: false,
  ...(earnedToday === undefined ? {} : { earnedToday }),
});

const weekly = (pointValue: number, earnedToday?: number) => ({
  unitId: "exercise-fitness",
  pointValue,
  timesPerWeek: 3,
  completedToday: true,
  extraToday: false,
  ...(earnedToday === undefined ? {} : { earnedToday }),
});

const day = (tasks: ReturnType<typeof habit>[]) =>
  computeDayScore({ kind: "normal", satisfactionRating: null, tasks });

describe("the regression this was written for", () => {
  it("credits what a quarter paid, not what the task is worth", () => {
    const value = 40;
    const quarter = partialPoints(value, [], 0.25);

    expect(day([habit(value)]).earned).toBe(value);
    expect(day([habit(value, quarter)]).earned).toBe(quarter);
  });
});

describe("omitting it changes nothing", () => {
  it("scores a routine day exactly as it did before the column", () => {
    // Every completion written before `fraction` existed was a whole
    // one, and this is the guarantee that those days do not move.
    const tasks = [habit(30), habit(30), weekly(10)];
    expect(day(tasks).earned).toBe(70);
    expect(day(tasks.map((t) => ({ ...t, earnedToday: t.pointValue }))).earned).toBe(
      70,
    );
  });

  it("is not confused with zero", () => {
    // `earnedToday: 0` is a real value — a middle quarter can pay
    // nothing (ADR-0014 §3's 1, 1, 0, 1). It must not fall back.
    expect(day([habit(30, 0)]).earned).toBe(0);
    expect(day([habit(30)]).earned).toBe(30);
  });
});

describe("the bands still cap", () => {
  it("adds partial routine pay, since the routine band is not capped here", () => {
    // `bandPointValues` already divides exactly ROUTINE_BAND across the
    // day's daily tasks, so the sum cannot overrun in practice and
    // `computeDayScore` deliberately does not cap it a second time.
    // This pins that: the routine branch adds what was paid, nothing more.
    const half = ROUTINE_BAND / 2;
    expect(day([habit(half, 10), habit(half, 5)]).earned).toBe(15);
  });

  it("keeps partial non-daily work inside the variable band", () => {
    const tasks = [weekly(40, 40), weekly(40, 40)];
    expect(day(tasks).earned).toBe(VARIABLE_BAND);
  });
});

describe("the commitment band", () => {
  const commitment = (pointValue: number, earnedToday?: number) => ({
    unitId: "school",
    pointValue,
    timesPerWeek: 3,
    completedToday: true,
    extraToday: false,
    isCommitment: true,
    ...(earnedToday === undefined ? {} : { earnedToday }),
  });

  it("spends a partial commitment task at what it paid", () => {
    const full = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      commitmentBand: 40,
      tasks: [commitment(40)],
    });
    const half = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      commitmentBand: 40,
      tasks: [commitment(40, 20)],
    });
    expect(full.earned - half.earned).toBe(20);
  });
});

describe("a whole task's four quarters", () => {
  it("pay exactly what the task is worth, no matter the order", () => {
    // The day-by-day arithmetic a one-off actually goes through: each
    // step is the rounded running total minus what is already paid.
    const value = 3;
    const steps: number[] = [];
    const prior: number[] = [];
    for (const _ of [0, 1, 2, 3]) {
      steps.push(partialPoints(value, prior, 0.25));
      prior.push(0.25);
    }
    expect(steps).toEqual([1, 1, 0, 1]);
    expect(steps.reduce((a, b) => a + b, 0)).toBe(value);

    // And each of those days credits exactly its own step.
    for (const step of steps) {
      expect(day([weekly(value, step)]).earned).toBe(step);
    }
  });
});

describe("commitment work done off its schedule (ADR-0032 §4)", () => {
  const offSchedule = (pointValue: number, over: Record<string, unknown> = {}) => ({
    unitId: "school",
    pointValue,
    timesPerWeek: 1,
    completedToday: true,
    extraToday: false,
    isCommitment: false,
    offSchedule: true,
    ...over,
  });
  const weekly = (pointValue: number) => ({
    unitId: "exercise-fitness",
    pointValue,
    timesPerWeek: 3,
    completedToday: true,
    extraToday: false,
  });

  it("pays its scheduled-day worth in full", () => {
    const score = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks: [offSchedule(12)],
    });
    expect(score.earned).toBe(12);
  });

  it("is not unplanned credit — it never touches the pool", () => {
    // Henry, 2026-09-30: "remove the cap." Beside 15 points of
    // activities it no longer competes for the same 20.
    const score = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks: [offSchedule(12)],
      activities: [[{ unitId: "friendship", pointsCredited: 15 }]],
    });
    expect(score.unplanned).toBe(15);
    expect(score.unplannedForgone).toBe(0);
    expect(score.earned).toBe(27);
  });

  it("is not clipped by a variable band that is already full", () => {
    // Under v9 this paid nothing: the pool's headroom is what the
    // variable band has left, and weekly work had used all 20.
    const score = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks: [weekly(20), offSchedule(12)],
    });
    expect(score.earned).toBe(32);
  });

  it("can take a day past 100, as extra runs can", () => {
    const daily = { unitId: "hygiene", pointValue: 80, timesPerWeek: 7, completedToday: true, extraToday: false };
    const score = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks: [daily, weekly(20), offSchedule(12)],
    });
    expect(score.earned).toBe(112);
  });

  it("never enters a planned band, so it cannot be counted twice", () => {
    // Flagged as routine cadence and as commitment work, it is still
    // paid once, through its own route.
    const score = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      commitmentBand: 40,
      tasks: [offSchedule(10, { timesPerWeek: 7, isCommitment: true })],
    });
    expect(score.earned).toBe(10);
  });

  it("stays out of the routine band on an ordinary day", () => {
    // A daily-cadence commitment task with no band in play: only the
    // off-schedule route pays it. (The case above is also excluded by
    // the commitment band, so it cannot tell whether this guard holds.)
    const score = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks: [offSchedule(10, { timesPerWeek: 7 })],
    });
    expect(score.earned).toBe(10);
  });

  it("pays a part-done off-schedule task what the fraction paid", () => {
    const score = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks: [offSchedule(12, { earnedToday: 6 })],
    });
    expect(score.earned).toBe(6);
  });

  it("pays nothing until it is done", () => {
    const score = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks: [offSchedule(12, { completedToday: false })],
    });
    expect(score.earned).toBe(0);
  });
});
