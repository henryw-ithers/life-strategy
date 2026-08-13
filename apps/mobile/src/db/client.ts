import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

// The filename predates both renames and must not change: it is the
// on-device path to the user's data. Renaming it would leave every
// existing database orphaned and open an empty one in its place.
export const sqlite = openDatabaseSync("life-strategy.db", {
  enableChangeListener: true,
});

export const db = drizzle(sqlite, { schema });

/**
 * Native SQLite is in-process, so the connection above already exists
 * by the time anything can call this — there is nothing to wait for.
 *
 * It exists so the startup gate in `app/_layout.tsx` can be written
 * once for both platforms. Web cannot open synchronously at all, and
 * does the real work in [client.web.ts](client.web.ts).
 */
export function openDatabase(): Promise<void> {
  return Promise.resolve();
}
