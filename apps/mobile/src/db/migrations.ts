/**
 * One-time data fixups that can't be expressed as schema migrations.
 *
 * Drizzle's forward-only migrations (ADR-0002) handle structure. This
 * handles the cases where a *decision* changed the meaning of data
 * already on disk — the rows are structurally fine, they just mean
 * something different now. Each fixup is guarded by an `app_setting`
 * flag so it runs exactly once per device, and each is written to be
 * harmless if it somehow runs twice.
 */
import { addDays, weekStart } from "@glide/scoring";
import { eq } from "drizzle-orm";

import { db } from "./client";
import { contentmentCheckin, task, taskUnit } from "./schema";
import { getSetting, setSetting } from "./settings";

const KEY_SUNDAY_WEEKS = "migration.sundayWeeks";
const KEY_TASK_UNITS = "migration.taskUnits";

/**
 * ADR-0004 §1 amendment (2026-07-27): weeks moved from Monday-first to
 * Sunday-first. `contentment_checkin` rows are keyed by the week they
 * describe, so every existing key is a Monday that no longer starts a
 * week — `loadCheckinStatus` would read those weeks as unanswered and
 * `loadContentmentSamples` would orphan them from their grades.
 *
 * Each Monday key moves back one day to the Sunday that now opens the
 * week it sat in. Six of the seven days are the same days either way,
 * which is the closest correct mapping available; nothing is lost and
 * no score is altered.
 */
export async function migrateToSundayWeeks(): Promise<void> {
  if ((await getSetting(KEY_SUNDAY_WEEKS)) === "done") return;

  const rows = await db.select().from(contentmentCheckin);
  for (const row of rows) {
    // Already Sunday-aligned (a fresh install, or a re-run): leave it.
    if (weekStart(row.weekStartDate) === row.weekStartDate) continue;
    await db
      .update(contentmentCheckin)
      .set({ weekStartDate: addDays(row.weekStartDate, -1) })
      .where(eq(contentmentCheckin.id, row.id));
  }

  await setSetting(KEY_SUNDAY_WEEKS, "done");
}

/**
 * ADR-0019: tasks gained a `task_unit` membership table so one task can
 * serve several units. Migration 0006 creates the table; every task
 * that predates it needs its one existing membership written out, or it
 * would score nothing.
 *
 * Archived tasks get a row too — `recomputeUnitPoints` filters on
 * `task.active`, and leaving them out would silently drop their
 * membership if they're ever restored.
 */
export async function backfillTaskUnits(): Promise<void> {
  if ((await getSetting(KEY_TASK_UNITS)) === "done") return;

  const [tasks, existing] = await Promise.all([
    db.select().from(task),
    db.select().from(taskUnit),
  ]);
  const has = new Set(existing.map((m) => `${m.taskId}|${m.unitId}`));

  for (const t of tasks) {
    if (has.has(`${t.id}|${t.unitId}`)) continue;
    await db.insert(taskUnit).values({
      taskId: t.id,
      unitId: t.unitId,
      rankInUnit: t.rankInUnit,
      pointValue: t.pointValue,
    });
  }

  await setSetting(KEY_TASK_UNITS, "done");
}

/** Every pending data fixup, in order. Runs at launch behind the same
 *  gate as the schema migrations and taxonomy sync. */
export async function runDataMigrations(): Promise<void> {
  await migrateToSundayWeeks();
  await backfillTaskUnits();
}
