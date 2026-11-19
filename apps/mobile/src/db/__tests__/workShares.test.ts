/**
 * Effort share from stored rows (ADR-0041 §5): shares of the time spent,
 * a commitment as one row; and writing a run of skips.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activity,
  activityTag,
  lifeArea,
  lifeUnit,
  scheduleSkip,
  task,
  taskCompletion,
  taskUnit,
} from "../schema";
import { loadWorkShares } from "../workShares";
import { setRunsSkipped } from "../skips";
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

describe("effort share (ADR-0041 §5)", () => {
  it("is each unit's share of the time, a commitment as one row", async () => {
    addTask({ id: "run", unitId: "fitness", size: "normal" });
    addTask({ id: "lecture", unitId: "comp", kind: "event", plannedWeekdays: "2", startMinute: 600, endMinute: 720 });
    tick("run", LAST_TUE);
    tick("lecture", LAST_TUE);
    // Outside the range, so not counted.
    tick("run", MON);

    const shares = await loadWorkShares("2026-10-11", "2026-10-17");
    expect(shares.map((s) => [s.unitId, s.name, Math.round(s.share * 100)])).toEqual([
      ["school", "School", 67],
      ["fitness", "Fitness", 33],
    ]);
  });

  it("counts sized activities across their tags", async () => {
    testDb()
      .insert(activity)
      .values([
        { id: "a1", localDate: LAST_TUE, title: "Dinner", size: "big" },
        { id: "a2", localDate: LAST_TUE, title: "A thought", size: null },
      ])
      .run();
    testDb().insert(activityTag).values({ activityId: "a1", unitId: "friends" }).run();
    const shares = await loadWorkShares("2026-10-11", "2026-10-17");
    expect(shares.map((s) => s.unitId)).toEqual(["friends"]);
  });
});

describe("setRunsSkipped", () => {
  it("writes all of the runs or none of them", async () => {
    addTask({ id: "lecture", unitId: "comp", kind: "event", plannedWeekdays: "1,3", startMinute: 600, endMinute: 690 });
    // A past day can't be skipped, so nothing is written.
    await expect(setRunsSkipped("lecture", ["2026-10-18", MON], true)).rejects.toThrow();
    expect(testDb().select().from(scheduleSkip).all()).toEqual([]);
    await setRunsSkipped("lecture", [MON, "2026-10-21"], true);
    await setRunsSkipped("lecture", [MON], true);
    expect(testDb().select().from(scheduleSkip).all()).toHaveLength(2);
  });
});
