/**
 * Native build of the database client. Same exports as
 * [client.web.ts](client.web.ts) — `sqlite`, `db`, `openDatabase` —
 * and now the same contract: the connection arrives asynchronously and
 * `openDatabase()` must resolve before the first query.
 *
 * ## Why the open moved out of module scope (2026-08-19)
 *
 * This file used to call `openDatabaseSync` at module scope, so the
 * database opened during *import* — before React existed, and
 * therefore before any error boundary could see it.
 *
 * That placement silently disabled the one screen written for this
 * failure. [_layout.tsx](../app/_layout.tsx) wraps `openDatabase()` in
 * a `.catch()` that renders `StartupFailure` ("Couldn't open your
 * data"), but on native `openDatabase()` was `Promise.resolve()` — the
 * real open had already happened, so the catch was unreachable code.
 * A database that would not open (a journal left inconsistent by a
 * process killed mid-write is the likely way in) threw during bundle
 * evaluation: no screen, no problem-log entry, no route back except
 * deleting the app and losing the data with it.
 *
 * Opening here puts that failure inside the promise the gate already
 * awaits, which turns a silent termination into a message.
 *
 * ## What stays synchronous
 *
 * Only the open is async. Drizzle's expo-sqlite driver is sync-only
 * (`prepareSync`, `runSync`, `getAllSync`), so every query in the app's
 * database modules runs exactly as before. On native the connection is
 * in-process, so there is no worker to warm and nothing else changes.
 *
 * ## Why the exports are reassigned rather than proxied
 *
 * `sqlite` and `db` start as placeholders that throw on any use and
 * are replaced by the real instances when the open resolves. ESM live
 * bindings mean every `import { db } from "./client"` sees the
 * replacement, so no consumer changes — and once open, callers hold
 * the genuine drizzle and expo-sqlite objects, with no proxy sitting
 * in front of the private class fields and `entityKind` checks that
 * both libraries rely on internally.
 */
import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { notReady } from "./notReady";
import * as schema from "./schema";

/** Precisely what `drizzle()` returns, so the type every caller has
 *  always seen is unchanged by the move. */
type Database = ExpoSQLiteDatabase<typeof schema> & { $client: SQLiteDatabase };

// The filename predates both renames and must not change: it is the
// on-device path to the user's data. Renaming it would leave every
// existing database orphaned and open an empty one in its place.
const DATABASE_NAME = "life-strategy.db";

export let sqlite: SQLiteDatabase = notReady<SQLiteDatabase>("sqlite");
export let db: Database = notReady<Database>("db");

let opening: Promise<void> | null = null;

/**
 * Opens the database, once. Concurrent callers share the same promise,
 * and callers after it resolves get an already-resolved one, so this is
 * safe to await from anywhere that needs the connection.
 *
 * A failed open clears the memo so a retry genuinely retries rather
 * than replaying the stored rejection — which is what makes the
 * "closing and reopening usually fixes this" line on `StartupFailure`
 * true rather than hopeful.
 */
export function openDatabase(): Promise<void> {
  opening ??= openDatabaseAsync(DATABASE_NAME, { enableChangeListener: true })
    .then((connection) => {
      sqlite = connection;
      db = drizzle(connection, { schema });
    })
    .catch((error: unknown) => {
      opening = null;
      throw error;
    });
  return opening;
}
