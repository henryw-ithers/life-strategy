/**
 * Erase everything the app has stored, on purpose.
 *
 * Testers need a way back to a clean first run, and a wedged database
 * currently has no recovery path short of deleting the app. This is
 * that path.
 *
 * It clears **rows, not schema**: migrations stay applied, so the
 * database comes back current rather than being rebuilt from scratch.
 * Deleting the SQLite file instead would work, but it would leave the
 * live connection pointing at a file that no longer exists — the app
 * would need a relaunch to be usable again, which a settings action
 * shouldn't require.
 *
 * `__drizzle_migrations` is deliberately untouched. Clearing it would
 * make the migrator replay every migration against a schema that
 * already has them, which fails on the first `CREATE TABLE`.
 */
import { sql } from "drizzle-orm";

import { db, sqlite } from "./client";
import { syncTaxonomy } from "./seed";

/** Every table holding user data, children before parents so the wipe
 *  holds even if foreign keys are being enforced. */
const TABLES_IN_DELETE_ORDER = [
  "activity_tag",
  "activity",
  "task_completion",
  "task_unit",
  "milestone",
  "achievement",
  "calibration_suggestion",
  "contentment_checkin",
  "journal_entry",
  "photo",
  "day_grade",
  "task",
  "goal",
  "unit_weight",
  "rating",
  "snapshot",
  "life_unit",
  "life_area",
  "app_setting",
] as const;

/**
 * Photos are copied into app storage on add, so their files outlive
 * the rows that point at them. Failure here is swallowed: an orphaned
 * image is a much smaller problem than a reset that refuses to finish.
 */
async function deletePhotoFiles(): Promise<void> {
  try {
    const FileSystem = await import("expo-file-system/legacy");
    const dir = `${FileSystem.documentDirectory}photos`;
    const info = await FileSystem.getInfoAsync(dir);
    if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
  } catch {
    // Ignored on purpose — see above.
  }
}

/**
 * Wipes all user data and reseeds the default taxonomy, leaving the
 * app exactly as a fresh install finds it. The caller is responsible
 * for sending the user back to onboarding.
 */
export async function eraseAllData(): Promise<void> {
  await deletePhotoFiles();

  await db.transaction(async (tx) => {
    for (const table of TABLES_IN_DELETE_ORDER) {
      await tx.run(sql.raw(`DELETE FROM ${table}`));
    }
  });

  // Reclaim the pages the delete freed; without this the file keeps
  // its old size and a "wiped" app still reports the same footprint.
  await sqlite.execAsync("VACUUM");

  // The taxonomy is scaffolding, not user data — a fresh install has
  // it, so a reset one must too.
  await syncTaxonomy(db);
}
