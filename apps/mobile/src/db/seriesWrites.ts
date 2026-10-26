/**
 * Changing a repeating event (ADR-0040 §§1–2, Phase 7): one
 * occurrence, this and following, its repeat length, and archiving a
 * series once it has ended and its days have settled. The rules are
 * `seriesRules.ts`; skips, Clear today and Away are `skips.ts`.
 *
 * Every write here changes what's due, so it marks grades stale in its
 * own transaction (`writeAndMarkStale`).
 */
import { addDays, boundsError } from "@glide/scoring";
import { and, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { currentLocalDate } from "../lib/calendar";
import { db } from "./client";
import type { ExistingEvent, Replacement } from "./eventClash";
import type { EventInput } from "./events";
import { forgetPinsOf } from "./pins";
import { scheduleSkip, task, taskCompletion, taskUnit } from "./schema";
import {
  archiveDue,
  boundsCutToday,
  movedSkips,
  pastChangedBy,
  splitSeries,
  type Bounds,
} from "./seriesRules";
import { writeAndMarkStale } from "./settings";
import { addSkip, removeSkip } from "./skips";
import { addEvent, archiveTask, recomputeAllUnitPoints, updateEvent, type Tx } from "./tasks";
import { skipProblem } from "./windowRules";

/** The units a task is filed under, home first: what a copy of it
 *  takes. */
function unitsOf(tx: Tx | typeof db, taskId: string): string[] {
  const [row] = tx.select({ unitId: task.unitId }).from(task).where(eq(task.id, taskId)).all();
  if (!row) throw new Error(`No such event: ${taskId}`);
  const others = tx
    .select({ unitId: taskUnit.unitId })
    .from(taskUnit)
    .where(eq(taskUnit.taskId, taskId))
    .all()
    .map((m) => m.unitId)
    .filter((u) => u !== row.unitId);
  return [row.unitId, ...others];
}

/** Remove an event made moments ago whose companion write failed. */
function discardNew(taskId: string): void {
  db.transaction((tx) => {
    tx.delete(scheduleSkip).where(eq(scheduleSkip.taskId, taskId)).run();
    tx.delete(taskUnit).where(eq(taskUnit.taskId, taskId)).run();
    tx.delete(task).where(eq(task.id, taskId)).run();
    recomputeAllUnitPoints(tx);
  });
}

/**
 * "This event only" (ADR-0040 §2; Henry, 2026-10-20): skip that date in
 * the series and add a one-off event on it with the new details. Scoring,
 * the commitment share and windows already handle one-off events, so
 * nothing new reads it. A tick that day belongs to the one-off.
 *
 * Only from today on, as a skip is. Returns the one-off's id.
 */
export async function editEventOccurrence(
  taskId: string,
  date: string,
  input: EventInput,
): Promise<string> {
  const problem = skipProblem({ kind: "occurrence", taskId, date }, currentLocalDate());
  if (problem) throw new Error(problem);
  const units = unitsOf(db, taskId);
  const skipId = await addSkip({ kind: "occurrence", taskId, date });
  try {
    const id = await addEvent(units, { ...input, weekdays: [], date });
    if (!id) throw new Error("The event couldn't be added.");
    return id;
  } catch (e) {
    await removeSkip(skipId);
    throw e;
  }
}

/**
 * "This and following" (ADR-0040 §2): the series ends the day before
 * `date` and a new one with the new details starts on it, to the same
 * end. Skips from the date on move to it, a skipped week the split
 * falls in is copied (EC-27). Ticks stay with the old series.
 *
 * On or before the series' first day this is the whole series, edited
 * in place, and returns null. Otherwise it returns the new series' id.
 * Only from today on: the past isn't rewritten.
 */
export async function editEventFollowing(
  taskId: string,
  date: string,
  input: EventInput,
): Promise<string | null> {
  const [row] = db.select().from(task).where(eq(task.id, taskId)).all();
  if (!row) throw new Error(`No such event: ${taskId}`);
  const split = splitSeries({ repeatFrom: row.repeatFrom, repeatUntil: row.repeatUntil }, date);
  if (split === null) {
    await updateEvent(taskId, input);
    return null;
  }
  if (date < currentLocalDate()) throw new Error("A series can only change from today on.");
  const problem = boundsError(split.next) ?? boundsError(split.old);
  if (problem) throw new Error(problem);

  const nextId = await addEvent(unitsOf(db, taskId), input);
  if (!nextId) throw new Error("The event couldn't be added.");
  try {
    writeAndMarkStale((tx) => {
      tx.update(task).set(split.old).where(eq(task.id, taskId)).run();
      tx.update(task).set(split.next).where(eq(task.id, nextId)).run();
      const skips = tx
        .select()
        .from(scheduleSkip)
        .where(and(eq(scheduleSkip.taskId, taskId), inArray(scheduleSkip.kind, ["occurrence", "taskWeek"])))
        .all();
      const { move, copy } = movedSkips(
        skips.map((s) => ({ id: s.id, kind: s.kind as "occurrence" | "taskWeek", localDate: s.localDate })),
        date,
      );
      if (move.length > 0) {
        tx.update(scheduleSkip).set({ taskId: nextId }).where(inArray(scheduleSkip.id, move)).run();
      }
      for (const s of skips.filter((s) => copy.includes(s.id))) {
        tx.insert(scheduleSkip)
          .values({ ...s, id: Crypto.randomUUID(), taskId: nextId })
          .run();
      }
    });
  } catch (e) {
    discardNew(nextId);
    throw e;
  }
  return nextId;
}

/**
 * Set how long an event repeats: "For N weeks" (saved as a date,
 * `untilForWeeks`), "Until a date" or "No end" (ADR-0040 §1).
 *
 * If the change takes today's run away, the day is emptied on the day
 * itself, so a same-day skip is recorded with it (ADR-0040 §3,
 * clarified 2026-10-20): the day can't then become a rest day by being
 * emptied.
 */
export async function setEventRepeat(taskId: string, bounds: Bounds): Promise<void> {
  const problem = boundsError(bounds);
  if (problem !== null) throw new Error(problem);
  const today = currentLocalDate();
  writeAndMarkStale((tx) => {
    const [row] = tx.select().from(task).where(eq(task.id, taskId)).all();
    if (!row) throw new Error(`No such event: ${taskId}`);
    if (pastChangedBy({ repeatFrom: row.repeatFrom, repeatUntil: row.repeatUntil }, bounds, today)) {
      throw new Error(
        "Past days keep the plan they had: a series can end yesterday at the earliest, and one that has started keeps its first day.",
      );
    }
    tx.update(task).set(bounds).where(eq(task.id, taskId)).run();
    const cut = boundsCutToday(
      row,
      { repeatFrom: row.repeatFrom, repeatUntil: row.repeatUntil },
      bounds,
      today,
    );
    if (!cut) return;
    const [already] = tx
      .select({ id: scheduleSkip.id })
      .from(scheduleSkip)
      .where(
        and(
          eq(scheduleSkip.taskId, taskId),
          eq(scheduleSkip.kind, "occurrence"),
          eq(scheduleSkip.localDate, today),
        ),
      )
      .all();
    if (!already) {
      tx.insert(scheduleSkip)
        .values({ id: Crypto.randomUUID(), kind: "occurrence", taskId, unitId: null, localDate: today, madeOn: today })
        .run();
    }
  });
}

/**
 * Archive every series whose last day is before the edit window
 * (ADR-0040 §1 as clarified 2026-10-20; EC-26): its days have all
 * settled, so its ticks stay with them, and it leaves the lists. Its
 * pins go, as any archived task's do. Run at launch. Returns how many.
 */
export async function archiveEndedSeries(): Promise<number> {
  const today = currentLocalDate();
  return writeAndMarkStale((tx) => {
    const ended = tx
      .select({ id: task.id, repeatUntil: task.repeatUntil })
      .from(task)
      .where(and(eq(task.active, true), isNotNull(task.repeatUntil)))
      .all()
      .filter((t) => archiveDue(t.repeatUntil, today))
      .map((t) => t.id);
    if (ended.length === 0) return 0;
    forgetPinsOf(tx, ended);
    tx.update(task)
      .set({ active: false, archivedAt: new Date().toISOString() })
      .where(inArray(task.id, ended))
      .run();
    recomputeAllUnitPoints(tx);
    return ended.length;
  });
}

/**
 * The days from `from` on that a series is already ticked: "this event"
 * passes over them, so editing never reopens a run that has been done
 * and paid (each session pays once).
 */
export async function tickedFrom(taskId: string, from: string): Promise<Set<string>> {
  const rows = await db
    .select({ localDate: taskCompletion.localDate })
    .from(taskCompletion)
    .where(and(eq(taskCompletion.taskId, taskId), gte(taskCompletion.localDate, from)));
  return new Set(rows.map((r) => r.localDate));
}

// ── Replacing an event (Henry, 2026-10-26) ──────────────────────────

/** Every live event, for what a new event or window lands on. */
export async function loadLiveEvents(): Promise<ExistingEvent[]> {
  return db
    .select({
      id: task.id,
      title: task.title,
      plannedWeekdays: task.plannedWeekdays,
      oneOffDate: task.oneOffDate,
      startMinute: task.startMinute,
      endMinute: task.endMinute,
      repeatFrom: task.repeatFrom,
      repeatUntil: task.repeatUntil,
    })
    .from(task)
    .where(and(eq(task.kind, "event"), eq(task.active, true), isNull(task.archivedAt)));
}

/**
 * Replace what a new event or window lands on (`eventClashes`): end a
 * series from today, archive a one-time event, or skip one day of a
 * series. Nothing before today changes.
 */
export async function replaceEvents(replacements: readonly Replacement[]): Promise<void> {
  const yesterday = addDays(currentLocalDate(), -1);
  for (const r of replacements) {
    if (r.action === "archive") await archiveTask(r.id);
    else if (r.action === "skip") await addSkip({ kind: "occurrence", taskId: r.id, date: r.date });
    else {
      const [row] = await db
        .select({ repeatFrom: task.repeatFrom })
        .from(task)
        .where(eq(task.id, r.id));
      await setEventRepeat(r.id, { repeatFrom: row?.repeatFrom ?? null, repeatUntil: yesterday });
    }
  }
}
