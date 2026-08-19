/**
 * Web build of the database client. Same exports as
 * [client.ts](client.ts) — `sqlite`, `db`, `openDatabase` — but the
 * connection arrives asynchronously, so `openDatabase()` must resolve
 * before the first query. The startup gate in
 * [_layout.tsx](../app/_layout.tsx) awaits it.
 *
 * ## Why a synchronous open cannot work here
 *
 * Native opens asynchronously too now, but for a different reason (see
 * [client.ts](client.ts): so a failed open reaches the startup gate).
 * On web an asynchronous open is not a choice at all.
 *
 * On web `expo-sqlite` runs SQLite as WebAssembly inside a Web Worker.
 * Every *synchronous* call reaches that worker through a
 * SharedArrayBuffer handshake: the main thread posts the request and
 * then spins on `Atomics` waiting for the answer, because a blocked
 * main thread has no way to yield. That spin gives up after ~1M
 * iterations — measured at ~33ms — and throws "Sync operation timeout".
 *
 * The worker is a *separate Metro bundle* (~380 kB) that must be
 * fetched, parsed, and then instantiate a ~600 kB `wa-sqlite.wasm` and
 * claim an OPFS access-handle pool. Cold, that took ~8.8s against the
 * dev server, and Metro serves the bundle `no-store`, so every reload
 * pays it again. The first synchronous call therefore loses the race
 * every time.
 *
 * ## Why opening asynchronously is enough
 *
 * `openDatabaseAsync` has no spin budget; it waits properly. Opening
 * through it both loads the worker and opens the database, so every
 * synchronous call afterwards is talking to a worker that is already
 * warm and answers in well under the budget.
 *
 * That matters because going async is *not* an option for the queries
 * themselves: drizzle's expo-sqlite driver is sync-only (`prepareSync`,
 * `runSync`, `getAllSync`), so the synchronous path is the only path
 * the app's 13 database modules have. Warming the worker is what makes
 * them work; rewriting callers to `await` would not.
 *
 * ## Why the exports are reassigned rather than proxied
 *
 * `sqlite` and `db` start as placeholders that throw on any use and are
 * replaced by the real instances when the open resolves. ESM live
 * bindings mean every `import { db } from "./client"` sees the
 * replacement, so no consumer changes — and once open, callers hold the
 * genuine drizzle and expo-sqlite objects, with no proxy sitting in
 * front of the private class fields and `entityKind` checks that both
 * libraries rely on internally.
 *
 * The placeholder itself is [notReady](notReady.ts), shared with the
 * native client since both builds now have the same gap to cover.
 */
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseAsync } from "expo-sqlite";

import { notReady } from "./notReady";
import * as schema from "./schema";

/* Structural types taken from the native module so the two builds
 * cannot drift apart. `typeof import(...)` lives entirely in type
 * space and is erased at build time, so client.ts is never bundled
 * for web. */
type NativeSqlite = typeof import("./client").sqlite;
type NativeDb = typeof import("./client").db;

// The filename predates both renames and must not change: it is the
// stored path to the user's data. Renaming it would leave every
// existing database orphaned and open an empty one in its place.
const DATABASE_NAME = "life-strategy.db";

export let sqlite: NativeSqlite = notReady<NativeSqlite>("sqlite");
export let db: NativeDb = notReady<NativeDb>("db");

let opening: Promise<void> | null = null;

/**
 * Opens the database, once. Concurrent callers share the same promise,
 * and callers after it resolves get an already-resolved one, so this is
 * safe to await from anywhere that needs the connection.
 *
 * A failed open clears the memo so a retry can genuinely retry rather
 * than replay the stored rejection.
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
