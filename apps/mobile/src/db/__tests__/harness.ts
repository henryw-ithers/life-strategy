/**
 * A real SQLite for the data layer's tests (Phase 5).
 *
 * The app's vitest runner can't load `./client`, which is React Native
 * (ADR-0013). This opens an in-memory better-sqlite3 database instead,
 * runs every migration in `drizzle/` on it, and hands it to tests in
 * place of the app's connection:
 *
 *     vi.mock("../client", async () => (await import("./harness")).mockClient());
 *     vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
 *
 * Drizzle's better-sqlite3 driver is synchronous like the app's
 * expo-sqlite one, so the modules under test run their real queries.
 * One difference matters: better-sqlite3 refuses a transaction callback
 * that returns a promise, where expo-sqlite commits it after its first
 * statement. New writers use synchronous callbacks, which are atomic on
 * both.
 *
 * better-sqlite3 is a dev dependency only. Nothing here ships.
 */
import * as path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "../schema";

const MIGRATIONS = path.join(__dirname, "..", "..", "..", "drizzle");

function open() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  return { sqlite, db };
}

let current = open();

/** The database the mocked client hands out. */
export function testDb() {
  return current.db;
}

/** A fresh, migrated database for the next test. */
export function resetTestDb(): void {
  current.sqlite.close();
  current = open();
}

/** The module `vi.mock("../client", …)` returns. `db` is a getter so a
 *  reset is seen by every module that imported it. */
export function mockClient() {
  return {
    get db() {
      return current.db;
    },
    get sqlite() {
      return current.sqlite;
    },
    openDatabase: () => Promise.resolve(),
  };
}

/** The test database as the type the app's helpers take (`syncTaxonomy`
 *  and the like): the same Drizzle API over better-sqlite3 rather than
 *  expo-sqlite. */
export const appDb = () => testDb() as unknown as typeof import("../client").db;
