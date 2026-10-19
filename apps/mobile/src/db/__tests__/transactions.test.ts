/**
 * The data layer's transactions are atomic.
 *
 * drizzle's expo-sqlite driver commits as soon as a transaction callback
 * returns, so an async callback commits before its first awaited
 * statement and nothing after it rolls back. Every writer now uses a
 * synchronous callback. better-sqlite3 refuses a callback that returns
 * a promise, so each writer passing here is synchronous, and a trigger
 * that fails a late statement shows the earlier ones are undone.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCommitment,
  createPool,
  deleteCommitment,
  setUsesSubCommitments,
  updateCommitment,
  updatePool,
} from "../commitmentWrites";
import { applyPriorityOrder, loadRankingBoard } from "../ranking";
import {
  appSetting,
  lifeArea,
  lifeUnit,
  pool,
  poolMember,
  rating,
  snapshot,
  task,
  taskUnit,
  unitWeight,
} from "../schema";
import { archiveTask, restoreTask, setTaskPlanning } from "../tasks";
import { resetTestDb, testDb } from "./harness";

const recache = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
// Re-scoring cached days loads whole days, which this file isn't about.
vi.mock("../dayGrades", () => ({ recacheAllDayScores: recache }));

/** Make every `op` on `table` fail, the way a full disk or a broken
 *  constraint would part way through a write. `when` narrows it to
 *  some rows, as SQL on `NEW` or `OLD`. */
function failOn(table: string, op: "INSERT" | "UPDATE" | "DELETE", when?: string) {
  testDb().run(
    sql.raw(
      `CREATE TRIGGER fail_${table}_${op} BEFORE ${op} ON ${table} ` +
        (when ? `WHEN ${when} ` : "") +
        `BEGIN SELECT RAISE(ABORT, 'injected failure'); END`,
    ),
  );
}

/** Fail only the grades-stale mark. */
const failStaleMark = () => failOn("app_setting", "INSERT", "NEW.key = 'grades.stale'");

function gradesStale(): string | undefined {
  return testDb()
    .select()
    .from(appSetting)
    .all()
    .find((r) => r.key === "grades.stale")?.value;
}

function taskRow(id: string) {
  return testDb().select().from(task).all().find((t) => t.id === id);
}

/** Two life units with a snapshot behind them, and three tasks. */
function seedPlan() {
  const db = testDb();
  db.insert(lifeArea).values({ id: "area", name: "Area", sortOrder: 0 }).run();
  db.insert(lifeUnit)
    .values([
      // Weights come from tiers (ADR-0041).
      { id: "fitness", areaId: "area", name: "Fitness", sortOrder: 0, tier: "top", tierOrder: 0 },
      { id: "friends", areaId: "area", name: "Friends", sortOrder: 1, tier: "important", tierOrder: 0 },
    ])
    .run();
  db.insert(snapshot).values({ id: "snap", takenAt: "2026-10-01T00:00:00Z", formulaVersion: 10 }).run();
  db.insert(rating)
    .values([
      { snapshotId: "snap", unitId: "fitness", importance: 9, satisfaction: 5 },
      { snapshotId: "snap", unitId: "friends", importance: 6, satisfaction: 5 },
    ])
    .run();
  db.insert(unitWeight)
    .values([
      { snapshotId: "snap", unitId: "fitness", derived: 60 },
      { snapshotId: "snap", unitId: "friends", derived: 40 },
    ])
    .run();
  const t = (id: string, unitId: string, rank: number) => ({
    id,
    unitId,
    title: id,
    timesPerWeek: 3,
    pointValue: 0,
    rankInUnit: rank,
  });
  db.insert(task).values([t("gym", "fitness", 1), t("run", "fitness", 2), t("call", "friends", 1)]).run();
  db.insert(taskUnit)
    .values([
      { taskId: "gym", unitId: "fitness", rankInUnit: 1, pointValue: 0 },
      { taskId: "run", unitId: "fitness", rankInUnit: 2, pointValue: 0 },
      { taskId: "call", unitId: "friends", rankInUnit: 1, pointValue: 0 },
    ])
    .run();
}

/** School, split into COMP2521, with an essay in a "Do N of these"
 *  pool beside a life task, and a second pool cued to the essay. */
function seedCommitment() {
  seedPlan();
  const db = testDb();
  db.insert(lifeUnit)
    .values([
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
  db.insert(task)
    .values({ id: "essay", unitId: "comp", title: "Essay", timesPerWeek: 2, pointValue: 0, rankInUnit: 1 })
    .run();
  db.insert(taskUnit).values({ taskId: "essay", unitId: "comp", rankInUnit: 1, pointValue: 0 }).run();
  db.insert(pool)
    .values([
      { id: "p1", localDate: "2026-10-19", partOfDay: "morning", plannedCount: 1 },
      { id: "p2", localDate: "2026-10-19", afterTaskId: "essay", plannedCount: 1 },
    ])
    .run();
  db.insert(poolMember)
    .values([
      { poolId: "p1", taskId: "essay", sortOrder: 0 },
      { poolId: "p1", taskId: "gym", sortOrder: 1 },
      { poolId: "p2", taskId: "run", sortOrder: 0 },
    ])
    .run();
}

beforeEach(() => {
  resetTestDb();
  recache.mockClear();
});

// Types can't catch an async callback, and the tests below only cover
// the writers they call, so every module is checked for one.
it("no module in db/ passes an async callback to a transaction", () => {
  const dir = path.join(__dirname, "..");
  const offenders = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .flatMap((f) =>
      fs
        .readFileSync(path.join(dir, f), "utf8")
        .split("\n")
        .map((line, i) => ({ where: `${f}:${i + 1}`, line }))
        .filter(({ line }) => /\.transaction\(\s*async\b/.test(line))
        .map(({ where }) => where),
    );
  expect(offenders).toEqual([]);
});

describe("archiveTask", () => {
  it("archives the task, reprices the plan and marks grades stale", async () => {
    seedPlan();
    await archiveTask("gym");

    const gym = taskRow("gym");
    expect(gym?.active).toBe(false);
    expect(gym?.archivedAt).not.toBeNull();
    // The pricing pass ran in the same transaction: run is now the only
    // fitness task, and every live task has a weight.
    expect(taskRow("run")?.pointValue).toBeGreaterThan(0);
    expect(taskRow("call")?.pointValue).toBeGreaterThan(0);
    expect(gradesStale()).toBe("1");
  });

  it("rolls the archive back when the pricing pass fails", async () => {
    seedPlan();
    // Marking grades stale is the last statement of the pricing pass.
    failOn("app_setting", "INSERT");

    await expect(archiveTask("gym")).rejects.toThrow(/injected failure/);

    const gym = taskRow("gym");
    expect(gym?.active).toBe(true);
    expect(gym?.archivedAt).toBeNull();
    expect(taskRow("run")?.pointValue).toBe(0);
    expect(gradesStale()).toBeUndefined();
  });

  it("restoreTask undoes it", async () => {
    seedPlan();
    await archiveTask("gym");
    await restoreTask("gym");
    expect(taskRow("gym")?.active).toBe(true);
    expect(taskRow("gym")?.archivedAt).toBeNull();
  });
});

describe("deleteCommitment", () => {
  it("removes the commitment, its parts, their tasks and their pools", async () => {
    seedCommitment();
    const removed = await deleteCommitment("school");

    expect(removed).toEqual({ units: 2, tasks: 1, pools: 1 });
    const db = testDb();
    const unitIds = db.select().from(lifeUnit).all().map((u) => u.id);
    expect(unitIds).not.toContain("school");
    expect(unitIds).not.toContain("comp");
    expect(taskRow("essay")).toBeUndefined();
    // The pool holding the essay is gone with its members; the one cued
    // to it stays, as a part-of-day window.
    expect(db.select().from(pool).all().map((p) => p.id)).toEqual(["p2"]);
    expect(db.select().from(pool).all()[0]?.afterTaskId).toBeNull();
    expect(db.select().from(poolMember).all().map((m) => m.poolId)).toEqual(["p2"]);
    // The life task that shared the deleted pool survives.
    expect(taskRow("gym")).toBeDefined();
  });

  it("rolls everything back when deleting the units fails", async () => {
    seedCommitment();
    // Units are deleted after the pools and tasks.
    failOn("life_unit", "DELETE");

    await expect(deleteCommitment("school")).rejects.toThrow(/injected failure/);

    const db = testDb();
    expect(taskRow("essay")).toBeDefined();
    expect(db.select().from(taskUnit).all().some((m) => m.taskId === "essay")).toBe(true);
    expect(db.select().from(pool).all().map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect(db.select().from(pool).all().find((p) => p.id === "p2")?.afterTaskId).toBe("essay");
    expect(db.select().from(poolMember).all()).toHaveLength(3);
  });

  it("deletes nothing when the stale mark fails", async () => {
    seedCommitment();
    failStaleMark();

    await expect(deleteCommitment("school")).rejects.toThrow(/injected failure/);

    const unitIds = testDb().select().from(lifeUnit).all().map((u) => u.id);
    expect(unitIds).toEqual(expect.arrayContaining(["school", "comp"]));
    expect(taskRow("essay")).toBeDefined();
    expect(testDb().select().from(pool).all()).toHaveLength(2);
  });

  it("puts the last sub-commitment's work back, or nothing, with the mark", async () => {
    seedCommitment();
    failStaleMark();
    await expect(deleteCommitment("comp")).rejects.toThrow(/injected failure/);
    expect(taskRow("essay")?.unitId).toBe("comp");

    testDb().run(sql.raw("DROP TRIGGER fail_app_setting_INSERT"));
    expect(await deleteCommitment("comp")).toEqual({ units: 1, tasks: 0, pools: 0 });
    expect(taskRow("essay")?.unitId).toBe("school");
    expect(gradesStale()).toBe("1");
  });
});

describe("setUsesSubCommitments", () => {
  it("folds the work up and splits it back out where it came from", async () => {
    seedCommitment();
    await setUsesSubCommitments("school", false);
    expect(taskRow("essay")?.unitId).toBe("school");
    expect(taskRow("essay")?.movedFromUnitId).toBe("comp");
    const comp = () => testDb().select().from(lifeUnit).all().find((u) => u.id === "comp");
    expect(comp()?.archivedAt).not.toBeNull();

    await setUsesSubCommitments("school", true);
    expect(taskRow("essay")?.unitId).toBe("comp");
    expect(taskRow("essay")?.movedFromUnitId).toBeNull();
    expect(comp()?.archivedAt).toBeNull();
  });

  it("leaves the work where it was when folding fails part way", async () => {
    seedCommitment();
    // The tasks move first; archiving the sub-commitments comes after.
    failOn("life_unit", "UPDATE");

    await expect(setUsesSubCommitments("school", false)).rejects.toThrow(/injected failure/);

    expect(taskRow("essay")?.unitId).toBe("comp");
    expect(taskRow("essay")?.movedFromUnitId).toBeNull();
    const memberships = testDb().select().from(taskUnit).all().filter((m) => m.taskId === "essay");
    expect(memberships.map((m) => m.unitId)).toEqual(["comp"]);
  });
});

describe("updatePool", () => {
  it("refuses a task already pooled in the same window, changing nothing", async () => {
    seedCommitment();
    testDb()
      .insert(pool)
      .values({ id: "p3", localDate: "2026-10-19", partOfDay: "morning", plannedCount: 1 })
      .run();
    testDb().insert(poolMember).values({ poolId: "p3", taskId: "call", sortOrder: 0 }).run();

    // gym is already in p1, the other morning pool.
    await expect(updatePool("p3", { taskIds: ["call", "gym"] })).rejects.toThrow();

    const members = testDb().select().from(poolMember).all().filter((m) => m.poolId === "p3");
    expect(members.map((m) => m.taskId)).toEqual(["call"]);
  });
});

describe("applyPriorityOrder", () => {
  it("sets tiers from the order and reprices the plan", async () => {
    seedPlan();
    const board = await loadRankingBoard();
    if (!board) throw new Error("no board");

    await applyPriorityOrder(board, ["friends", "fitness"]);

    const units = testDb().select().from(lifeUnit).all();
    expect(units.find((u) => u.id === "friends")?.tier).toBe("top");
    expect(units.find((u) => u.id === "fitness")?.tier).toBe("important");
    expect(testDb().select().from(unitWeight).all().every((w) => w.override === null)).toBe(true);
    expect(taskRow("call")?.pointValue).toBeGreaterThan(0);
    expect(recache).toHaveBeenCalledOnce();
  });

  it("rolls the tiers back when the pricing pass fails", async () => {
    seedPlan();
    const board = await loadRankingBoard();
    if (!board) throw new Error("no board");
    failOn("app_setting", "INSERT");

    await expect(applyPriorityOrder(board, ["friends", "fitness"])).rejects.toThrow(
      /injected failure/,
    );

    expect(testDb().select().from(lifeUnit).all().find((u) => u.id === "fitness")?.tier).toBe("top");
    expect(taskRow("call")?.pointValue).toBe(0);
    // Nothing is re-scored from a plan that was never saved.
    expect(recache).not.toHaveBeenCalled();
  });
});

describe("grades are marked stale in the same transaction as the write", () => {
  it("marks them when the write lands", async () => {
    seedPlan();
    await setTaskPlanning("gym", "1,3", "morning");
    expect(taskRow("gym")?.plannedWeekdays).toBe("1,3");
    expect(gradesStale()).toBe("1");
  });

  it("a task's days roll back when the mark fails", async () => {
    seedPlan();
    failStaleMark();
    await expect(setTaskPlanning("gym", "1,3", "morning")).rejects.toThrow(/injected failure/);
    expect(taskRow("gym")?.plannedWeekdays).toBeNull();
  });

  it("a new pool rolls back when the mark fails", async () => {
    seedPlan();
    failStaleMark();
    await expect(
      createPool({ localDate: "2026-10-19", taskIds: ["gym", "call"], partOfDay: "evening" }),
    ).rejects.toThrow(/injected failure/);
    expect(testDb().select().from(pool).all()).toEqual([]);
    expect(testDb().select().from(poolMember).all()).toEqual([]);
  });

  it("a renamed commitment rolls back when the mark fails", async () => {
    seedCommitment();
    failStaleMark();
    await expect(updateCommitment("school", { name: "Uni" })).rejects.toThrow(/injected failure/);
    expect(testDb().select().from(lifeUnit).all().find((u) => u.id === "school")?.name).toBe("School");
  });

  it("a change to nothing marks nothing", async () => {
    seedCommitment();
    await updateCommitment("school", {});
    expect(gradesStale()).toBeUndefined();
  });
});

describe("createCommitment", () => {
  function seedCommitments(n: number) {
    const db = testDb();
    db.insert(lifeArea).values({ id: "work-money", name: "Work", sortOrder: 0 }).run();
    for (let i = 0; i < n; i++) {
      db.insert(lifeUnit)
        .values({
          id: `c${i}`,
          areaId: "work-money",
          name: `C${i}`,
          sortOrder: i,
          isCustom: true,
          includeInScoring: false,
          commitmentShare: 100 / n,
        })
        .run();
    }
  }
  const liveCommitments = () =>
    testDb()
      .select()
      .from(lifeUnit)
      .all()
      .filter((u) => u.isCustom && u.parentUnitId === null && u.archivedAt === null);

  it("refuses a fourth", async () => {
    seedCommitments(3);
    await expect(createCommitment({ name: "Gym club" })).rejects.toThrow(/At most three/);
    expect(liveCommitments()).toHaveLength(3);
  });

  it("lets only one of two quick taps take the last place", async () => {
    seedCommitments(2);
    const results = await Promise.allSettled([
      createCommitment({ name: "Gym club" }),
      createCommitment({ name: "Gym club" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(liveCommitments()).toHaveLength(3);
  });

  it("starts a split one with its General, and marks grades stale", async () => {
    seedCommitments(0);
    const id = await createCommitment({ name: "School", usesSubCommitments: true });
    const general = testDb().select().from(lifeUnit).all().filter((u) => u.parentUnitId === id);
    expect(general).toHaveLength(1);
    expect(gradesStale()).toBe("1");
  });
});
