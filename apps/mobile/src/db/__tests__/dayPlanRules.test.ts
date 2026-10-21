/**
 * The pure rules behind a day's plan: events on a day, and how each
 * open task reaches `planDay` (spec §§3.2, 3.5; ADR-0039 §8).
 */
import { describe, expect, it } from "vitest";

import {
  eventsOn,
  isFlexible,
  spreadDays,
  tierRankOf,
  toOpenTask,
  type EventRow,
} from "../dayPlanRules";
import type { TodayTask } from "../today";

/** Monday 19 October 2026; the week runs Sunday 18 to Saturday 24. */
const MON = "2026-10-19";

const event = (id: string, over: Partial<EventRow> = {}): EventRow => ({
  id,
  startMinute: 600,
  endMinute: 660,
  plannedWeekdays: "1",
  timesPerWeek: 1,
  fortnightOffset: 0,
  oneOffSize: null,
  oneOffDate: null,
  repeatFrom: null,
  repeatUntil: null,
  skippedDates: new Set(),
  ...over,
});

const facts = { tierRank: 1 as const, unitOrder: 0, createdAt: "2026-01-01", goalLinked: false };

function task(over: Partial<TodayTask> = {}): TodayTask {
  return {
    id: "t",
    title: "t",
    unitId: "u",
    areaId: "a",
    pointValue: 0,
    timesPerWeek: 3,
    plannedWeekdays: null,
    fortnightOffset: 0,
    oneOffSize: null,
    oneOffDue: null,
    partOfDay: null,
    band: "week",
    completedToday: false,
    doneCount: 0,
    goalCount: 3,
    extraToday: false,
    pointsIfCompletedNow: 0,
    tagUnitIds: [],
    streak: null,
    allowsPartial: false,
    commitment: false,
    offSchedule: false,
    doneAheadOn: null,
    oneOffDate: null,
    plannedOn: null,
    progress: 0,
    earnedToday: null,
    fractionToday: null,
    startMinute: null,
    endMinute: null,
    size: null,
    kind: "task",
    repeatFrom: null,
    repeatUntil: null,
    skippedToday: false,
    ...over,
  };
}

describe("eventsOn", () => {
  it("holds a repeating event on its days and a one-time one on its date, earliest first", () => {
    const rows = [
      event("late", { startMinute: 900, endMinute: 960 }),
      event("early"),
      event("tuesday", { plannedWeekdays: "2" }),
      event("once", { plannedWeekdays: null, oneOffSize: "normal", oneOffDate: MON, startMinute: 480, endMinute: 540 }),
      event("untimed", { startMinute: null }),
    ];
    expect(eventsOn(rows, MON).map((e) => e.id)).toEqual(["once", "early", "late"]);
  });

  it("leaves out a skipped run and one past the series' end", () => {
    const rows = [
      event("skipped", { skippedDates: new Set([MON]) }),
      event("ended", { repeatUntil: "2026-10-12" }),
      event("onceSkipped", { oneOffSize: "normal", oneOffDate: MON, skippedDates: new Set([MON]) }),
    ];
    expect(eventsOn(rows, MON)).toEqual([]);
  });
});

describe("toOpenTask", () => {
  it("leaves out events, skipped runs and sessions done early", () => {
    expect(toOpenTask(task({ kind: "event" }), MON, facts)).toBeNull();
    expect(toOpenTask(task({ skippedToday: true }), MON, facts)).toBeNull();
    expect(toOpenTask(task({ doneAheadOn: "2026-10-18" }), MON, facts)).toBeNull();
  });

  it("marks work due on the day as due", () => {
    const t = toOpenTask(task({ band: "due", plannedWeekdays: "1" }), MON, facts)!;
    expect(t).toMatchObject({ dueToday: true, carried: false, plannedLater: false, owesRun: true });
  });

  it("carries a run from a day gone this week, and a one-off past its date (ADR-0039 §8)", () => {
    expect(toOpenTask(task({ band: "due", plannedOn: "2026-10-18" }), MON, facts)).toMatchObject({
      carried: true,
      dueToday: false,
    });
    expect(
      toOpenTask(task({ band: "due", oneOffSize: "normal", oneOffDate: "2026-10-15" }), MON, facts),
    ).toMatchObject({ carried: true, size: "normal" });
  });

  it("holds work planned for later back from suggestions (§3.2)", () => {
    expect(toOpenTask(task({ plannedOn: "2026-10-21" }), MON, facts)).toMatchObject({
      plannedLater: true,
      dueToday: false,
    });
    expect(toOpenTask(task(), MON, facts, { spreadHere: false })).toMatchObject({ plannedLater: true });
  });

  it("owes nothing once the week's runs are done", () => {
    expect(toOpenTask(task({ band: "doneThisWeek" }), MON, facts)?.owesRun).toBe(false);
  });
});

describe("spreading flexible runs (§3.5)", () => {
  it("is life work with no days, no date and not every day", () => {
    expect(isFlexible(task())).toBe(true);
    expect(isFlexible(task({ plannedWeekdays: "1" }))).toBe(false);
    expect(isFlexible(task({ timesPerWeek: 7 }))).toBe(false);
    expect(isFlexible(task({ oneOffSize: "quick" }))).toBe(false);
    expect(isFlexible(task({ commitment: true }))).toBe(false);
  });

  it("covers what's left of the week, from tomorrow in this one", () => {
    expect(spreadDays("2026-10-21", MON)).toEqual([
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
    expect(spreadDays("2026-10-28", MON)[0]).toBe("2026-10-25");
    expect(spreadDays("2026-10-28", MON)).toHaveLength(7);
  });
});

describe("tierRankOf", () => {
  it("ranks Top first and a commitment with Important", () => {
    expect([tierRankOf("top"), tierRankOf("important"), tierRankOf("background"), tierRankOf(null)]).toEqual([
      0, 1, 2, 1,
    ]);
  });
});
