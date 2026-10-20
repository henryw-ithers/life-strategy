/**
 * Changing a repeating event (ADR-0040, Phase 7) on a real migrated
 * SQLite: "This event only", "This and following" with its skips
 * (EC-27), repeat lengths that take today's run away, archiving a
 * series once its days have settled (EC-26), and streaks over skips.
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGoal, loadGoals } from "../goals";
import { goalEntry, lifeArea, lifeUnit, scheduleSkip, task, taskCompletion, taskUnit } from "../schema";
import {
  archiveEndedSeries,
  editEventFollowing,
  editEventOccurrence,
  setEventRepeat,
} from "../seriesWrites";
import { addSkip } from "../skips";
import { resetTestDb, testDb } from "./harness";

const clock = vi.hoisted(() => ({ today: "2026-10-20" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => clock.today,
  assertEditable: () => {},
}));
vi.mock("../dayGrades", async (original) => ({
  ...(await original<typeof import("../dayGrades")>()),
  recacheAllDayScores: vi.fn(() => Promise.resolve()),
}));

/** Tuesday 20 October 2026. */
const TODAY = "2026-10-20";

const lecture = {
  title: "COMP2521 lecture",
  weekdays: [2],
  date: null,
  startMinute: 11 * 60,
  endMinute: 12 * 60 + 30,
};

function seed() {
  const db = testDb();
  db.insert(lifeArea).values({ id: "area", name: "Area", sortOrder: 0 }).run();
  db.insert(lifeUnit)
    .values({
      id: "school",
      areaId: "area",
      name: "School",
      sortOrder: 0,
      isCustom: true,
      includeInScoring: false,
      commitmentShare: 100,
    })
    .run();
  db.insert(task)
    .values({
      id: "lec",
      unitId: "school",
      title: lecture.title,
      kind: "event",
      plannedWeekdays: "2",
      timesPerWeek: 1,
      startMinute: lecture.startMinute,
      endMinute: lecture.endMinute,
      repeatFrom: "2026-09-01",
      repeatUntil: "2026-12-01",
      pointValue: 0,
      rankInUnit: 1,
    })
    .run();
  db.insert(taskUnit).values({ taskId: "lec", unitId: "school", rankInUnit: 1, pointValue: 0 }).run();
}

const taskRow = (id: string) => testDb().select().from(task).where(eq(task.id, id)).all()[0];
const skipsOf = (id: string) =>
  testDb().select().from(scheduleSkip).where(eq(scheduleSkip.taskId, id)).all();

beforeEach(() => {
  resetTestDb();
  clock.today = TODAY;
  seed();
});

describe("This event only", () => {
  it("skips that date in the series and adds a one-off on it with the new details", async () => {
    const id = await editEventOccurrence("lec", "2026-10-27", {
      ...lecture,
      startMinute: 13 * 60,
      endMinute: 14 * 60 + 30,
    });
    expect(skipsOf("lec").map((s) => [s.kind, s.localDate])).toEqual([["occurrence", "2026-10-27"]]);
    expect(taskRow(id)).toMatchObject({
      kind: "event",
      unitId: "school",
      oneOffDate: "2026-10-27",
      startMinute: 13 * 60,
      plannedWeekdays: null,
    });
    // The series itself is unchanged.
    expect(taskRow("lec")).toMatchObject({ startMinute: 11 * 60, repeatUntil: "2026-12-01" });
  });

  it("refuses a day that has passed, leaving nothing behind", async () => {
    await expect(editEventOccurrence("lec", "2026-10-13", lecture)).rejects.toThrow();
    expect(skipsOf("lec")).toEqual([]);
    expect(testDb().select().from(task).all()).toHaveLength(1);
  });
});

describe("This and following", () => {
  it("ends the series the day before and starts a new one, moving later skips (EC-27)", async () => {
    await addSkip({ kind: "occurrence", taskId: "lec", date: "2026-11-03" });
    await addSkip({ kind: "taskWeek", taskId: "lec", date: "2026-11-15" });
    await addSkip({ kind: "occurrence", taskId: "lec", date: "2026-10-20" });

    const next = await editEventFollowing("lec", "2026-10-27", { ...lecture, startMinute: 10 * 60 });
    expect(next).not.toBeNull();
    expect(taskRow("lec")).toMatchObject({ repeatUntil: "2026-10-26", startMinute: 11 * 60 });
    expect(taskRow(next!)).toMatchObject({
      repeatFrom: "2026-10-27",
      repeatUntil: "2026-12-01",
      startMinute: 10 * 60,
      unitId: "school",
    });
    expect(skipsOf("lec").map((s) => s.localDate)).toEqual(["2026-10-20"]);
    expect(skipsOf(next!).map((s) => s.localDate).sort()).toEqual(["2026-11-03", "2026-11-15"]);
  });

  it("is the whole series from its first day", async () => {
    const next = await editEventFollowing("lec", "2026-09-01", { ...lecture, startMinute: 10 * 60 });
    expect(next).toBeNull();
    expect(taskRow("lec")).toMatchObject({ startMinute: 10 * 60 });
  });
});

describe("setEventRepeat", () => {
  it("saves the bounds", async () => {
    await setEventRepeat("lec", { repeatFrom: "2026-09-01", repeatUntil: "2026-11-28" });
    expect(taskRow("lec")).toMatchObject({ repeatUntil: "2026-11-28" });
    expect(skipsOf("lec")).toEqual([]);
  });

  it("records a same-day skip when the change takes today's run away", async () => {
    await setEventRepeat("lec", { repeatFrom: "2026-09-01", repeatUntil: "2026-10-19" });
    expect(skipsOf("lec").map((s) => [s.kind, s.localDate, s.madeOn])).toEqual([
      ["occurrence", TODAY, TODAY],
    ]);
  });
});

describe("archiveEndedSeries (EC-26)", () => {
  it("archives a series once its last day is before the edit window, keeping its history", async () => {
    testDb().update(task).set({ repeatUntil: "2026-10-10" }).where(eq(task.id, "lec")).run();
    testDb()
      .insert(taskCompletion)
      .values({ id: "c", taskId: "lec", localDate: "2026-10-06", completedAt: "x", pointsEarned: 3 })
      .run();
    expect(await archiveEndedSeries()).toBe(1);
    expect(taskRow("lec")).toMatchObject({ active: false });
    expect(taskRow("lec")!.archivedAt).not.toBeNull();
    expect(testDb().select().from(taskCompletion).all()).toHaveLength(1);
  });

  it("leaves a series that ended inside the edit window", async () => {
    testDb().update(task).set({ repeatUntil: "2026-10-12" }).where(eq(task.id, "lec")).run();
    expect(await archiveEndedSeries()).toBe(0);
    expect(taskRow("lec")).toMatchObject({ active: true });
  });
});

describe("a streak over skipped days", () => {
  async function streakWithGap(skip: boolean) {
    const db = testDb();
    db.insert(lifeUnit).values({ id: "mind", areaId: "area", name: "Mind", sortOrder: 1 }).run();
    db.insert(task)
      .values({ id: "med", unitId: "mind", title: "Meditate", timesPerWeek: 7, pointValue: 0, rankInUnit: 1 })
      .run();
    db.insert(taskUnit).values({ taskId: "med", unitId: "mind", rankInUnit: 1, pointValue: 0 }).run();
    const id = await createGoal({ unitId: "mind", title: "Meditate", measure: { kind: "streak", taskId: "med" } });
    for (let d = 13; d <= 20; d++) {
      const date = `2026-10-${d}`;
      if (d === 18) continue;
      db.insert(taskCompletion).values({ id: date, taskId: "med", localDate: date, completedAt: date, pointsEarned: 0 }).run();
      db.insert(goalEntry)
        .values({ id: date, goalId: id, completionId: date, taskId: "med", localDate: date, minutes: 30, points: 0 })
        .run();
    }
    if (skip) {
      db.insert(scheduleSkip)
        .values({ id: "s", kind: "occurrence", taskId: "med", localDate: "2026-10-18", madeOn: "2026-10-17" })
        .run();
    }
    return (await loadGoals()).find((g) => g.id === id)?.value;
  }

  it("is ended by a missed every-day run that wasn't skipped", async () => {
    // Two days since the gap: under 7, so nothing shows.
    expect(await streakWithGap(false)).toBeNull();
  });

  it("bridges a day the task was skipped", async () => {
    expect(await streakWithGap(true)).toBe(7);
  });
});
