/**
 * Which days a task is scheduled on (ADR-0024 §1, as amended
 * 2026-08-18) — the one implementation the grade, the checklist and the
 * commitment band all read.
 *
 * Pins are stored as a comma-separated string of ISO weekdays
 * (`"1,3,5"`); everything here takes either that string or the parsed
 * numbers, and nothing here touches a clock time.
 */
import { weekOfFortnight } from "./days";

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
 * Whether a stored task is **pinned** to `localDate`.
 *
 * Unpinned tasks return false — flexible is not "due today", it is
 * "due some day this week". That includes an unpinned every-day task,
 * which is the one place this differs from the grade's `isAnchoredOn`:
 * the grade expects a daily task every day whatever its pins, while
 * this answers only "did the schedule name this day", which is what
 * the planner and the commitment band ask.
 */
export function isDueOn(
  task: {
    plannedWeekdays: string | null;
    timesPerWeek: number;
    fortnightOffset?: number;
  },
  localDate: string,
): boolean {
  return pinnedOn(
    parseWeekdays(task.plannedWeekdays),
    task.timesPerWeek,
    task.fortnightOffset,
    localDate,
  );
}
