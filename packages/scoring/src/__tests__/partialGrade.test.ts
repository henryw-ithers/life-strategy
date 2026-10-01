/**
 * A partial completion has to reach the grade (ADR-0014 §3).
 *
 * `partialPoints` works out what a fraction pays and `task_completion`
 * records it — and since formula v10 the day's number is built from the
 * day's load, so the fraction has to reach `computeDayLoad` too. Without
 * it the row says a quarter and the grade credits the whole run.
 */
import { describe, expect, it } from "vitest";

import { PLANNED_BAND } from "../bands";
import { computeDayLoad, runsBefore, type LoadTask } from "../dayLoad";
import { computeDayScore } from "../grade";
import { partialPoints } from "../partial";

const date = "2026-07-17"; // Friday; the week opens Sunday 07-12

const habit: LoadTask = { taskId: "h", weight: 10, timesPerWeek: 7, pinnedWeekdays: [] };
const oneOff: LoadTask = { taskId: "o", weight: 10, timesPerWeek: 1, pinnedWeekdays: [], oneOff: true };

const row = (taskId: string, localDate: string, fraction?: number) => ({
  taskId,
  localDate,
  ...(fraction === undefined ? {} : { fraction }),
});

const earnedOf = (tasks: LoadTask[], rows: ReturnType<typeof row>[]) =>
  computeDayScore({ kind: "normal", load: computeDayLoad(tasks, rows, date) }).earned;

describe("the regression this was written for", () => {
  it("credits what a quarter is, not the whole run", () => {
    expect(earnedOf([habit], [row("h", date)])).toBe(PLANNED_BAND);
    expect(earnedOf([habit], [row("h", date, 0.25)])).toBe(Math.round(PLANNED_BAND / 4));
  });
});

describe("omitting it changes nothing", () => {
  it("scores a day exactly as it did before the column", () => {
    // Every completion written before `fraction` existed was a whole
    // one, and this is the guarantee that those days do not move.
    expect(earnedOf([habit], [row("h", date)])).toBe(earnedOf([habit], [row("h", date, 1)]));
  });
});

describe("a recurring task resets each day", () => {
  it("counts a part-done day as a run toward the week", () => {
    // Henry, 2026-09-30: "some days showing up is what counts."
    const weekly: LoadTask = { taskId: "w", weight: 10, timesPerWeek: 2, pinnedWeekdays: [] };
    expect(runsBefore(weekly, [row("w", "2026-07-13", 0.25)])).toBe(1);
  });

  it("pays today's fraction, whatever yesterday's was", () => {
    expect(
      earnedOf([habit], [row("h", "2026-07-16", 0.25), row("h", date, 0.5)]),
    ).toBe(PLANNED_BAND / 2);
  });
});

describe("an extra run", () => {
  it("counts its fraction too, so a part-done extra run is part of one", () => {
    const weekly: LoadTask = { taskId: "w", weight: 10, timesPerWeek: 1, pinnedWeekdays: [] };
    const load = computeDayLoad(
      [weekly],
      [row("w", "2026-07-13"), row("w", date, 0.5)],
      date,
    );
    expect(load.extra).toBe(5);
  });
});

describe("a one-off accumulates across days", () => {
  it("leaves what is still owed after a part-done day", () => {
    expect(runsBefore(oneOff, [row("o", "2026-07-13", 0.25)])).toBe(0.25);
    expect(runsBefore(oneOff, [row("o", "2026-07-13", 0.75), row("o", "2026-07-14", 0.75)]))
      .toBe(1);
  });

  it("pays at most what was still owed", () => {
    // 0.75 done Monday; marking it whole today earns the last quarter,
    // not a whole run, and never an extra one.
    const load = computeDayLoad(
      [oneOff],
      [row("o", "2026-07-13", 0.75), row("o", date, 1)],
      date,
    );
    expect(load.earned).toBe(2.5);
    expect(load.extra).toBe(0);
  });
});

describe("a whole task's four quarters", () => {
  it("pay exactly what the task is worth, no matter the order", () => {
    // Each step is the rounded running total minus what is already paid.
    const value = 3;
    const steps: number[] = [];
    const prior: number[] = [];
    for (const _ of [0, 1, 2, 3]) {
      steps.push(partialPoints(value, prior, 0.25));
      prior.push(0.25);
    }
    expect(steps).toEqual([1, 1, 0, 1]);
    expect(steps.reduce((a, b) => a + b, 0)).toBe(value);
  });
});
