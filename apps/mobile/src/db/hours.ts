/**
 * Working hours, one day's own hours, and one day's window edits
 * (ADR-0039 §1, windows-and-pins.md §§1.4–1.5).
 *
 * What's stored here is everything `dayHours` needs except the day's
 * events, which come from its tasks. The rules (parsing, validation)
 * are in `windowRules.ts`.
 *
 * Writes mark grades stale: working hours size the commitment share
 * (ADR-0044), one of the two things about windows that can change a
 * score. Transactions here use synchronous callbacks, which are atomic
 * on the app's driver (an async callback commits after its first
 * statement there).
 */
import { asc, eq, gte, max } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import type { HoursVersion, NamedGap, TimeRange, WorkSchedule, DayEdit } from "@glide/scoring";

import { currentLocalDate } from "../lib/calendar";
import { db } from "./client";
import { dayWindowEdit, workDayOverride, workHours } from "./schema";
import { markGradesStale } from "./settings";
import {
  dayEditProblem,
  hoursProblem,
  overrideProblem,
  parseRanges,
  serializeGaps,
  serializeRanges,
  serializeSchedules,
  toDayEdits,
  toHoursVersion,
  unreadableVersion,
  type DayEditInput,
} from "./windowRules";

/** Every version of the template, oldest first. */
export async function loadHoursVersions(): Promise<HoursVersion[]> {
  const rows = await db.select().from(workHours).orderBy(asc(workHours.fromDate));
  return rows.filter((r) => !unreadableVersion(r)).map(toHoursVersion);
}

/**
 * Save the template from `fromDate` on ("This week and after").
 *
 * Versions starting on or after `fromDate` are replaced: the newest
 * choice holds from its first day, and earlier days keep the hours they
 * had (EC-15). An empty `schedules` is a template with no working hours
 * at all, which is different from never having set any.
 */
export async function saveHoursFrom(
  fromDate: string,
  schedules: readonly WorkSchedule[],
  gaps: readonly NamedGap[] = [],
): Promise<void> {
  const problem = hoursProblem(fromDate, schedules, gaps);
  if (problem !== null) throw new Error(problem);
  db.transaction((tx) => {
    tx.delete(workHours).where(gte(workHours.fromDate, fromDate)).run();
    tx.insert(workHours)
      .values({
        fromDate,
        schedules: serializeSchedules(schedules),
        gaps: serializeGaps(gaps),
      })
      .run();
  });
  await markGradesStale();
}

/** One date's own ranges, or null if it follows the template. */
export async function loadDayOverride(localDate: string): Promise<TimeRange[] | null> {
  const [row] = await db
    .select()
    .from(workDayOverride)
    .where(eq(workDayOverride.localDate, localDate));
  return row ? parseRanges(row.ranges) : null;
}

/** Give one date its own ranges ("Just this week" writes one per day).
 *  An empty list is a day with no working hours. */
export async function setDayOverride(
  localDate: string,
  ranges: readonly TimeRange[],
): Promise<void> {
  const problem = overrideProblem(localDate, ranges);
  if (problem !== null) throw new Error(problem);
  const value = serializeRanges(ranges);
  await db
    .insert(workDayOverride)
    .values({ localDate, ranges: value })
    .onConflictDoUpdate({ target: workDayOverride.localDate, set: { ranges: value } });
  await markGradesStale();
}

/** Return a date to the template's hours. */
export async function clearDayOverride(localDate: string): Promise<void> {
  await db.delete(workDayOverride).where(eq(workDayOverride.localDate, localDate));
  await markGradesStale();
}

/** One date's window edits, in the order they were made. */
export async function loadDayEdits(localDate: string): Promise<DayEdit[]> {
  const rows = await db
    .select()
    .from(dayWindowEdit)
    .where(eq(dayWindowEdit.localDate, localDate));
  return toDayEdits(rows);
}

/**
 * Add, remove or change a window on one day, after the edits already
 * made (§1.4). Stamped with today's date, so an edit made on the day
 * itself is left out of the commitment share's hours (EC-56). Returns
 * the edit's id, for Undo.
 */
export async function addDayEdit(localDate: string, edit: DayEditInput): Promise<string> {
  const today = currentLocalDate();
  const problem = dayEditProblem(localDate, edit, today);
  if (problem !== null) throw new Error(problem);
  const id = Crypto.randomUUID();
  const [start, end, to] =
    edit.kind === "change"
      ? [edit.from.start, edit.from.end, edit.to]
      : [edit.range.start, edit.range.end, null];
  db.transaction((tx) => {
    const [last] = tx
      .select({ seq: max(dayWindowEdit.seq) })
      .from(dayWindowEdit)
      .where(eq(dayWindowEdit.localDate, localDate))
      .all();
    tx.insert(dayWindowEdit)
      .values({
        id,
        localDate,
        seq: (last?.seq ?? -1) + 1,
        kind: edit.kind,
        startMinute: start,
        endMinute: end,
        toStartMinute: to?.start ?? null,
        toEndMinute: to?.end ?? null,
        madeOn: today,
      })
      .run();
  });
  await markGradesStale();
  return id;
}

/** Take back one edit (Undo after removing a window on Home). Later
 *  edits stay, applied in their order as before. */
export async function deleteDayEdit(id: string): Promise<void> {
  await db.delete(dayWindowEdit).where(eq(dayWindowEdit.id, id));
  await markGradesStale();
}
