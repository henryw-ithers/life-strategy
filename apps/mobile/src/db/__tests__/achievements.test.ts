/**
 * Achievements on a real migrated SQLite (ADR-0047): ranks awarded
 * once and never taken back, progress toward the next, the celebration
 * shown once, the month review's list, and "Took about…".
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  awardAchievements,
  badgesByUnit,
  loadAchievements,
  loadUncelebrated,
  markCelebrated,
  takeUncelebrated,
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

/** The unit's completions: per-task series are retired (ADR-0050), so
 *  the run's ticks count for Fitness. Bronze is 50. */
const runCompletions = async () =>
  (await loadAchievements()).find((a) => a.series === "unitCompletions" && a.subjectId === "fit")!;

beforeEach(() => {
  resetTestDb();
  clock.today = TODAY;
  seed();
});

describe("awarding", () => {
  it("awards each rank reached once, dated today", async () => {
    ticks(50);
    const fresh = await awardAchievements();
    expect(fresh.filter((a) => a.series === "unitCompletions")).toEqual([
      expect.objectContaining({ subjectId: "fit", subjectName: "Fitness", rank: "bronze", threshold: 50, earnedOn: TODAY }),
    ]);
    expect(await awardAchievements()).toEqual([]);
  });

  it("never takes a rank back when the tick that earned it is undone", async () => {
    ticks(49);
    await toggleCompletion("run", TODAY);
    expect(
      (await awardAchievements()).some((a) => a.rank === "bronze" && a.series === "unitCompletions"),
    ).toBe(true);
    await toggleCompletion("run", TODAY);
    const item = await runCompletions();
    expect(item.earned.map((e) => e.rank)).toEqual(["bronze"]);
    // Progress is honest: 49 toward Silver's 150.
    expect(item).toMatchObject({ progress: 49, next: { rank: "silver", threshold: 150 } });
  });

  it("shows a locked one's progress", async () => {
    ticks(7);
    expect(await runCompletions()).toMatchObject({ earned: [], progress: 7, next: { rank: "bronze", threshold: 50 } });
  });

  it("keeps a retired series' ranks for the Log, off the screen (ADR-0050)", async () => {
    testDb()
      .insert(achievement)
      .values({
        id: "old",
        series: "taskCompletions",
        subjectKind: "task",
        subjectId: "run",
        subjectName: "Run",
        rank: "bronze",
        threshold: 20,
        earnedOn: "2026-10-10",
        celebratedAt: "2026-10-10T00:00:00.000Z",
      })
      .run();
    expect((await loadAchievements()).some((a) => a.series === "taskCompletions")).toBe(false);
    const october = (await loadLog()).find((m) => m.month === "2026-10")!;
    expect(october.earned).toContain("Bronze · Run · 20 completions");
  });

  it("gives the unit its highest rank, and its longest run going now", async () => {
    ticks(20);
    const badges = badgesByUnit(await loadAchievements());
    // Twenty days in a row to yesterday: the unit's days beat its weeks.
    expect(badges.get("fit")).toEqual({ rank: "bronze", streak: { length: 20, per: "day" } });
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

  it("is handed out once, even if the card is never put away", async () => {
    ticks(20);
    await awardAchievements();
    const first = await takeUncelebrated(new Set());
    expect(first.length).toBeGreaterThan(0);
    // The next open: nothing new was earned, so nothing is shown.
    await awardAchievements();
    expect(await takeUncelebrated(new Set())).toEqual([]);
  });

  it("marks skipped series without returning them", async () => {
    ticks(20);
    await awardAchievements();
    const all = await loadUncelebrated();
    const skipped = new Set(all.map((a) => a.series));
    expect(await takeUncelebrated(skipped)).toEqual([]);
    expect(await loadUncelebrated()).toEqual([]);
  });
});

describe("the month review", () => {
  it("lists what was earned that month", async () => {
    ticks(50);
    await awardAchievements();
    const october = (await loadLog()).find((m) => m.month === "2026-10")!;
    expect(october.earned).toContain("Bronze · Fitness · 50 completions");
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
