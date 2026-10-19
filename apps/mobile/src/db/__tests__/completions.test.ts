/**
 * One completion per task per day (ADR-0004), on a real migrated
 * SQLite, including when two writes overlap.
 *
 * A tick prices itself with `loadDay` before it inserts, so two quick
 * taps used to both find no completion and both insert one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCompletionFraction, toggleCompletion } from "../completions";
import { lifeArea, lifeUnit, task, taskCompletion, taskUnit } from "../schema";
import { setTiersFromOrder } from "../tasks";
import { resetTestDb, testDb } from "./harness";

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => MON,
}));

/** Monday 19 October 2026. */
const MON = "2026-10-19";

function addTask(row: Partial<typeof task.$inferInsert> & { id: string; unitId: string }) {
  testDb()
    .insert(task)
    .values({ title: row.id, pointValue: 0, rankInUnit: 1, timesPerWeek: 1, ...row })
    .run();
  testDb()
    .insert(taskUnit)
    .values({ taskId: row.id, unitId: row.unitId, rankInUnit: 1, pointValue: 0 })
    .run();
}

const completions = () => testDb().select().from(taskCompletion).all();

beforeEach(() => {
  resetTestDb();
  const db = testDb();
  db.insert(lifeArea).values({ id: "area", name: "Area", sortOrder: 0 }).run();
  db.insert(lifeUnit).values({ id: "fitness", areaId: "area", name: "Fitness", sortOrder: 0 }).run();
  addTask({ id: "gym", unitId: "fitness", plannedWeekdays: "1", allowsPartial: true });
  db.transaction((tx) => setTiersFromOrder(tx as never, ["fitness"]));
});

describe("toggleCompletion", () => {
  it("ticks, then unticks", async () => {
    await toggleCompletion("gym", MON);
    expect(completions()).toHaveLength(1);
    expect(completions()[0]?.pointsEarned).toBeGreaterThan(0);

    await toggleCompletion("gym", MON);
    expect(completions()).toEqual([]);
  });

  it("leaves one completion when two taps overlap", async () => {
    await Promise.all([toggleCompletion("gym", MON), toggleCompletion("gym", MON)]);
    expect(completions()).toHaveLength(1);
  });
});

describe("setCompletionFraction", () => {
  it("replaces the day's fraction rather than adding a second row", async () => {
    await setCompletionFraction("gym", MON, 0.25);
    await setCompletionFraction("gym", MON, 0.5);
    expect(completions().map((c) => c.fraction)).toEqual([0.5]);
  });

  it("leaves one completion when two picks overlap", async () => {
    await Promise.all([
      setCompletionFraction("gym", MON, 0.25),
      setCompletionFraction("gym", MON, 0.5),
    ]);
    expect(completions()).toHaveLength(1);
  });
});
