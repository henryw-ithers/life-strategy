/**
 * Conversions between the app's stored forms and a picker's `Date`.
 *
 * The app keeps a clock time as integer minutes from local midnight and
 * a day as a `YYYY-MM-DD` local date (ADR-0002). Pickers speak `Date`.
 * These are the only crossings, so the four pickers can't drift apart.
 * Pure: the picker field and its web fallback both use them.
 */

/**
 * Minutes from local midnight → that time on a fixed day. Only the time
 * is read back, so the day is chosen to have no daylight-saving change:
 * on today's date, 02:30 on the morning the clocks go forward doesn't
 * exist and would come back an hour out.
 */
export function minutesToDate(minutes: number): Date {
  return new Date(2001, 0, 15, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

/** A picked `Date` → minutes from local midnight. */
export function dateToMinutes(at: Date): number {
  return at.getHours() * 60 + at.getMinutes();
}

/**
 * `YYYY-MM-DD` → that day at local noon. Noon, because a midnight
 * built from a date string can land on the day before once a timezone
 * is applied. Built from parts, never from Date's string parser.
 */
export function localDateToDate(localDate: string): Date {
  const [y, m, d] = localDate.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0);
}

/** A picked `Date` → its local `YYYY-MM-DD`, with no 3am rollover:
 *  the day picked is the day meant. */
export function dateToLocalDate(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(
    at.getDate(),
  ).padStart(2, "0")}`;
}

/** `HH:MM` (as a web time input gives it) → minutes, or null. */
export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}
