/**
 * What takes runs off the schedule (ADR-0040): repeat bounds, skipped
 * occurrences and weeks, Clear today, and Away.
 *
 * Each changes what's due, so every write marks grades stale. They take
 * runs away and never add them (ADR-0040 §3). The rules are in
 * `windowRules.ts`; the engine reads bounds and skips through
 * `ScheduleBounds` and Away days through `computeDayLoad`.
 *
 * Transactions here use synchronous callbacks: on the app's driver an
 * async callback commits after its first statement.
 */
import { and, asc, eq, gte, inArray, lte, or } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { boundsError, weekStart } from "@glide/scoring";

import { currentLocalDate } from "../lib/calendar";
import { db } from "./client";
import { awayRange, dayClear, scheduleSkip, task } from "./schema";
import { markGradesStale } from "./settings";
import type { Tx } from "./tasks";
import { awayProblem, skipProblem, type SkipInput, type SkipRow } from "./windowRules";

type SyncTx = Pick<Tx, "select" | "insert" | "update" | "delete">;

// ── Repeat bounds (ADR-0040 §1) ─────────────────────────────────────

/** Set when a repeating task or event runs: from its first day to its
 *  last, either open. "For N weeks" passes `untilForWeeks(...)`. */
export async function setRepeatBounds(
  taskId: string,
  repeatFrom: string | null,
  repeatUntil: string | null,
): Promise<void> {
  const problem = boundsError({ repeatFrom, repeatUntil });
  if (problem !== null) throw new Error(problem);
  const result = await db.update(task).set({ repeatFrom, repeatUntil }).where(eq(task.id, taskId));
  if (result.changes === 0) throw new Error(`No such task: ${taskId}`);
  await markGradesStale();
}

// ── Skips (ADR-0040 §2) ─────────────────────────────────────────────

/**
 * Skip one run, one task's week, or a whole commitment's week. A week
 * is stored by its first day. Skipping what's already skipped changes
 * nothing and returns the existing skip. Returns the skip's id, for
 * Undo.
 */
export async function addSkip(skip: SkipInput): Promise<string> {
  const today = currentLocalDate();
  const problem = skipProblem(skip, today);
  if (problem !== null) throw new Error(problem);
  const localDate = skip.kind === "occurrence" ? skip.date : weekStart(skip.date);
  const taskId = skip.kind === "commitmentWeek" ? null : skip.taskId;
  const unitId = skip.kind === "commitmentWeek" ? skip.unitId : null;

  let id = Crypto.randomUUID();
  db.transaction((tx) => {
    const [existing] = tx
      .select({ id: scheduleSkip.id })
      .from(scheduleSkip)
      .where(
        and(
          eq(scheduleSkip.kind, skip.kind),
          eq(scheduleSkip.localDate, localDate),
          taskId !== null ? eq(scheduleSkip.taskId, taskId) : eq(scheduleSkip.unitId, unitId!),
        ),
      )
      .all();
    if (existing) {
      id = existing.id;
      return;
    }
    tx.insert(scheduleSkip)
      .values({ id, kind: skip.kind, taskId, unitId, localDate, madeOn: today })
      .run();
  });
  await markGradesStale();
  return id;
}

/** Take a skip back. */
export async function removeSkip(id: string): Promise<void> {
  await db.delete(scheduleSkip).where(eq(scheduleSkip.id, id));
  await markGradesStale();
}

/** The skips that touch `start`..`end`: runs on those dates, and weeks
 *  starting from `start`'s week to `end`. */
export async function loadSkipsBetween(start: string, end: string): Promise<SkipRow[]> {
  return db
    .select({
      kind: scheduleSkip.kind,
      taskId: scheduleSkip.taskId,
      unitId: scheduleSkip.unitId,
      localDate: scheduleSkip.localDate,
      madeOn: scheduleSkip.madeOn,
    })
    .from(scheduleSkip)
    .where(
      or(
        and(
          eq(scheduleSkip.kind, "occurrence"),
          gte(scheduleSkip.localDate, start),
          lte(scheduleSkip.localDate, end),
        ),
        and(
          inArray(scheduleSkip.kind, ["taskWeek", "commitmentWeek"]),
          gte(scheduleSkip.localDate, weekStart(start)),
          lte(scheduleSkip.localDate, end),
        ),
      ),
    );
}

/** Forget the skips of deleted tasks and units, inside the caller's
 *  transaction. */
export function forgetSkipsOf(
  tx: SyncTx,
  taskIds: readonly string[],
  unitIds: readonly string[] = [],
): void {
  if (taskIds.length > 0) {
    tx.delete(scheduleSkip).where(inArray(scheduleSkip.taskId, [...taskIds])).run();
  }
  if (unitIds.length > 0) {
    tx.delete(scheduleSkip).where(inArray(scheduleSkip.unitId, [...unitIds])).run();
  }
}

// ── Clear today (ADR-0040 §4) ───────────────────────────────────────

/** Set today's windows and unticked events aside. */
export async function clearToday(): Promise<void> {
  await db.insert(dayClear).values({ localDate: currentLocalDate() }).onConflictDoNothing();
  await markGradesStale();
}

/** Undo Clear today. Only today's can be undone: once the day has
 *  ended, it stands. */
export async function undoClearToday(): Promise<void> {
  await db.delete(dayClear).where(eq(dayClear.localDate, currentLocalDate()));
  await markGradesStale();
}

/** Whether a day was cleared. */
export async function isCleared(localDate: string): Promise<boolean> {
  const [row] = await db.select().from(dayClear).where(eq(dayClear.localDate, localDate));
  return row !== undefined;
}

// ── Away (ADR-0040 §5) ──────────────────────────────────────────────

export interface AwayRange {
  id: string;
  startDate: string;
  endDate: string;
  label: string | null;
}

/** Every Away range, earliest first. */
export async function loadAwayRanges(): Promise<AwayRange[]> {
  return db
    .select({
      id: awayRange.id,
      startDate: awayRange.startDate,
      endDate: awayRange.endDate,
      label: awayRange.label,
    })
    .from(awayRange)
    .orderBy(asc(awayRange.startDate));
}

const cleanLabel = (label: string | null | undefined) => label?.trim() || null;

/** Add days away, inclusive. Returns its id. */
export async function addAway(
  startDate: string,
  endDate: string,
  label?: string | null,
): Promise<string> {
  const problem = awayProblem(startDate, endDate, currentLocalDate());
  if (problem !== null) throw new Error(problem);
  const id = Crypto.randomUUID();
  await db.insert(awayRange).values({ id, startDate, endDate, label: cleanLabel(label) });
  await markGradesStale();
  return id;
}

/** Change an Away range's days or label. */
export async function updateAway(
  id: string,
  startDate: string,
  endDate: string,
  label?: string | null,
): Promise<void> {
  const problem = awayProblem(startDate, endDate, currentLocalDate());
  if (problem !== null) throw new Error(problem);
  await db
    .update(awayRange)
    .set({ startDate, endDate, label: cleanLabel(label) })
    .where(eq(awayRange.id, id));
  await markGradesStale();
}

export async function removeAway(id: string): Promise<void> {
  await db.delete(awayRange).where(eq(awayRange.id, id));
  await markGradesStale();
}
