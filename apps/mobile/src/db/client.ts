import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

// The filename predates the Glide rename and must not change: it is the
// on-device path to the user's data. Renaming it would leave every
// existing database orphaned and open an empty one in its place.
export const sqlite = openDatabaseSync("life-strategy.db", {
  enableChangeListener: true,
});

export const db = drizzle(sqlite, { schema });
