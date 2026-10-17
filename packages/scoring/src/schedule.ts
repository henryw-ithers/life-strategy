/**
 * Which days a task is scheduled on (ADR-0024 §1, as amended
 * 2026-08-18) — the one implementation the grade, the checklist and the
 * commitment band all read.
 *
 * Pins are stored as a comma-separated string of ISO weekdays
 * (`"1,3,5"`); everything here takes either that string or the parsed
 * numbers, and nothing here touches a clock time.
 */
import { addDays, isLocalDate, weekOfFortnight, weekStart } from "./days";

/** ISO weekday numbers: Monday is 1, Sunday is 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** ISO weekday for a `YYYY-MM-DD` local date: Monday 1 … Sunday 7.
 *  Read from the date's own parts, never through a local `Date`, which
 *  would land on the wrong day west of Greenwich (ADR-0002). */
export function isoWeekday(localDate: string): Weekday {
  const y = Number(localDate.slice(0, 4));
  const m = Number(localDate.slice(5, 7));
  const d = Number(localDate.slice(8, 10));
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return (day === 0 ? 7 : day) as Weekday;
}

/** `"1,3,5"` → `[1, 3, 5]`. Tolerates junk rather than throwing: this
 *  parses a free-form text column, and a malformed row should degrade
 *  to "flexible" rather than break the checklist. */
export function parseWeekdays(stored: string | null | undefined): Weekday[] {
  if (!stored) return [];
  const seen = new Set<Weekday>();
  for (const part of stored.split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n >= 1 && n <= 7) seen.add(n as Weekday);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Whether pins put a task on `localDate`: one of its weekdays, and —
 * for a **fortnightly** task (`timesPerWeek === 0`) — in the half of
 * the fortnight it belongs to, "every other Tuesday" rather than every
 * Tuesday. Which half is the task's own `fortnightOffset`, because the
 * date alone cannot say. No pins is never "on" a day.
 */
export function pinnedOn(
  pins: readonly number[],
  timesPerWeek: number,
  fortnightOffset: number | undefined,
  localDate: string,
): boolean {
  if (!pins.includes(isoWeekday(localDate))) return false;
  if (timesPerWeek !== 0) return true;
  return weekOfFortnight(localDate) === (fortnightOffset ?? 0);
}

/**
 * Where a series starts and stops, and the days it skips (ADR-0040).
 *
 * Every field is optional, and a task with none of them runs as it
 * always did: from when it was made, with no end and nothing skipped.
 * The data layer turns each kind of skip (one occurrence, one event's
 * week, a whole commitment's week) into the dates it covers; this side
 * only ever asks about a date.
 */
export interface ScheduleBounds {
  /** First day the series runs, inclusive. */
  repeatFrom?: string | null;
  /** Last day the series runs, inclusive ("For N weeks" is saved as
   *  this date, by `untilForWeeks`). */
  repeatUntil?: string | null;
  /** Days it doesn't run: skipped occurrences and skipped weeks. */
  skippedDates?: ReadonlySet<string>;
}

/**
 * What's wrong with a set of bounds, or null if nothing is. For the
 * place that saves them: **strict on write, tolerant on read.**
 * `inScheduleOn` never throws, so a bad stored row can't break the day
 * screen; it would only make a series run never, or skip nothing. This
 * is what keeps such rows from being written.
 */
export function boundsError(bounds: ScheduleBounds): string | null {
  for (const [name, value] of [
    ["first day", bounds.repeatFrom],
    ["last day", bounds.repeatUntil],
  ] as const) {
    if (value && !isLocalDate(value)) return `The ${name} isn't a date: ${value}`;
  }
  if (bounds.repeatFrom && bounds.repeatUntil && bounds.repeatUntil < bounds.repeatFrom) {
    return "The last day is before the first.";
  }
  for (const d of bounds.skippedDates ?? []) {
    if (!isLocalDate(d)) return `A skipped day isn't a date: ${d}`;
  }
  return null;
}

/** Whether a task has any of the bounds above. */
export function isBounded(bounds: ScheduleBounds): boolean {
  return Boolean(
    bounds.repeatFrom || bounds.repeatUntil || (bounds.skippedDates?.size ?? 0) > 0,
  );
}

/**
 * Whether a series runs on `localDate` at all: inside its first and
 * last day, and not skipped (ADR-0040 §§1–3). The one gate every "is
 * this due" question goes through, so a skip or an end date changes
 * what's due everywhere at once and nowhere else.
 */
export function inScheduleOn(bounds: ScheduleBounds, localDate: string): boolean {
  if (bounds.repeatFrom && localDate < bounds.repeatFrom) return false;
  if (bounds.repeatUntil && localDate > bounds.repeatUntil) return false;
  return !(bounds.skippedDates?.has(localDate) ?? false);
}

/**
 * The last day of a series that runs "For N weeks" from `startDate`
 * (ADR-0040 §1): the Saturday ending its Nth week, where the week it
 * starts in is week 1 even if it starts mid-week (EC-21). Weeks run
 * Sunday to Saturday (`weekStart`).
 */
export function untilForWeeks(startDate: string, weeks: number): string {
  if (!Number.isInteger(weeks) || weeks < 1) {
    throw new Error(`untilForWeeks: weeks must be a whole number from 1, got ${weeks}`);
  }
  return addDays(weekStart(startDate), weeks * 7 - 1);
}

/**
 * Whether a stored task is **pinned** to `localDate`.
 *
 * Unpinned tasks return false — flexible is not "due today", it is
 * "due some day this week". That includes an unpinned every-day task,
 * which is the one place this differs from the grade's `isAnchoredOn`:
 * the grade expects a daily task every day whatever its pins, while
 * this answers only "did the schedule name this day", which is what
 * the planner and the commitment band ask.
 *
 * Outside its bounds, or on a skipped date, a task is not due
 * (ADR-0040 §3).
 */
export function isDueOn(
  task: {
    plannedWeekdays: string | null;
    timesPerWeek: number;
    fortnightOffset?: number;
  } & ScheduleBounds,
  localDate: string,
): boolean {
  if (!inScheduleOn(task, localDate)) return false;
  return pinnedOn(
    parseWeekdays(task.plannedWeekdays),
    task.timesPerWeek,
    task.fortnightOffset,
    localDate,
  );
}
