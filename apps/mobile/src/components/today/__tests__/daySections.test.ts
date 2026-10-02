/**
 * How the Today screen arranges a loaded day into sections. Pure, so it
 * runs off-device like the other tests in this folder.
 */
import { describe, expect, it } from "vitest";

import type { DayData, TodayTask } from "../../../db/today";
import { arrangeDay, isDone, minuteOfToday } from "../daySections";

// A Wednesday.
const DATE = "2026-07-15";

function task(id: string, over: Partial<TodayTask> = {}): TodayTask {
  return {
    id,
    title: id,
    unitId: "u",
    areaId: "a",
    pointValue: 5,
    timesPerWeek: 7,
    plannedWeekdays: null,
    fortnightOffset: 0,
    oneOffSize: null,
    oneOffDue: null,
    partOfDay: null,
    placedToday: false,
    dayOrder: null,
    band: "due",
    completedToday: false,
    doneCount: 0,
    goalCount: 7,
    extraToday: false,
    pointsIfCompletedNow: 5,
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
    location: null,
    ...over,
  };
}

function day(due: TodayTask[], over: Partial<DayData> = {}): DayData {
  return {
    date: DATE,
    today: DATE,
    due,
    week: [],
    doneThisWeek: [],
    aheadCount: 0,
    ...over,
  } as DayData;
}

const keys = (sections: { key: string }[]) => sections.map((s) => s.key);

describe("arrangeDay", () => {
  it("always shows the three parts of the day, and Anytime only when it holds something", () => {
    const empty = arrangeDay(day([]), null, null, "checklist");
    expect(keys(empty.arrangeable)).toEqual(["morning", "afternoon", "evening"]);

    const loose = arrangeDay(day([task("t")]), null, null, "checklist");
    expect(keys(loose.arrangeable)).toEqual(["morning", "afternoon", "evening", "anytime"]);
  });

  it("files each open task under its part of the day and totals its points", () => {
    const a = arrangeDay(
      day([task("run", { partOfDay: "morning" }), task("read", { partOfDay: "morning" })]),
      null,
      null,
      "checklist",
    );
    const morning = a.arrangeable.find((s) => s.key === "morning");
    expect(morning?.tasks.map((t) => t.id).sort()).toEqual(["read", "run"]);
    expect(morning?.pts).toBe(10);
  });

  it("moves finished work to Completed", () => {
    const a = arrangeDay(
      day([task("done", { completedToday: true }), task("open")]),
      null,
      null,
      "checklist",
    );
    expect(a.openTasks.map((t) => t.id)).toEqual(["open"]);
    expect(a.tailSections.find((s) => s.key === "completed")?.tasks.map((t) => t.id)).toEqual([
      "done",
    ]);
  });

  it("carries unfinished work forward once its window has ended, but not timed work", () => {
    const evening = 20 * 60;
    const a = arrangeDay(
      day([
        task("loose", { partOfDay: "morning" }),
        task("lecture", { partOfDay: "morning", startMinute: 9 * 60, endMinute: 10 * 60 }),
      ]),
      null,
      evening,
      "checklist",
    );
    const byId = (id: string) => a.openTasks.find((t) => t.id === id)!;
    expect(a.shownPart(byId("loose"))).toBe("evening");
    expect(a.shownPart(byId("lecture"))).toBe("morning");
  });

  it("counts unloaded one-offs in Planned for other days until it is opened", () => {
    const a = arrangeDay(day([], { aheadCount: 2 }), null, null, "checklist");
    expect(a.tailSections.find((s) => s.key === "otherDays")?.count).toBe(2);
  });

  it("offers the hours view only when something is timed, or it is already on", () => {
    expect(arrangeDay(day([task("t")]), null, null, "checklist").showsGrid).toBe(false);
    expect(arrangeDay(day([task("t")]), null, null, "grid").showsGrid).toBe(true);
    const timed = task("t", { startMinute: 600, endMinute: 660 });
    expect(arrangeDay(day([timed]), null, null, "checklist").showsGrid).toBe(true);
  });
});

describe("isDone", () => {
  it("counts a session done ahead on an earlier day as done", () => {
    expect(isDone(task("t", { doneAheadOn: "2026-07-13" }))).toBe(true);
    expect(isDone(task("t"))).toBe(false);
  });
});

describe("minuteOfToday", () => {
  it("runs past midnight until the 3am rollover rather than wrapping", () => {
    expect(minuteOfToday(new Date(2026, 6, 15, 1, 30))).toBe(25 * 60 + 30);
    expect(minuteOfToday(new Date(2026, 6, 15, 9, 0))).toBe(9 * 60);
  });
});
