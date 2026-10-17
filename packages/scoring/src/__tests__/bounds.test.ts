/**
 * ADR-0040: repeats can end, weeks can be skipped, a day can be
 * cleared, and you can be away. Each changes what is due through
 * `inScheduleOn`, and nowhere else.
 */
import { describe, expect, it } from "vitest";

import { computeDayLoad, isAnchoredOn, plannedDateFor, weeklyGoalFor, type LoadTask } from "../dayLoad";
import { isLocalDate } from "../days";
import { computeDayScore, deriveChecklist, isRestDay } from "../grade";
import { boundsError, inScheduleOn, isDueOn, untilForWeeks } from "../schedule";

// The week opens Sunday 2026-07-12 and closes Saturday 2026-07-18.
const SUNDAY = "2026-07-12";
const MONDAY = "2026-07-13";
const TUESDAY = "2026-07-14";
const WEDNESDAY = "2026-07-15";
const THURSDAY = "2026-07-16";
const FRIDAY = "2026-07-17";
const SATURDAY = "2026-07-18";
const NEXT_SUNDAY = "2026-07-19";
const NEXT_MONDAY = "2026-07-20";

const t = (taskId: string, timesPerWeek: number, extra: Partial<LoadTask> = {}): LoadTask => ({
  taskId,
  weight: 10,
  timesPerWeek,
  pinnedWeekdays: [],
  ...extra,
});
const done = (taskId: string, localDate: string) => ({ taskId, localDate });

describe("untilForWeeks", () => {
  it("counts a mid-week start as week 1 and ends on the Saturday of week N (EC-21)", () => {
    expect(untilForWeeks(WEDNESDAY, 1)).toBe(SATURDAY);
    expect(untilForWeeks(WEDNESDAY, 12)).toBe("2026-10-03");
  });

  it("refuses a count that isn't a whole number from 1", () => {
    expect(() => untilForWeeks(MONDAY, 0)).toThrow();
    expect(() => untilForWeeks(MONDAY, 1.5)).toThrow();
  });
});

describe("inScheduleOn", () => {
  it("runs as it always did with no bounds", () => {
    expect(inScheduleOn({}, MONDAY)).toBe(true);
  });

  it("includes the first and last day, and nothing outside them", () => {
    const b = { repeatFrom: TUESDAY, repeatUntil: THURSDAY };
    expect(inScheduleOn(b, MONDAY)).toBe(false);
    expect(inScheduleOn(b, TUESDAY)).toBe(true);
    expect(inScheduleOn(b, THURSDAY)).toBe(true);
    expect(inScheduleOn(b, FRIDAY)).toBe(false);
  });

  it("leaves out skipped dates", () => {
    expect(inScheduleOn({ skippedDates: new Set([WEDNESDAY]) }, WEDNESDAY)).toBe(false);
    expect(inScheduleOn({ skippedDates: new Set([WEDNESDAY]) }, THURSDAY)).toBe(true);
  });
});

describe("isDueOn and isAnchoredOn with bounds", () => {
  const lecture = {
    plannedWeekdays: "1,3",
    timesPerWeek: 2,
    skippedDates: new Set([WEDNESDAY]),
  };

  it("isn't due on a skipped occurrence, and is on the others", () => {
    expect(isDueOn(lecture, MONDAY)).toBe(true);
    expect(isDueOn(lecture, WEDNESDAY)).toBe(false);
  });

  it("isn't due after the series ends (EC-26)", () => {
    expect(isDueOn({ ...lecture, repeatUntil: SATURDAY }, NEXT_MONDAY)).toBe(false);
  });

  it("isn't anchored on a skipped day, even for an every-day task", () => {
    const daily = t("d", 7, { skippedDates: new Set([TUESDAY]) });
    expect(isAnchoredOn(daily, MONDAY)).toBe(true);
    expect(isAnchoredOn(daily, TUESDAY)).toBe(false);
  });
});

describe("weeklyGoalFor", () => {
  it("is the frequency for a task with no bounds", () => {
    expect(weeklyGoalFor(t("a", 3), MONDAY)).toBe(3);
  });

  it("owes no more runs than the series has days in the week", () => {
    expect(weeklyGoalFor(t("a", 3, { repeatFrom: FRIDAY }), FRIDAY)).toBe(2);
  });

  it("owes nothing in a week skipped entirely", () => {
    const week = new Set([SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY]);
    expect(weeklyGoalFor(t("a", 3, { skippedDates: week }), MONDAY)).toBe(0);
  });

  it("doesn't owe a skipped session of a pinned task", () => {
    // A weekly event on Mondays, with Monday skipped: nothing is owed
    // that week, so it doesn't sit open until Saturday.
    const event = t("e", 1, { pinnedWeekdays: [1], skippedDates: new Set([MONDAY]) });
    expect(weeklyGoalFor(event, WEDNESDAY)).toBe(0);
    expect(deriveChecklist([event], [], WEDNESDAY)[0]?.band).toBe("doneThisWeek");
  });

  it("loses only the skipped run of a task pinned to three days", () => {
    // Monday, Wednesday and Friday, with Wednesday skipped: two runs.
    const task = t("m", 3, { pinnedWeekdays: [1, 3, 5], skippedDates: new Set([WEDNESDAY]) });
    expect(weeklyGoalFor(task, SATURDAY)).toBe(2);
    // Monday and Friday done: a Saturday tick is an extra run, not a
    // late one paid at Friday's value.
    const status = deriveChecklist([task], [done("m", MONDAY), done("m", FRIDAY)], SATURDAY)[0];
    expect(status?.goalCount).toBe(2);
    expect(status?.extraToday).toBe(true);
  });

  it("changes nothing for a first day long past or a skip outside the week", () => {
    const plain = t("p", 3, { pinnedWeekdays: [1, 3, 5] });
    const bounded = t("p", 3, {
      pinnedWeekdays: [1, 3, 5],
      repeatFrom: "2026-01-01",
      skippedDates: new Set(["2026-08-03"]),
    });
    expect(weeklyGoalFor(bounded, SATURDAY)).toBe(weeklyGoalFor(plain, SATURDAY));
    expect(plannedDateFor(bounded, SATURDAY)).toBe(plannedDateFor(plain, SATURDAY));
  });

  it("feeds the checklist the same goal", () => {
    const task = t("a", 3, { repeatFrom: FRIDAY });
    expect(deriveChecklist([task], [], FRIDAY)[0]?.goalCount).toBe(2);
  });
});

describe("computeDayLoad with bounds and Away days", () => {
  it("doesn't load a day after a flexible series ends", () => {
    // 3×/week, ending Tuesday: on Wednesday it owes nothing more.
    const load = computeDayLoad([t("a", 3, { repeatUntil: TUESDAY })], [], WEDNESDAY);
    expect(load.expected).toBe(0);
  });

  it("only owes runs on the days a bounded series still has", () => {
    // 3×/week, ending Thursday, nothing done: from Wednesday it can
    // still run on two days, so two runs are spread over the four days
    // left (Wednesday to Saturday).
    const load = computeDayLoad([t("a", 3, { repeatUntil: THURSDAY })], [], WEDNESDAY);
    expect(load.flexible).toBeCloseTo((10 * 2) / 4, 6);
  });

  it("loads a Saturday exactly as before when a bound removes no day ahead", () => {
    // A first day in the past is a bound that takes nothing away: the
    // flexible pool must be what the unbounded task gives.
    const plain = computeDayLoad([t("a", 3)], [], SATURDAY);
    const old = computeDayLoad([t("a", 3, { repeatFrom: "2026-01-01" })], [], SATURDAY);
    expect(old).toEqual(plain);
  });

  it("shows on the checklist what the day pays, Away days included", () => {
    const away = new Set([THURSDAY, FRIDAY, SATURDAY]);
    const tasks = [t("a", 2), t("d", 7)];
    const load = computeDayLoad(tasks, [], WEDNESDAY, away);
    const row = deriveChecklist(tasks, [], WEDNESDAY, 1, away).find((r) => r.taskId === "d");
    expect(row?.pointsIfCompletedNow).toBe(Math.round((90 * 10) / load.expected));
  });

  it("leaves an unbounded task exactly as it was", () => {
    const plain = computeDayLoad([t("a", 3)], [], WEDNESDAY);
    const withNone = computeDayLoad([t("a", 3, {})], [], WEDNESDAY, new Set());
    expect(withNone).toEqual(plain);
  });

  it("spreads flexible work over the days you're here (EC-30)", () => {
    // Away Thursday to Saturday: Wednesday is the only day left.
    const away = new Set([THURSDAY, FRIDAY, SATURDAY]);
    const load = computeDayLoad([t("a", 2)], [], WEDNESDAY, away);
    expect(load.flexible).toBeCloseTo(10 * 2, 6);
  });

  it("lets flexible work lapse when no days are left (EC-30)", () => {
    const away = new Set([WEDNESDAY, THURSDAY, FRIDAY, SATURDAY]);
    expect(computeDayLoad([t("a", 2)], [], WEDNESDAY, away).flexible).toBe(0);
  });

  it("starts a repeating task's count again next week (EC-48)", () => {
    // Unfinished on Saturday, it doesn't owe anything into the next week.
    const daily = t("d", 7);
    const nextWeek = computeDayLoad([daily], [done("d", SATURDAY)], NEXT_SUNDAY);
    expect(nextWeek.anchored.get("d")).toBe(10);
    const flex = t("f", 3);
    expect(computeDayLoad([flex], [], NEXT_SUNDAY).flexible).toBeCloseTo((10 * 3) / 7, 6);
  });
});

describe("rest days and days emptied on the day (ADR-0040 §3)", () => {
  const empty = computeDayLoad([t("p", 1, { pinnedWeekdays: [1] })], [], TUESDAY);
  const rest = { hasPlan: true, openThisWeek: false, earlyToday: false, emptiedToday: false };

  it("can be a rest day when it was empty from the start (EC-24)", () => {
    expect(isRestDay(empty, 0, rest)).toBe(true);
  });

  it("is never a rest day when emptied on the day itself (EC-24, EC-29)", () => {
    expect(isRestDay(empty, 0, { ...rest, emptiedToday: true })).toBe(false);
  });

  it("is ungraded when emptied on the day itself", () => {
    const score = computeDayScore({
      kind: "normal",
      load: empty,
      restDay: { averageExpected: 1, ...rest, emptiedToday: true },
    });
    expect(score.base).toBeNull();
  });

  it("a skip made ahead of time can leave a rest day: the skip is just not due", () => {
    // Monday's only session is skipped: Monday asks nothing.
    const lecture = t("l", 1, { pinnedWeekdays: [1], skippedDates: new Set([MONDAY]) });
    const load = computeDayLoad([lecture], [], MONDAY);
    expect(load.expected).toBe(0);
    expect(isRestDay(load, 0, rest)).toBe(true);
  });
});

describe("boundsError (strict on write)", () => {
  it("accepts bounds that make sense", () => {
    expect(boundsError({})).toBeNull();
    expect(boundsError({ repeatFrom: MONDAY, repeatUntil: FRIDAY, skippedDates: new Set([WEDNESDAY]) })).toBeNull();
  });

  it("refuses a last day before the first", () => {
    expect(boundsError({ repeatFrom: FRIDAY, repeatUntil: MONDAY })).toMatch(/before the first/);
  });

  it("refuses something that isn't a date", () => {
    expect(boundsError({ repeatFrom: "2026-7-14" })).toMatch(/isn't a date/);
    expect(boundsError({ skippedDates: new Set(["2026-07-14T00:00:00Z"]) })).toMatch(/isn't a date/);
  });
});

describe("isLocalDate", () => {
  it("takes real zero-padded dates only", () => {
    expect(isLocalDate("2026-07-14")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-7-14")).toBe(false);
    expect(isLocalDate("2026-07-14T00:00")).toBe(false);
  });
});
