/**
 * ADR-0029 §1: what a day asks of you.
 *
 * Two rules, applying to different tasks. Anchored work — every-day
 * tasks and anything pinned to today — is expected **in full** on its
 * day and not at all on any other. Flexible work is pooled and divided
 * evenly across the days the week has left.
 */
import { describe, expect, it } from "vitest";

import {
  computeDayLoad,
  daysLeftInWeek,
  isAnchoredOn,
  isoWeekday,
  isPinnedElsewhere,
  type LoadTask,
} from "../dayLoad";

// The week opens Sunday 2026-07-12 and closes Saturday 2026-07-18.
const SUNDAY = "2026-07-12";
const MONDAY = "2026-07-13";
const WEDNESDAY = "2026-07-15";
const FRIDAY = "2026-07-17";
const SATURDAY = "2026-07-18";

const t = (
  taskId: string,
  timesPerWeek: number,
  weight = 10,
  pinnedWeekdays: number[] = [],
): LoadTask => ({ taskId, weight, timesPerWeek, pinnedWeekdays });

const done = (taskId: string, localDate: string) => ({ taskId, localDate });

describe("isoWeekday", () => {
  it("runs Monday 1 to Sunday 7", () => {
    expect(isoWeekday(SUNDAY)).toBe(7);
    expect(isoWeekday(MONDAY)).toBe(1);
    expect(isoWeekday(FRIDAY)).toBe(5);
  });
});

describe("daysLeftInWeek", () => {
  it("counts the day itself, from 7 on Sunday down to 1 on Saturday", () => {
    expect(daysLeftInWeek(SUNDAY)).toBe(7);
    expect(daysLeftInWeek(MONDAY)).toBe(6);
    expect(daysLeftInWeek(SATURDAY)).toBe(1);
  });
});

describe("anchoring", () => {
  it("anchors an every-day task to every day", () => {
    expect(isAnchoredOn(t("a", 7), MONDAY)).toBe(true);
    expect(isAnchoredOn(t("a", 7), SATURDAY)).toBe(true);
  });

  it("anchors a pinned task to its own weekdays and no others", () => {
    const gym = t("gym", 3, 10, [1, 3, 5]);
    expect(isAnchoredOn(gym, MONDAY)).toBe(true);
    expect(isAnchoredOn(gym, WEDNESDAY)).toBe(true);
    expect(isAnchoredOn(gym, SUNDAY)).toBe(false);
    expect(isPinnedElsewhere(gym, SUNDAY)).toBe(true);
  });

  it("never anchors flexible work — it is due some day, not this one", () => {
    const flexible = t("flex", 3);
    expect(isAnchoredOn(flexible, MONDAY)).toBe(false);
    expect(isPinnedElsewhere(flexible, MONDAY)).toBe(false);
  });

  it("anchors a fortnightly task only in its own half of the fortnight", () => {
    const a = { ...t("a", 0, 10, [1]), fortnightOffset: 0 };
    const b = { ...t("b", 0, 10, [1]), fortnightOffset: 1 };
    expect(isAnchoredOn(a, MONDAY)).not.toBe(isAnchoredOn(b, MONDAY));
  });
});

describe("what the day expects", () => {
  it("expects a pinned task in full on its day, and not at all off it", () => {
    // The correction that produced this model. Henry, 2026-08-26, on an
    // earlier draft that gave a 3x/week task 3/7 of itself every day:
    // "makes no sense and is not at all what I said."
    const gym = t("gym", 3, 10, [1, 3, 5]);
    expect(computeDayLoad([gym], [], MONDAY).expected).toBe(10);
    expect(computeDayLoad([gym], [], SUNDAY).expected).toBe(0);
  });

  it("spreads flexible work evenly: seven weekly tasks means one a day", () => {
    // Henry's own worked example.
    const tasks = Array.from({ length: 7 }, (_, i) => t(`t${i}`, 1, 10));
    expect(computeDayLoad(tasks, [], SUNDAY).expected).toBe(10);
    expect(computeDayLoad(tasks, [], SUNDAY).flexible).toBe(10);
  });

  it("re-spreads the flexible pool as the week is worked through", () => {
    const tasks = Array.from({ length: 7 }, (_, i) => t(`t${i}`, 1, 10));
    // One done on Sunday: six left over the six days remaining.
    const monday = computeDayLoad(tasks, [done("t0", SUNDAY)], MONDAY);
    expect(monday.expected).toBe(10);
  });

  it("expects nothing once the week's flexible work is finished", () => {
    const tasks = Array.from({ length: 2 }, (_, i) => t(`t${i}`, 1, 10));
    const completions = [done("t0", SUNDAY), done("t1", SUNDAY)];
    expect(computeDayLoad(tasks, completions, MONDAY).expected).toBe(0);
  });

  it("adds anchored and flexible work together", () => {
    const tasks = [t("daily", 7, 20), ...Array.from({ length: 7 }, (_, i) => t(`f${i}`, 1, 7))];
    // 20 anchored, plus 49 of flexible demand over seven days.
    expect(computeDayLoad(tasks, [], SUNDAY).expected).toBe(27);
  });

  it("never lets today's own completions move today's expectation", () => {
    const tasks = [t("a", 7, 10), t("b", 7, 10)];
    const before = computeDayLoad(tasks, [], FRIDAY).expected;
    const after = computeDayLoad(tasks, [done("a", FRIDAY)], FRIDAY).expected;
    expect(after).toBe(before);
  });
});

describe("obligations are weekly, so a wrong day costs nothing", () => {
  /**
   * ADR-0029 §3, and the reason this can read weekday pins without
   * becoming the schedule-violation scoring ADR-0024 §2 forbade.
   * Nothing anywhere compares a completion's date to the day it was
   * pinned to.
   */
  it("counts a Friday-pinned run done on Monday, and Friday stops expecting it", () => {
    const chore = t("chore", 1, 10, [5]);
    const early = [done("chore", MONDAY)];

    // Monday counted it, even though Monday never expected it.
    expect(computeDayLoad([chore], early, MONDAY).earned).toBe(10);
    // Friday now owes nothing, so it asks for nothing.
    expect(computeDayLoad([chore], early, FRIDAY).expected).toBe(0);
  });

  it("still expects a pinned run on its day when it has not been done", () => {
    const chore = t("chore", 1, 10, [5]);
    expect(computeDayLoad([chore], [], FRIDAY).expected).toBe(10);
  });

  it("lets a pinned day pass silently once it is gone", () => {
    // ADR-0024 §2: "an unfulfilled placement lapses silently." A missed
    // Monday does not reappear as a debt on Wednesday.
    const chore = t("chore", 1, 10, [1]);
    expect(computeDayLoad([chore], [], WEDNESDAY).expected).toBe(0);
  });
});

describe("earned and extra", () => {
  it("counts a completion within the weekly goal as earned", () => {
    const load = computeDayLoad([t("a", 3, 12)], [done("a", FRIDAY)], FRIDAY);
    expect(load.earned).toBe(12);
    expect(load.extra).toBe(0);
  });

  it("counts a completion past the weekly goal as extra, not earned", () => {
    const load = computeDayLoad(
      [t("a", 2, 12)],
      [done("a", SUNDAY), done("a", MONDAY), done("a", FRIDAY)],
      FRIDAY,
    );
    expect(load.earned).toBe(0);
    expect(load.extra).toBe(12);
  });

  it("measures a fortnightly task over the fortnight, not the week", () => {
    const fortnightly = t("f", 0, 10, [1]);
    const load = computeDayLoad([fortnightly], [], MONDAY);
    // Anchored or not depends on which half of the fortnight this is;
    // either way it owes exactly one run, never two.
    expect(load.expected).toBeLessThanOrEqual(10);
  });
});

describe("one-offs", () => {
  it("treats a one-off as flexible work owing a single run", () => {
    const errand: LoadTask = {
      taskId: "errand",
      weight: 14,
      timesPerWeek: 1,
      pinnedWeekdays: [],
      oneOff: true,
    };
    expect(isAnchoredOn(errand, MONDAY)).toBe(false);
    // 14 of demand spread over the six days Monday leaves.
    expect(computeDayLoad([errand], [], MONDAY).expected).toBeCloseTo(14 / 6, 10);
  });

  it("stops expecting a one-off once it is done", () => {
    const errand: LoadTask = {
      taskId: "errand",
      weight: 14,
      timesPerWeek: 1,
      pinnedWeekdays: [],
      oneOff: true,
    };
    expect(
      computeDayLoad([errand], [done("errand", SUNDAY)], MONDAY).expected,
    ).toBe(0);
  });
});
