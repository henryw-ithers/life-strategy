/**
 * The app's clock and its day ranges: which local date it is, which
 * past days are open for editing, and how far ahead a day can be
 * planned. Pure — no database — so screens and the data layer share one
 * definition of "today".
 *
 * **The day starts when the user says** (ADR-0049): 3am unless changed
 * in Settings, for someone on nights or a shifted schedule. The stored
 * hour is read at launch (`loadDayStart`) and held here, so every
 * "what day is it" agrees without a database read.
 */
import {
  addDays,
  dayEnd,
  dayMinute,
  editWindowStart,
  endAfter,
  isEditable,
  localDateOf,
  ROLLOVER_HOUR,
} from "@glide/scoring";

let dayStart = ROLLOVER_HOUR;

/** The hour the day starts, 0–23. */
export function dayStartHour(): number {
  return dayStart;
}

/** Use `hour` as the start of the day from now on. Anything but a whole
 *  hour of the day is ignored. */
export function applyDayStart(hour: number): void {
  if (Number.isInteger(hour) && hour >= 0 && hour < 24) dayStart = hour;
}

export function currentLocalDate(): string {
  return localDateOf(new Date(), dayStart);
}

/** The day an instant belongs to. */
export function localDateAt(at: Date): string {
  return localDateOf(at, dayStart);
}

/** Where an instant falls in its day, in minutes from that date's
 *  midnight: 1:30am before a 3am start is 1530. */
export function dayMinuteAt(at: Date): number {
  return dayMinute(at.getHours(), at.getMinutes(), dayStart);
}

/** Where today ends and tomorrow begins, in today's minutes. */
export function todayEnd(): number {
  return dayEnd(dayStart);
}

/** A start picked on the clock (0–1439) → its minute in the day: before
 *  the day starts is after midnight, the same day. */
export function startFromClock(clock: number): number {
  return dayMinute(Math.floor(clock / 60), clock % 60, dayStart);
}

/** An end picked on the clock → the first time it comes round after
 *  `start`: earlier on the clock is the next day. */
export function endFromClock(start: number, clock: number): number {
  return endAfter(start, clock);
}

export function assertEditable(date: string): void {
  if (!isEditable(date, currentLocalDate())) {
    throw new Error("That day hasn't happened yet.");
  }
}

/** The 14 selectable days: last week's Sunday through this week's
 *  Sunday. Days after `today` are visible but disabled. */
export function editWindowDays(today: string): string[] {
  const start = editWindowStart(today);
  return Array.from({ length: 14 }, (_, i) => addDays(start, i));
}

/** Whether `date` is a day the planner will open. */
export function isPlannable(date: string, today: string): boolean {
  return date > today && date <= addDays(today, 28);
}
