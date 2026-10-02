/**
 * Ticking work off (ADR-0004, ADR-0014): one completion per task per
 * day, optionally part-done, priced at the moment it is earned. Every
 * write re-scores the day and any later stored day whose load read it.
 */
import {
  addDays,
  fortnightStart,
  isDueOn,
  normalizeFraction,
  partialPoints,
} from "@glide/scoring";
import { and, eq, gt, inArray, isNull, lt, lte } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { assertEditable, currentLocalDate } from "../lib/calendar";
import { db } from "./client";
import { COVERAGE_LOOKBACK_DAYS, isCommitmentUnit } from "./commitmentPlan";
import { cacheDayScore } from "./dayGrades";
import { autocountForTask, removeAutocountForTask } from "./goals";
import { dayGrade, lifeUnit, task, taskCompletion, taskCompletionTag } from "./schema";
import { loadDay, type DayData } from "./today";

/**
 * One completion per task per day: a second toggle unchecks.
 *
 * Returns the day as just scored, so the caller need not load it again
 * — or null for a settled day, whose live read (`loadDay` without
 * `recompute`) is the stored number rather than this one.
 */
export async function toggleCompletion(
  taskId: string,
  date: string,
): Promise<DayData | null> {
  assertEditable(date);
  const cleared = await clearCompletion(taskId, date);
  if (!cleared) await writeCompletion(taskId, date, 1);
  return afterCompletionEdit(taskId, date);
}

/**
 * Record how much of a task was done today (ADR-0014 §4's picker).
 *
 * **Replaces the day's fraction rather than adding to it.** Within one
 * day there is one completion row per task, so picking a half after a
 * quarter means "actually, a half" — not "a quarter and then a half".
 * Across days a one-off still accumulates, which is what `settledFor`
 * scopes and what §2's "finishing on a later day" relies on.
 */
export async function setCompletionFraction(
  taskId: string,
  date: string,
  fraction: number,
): Promise<DayData | null> {
  assertEditable(date);
  await clearCompletion(taskId, date);
  await writeCompletion(taskId, date, fraction);
  return afterCompletionEdit(taskId, date);
}

/** Re-score `date` and every stored day that read its completions. */
async function afterCompletionEdit(taskId: string, date: string): Promise<DayData | null> {
  const day = await cacheDayScore(date);
  const done = await recacheLaterDays(date);
  await recacheCoveredSessions(taskId, date, done);
  return day.finalized ? null : day;
}

/**
 * Re-score the later days of `date`'s counting windows that already
 * hold a live grade.
 *
 * What a day expects is measured against what was still owed before it
 * (`computeDayLoad`), so a completion backfilled on Sunday changes what
 * Monday asked for. Without this Monday's stored row kept the old
 * number while its live screen showed the new one. The fortnight covers
 * both weekly and fortnightly windows; settled days are left as they
 * stand, and nothing after today has a grade to correct.
 */
async function recacheLaterDays(date: string): Promise<Set<string>> {
  const fortnightEnd = addDays(fortnightStart(date), 13);
  const today = currentLocalDate();
  const rows = await db
    .select({ localDate: dayGrade.localDate })
    .from(dayGrade)
    .where(
      and(
        gt(dayGrade.localDate, date),
        lte(dayGrade.localDate, fortnightEnd < today ? fortnightEnd : today),
        isNull(dayGrade.finalizedAt),
      ),
    );
  for (const r of rows) await cacheDayScore(r.localDate);
  return new Set(rows.map((r) => r.localDate));
}

/**
 * Re-score the days whose session an off-schedule tick on `date` may
 * have taken or given back (ADR-0032 §4, amended 2026-10-01).
 *
 * Ticking Tuesday takes Wednesday's session out of Wednesday's band;
 * unticking it puts it back. If Wednesday has already been scored, its
 * stored grade would otherwise describe a band it no longer has. Only
 * days already holding a grade are touched — a day never opened is
 * computed when it is — and only up to today, since no later day has a
 * grade to correct.
 */
async function recacheCoveredSessions(
  taskId: string,
  date: string,
  /** Days already re-scored by `recacheLaterDays`. */
  done: ReadonlySet<string> = new Set(),
): Promise<void> {
  const [row] = await db.select().from(task).where(eq(task.id, taskId));
  if (!row || row.oneOffSize != null || isDueOn(row, date)) return;
  const [home] = await db.select().from(lifeUnit).where(eq(lifeUnit.id, row.unitId));
  if (!home || !isCommitmentUnit(home)) return;

  const today = currentLocalDate();
  for (let i = 1; i <= COVERAGE_LOOKBACK_DAYS; i++) {
    const day = addDays(date, i);
    if (day > today) break;
    if (!isDueOn(row, day) || done.has(day)) continue;
    const [graded] = await db
      .select({ localDate: dayGrade.localDate })
      .from(dayGrade)
      .where(eq(dayGrade.localDate, day));
    if (graded) await cacheDayScore(day);
  }
}

/** Removes the day's completion if there is one. Returns whether there was. */
async function clearCompletion(taskId: string, date: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(taskCompletion)
    .where(and(eq(taskCompletion.taskId, taskId), eq(taskCompletion.localDate, date)));
  if (existing.length === 0) return false;
  // Tags hang off the completion, so unchecking takes them with it —
  // otherwise the row would be orphaned against its foreign key and
  // a re-check would silently inherit yesterday's tags.
  await db.delete(taskCompletionTag).where(
    inArray(
      taskCompletionTag.completionId,
      existing.map((c) => c.id),
    ),
  );
  await db
    .delete(taskCompletion)
    .where(and(eq(taskCompletion.taskId, taskId), eq(taskCompletion.localDate, date)));
  await removeAutocountForTask(taskId, date);
  return true;
}

/** Writes one completion for `date`, priced per ADR-0014 §3. */
async function writeCompletion(
  taskId: string,
  date: string,
  fraction: number,
): Promise<void> {
  const find = (d: DayData) =>
    [...d.due, ...d.week, ...d.doneThisWeek].find((t) => t.id === taskId);
  // A one-off planned for later is only on the day once listed, so a
  // tick from "Planned for other days" prices it from the full list.
  const status =
    find(await loadDay(date)) ?? find(await loadDay(date, { includeAhead: true }));
  if (!status) return;
  // What a partial completion pays: the rounded running total minus
  // what earlier fractions already paid (ADR-0014 §3). Never more
  // than the task is worth, however it is split up.
  const applied = status.allowsPartial ? normalizeFraction(fraction) : 1;
  const settled = await settledFor(taskId, date, status.oneOffSize != null);
  const points =
    applied === 1 && settled.length === 0
      ? status.pointsIfCompletedNow
      : partialPoints(status.pointsIfCompletedNow, settled, applied);

  await db.insert(taskCompletion).values({
    id: Crypto.randomUUID(),
    taskId,
    localDate: date,
    completedAt: new Date().toISOString(),
    pointsEarned: points,
    fraction: applied,
  });
  // ADR-0015 §2. A goal that nominated this task gets a visible,
  // deletable progress row — the completion scores, the row does not
  // (§7 keeps the two meanings apart).
  await autocountForTask(taskId, date);
}

/**
 * Fractions already settled against a task, before `date`.
 *
 * Progress is their **sum** (ADR-0014 §2) — there is deliberately no
 * stored progress on `task`, so nothing can disagree with the
 * completion history.
 *
 * **Only a one-off accumulates across days.** A recurring task's
 * Tuesday is a fresh instance, not a continuation of its Monday:
 * summing every day's fraction would have made its second completion
 * pay `round(1×v) − round(1×v)` — nothing at all — for the rest of the
 * task's life.
 */
async function settledFor(
  taskId: string,
  date: string,
  oneOff: boolean,
): Promise<number[]> {
  if (!oneOff) return [];
  const rows = await db
    .select({ fraction: taskCompletion.fraction })
    .from(taskCompletion)
    .where(and(eq(taskCompletion.taskId, taskId), lt(taskCompletion.localDate, date)));
  return rows.map((r) => r.fraction);
}

/**
 * Replace which other units this completion counted toward
 * (ADR-0025 §4).
 *
 * Units, never named people — an explicit non-goal of that ADR, and
 * the reason the UI asks *where does this count* rather than *who were
 * you with*. Recording that an hour counted toward Family is a fact
 * about the user; naming who was there would be a record about someone
 * who never agreed to be in this database.
 *
 * Rescores the day: since `FORMULA_VERSION` 6 a single tag earns the
 * unit's full daily share (ADR-0025 §3).
 */
export async function setCompletionTags(
  taskId: string,
  date: string,
  unitIds: readonly string[],
): Promise<void> {
  assertEditable(date);
  const [completion] = await db
    .select()
    .from(taskCompletion)
    .where(and(eq(taskCompletion.taskId, taskId), eq(taskCompletion.localDate, date)));
  // Nothing to hang a tag on. Reached only if the row was unchecked
  // between opening the sheet and saving it.
  if (!completion) return;

  await db.transaction(async (tx) => {
    await tx
      .delete(taskCompletionTag)
      .where(eq(taskCompletionTag.completionId, completion.id));
    if (unitIds.length > 0) {
      await tx.insert(taskCompletionTag).values(
        [...new Set(unitIds)].map((unitId) => ({
          completionId: completion.id,
          unitId,
        })),
      );
    }
  });
  // Since v6 a tag moves the number, so the cache has to follow it.
  // Before v6 tagging scored nothing and this call was deliberately
  // absent; leaving it absent after the formula changed would have let
  // the calendar, the week and the month read a stale day.
  await cacheDayScore(date);
}
