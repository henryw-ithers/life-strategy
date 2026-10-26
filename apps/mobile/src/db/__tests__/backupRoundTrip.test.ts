/**
 * A backup of a real database comes back whole (ADR-0046). The format's
 * own tests use a stand-in image; this one writes the migrated, filled
 * test database through `writeBackup`, reads it back, opens the image,
 * and checks the rows and SQLite's own integrity check.
 */
import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";

import { readBackup, writeBackup } from "@glide/backup";

import journal from "../../../drizzle/meta/_journal.json";
import { dayGrade } from "../schema";
import { syncTaxonomy } from "../seed";
import { resetTestDb, testDb } from "./harness";

vi.mock("../client", async () => (await import("./harness")).mockClient());

const appDb = () => testDb() as unknown as Parameters<typeof syncTaxonomy>[0];

describe("a backup round trip", () => {
  it("brings back every row of a migrated, filled database", async () => {
    resetTestDb();
    await syncTaxonomy(appDb());
    testDb().insert(dayGrade).values({ localDate: "2026-10-20", pointsEarned: 63, pointsPossible: 100 }).run();
    const sqlite = testDb().$client;
    const image = new Uint8Array(sqlite.serialize());

    const file = writeBackup({
      payload: image,
      meta: {
        appVersion: "test",
        migrationCount: journal.entries.length,
        createdAt: "2026-10-26T00:00:00.000Z",
      },
    });
    const opened = readBackup(file);
    expect(opened.meta.migrationCount).toBe(journal.entries.length);

    const restored = new Database(Buffer.from(opened.payload));
    try {
      expect(restored.pragma("integrity_check", { simple: true })).toBe("ok");
      expect(restored.prepare("select count(*) as n from life_unit").get()).toEqual({ n: 18 });
      expect(
        restored.prepare("select points_earned from day_grade where local_date = ?").get("2026-10-20"),
      ).toEqual({ points_earned: 63 });
    } finally {
      restored.close();
    }
  });
});
