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

import { clearLog } from "../lib/problemLog";
import { db, sqlite } from "./client";
import { syncTaxonomy } from "./seed";

/**
 * Every table holding user data, children before parents so the wipe
 * holds even if foreign keys are being enforced.
 *
 * **This list must name every table in `schema.ts`.** It fell three
 * behind before anyone noticed (fixed 2026-09-11): `goal_progress`,
 * `task_completion_tag` and `planned_occurrence` were all missing, so
 * `eraseAllData` left their rows in place and the ordering promise
 * above was already false. A table added without a line here does not
 * fail — it silently survives a reset, which is the worst shape a bug
 * of this kind can take.
 */
const TABLES_IN_DELETE_ORDER = [
  "activity_tag",
  "activity",
  // Before `pool` and `task`, both of which it references.
  "pool_member",
  // Before `task`, which it references.
  "pool",
  // Before `task_completion`, which it references.
  "task_completion_tag",
  "task_completion",
  "task_unit",
  // Before `task`, which it references.
  "planned_occurrence",
  // Before `milestone` and `goal`, both of which it references.
  "achievement",
  "milestone",
  // Before `goal`, which it references.
  "goal_progress",
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

  // The problem log lives outside the database (ADR-0013 decision 2),
  // so nothing below reaches it. Erase all data means all data, and a
  // diagnostics file that outlived the one destructive action in the
  // app would be a lie in the place that can least afford one.
  clearLog();

  await db.transaction(async (tx) => {
    // `task` and `goal` reference each other — `task.goal_id` one way,
    // `goal.autocount_task_id` (ADR-0015 §2) the other — so no ordering
    // of the list can satisfy both. Nulling the optional side first
    // breaks the cycle; the rows are about to go anyway.
    await tx.run(sql.raw(`UPDATE goal SET autocount_task_id = NULL`));

    for (const table of TABLES_IN_DELETE_ORDER) {
      // `life_unit` references itself (`parent_unit_id`, ADR-0029), so
      // a single bulk delete can trip the constraint mid-statement with
      // foreign keys on: a parent row may go before its sub-commitment.
      // Clearing the children first makes the order hold inside the
      // table as well as between tables.
      if (table === "life_unit") {
        await tx.run(
          sql.raw(`DELETE FROM life_unit WHERE parent_unit_id IS NOT NULL`),
        );
      }
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
