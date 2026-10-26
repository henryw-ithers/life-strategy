/**
 * The taxonomy sync (ADR-0002 §2), which runs on every launch against
 * real data: seeds the six areas and eighteen units, re-applies names
 * as labels, archives a retired default unit rather than deleting it,
 * and never touches a commitment.
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { lifeArea, lifeUnit } from "../schema";
import { syncTaxonomy } from "../seed";
import { resetTestDb, testDb } from "./harness";

vi.mock("../client", async () => (await import("./harness")).mockClient());

/** The test database, as the type the app's helpers take: the same
 *  Drizzle API over better-sqlite3 rather than expo-sqlite. */
const appDb = () => testDb() as unknown as Parameters<typeof syncTaxonomy>[0];

describe("syncTaxonomy", () => {
  beforeEach(() => resetTestDb());

  it("seeds six areas and eighteen units on a fresh database", async () => {
    await syncTaxonomy(appDb());
    expect(testDb().select().from(lifeArea).all()).toHaveLength(6);
    expect(testDb().select().from(lifeUnit).all()).toHaveLength(18);
  });

  it("changes nothing when run again", async () => {
    await syncTaxonomy(appDb());
    const before = testDb().select().from(lifeUnit).all();
    await syncTaxonomy(appDb());
    expect(testDb().select().from(lifeUnit).all()).toEqual(before);
  });

  it("puts a renamed default unit's label back, keeping its id", async () => {
    await syncTaxonomy(appDb());
    const [first] = testDb().select().from(lifeUnit).all();
    testDb().update(lifeUnit).set({ name: "Renamed" }).where(eq(lifeUnit.id, first!.id)).run();
    await syncTaxonomy(appDb());
    const [after] = testDb().select().from(lifeUnit).where(eq(lifeUnit.id, first!.id)).all();
    expect(after?.name).toBe(first!.name);
  });

  it("archives a default unit that left the taxonomy, never deleting it", async () => {
    await syncTaxonomy(appDb());
    testDb()
      .insert(lifeUnit)
      .values({ id: "retired", areaId: "work-money", name: "Retired", sortOrder: 99 })
      .run();
    await syncTaxonomy(appDb());
    const [row] = testDb().select().from(lifeUnit).where(eq(lifeUnit.id, "retired")).all();
    expect(row).toBeDefined();
    expect(row?.archivedAt).not.toBeNull();
  });

  it("never touches a commitment", async () => {
    await syncTaxonomy(appDb());
    testDb()
      .insert(lifeUnit)
      .values({ id: "school", areaId: "work-money", name: "School", sortOrder: 50, isCustom: true })
      .run();
    await syncTaxonomy(appDb());
    const [row] = testDb().select().from(lifeUnit).where(eq(lifeUnit.id, "school")).all();
    expect(row?.archivedAt).toBeNull();
    expect(row?.name).toBe("School");
  });
});
