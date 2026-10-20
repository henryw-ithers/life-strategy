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
import { writeAndMarkStale } from "./settings";
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
  writeAndMarkStale((tx) => {
    const result = tx.update(task).set({ repeatFrom, repeatUntil }).where(eq(task.id, taskId)).run();
    if (result.changes === 0) throw new Error(`No such task: ${taskId}`);
  });
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
  writeAndMarkStale((tx) => {
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
  return id;
}

/** Take a skip back. */
export async function removeSkip(id: string): Promise<void> {
  writeAndMarkStale((tx) => tx.delete(scheduleSkip).where(eq(scheduleSkip.id, id)).run());
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
  const localDate = currentLocalDate();
  writeAndMarkStale((tx) => tx.insert(dayClear).values({ localDate }).onConflictDoNothing().run());
}

/** Undo Clear today. Only today's can be undone: once the day has
 *  ended, it stands. */
export async function undoClearToday(): Promise<void> {
  const localDate = currentLocalDate();
  writeAndMarkStale((tx) => tx.delete(dayClear).where(eq(dayClear.localDate, localDate)).run());
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
  writeAndMarkStale((tx) =>
    tx.insert(awayRange).values({ id, startDate, endDate, label: cleanLabel(label) }).run(),
  );
  return id;
}

/**
 * Change an Away range's days or label. Its days are checked only when
 * they change (EC-32), so a range that began on settled days can still
 * be renamed, while its settled days stand.
 */
export async function updateAway(
  id: string,
  startDate: string,
  endDate: string,
  label?: string | null,
): Promise<void> {
  const [existing] = await db.select().from(awayRange).where(eq(awayRange.id, id));
  if (!existing) throw new Error(`No such time away: ${id}`);
  if (existing.startDate !== startDate || existing.endDate !== endDate) {
    const problem = awayProblem(startDate, endDate, currentLocalDate());
    if (problem !== null) throw new Error(problem);
  }
  writeAndMarkStale((tx) =>
    tx
      .update(awayRange)
      .set({ startDate, endDate, label: cleanLabel(label) })
      .where(eq(awayRange.id, id))
      .run(),
  );
}

export async function removeAway(id: string): Promise<void> {
  writeAndMarkStale((tx) => tx.delete(awayRange).where(eq(awayRange.id, id)).run());
}

/** A series' own skips, runs and weeks: what "Skip weeks ›" switches
 *  and what its next run steps past. Not its commitment's weeks. */
export async function loadTaskSkips(
  taskId: string,
): Promise<{ id: string; kind: "occurrence" | "taskWeek"; localDate: string }[]> {
  const rows = await db
    .select({ id: scheduleSkip.id, kind: scheduleSkip.kind, localDate: scheduleSkip.localDate })
    .from(scheduleSkip)
    .where(and(eq(scheduleSkip.taskId, taskId), inArray(scheduleSkip.kind, ["occurrence", "taskWeek"])));
  return rows.map((r) => ({ id: r.id, kind: r.kind as "occurrence" | "taskWeek", localDate: r.localDate }));
}

/** A commitment's skipped weeks, by their first day: what "Skip a
 *  week…" switches (ADR-0040 §2). */
export async function loadCommitmentWeekSkips(unitId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: scheduleSkip.id, localDate: scheduleSkip.localDate })
    .from(scheduleSkip)
    .where(and(eq(scheduleSkip.unitId, unitId), eq(scheduleSkip.kind, "commitmentWeek")));
  return new Map(rows.map((r) => [r.localDate, r.id]));
}
