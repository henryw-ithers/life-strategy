/**
 * Logged activities on a real migrated SQLite: logged with their tags,
 * edited and deleted as one write each, so a failure can't leave an
 * activity stripped of its tags.
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteActivity, logActivity, updateActivity } from "../activities";
import { activity, activityTag } from "../schema";
import { syncTaxonomy } from "../seed";
import { appDb, resetTestDb, testDb } from "./harness";

const clock = vi.hoisted(() => ({ today: "2026-10-26" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => clock.today,
}));

describe("activities", () => {
  beforeEach(async () => {
    resetTestDb();
    await syncTaxonomy(appDb());
  });

  it("logs an activity with at most three tags", async () => {
    await logActivity(clock.today, "Hike", null, "big", [
      "exercise-fitness",
      "nature-surroundings",
      "friendship",
      "hobbies-interests",
    ]);
    const [row] = testDb().select().from(activity).all();
    expect(row?.title).toBe("Hike");
    expect(testDb().select().from(activityTag).all()).toHaveLength(3);
  });

  it("replaces an activity's tags when it's edited", async () => {
    await logActivity(clock.today, "Hike", null, "big", ["exercise-fitness", "friendship"]);
    const [row] = testDb().select().from(activity).all();
    await updateActivity(row!.id, clock.today, "Long hike", "Ridge", "big", ["nature-surroundings"]);
    const tags = testDb().select().from(activityTag).where(eq(activityTag.activityId, row!.id)).all();
    expect(tags.map((t) => t.unitId)).toEqual(["nature-surroundings"]);
    expect(testDb().select().from(activity).all()[0]).toMatchObject({ title: "Long hike", note: "Ridge" });
  });

  it("deletes an activity with its tags", async () => {
    await logActivity(clock.today, "Hike", null, "big", ["exercise-fitness"]);
    const [row] = testDb().select().from(activity).all();
    await deleteActivity(row!.id, clock.today);
    expect(testDb().select().from(activity).all()).toHaveLength(0);
    expect(testDb().select().from(activityTag).all()).toHaveLength(0);
  });
});
