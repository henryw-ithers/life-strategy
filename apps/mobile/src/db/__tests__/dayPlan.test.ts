/**
 * A day as Plan shows it, from stored rows (spec §5.3,
 * windows-and-pins.md §§1–3): windows from the hours less events,
 * suggestions, pins, work planned for later, flexible runs spread over
 * a future week, the week strip, and copying last week's events.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadDayPlan, loadWeek } from "../dayPlan";
import { saveHoursFrom } from "../hours";
import { pinForDay } from "../pins";
import { dayGrade, lifeArea, lifeUnit, task, taskCompletion, taskUnit } from "../schema";
import { addAway, clearToday } from "../skips";
import { copyLastWeeksEvents } from "../tasks";
import { placeTiers } from "./tierFixtures";
import { resetTestDb, testDb } from "./harness";

const clock = vi.hoisted(() => ({ today: "2026-10-19" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => clock.today,
}));

/** Sunday 18 October 2026 opens the week (ADR-0004 §1). */
const SUN = "2026-10-18";
/** Monday 19 October 2026, and the days after. */
const MON = "2026-10-19";
const TUE = "2026-10-20";
const WED = "2026-10-21";
const FRI = "2026-10-23";
const SAT = "2026-10-24";
const LAST_MON = "2026-10-12";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
/** 8 am on Monday, before the first window. */
const EARLY = new Date("2026-10-19T08:00:00");

type TaskRow = typeof task.$inferInsert;

function addTask(row: Partial<TaskRow> & { id: string; unitId: string }) {
  testDb()
    .insert(task)
    .values({ title: row.id, pointValue: 0, rankInUnit: 1, timesPerWeek: 1, ...row })
    .run();
  testDb()
    .insert(taskUnit)
    .values({ taskId: row.id, unitId: row.unitId, rankInUnit: 1, pointValue: 0 })
    .run();
}

function seed() {
  const db = testDb();
  db.insert(lifeArea).values({ id: "area", name: "Area", sortOrder: 0 }).run();
  db.insert(lifeUnit)
    .values([
      { id: "fitness", areaId: "area", name: "Fitness", sortOrder: 0 },
      { id: "friends", areaId: "area", name: "Friends", sortOrder: 1 },
      {
        id: "school",
        areaId: "area",
        name: "School",
        sortOrder: 2,
        isCustom: true,
        includeInScoring: false,
        commitmentShare: 100,
      },
    ])
    .run();
  placeTiers([
    ["fitness", "top"],
    ["friends", "important"],
  ]);
}

const nineToFive = [{ weekdays: [1, 2, 3, 4, 5] as const, ranges: [{ start: h(9), end: h(17) }] }];

async function hoursFromSunday() {
  clock.today = "2026-10-18";
  await saveHoursFrom("2026-10-18", nineToFive as never);
  clock.today = MON;
}

/** Every task id the plan places somewhere. */
function placed(plan: Awaited<ReturnType<typeof loadDayPlan>>): string[] {
  const p = plan.planned;
  return [
    ...p.windows.flatMap((w) => [
      ...w.pinned.map((x) => x.taskId),
      ...w.timed,
      ...w.suggested.map((s) => s.taskId),
      ...w.showAll.map((s) => s.taskId),
    ]),
    ...p.atTime,
    ...p.later,
    ...p.doesntFit,
  ];
}

beforeEach(async () => {
  resetTestDb();
  clock.today = MON;
  seed();
  await hoursFromSunday();
});

describe("windows (§3.2)", () => {
  it("are the working hours less each event and its buffer", async () => {
    addTask({
      id: "lecture",
      unitId: "school",
      kind: "event",
      plannedWeekdays: "1",
      startMinute: h(10),
      endMinute: h(11, 30),
    });
    const plan = await loadDayPlan(MON, EARLY);
    expect(plan.hours.windows).toEqual([
      { start: h(9), end: h(9, 50) },
      { start: h(11, 40), end: h(17) },
    ]);
    expect(plan.events.map((e) => [e.id, e.start, e.end])).toEqual([["lecture", h(10), h(11, 30)]]);
    expect(plan.freeMinutes).toBe(50 + 320);
  });

  it("are set aside on a cleared day and an Away day", async () => {
    await clearToday();
    expect((await loadDayPlan(MON, EARLY)).hours.windows).toEqual([]);
    await addAway(TUE, WED, null);
    expect((await loadDayPlan(WED)).hours.windows).toEqual([]);
  });
});

describe("filling them (windows-and-pins §3)", () => {
  it("suggests today's work and keeps every open task once", async () => {
    addTask({ id: "gym", unitId: "fitness", plannedWeekdays: "1" });
    addTask({ id: "call", unitId: "friends", timesPerWeek: 3 });
    const plan = await loadDayPlan(MON, EARLY);
    const suggested = plan.planned.windows.flatMap((w) => w.suggested.map((s) => s.taskId));
    expect(suggested).toEqual(["gym", "call"]);
    expect(plan.planned.windows[0]?.suggested[0]?.reason).toBe("due");
    expect(placed(plan).sort()).toEqual(["call", "gym"]);
  });

  it("shows a pin in the window holding its time", async () => {
    addTask({ id: "call", unitId: "friends", timesPerWeek: 3 });
    await pinForDay("call", MON, h(15), "window");
    const plan = await loadDayPlan(MON, EARLY);
    expect(plan.planned.windows[0]?.pinned.map((p) => p.taskId)).toEqual(["call"]);
  });

  it("never suggests work planned for a later day, but lists it", async () => {
    addTask({ id: "gym", unitId: "fitness", plannedWeekdays: "3" });
    const plan = await loadDayPlan(MON, EARLY);
    expect(placed(plan)).toEqual([]);
    expect(plan.planned.plannedAhead).toEqual(["gym"]);
  });

  it("puts a task ticked today where it was done", async () => {
    addTask({ id: "gym", unitId: "fitness", plannedWeekdays: "1" });
    testDb()
      .insert(taskCompletion)
      .values({
        id: "tick",
        taskId: "gym",
        localDate: MON,
        completedAt: "2026-10-19T10:15:00",
        pointsEarned: 0,
      })
      .run();
    const plan = await loadDayPlan(MON, new Date("2026-10-19T11:00:00"));
    expect(plan.now).toBe(h(11));
    expect(plan.planned.windows[0]?.done).toEqual(["gym"]);
    expect(placed(plan)).toEqual([]);
  });

  it("never suggests again a task ticked today at a time it can't place", async () => {
    addTask({ id: "gym", unitId: "fitness", plannedWeekdays: "1" });
    testDb()
      .insert(taskCompletion)
      .values({ id: "tick", taskId: "gym", localDate: MON, completedAt: "not a time", pointsEarned: 0 })
      .run();
    const plan = await loadDayPlan(MON, EARLY);
    expect(placed(plan)).toEqual([]);
    expect(plan.planned.windows.flatMap((w) => w.done)).toEqual([]);
  });
});

describe("a future day (§3.5)", () => {
  it("spreads flexible runs over the days with the most room", async () => {
    addTask({ id: "call", unitId: "friends", timesPerWeek: 3 });
    // Tuesday to Friday have hours; the weekend has none. Three runs go
    // to the first three of the roomiest days.
    const wed = await loadDayPlan(WED);
    expect(wed.planned.windows.flatMap((w) => w.suggested.map((s) => s.taskId))).toEqual(["call"]);
    const fri = await loadDayPlan(FRI);
    expect(fri.planned.windows.flatMap((w) => w.suggested.map((s) => s.taskId))).toEqual([]);
    expect(fri.planned.plannedAhead).toEqual(["call"]);
  });

  it("shows a pin on a day the runs weren't spread to", async () => {
    addTask({ id: "call", unitId: "friends", timesPerWeek: 3 });
    await pinForDay("call", FRI, h(10), "window");
    const fri = await loadDayPlan(FRI);
    expect(fri.planned.windows[0]?.pinned.map((p) => p.taskId)).toEqual(["call"]);
  });
});

describe("the week strip (§5.3)", () => {
  it("adds up free time and marks pins, Special days and Away", async () => {
    addTask({ id: "call", unitId: "friends", timesPerWeek: 3 });
    await pinForDay("call", TUE, h(10), "window");
    testDb().insert(dayGrade).values({ localDate: WED, kind: "special" }).run();
    await addAway(FRI, SAT, "Trip");

    const week = await loadWeek(WED);
    expect(week.map((d) => d.date)[0]).toBe(SUN);
    expect(week).toHaveLength(7);
    const on = (date: string) => week.find((d) => d.date === date)!;
    expect(on(MON).freeMinutes).toBe(h(8));
    expect(on(TUE).hasPins).toBe(true);
    expect(on(MON).hasPins).toBe(false);
    expect(on(WED).marker).toBe("special");
    expect(on(FRI).marker).toBe("away");
    expect(on(FRI).freeMinutes).toBe(0);
    expect(on(SAT).freeMinutes).toBe(0);
  });
});

describe("copying last week's events (ADR-0040 §6)", () => {
  const shift = (id: string, date: string, over: Partial<TaskRow> = {}) =>
    addTask({
      id,
      unitId: "school",
      kind: "event",
      oneOffSize: "normal",
      oneOffDate: date,
      startMinute: h(12),
      endMinute: h(16),
      ...over,
    });
  const events = () =>
    testDb()
      .select()
      .from(task)
      .all()
      .filter((t) => t.kind === "event");

  it("adds last week's one-time events a week later, once", async () => {
    shift("shift", LAST_MON, { title: "Café", description: "Back door" });
    expect(await copyLastWeeksEvents(SUN)).toBe(1);
    const copy = events().find((e) => e.id !== "shift");
    expect(copy).toMatchObject({
      title: "Café",
      unitId: "school",
      oneOffDate: MON,
      startMinute: h(12),
      endMinute: h(16),
      description: "Back door",
    });
    // Pressing it again adds nothing.
    expect(await copyLastWeeksEvents(SUN)).toBe(0);
    expect(events()).toHaveLength(2);
  });

  it("leaves repeating events alone and never copies onto a past day", async () => {
    addTask({
      id: "lecture",
      unitId: "school",
      kind: "event",
      plannedWeekdays: "1",
      startMinute: h(10),
      endMinute: h(11),
    });
    shift("monday", LAST_MON);
    shift("friday", "2026-10-16");
    // The copy of Monday's would land on Monday, now past.
    clock.today = TUE;
    expect(await copyLastWeeksEvents(SUN)).toBe(1);
    expect(events().map((e) => e.oneOffDate).sort()).toEqual([
      "2026-10-12",
      "2026-10-16",
      FRI,
      null,
    ].sort());
  });
});
