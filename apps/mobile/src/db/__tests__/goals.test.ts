/**
 * Goals the app counts (ADR-0042, Phase 5c), on a real migrated SQLite:
 * entries written with a tick and removed with it, links that only count
 * from now on, the four kinds' progress, "Took about…", and goals going
 * with a deleted commitment.
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCompletionFraction, toggleCompletion } from "../completions";
import { deleteCommitment } from "../commitmentWrites";
import {
  changeGoalStatus,
  completeGoal,
  createGoal,
  deleteGoal,
  linkGoalTask,
  loadGoalLinkedTaskIds,
  loadGoals,
  pointsByUnit,
  recordGoalEntries,
  setTookAbout,
  unlinkGoalTask,
} from "../goals";
import {
  achievement,
  goal,
  goalEntry,
  goalTask,
  lifeArea,
  lifeUnit,
  task,
  taskCompletion,
  taskUnit,
} from "../schema";
import { addAway } from "../skips";
import { placeTiers } from "./tierFixtures";
import { resetTestDb, testDb } from "./harness";

// Hoisted above the imports by vitest.
const clock = vi.hoisted(() => ({ today: "2026-10-19" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => clock.today,
  // The real one reads the module's own clock, not the mock's.
  assertEditable: () => {},
}));

/** Monday 19 October 2026, and the Sunday before. */
const MON = "2026-10-19";
const SUN = "2026-10-18";

type TaskRow = typeof task.$inferInsert;

function addTask(row: Partial<TaskRow> & { id: string; unitId: string }) {
  testDb()
    .insert(task)
    .values({ title: row.id, pointValue: 0, rankInUnit: 1, timesPerWeek: 7, ...row })
    .run();
  testDb()
    .insert(taskUnit)
    .values({ taskId: row.id, unitId: row.unitId, rankInUnit: 1, pointValue: 0 })
    .run();
}

/** Fitness and Mind in the plan, and School with a sub-commitment. */
function seed() {
  const db = testDb();
  db.insert(lifeArea).values({ id: "area", name: "Area", sortOrder: 0 }).run();
  db.insert(lifeUnit)
    .values([
      { id: "fitness", areaId: "area", name: "Fitness", sortOrder: 0 },
      { id: "mind", areaId: "area", name: "Mind", sortOrder: 1 },
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
        id: "comp2521",
        areaId: "area",
        name: "COMP2521",
        sortOrder: 3,
        isCustom: true,
        includeInScoring: false,
        parentUnitId: "school",
      },
    ])
    .run();
  addTask({ id: "run", unitId: "fitness", size: "big" });
  addTask({ id: "stretch", unitId: "fitness", size: "quick" });
  addTask({ id: "read", unitId: "mind" });
  addTask({ id: "study", unitId: "comp2521", plannedWeekdays: "1,2,3,4,5", timesPerWeek: 5 });
  placeTiers([
    ["fitness", "top"],
    ["mind", "important"],
  ]);
}

const entries = () => testDb().select().from(goalEntry).all();
const progressOf = async (id: string) => (await loadGoals()).find((g) => g.id === id)!;

beforeEach(() => {
  resetTestDb();
  clock.today = MON;
  seed();
});

describe("a tick on a linked task", () => {
  it("leaves an entry, and taking the tick back removes it", async () => {
    const id = await createGoal({
      unitId: "fitness",
      title: "Run 30 times",
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 30 },
    });
    await toggleCompletion("run", MON);
    expect(entries()).toHaveLength(1);
    expect((await progressOf(id)).value).toBe(1);

    await toggleCompletion("run", MON);
    expect(entries()).toEqual([]);
    expect(testDb().select().from(taskCompletion).all()).toEqual([]);
  });

  it("doesn't count ticks of tasks the goal didn't choose", async () => {
    await createGoal({
      unitId: "fitness",
      title: "Run",
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 30 },
    });
    await toggleCompletion("stretch", MON);
    expect(entries()).toEqual([]);
  });

  it("counts from when the task is linked, and keeps what it counted after unlinking", async () => {
    const id = await createGoal({
      unitId: "fitness",
      title: "Move",
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 10 },
    });
    await toggleCompletion("stretch", SUN);
    await linkGoalTask(id, "stretch");
    await toggleCompletion("stretch", MON);
    expect((await progressOf(id)).value).toBe(1);

    await unlinkGoalTask(id, "stretch");
    expect((await progressOf(id)).value).toBe(1);
    expect((await progressOf(id)).taskIds).toEqual(["run"]);
  });

  it("won't unlink a goal's last task, or a streak's", async () => {
    const id = await createGoal({
      unitId: "fitness",
      title: "Run",
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 30 },
    });
    await expect(unlinkGoalTask(id, "run")).rejects.toThrow("another task");
    await expect(unlinkGoalTask(id, "stretch")).rejects.toThrow();
    const streak = await createGoal({
      unitId: "fitness",
      title: "Stretch",
      measure: { kind: "streak", taskId: "stretch" },
    });
    await expect(unlinkGoalTask(streak, "stretch")).rejects.toThrow();
    expect(testDb().select().from(goalTask).all()).toHaveLength(2);
  });

  it("counts only its own unit's tasks, a commitment's sub-commitments included (EC-41)", async () => {
    await expect(
      createGoal({
        unitId: "fitness",
        title: "Everything",
        measure: { kind: "timesDone", taskIds: new Set(["run", "study"]), target: 10 },
      }),
    ).rejects.toThrow("own unit");
    const id = await createGoal({
      unitId: "fitness",
      title: "Run",
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 10 },
    });
    await expect(linkGoalTask(id, "read")).rejects.toThrow("own unit");
    await createGoal({
      unitId: "school",
      title: "Study",
      measure: { kind: "timesDone", taskIds: new Set(["study"]), target: 10 },
    });
  });

  it("keeps a tick's goals and Took about… when how much was done changes", async () => {
    testDb().update(task).set({ allowsPartial: true }).where(eq(task.id, "run")).run();
    const id = await createGoal({
      unitId: "fitness",
      title: "Training",
      measure: { kind: "timeSpent", counts: { taskIds: new Set(["run"]) }, target: 20 },
    });
    await setCompletionFraction("run", MON, 0.5);
    expect((await progressOf(id)).value).toBe(1);
    await changeGoalStatus(id, "pause");
    await setCompletionFraction("run", MON, 1);
    expect((await progressOf(id)).value).toBe(2);
    await setTookAbout("run", MON, 90);
    await setCompletionFraction("run", MON, 0.75);
    expect((await progressOf(id)).value).toBe(1.5);
    expect(testDb().select().from(taskCompletion).all()[0]!.actualMinutes).toBe(90);
  });

  it("keeps counting an archived task's past ticks, and stops listing it (EC-36)", async () => {
    const id = await createGoal({
      unitId: "fitness",
      title: "Run",
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 30 },
    });
    await toggleCompletion("run", MON);
    testDb().update(task).set({ active: false, archivedAt: MON }).where(eq(task.id, "run")).run();
    const g = await progressOf(id);
    expect(g.value).toBe(1);
    expect(g.taskIds).toEqual([]);
  });

  it("isn't collected by a paused goal", async () => {
    const id = await createGoal({
      unitId: "fitness",
      title: "Run",
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 30 },
    });
    await changeGoalStatus(id, "pause");
    await toggleCompletion("run", MON);
    expect(entries()).toEqual([]);
    expect(await loadGoalLinkedTaskIds()).toEqual(new Set());
  });
});

describe("time spent", () => {
  it("counts every task in the unit, including one added after the goal", async () => {
    const id = await createGoal({
      unitId: "fitness",
      title: "20 hours of training",
      measure: { kind: "timeSpent", counts: "wholeUnit", target: 20 },
    });
    addTask({ id: "swim", unitId: "fitness", size: "normal" });
    await toggleCompletion("run", MON);
    await toggleCompletion("swim", MON);
    await toggleCompletion("read", MON);
    expect((await progressOf(id)).value).toBe(3);
  });

  it("follows Took about… without moving any points", async () => {
    const id = await createGoal({
      unitId: "fitness",
      title: "Training",
      measure: { kind: "timeSpent", counts: { taskIds: new Set(["run"]) }, target: 20 },
    });
    await toggleCompletion("run", MON);
    const before = testDb().select().from(taskCompletion).all()[0]!;
    await setTookAbout("run", MON, 45);
    expect((await progressOf(id)).value).toBe(0.75);
    const after = testDb().select().from(taskCompletion).all()[0]!;
    expect(after.actualMinutes).toBe(45);
    expect(after.pointsEarned).toBe(before.pointsEarned);

    // Cleared, it goes back to the task's size: Big is two hours.
    await setTookAbout("run", MON, null);
    expect((await progressOf(id)).value).toBe(2);
  });

  it("keeps Took about… between a minute and twelve hours (EC-38)", async () => {
    await toggleCompletion("run", MON);
    await setTookAbout("run", MON, 24 * 60);
    expect(testDb().select().from(taskCompletion).all()[0]!.actualMinutes).toBe(12 * 60);
  });

  it("refuses Took about… on a task not ticked that day, or that isn't a number", async () => {
    await expect(setTookAbout("run", MON, 30)).rejects.toThrow();
    await toggleCompletion("run", MON);
    await expect(setTookAbout("run", MON, Number.NaN)).rejects.toThrow();
  });

  it("on a commitment counts its sub-commitments' work, and adds no scoring link (EC-41)", async () => {
    const id = await createGoal({
      unitId: "school",
      title: "40 h of study",
      measure: { kind: "timeSpent", counts: "wholeUnit", target: 40 },
    });
    const before = testDb().select().from(taskUnit).all();
    await toggleCompletion("study", MON);
    expect((await progressOf(id)).value).toBe(1);
    expect(testDb().select().from(taskUnit).all()).toEqual(before);
  });
});

describe("points earned", () => {
  it("splits a tick across the units it scores in, and gives a note tag nothing", () => {
    expect(
      pointsByUnit(12, [
        { unitId: "fitness", pointValue: 3 },
        { unitId: "mind", pointValue: 1 },
      ]),
    ).toEqual(
      new Map([
        ["fitness", 9],
        ["mind", 3],
      ]),
    );
    expect(pointsByUnit(12, [])).toEqual(new Map());
  });

  it("counts only its own unit's share of a tick", async () => {
    const fitness = await createGoal({
      unitId: "fitness",
      title: "300 Fitness points",
      measure: { kind: "pointsEarned", target: 300 },
    });
    const mind = await createGoal({
      unitId: "mind",
      title: "Mind points",
      measure: { kind: "pointsEarned", target: 300 },
    });
    const db = testDb();
    db.update(taskUnit).set({ pointValue: 3 }).where(eq(taskUnit.taskId, "run")).run();
    db.insert(taskUnit)
      .values([
        { taskId: "run", unitId: "mind", rankInUnit: 1, pointValue: 1 },
        // A note on School: touches it, earns nothing there.
        { taskId: "run", unitId: "school", rankInUnit: 0, pointValue: 0, membership: "note" },
      ])
      .run();
    db.insert(taskCompletion)
      .values({ id: "c1", taskId: "run", localDate: MON, completedAt: MON, pointsEarned: 12 })
      .run();
    db.transaction((tx) =>
      recordGoalEntries(tx as never, {
        id: "c1",
        taskId: "run",
        localDate: MON,
        pointsEarned: 12,
        fraction: 1,
        actualMinutes: null,
      }),
    );
    expect((await progressOf(fitness)).value).toBe(9);
    expect((await progressOf(mind)).value).toBe(3);
  });
});

describe("streak", () => {
  async function streakGoal() {
    return createGoal({
      unitId: "fitness",
      title: "Stretch every day",
      measure: { kind: "streak", taskId: "stretch" },
    });
  }
  const tickOn = (localDate: string) =>
    testDb()
      .insert(goalEntry)
      .values({
        id: localDate,
        goalId: testDb().select().from(goal).all()[0]!.id,
        completionId: (() => {
          testDb()
            .insert(taskCompletion)
            .values({ id: localDate, taskId: "stretch", localDate, completedAt: localDate, pointsEarned: 0 })
            .run();
          return localDate;
        })(),
        taskId: "stretch",
        localDate,
        minutes: 30,
        points: 0,
      })
      .run();

  it("shows nothing under 7 days, then the current run", async () => {
    const id = await streakGoal();
    for (let d = 13; d <= 18; d++) tickOn(`2026-10-${d}`);
    expect((await progressOf(id)).value).toBeNull();
    tickOn(MON);
    const g = await progressOf(id);
    expect(g.value).toBe(7);
    expect(g.target).toBeNull();
    expect(g.reached).toBe(false);
  });

  it("is bridged by an Away day", async () => {
    const id = await streakGoal();
    for (let d = 12; d <= 18; d++) if (d !== 15) tickOn(`2026-10-${d}`);
    tickOn(MON);
    await addAway("2026-10-15", "2026-10-15", null);
    expect((await progressOf(id)).value).toBe(7);
  });

  it("refuses a task that isn't every day, and an event", async () => {
    await expect(
      createGoal({ unitId: "school", title: "Study", measure: { kind: "streak", taskId: "study" } }),
    ).rejects.toThrow("every-day");
    addTask({ id: "yoga", unitId: "fitness", kind: "event", startMinute: 420, endMinute: 480 });
    await expect(
      createGoal({ unitId: "fitness", title: "Yoga", measure: { kind: "streak", taskId: "yoga" } }),
    ).rejects.toThrow("not an event");
  });
});

describe("making and ending goals", () => {
  it("refuses an end date that isn't a month, and a times done target that isn't whole", async () => {
    await expect(
      createGoal({
        unitId: "fitness",
        title: "x",
        measure: { kind: "pointsEarned", target: 300 },
        targetDate: "2026-12-01",
      }),
    ).rejects.toThrow("month");
    await expect(
      createGoal({
        unitId: "fitness",
        title: "x",
        measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 2.5 },
      }),
    ).rejects.toThrow("whole");
    await createGoal({
      unitId: "fitness",
      title: "x",
      measure: { kind: "pointsEarned", target: 300 },
      targetDate: "2026-12",
    });
  });

  it("refuses a target of zero and a times done goal with no tasks", async () => {
    await expect(
      createGoal({ unitId: "fitness", title: "x", measure: { kind: "pointsEarned", target: 0 } }),
    ).rejects.toThrow("target");
    await expect(
      createGoal({
        unitId: "fitness",
        title: "x",
        measure: { kind: "timesDone", taskIds: new Set(), target: 3 },
      }),
    ).rejects.toThrow("task");
    expect(testDb().select().from(goal).all()).toEqual([]);
  });

  it("won't link chosen tasks to a goal that counts the whole unit", async () => {
    const id = await createGoal({
      unitId: "fitness",
      title: "Points",
      measure: { kind: "pointsEarned", target: 100 },
    });
    await expect(linkGoalTask(id, "run")).rejects.toThrow();
  });

  it("finishing a goal records an achievement and leaves its tasks alone", async () => {
    const id = await createGoal({
      unitId: "fitness",
      title: "Run 30 times",
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 30 },
    });
    const tasksBefore = testDb().select().from(task).all();
    await completeGoal(id);
    expect((await progressOf(id)).status).toBe("completed");
    expect(testDb().select().from(achievement).all().map((a) => a.titleSnapshot)).toEqual([
      "Run 30 times",
    ]);
    expect(testDb().select().from(task).all()).toEqual(tasksBefore);
  });

  it("deleting a goal keeps its achievement, detached", async () => {
    const id = await createGoal({
      unitId: "fitness",
      title: "Run",
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 1 },
    });
    await toggleCompletion("run", MON);
    await completeGoal(id);
    await deleteGoal(id);
    expect(testDb().select().from(goal).all()).toEqual([]);
    expect(entries()).toEqual([]);
    expect(testDb().select().from(goalTask).all()).toEqual([]);
    expect(testDb().select().from(achievement).all()[0]!.goalId).toBeNull();
  });

  it("deleting a commitment deletes its goals and leaves others alone", async () => {
    await createGoal({
      unitId: "school",
      title: "Study",
      measure: { kind: "timesDone", taskIds: new Set(["study"]), target: 10 },
    });
    const fitness = await createGoal({
      unitId: "fitness",
      title: "Run",
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 10 },
    });
    await deleteCommitment("school");
    expect(testDb().select().from(goal).all().map((g) => g.id)).toEqual([fitness]);
    expect(testDb().select().from(goalTask).all().map((l) => l.taskId)).toEqual(["run"]);
  });

  it("removing the last sub-commitment moves its goals onto the commitment", async () => {
    const id = await createGoal({
      unitId: "comp2521",
      title: "COMP2521 hours",
      measure: { kind: "timeSpent", counts: "wholeUnit", target: 40 },
    });
    await deleteCommitment("comp2521");
    expect(testDb().select().from(goal).where(eq(goal.id, id)).all()[0]!.unitId).toBe("school");
  });
});
