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
import { asc, eq, gte, isNull, max } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import {
  addDays,
  dayHours,
  editWindowStart,
  isFinalized,
  type DayEdit,
  type HoursVersion,
  type NamedGap,
  type TimeRange,
  type WorkSchedule,
} from "@glide/scoring";

import { currentLocalDate } from "../lib/calendar";
import { db } from "./client";
import { dayGrade, dayWindowEdit, workDayOverride, workHours } from "./schema";
import { writeAndMarkStale } from "./settings";
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

// ── The hours a day began with (ADR-0044 §5) ───────────────────────

/** The working time `date` has now: its template or own hours, less
 *  named gaps, with the edits made ahead of the day (`dayHours`). */
export async function workingHoursNow(date: string): Promise<TimeRange[]> {
  const [versions, override, edits] = await Promise.all([
    loadHoursVersions(),
    loadDayOverride(date),
    loadDayEdits(date),
  ]);
  return [...dayHours({ date, versions, override, edits }).working];
}

/**
 * The working time the commitment share reads for `date`: what was
 * stored when the day began, else what it is now. A day's share then
 * never moves when its hours change on the day or after (EC-56).
 */
export async function startingHours(date: string): Promise<TimeRange[]> {
  const [row] = await db
    .select({ startingHours: dayGrade.startingHours })
    .from(dayGrade)
    .where(eq(dayGrade.localDate, date));
  return parseRanges(row?.startingHours) ?? workingHoursNow(date);
}

/**
 * Keep the hours `date` began with, if they aren't kept already. Only
 * for a day that has begun: a future day's hours can still change, and
 * changes made ahead count. Called when a day is scored, and before
 * any change to the hours that reaches today.
 */
export async function freezeStartingHours(date: string): Promise<void> {
  const today = currentLocalDate();
  // A day not begun can still change; a settled one keeps its grade.
  if (date > today || isFinalized(date, today)) return;
  const [row] = await db
    .select({ startingHours: dayGrade.startingHours })
    .from(dayGrade)
    .where(eq(dayGrade.localDate, date));
  if (row?.startingHours != null) return;
  const value = serializeRanges(await workingHoursNow(date));
  await db
    .insert(dayGrade)
    .values({ localDate: date, startingHours: value })
    // Never over a value already kept.
    .onConflictDoUpdate({
      target: dayGrade.localDate,
      set: { startingHours: value },
      setWhere: isNull(dayGrade.startingHours),
    });
}

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
  // Days already begun keep the hours they began with (ADR-0044 §5):
  // "This week and after" starts on a week's first day, which can be
  // before today.
  const today = currentLocalDate();
  const first = fromDate > editWindowStart(today) ? fromDate : editWindowStart(today);
  for (let d = first; d <= today; d = addDays(d, 1)) await freezeStartingHours(d);
  writeAndMarkStale((tx) => {
    tx.delete(workHours).where(gte(workHours.fromDate, fromDate)).run();
    tx.insert(workHours)
      .values({
        fromDate,
        schedules: serializeSchedules(schedules),
        gaps: serializeGaps(gaps),
      })
      .run();
  });
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
  await freezeStartingHours(localDate);
  const value = serializeRanges(ranges);
  writeAndMarkStale((tx) =>
    tx
      .insert(workDayOverride)
      .values({ localDate, ranges: value })
      .onConflictDoUpdate({ target: workDayOverride.localDate, set: { ranges: value } })
      .run(),
  );
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
  writeAndMarkStale((tx) => {
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
  return id;
}

/** Take back one edit (Undo after removing a window on Home). Later
 *  edits stay, applied in their order as before. */
export async function deleteDayEdit(id: string): Promise<void> {
  writeAndMarkStale((tx) => tx.delete(dayWindowEdit).where(eq(dayWindowEdit.id, id)).run());
}
