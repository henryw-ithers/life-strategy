/**
 * The weekly pass from stored rows (spec §5.3.2): last week as shares
 * of time, this week's events turned off and on, and the month's tiers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activity,
  activityTag,
  dayGrade,
  lifeArea,
  lifeUnit,
  scheduleSkip,
  task,
  taskCompletion,
  taskUnit,
} from "../schema";
import {
  isOnThisWeek,
  loadLastWeek,
  loadWeekEvents,
  markTiersOffered,
  setEventOffThisWeek,
  tiersCheckDue,
} from "../weeklyPass";
import { resetTestDb, testDb } from "./harness";

const clock = vi.hoisted(() => ({ today: "2026-10-19" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => clock.today,
}));

/** Monday 19 October 2026; last week is 11 to 17 October. */
const MON = "2026-10-19";
const LAST_TUE = "2026-10-13";

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
const tick = (taskId: string, localDate: string, fraction = 1) =>
  testDb()
    .insert(taskCompletion)
    .values({ id: `${taskId}-${localDate}`, taskId, localDate, completedAt: localDate, pointsEarned: 0, fraction })
    .run();

beforeEach(() => {
  resetTestDb();
  clock.today = MON;
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
        usesSubCommitments: true,
      },
      {
        id: "comp",
        areaId: "area",
        name: "COMP2521",
        sortOrder: 3,
        isCustom: true,
        includeInScoring: false,
        parentUnitId: "school",
      },
    ])
    .run();
});

describe("last week (spec §5.3.2)", () => {
  it("is each unit's share of the time, a commitment as one row", async () => {
    addTask({ id: "run", unitId: "fitness", size: "normal" });
    addTask({ id: "lecture", unitId: "comp", kind: "event", plannedWeekdays: "2", startMinute: 600, endMinute: 720 });
    tick("run", LAST_TUE);
    tick("lecture", LAST_TUE);
    // This week's work isn't last week's.
    tick("run", MON);

    const week = await loadLastWeek(MON);
    expect(week.start).toBe("2026-10-11");
    expect(week.shares.map((s) => [s.unitId, s.name, Math.round(s.share * 100)])).toEqual([
      ["school", "School", 67],
      ["fitness", "Fitness", 33],
    ]);
  });

  it("counts sized activities across their tags, flags and how many were logged", async () => {
    testDb()
      .insert(activity)
      .values([
        { id: "a1", localDate: LAST_TUE, title: "Dinner", size: "big", flagged: true },
        { id: "a2", localDate: LAST_TUE, title: "A thought", size: null },
      ])
      .run();
    testDb().insert(activityTag).values({ activityId: "a1", unitId: "friends" }).run();
    testDb().insert(dayGrade).values({ localDate: LAST_TUE, flagged: true }).run();

    const week = await loadLastWeek(MON);
    expect(week.shares.map((s) => s.unitId)).toEqual(["friends"]);
    expect(week.activities).toBe(2);
    expect(week.flaggedDays).toEqual([LAST_TUE]);
    expect(week.flaggedActivities).toEqual([{ title: "Dinner", date: LAST_TUE }]);
  });

  it("is empty when nothing was done, and says nothing about what wasn't", async () => {
    addTask({ id: "run", unitId: "fitness", plannedWeekdays: "2" });
    const week = await loadLastWeek(MON);
    expect(week.shares).toEqual([]);
    expect(Object.keys(week).sort()).toEqual([
      "activities",
      "end",
      "flaggedActivities",
      "flaggedDays",
      "shares",
      "start",
    ]);
  });
});

describe("this week's events", () => {
  beforeEach(() => {
    addTask({
      id: "lecture",
      unitId: "comp",
      kind: "event",
      plannedWeekdays: "1,3",
      timesPerWeek: 2,
      startMinute: 600,
      endMinute: 690,
    });
  });

  it("lists each event's days left this week", async () => {
    const [e] = await loadWeekEvents(MON);
    expect(e?.event.title).toBe("lecture");
    expect(e?.days.map((d) => d.date)).toEqual([MON, "2026-10-21"]);
    expect(isOnThisWeek(e!)).toBe(true);
  });

  it("turns one off for the week with skipped runs, and back on", async () => {
    const [e] = await loadWeekEvents(MON);
    await setEventOffThisWeek(e!, true);
    expect(testDb().select().from(scheduleSkip).all().map((s) => s.localDate).sort()).toEqual([
      MON,
      "2026-10-21",
    ]);
    const [off] = await loadWeekEvents(MON);
    expect(isOnThisWeek(off!)).toBe(false);

    await setEventOffThisWeek(off!, false);
    expect(testDb().select().from(scheduleSkip).all()).toEqual([]);
  });
});

describe("the month's tiers", () => {
  it("are offered once a month", async () => {
    expect(await tiersCheckDue(MON)).toBe(true);
    await markTiersOffered(MON);
    expect(await tiersCheckDue("2026-10-25")).toBe(false);
    expect(await tiersCheckDue("2026-11-01")).toBe(true);
  });
});
