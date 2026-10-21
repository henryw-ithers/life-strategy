/**
 * Achievements on a real migrated SQLite (ADR-0047): ranks awarded
 * once and never taken back, progress toward the next, the celebration
 * shown once, the month review's list, and "Took about…".
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  awardAchievements,
  badgesByUnit,
  loadAchievements,
  loadUncelebrated,
  markCelebrated,
} from "../achievements";
import { setTookAbout, toggleCompletion } from "../completions";
import { loadLog } from "../log";
import { achievement, lifeArea, lifeUnit, task, taskCompletion, taskUnit } from "../schema";
import { resetTestDb, testDb } from "./harness";

const clock = vi.hoisted(() => ({ today: "2026-10-21" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => clock.today,
  assertEditable: () => {},
}));

const TODAY = "2026-10-21";

function seed() {
  const db = testDb();
  db.insert(lifeArea).values({ id: "health", name: "Health", sortOrder: 0 }).run();
  db.insert(lifeUnit).values({ id: "fit", areaId: "health", name: "Fitness", sortOrder: 0 }).run();
  db.insert(task)
    .values({
      id: "run",
      unitId: "fit",
      title: "Run",
      timesPerWeek: 3,
      pointValue: 10,
      rankInUnit: 1,
      createdAt: "2026-09-01T00:00:00.000Z",
    })
    .run();
  db.insert(taskUnit).values({ taskId: "run", unitId: "fit", rankInUnit: 1, pointValue: 10 }).run();
}

/** `n` ticks of the run, one a day ending yesterday. */
function ticks(n: number) {
  const db = testDb();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 9, 20 - i)).toISOString().slice(0, 10);
    db.insert(taskCompletion)
      .values({ id: `t${i}`, taskId: "run", localDate: d, completedAt: `${d}T08:00:00.000Z`, pointsEarned: 0 })
      .run();
  }
}

const runCompletions = async () =>
  (await loadAchievements()).find((a) => a.series === "taskCompletions" && a.subjectId === "run")!;

beforeEach(() => {
  resetTestDb();
  clock.today = TODAY;
  seed();
});

describe("awarding", () => {
  it("awards each rank reached once, dated today", async () => {
    ticks(20);
    const fresh = await awardAchievements();
    expect(fresh.filter((a) => a.series === "taskCompletions")).toEqual([
      expect.objectContaining({ subjectId: "run", subjectName: "Run", rank: "bronze", threshold: 20, earnedOn: TODAY }),
    ]);
    expect(await awardAchievements()).toEqual([]);
  });

  it("never takes a rank back when the tick that earned it is undone", async () => {
    ticks(19);
    await toggleCompletion("run", TODAY);
    expect((await awardAchievements()).some((a) => a.rank === "bronze" && a.subjectId === "run")).toBe(true);
    await toggleCompletion("run", TODAY);
    const item = await runCompletions();
    expect(item.earned.map((e) => e.rank)).toEqual(["bronze"]);
    // Progress is honest: 19 toward Silver's 50.
    expect(item).toMatchObject({ progress: 19, next: { rank: "silver", threshold: 50 } });
  });

  it("shows a locked one's progress", async () => {
    ticks(7);
    expect(await runCompletions()).toMatchObject({ earned: [], progress: 7, next: { rank: "bronze", threshold: 20 } });
  });

  it("keeps the ranks of a task since deleted, under its old name", async () => {
    ticks(20);
    await awardAchievements();
    testDb().delete(taskCompletion).run();
    testDb().delete(taskUnit).run();
    testDb().delete(task).where(eq(task.id, "run")).run();
    const item = await runCompletions();
    expect(item).toMatchObject({ subjectName: "Run", progress: null, next: null });
    expect(item.earned.map((e) => e.rank)).toEqual(["bronze"]);
  });

  it("gives the unit its highest rank, and its longest run going now", async () => {
    ticks(20);
    const badges = badgesByUnit(await loadAchievements());
    // Daily since 1 October: three weeks ended with the run's target met.
    expect(badges.get("fit")).toEqual({ rank: "bronze", streak: { length: 3, per: "week" } });
  });
});

describe("celebrating", () => {
  it("is shown once", async () => {
    ticks(20);
    await awardAchievements();
    const waiting = await loadUncelebrated();
    expect(waiting.length).toBeGreaterThan(0);
    await markCelebrated(waiting.map((a) => a.id));
    expect(await loadUncelebrated()).toEqual([]);
  });
});

describe("the month review", () => {
  it("lists what was earned that month", async () => {
    ticks(20);
    await awardAchievements();
    const october = (await loadLog()).find((m) => m.month === "2026-10")!;
    expect(october.earned).toContain("Bronze · Run · 20 completions");
  });
});

describe("Took about…", () => {
  it("is kept on the tick and clamped, and counts toward hours", async () => {
    await toggleCompletion("run", TODAY);
    await setTookAbout("run", TODAY, 10_000);
    const [row] = testDb().select().from(taskCompletion).all();
    expect(row?.actualMinutes).toBe(720);
    const hours = (await loadAchievements()).find((a) => a.series === "unitHours" && a.subjectId === "fit");
    expect(hours?.progress).toBe(12);
    expect(testDb().select().from(achievement).all().length).toBeGreaterThan(0);
  });

  it("refuses a day with no tick", async () => {
    await expect(setTookAbout("run", TODAY, 30)).rejects.toThrow();
  });
});
