/**
 * Priorities as tiers (ADR-0041, Phase 6), on a real migrated SQLite:
 * saving writes a snapshot with tiers, Not now pauses and restores
 * tasks, overrides carry forward and score, and a Not now unit takes no
 * new task.
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pinWeekly } from "../pins";
import {
  clearOverrides,
  loadPriorities,
  savePriorities,
  type Placement,
} from "../priorities";
import {
  lifeArea,
  lifeUnit,
  snapshot,
  task,
  taskUnit,
  unitWeight,
  windowPlacement,
} from "../schema";
import { addTask, latestWeights } from "../tasks";
import { resetTestDb, testDb } from "./harness";

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => "2026-10-19",
}));

const UNITS = ["exercise", "friends", "sleep", "money"] as const;

function seed() {
  const db = testDb();
  db.insert(lifeArea).values({ id: "area", name: "Area", sortOrder: 0 }).run();
  db.insert(lifeUnit)
    .values([
      ...UNITS.map((id, i) => ({ id, areaId: "area", name: id, sortOrder: i })),
      {
        id: "school",
        areaId: "area",
        name: "School",
        sortOrder: 9,
        isCustom: true,
        includeInScoring: false,
        commitmentShare: 100,
      },
    ])
    .run();
}

function addRow(id: string, unitId: string) {
  testDb()
    .insert(task)
    .values({ id, unitId, title: id, pointValue: 0, rankInUnit: 1, timesPerWeek: 3 })
    .run();
  testDb()
    .insert(taskUnit)
    .values({ taskId: id, unitId, rankInUnit: 1, pointValue: 0 })
    .run();
}

const plan = (tiers: Record<string, Placement["tier"]>): Placement[] =>
  UNITS.map((unitId) => ({ unitId, tier: tiers[unitId] ?? "important" }));

const taskRow = (id: string) => testDb().select().from(task).where(eq(task.id, id)).all()[0]!;

beforeEach(() => {
  resetTestDb();
  seed();
});

describe("loadPriorities", () => {
  it("starts a first run with every unit in Important, in the default order", async () => {
    const board = await loadPriorities();
    expect(board.firstRun).toBe(true);
    expect(board.units.map((u) => [u.unitId, u.tier])).toEqual(
      UNITS.map((id) => [id, "important"]),
    );
  });

  it("leaves commitments off: they have their own share of the day", async () => {
    const board = await loadPriorities();
    expect(board.units.some((u) => u.unitId === "school")).toBe(false);
  });
});

describe("savePriorities", () => {
  it("writes the tiers and one snapshot with each unit's tier and recommended weight", async () => {
    await savePriorities(plan({ exercise: "top", money: "notNow" }), new Map());
    const units = testDb().select().from(lifeUnit).all();
    expect(units.find((u) => u.id === "exercise")).toMatchObject({ tier: "top", tierOrder: 0 });
    expect(units.find((u) => u.id === "money")).toMatchObject({
      tier: "notNow",
      includeInScoring: false,
    });
    expect(testDb().select().from(snapshot).all()).toHaveLength(1);
    const rows = testDb().select().from(unitWeight).all();
    expect(rows.find((r) => r.unitId === "exercise")).toMatchObject({ tier: "top" });
    expect(rows.find((r) => r.unitId === "money")).toMatchObject({ tier: "notNow", derived: 0 });

    const board = await loadPriorities();
    expect(board.firstRun).toBe(false);
    expect(board.units[0]).toMatchObject({ unitId: "exercise", tier: "top" });
  });

  it("refuses a plan with every unit in Not now", async () => {
    await expect(
      savePriorities(
        UNITS.map((unitId) => ({ unitId, tier: "notNow" as const })),
        new Map(),
      ),
    ).rejects.toThrow("Keep at least one unit in your plan.");
    expect(testDb().select().from(snapshot).all()).toEqual([]);
  });

  it("pauses a Not now unit's tasks and their pins, and restores the tasks without pins", async () => {
    await savePriorities(plan({}), new Map());
    addRow("run", "exercise");
    await pinWeekly("run", [1], "2026-10-19", 540, "window");
    expect(testDb().select().from(windowPlacement).all()).toHaveLength(1);

    await savePriorities(plan({ exercise: "notNow" }), new Map());
    expect(taskRow("run")).toMatchObject({ active: false, pausedForNotNow: true });
    expect(taskRow("run").archivedAt).not.toBeNull();
    expect(testDb().select().from(windowPlacement).all()).toEqual([]);

    await savePriorities(plan({ exercise: "top" }), new Map());
    expect(taskRow("run")).toMatchObject({ active: true, pausedForNotNow: false, archivedAt: null });
    expect(testDb().select().from(windowPlacement).all()).toEqual([]);
  });

  it("doesn't restore a task you archived yourself", async () => {
    await savePriorities(plan({}), new Map());
    addRow("old", "exercise");
    testDb().update(task).set({ active: false, archivedAt: "2026-10-01" }).where(eq(task.id, "old")).run();
    await savePriorities(plan({ exercise: "notNow" }), new Map());
    await savePriorities(plan({ exercise: "top" }), new Map());
    expect(taskRow("old")).toMatchObject({ active: false, archivedAt: "2026-10-01" });
  });

  it("scores with your overrides, adding to 100, and keeps the recommended weight beside them", async () => {
    await savePriorities(plan({ exercise: "top" }), new Map([["money", 40]]));
    const weights = latestWeights(testDb() as never);
    expect(weights.get("money")).toBe(40);
    expect([...weights.values()].reduce((a, w) => a + w, 0)).toBe(100);
    const money = (await loadPriorities()).units.find((u) => u.unitId === "money")!;
    expect(money.override).toBe(40);
    expect(money.recommended).not.toBe(40);
    expect(money.weight).toBe(40);
  });

  it("carries overrides forward and lists those whose recommended weight changed", async () => {
    await savePriorities(plan({}), new Map([["money", 40]]));
    const { review } = await savePriorities(plan({ exercise: "top" }), new Map([["money", 40]]));
    expect(review.map((r) => r.unitId)).toEqual(["money"]);
    expect(review[0]!.recommendedBefore).not.toBe(review[0]!.recommendedNow);

    await clearOverrides(["money"]);
    expect((await loadPriorities()).units.find((u) => u.unitId === "money")!.override).toBeNull();
    expect(latestWeights(testDb() as never).get("money")).not.toBe(40);
  });

  it("refuses overrides that leave no room for the other units", async () => {
    await expect(
      savePriorities(plan({}), new Map([["money", 99], ["sleep", 50]])),
    ).rejects.toThrow("no room");
  });
});

describe("a Not now unit", () => {
  it("takes no new task", async () => {
    await savePriorities(plan({ sleep: "notNow" }), new Map());
    await expect(addTask(["sleep"], "Nap", 3)).rejects.toThrow("Move it up");
    expect(await addTask(["exercise"], "Run", 3)).not.toBeNull();
  });
});
