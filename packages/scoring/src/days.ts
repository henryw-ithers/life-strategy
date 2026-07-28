/**
 * Day and week arithmetic (ADR-0004 §1). All dates are local calendar
 * days as 'YYYY-MM-DD' strings; ISO date strings compare correctly
 * with plain string comparison, which the edit-window logic relies on.
 */

/** The day rolls over at 3:00 AM local — a late night still belongs
 *  to the day it felt like. Configurable via app_setting. */
export const ROLLOVER_HOUR = 3;

/** A Sunday (1970-01-04); anchors fortnight parity. */
const EPOCH_SUNDAY_MS = Date.UTC(1970, 0, 4, 12);
const DAY_MS = 24 * 3600_000;

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`invalid local date: ${date}`);
  // Noon UTC keeps every timezone offset away from the date boundary.
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function format(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = `${dt.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${dt.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The local date `now` belongs to, honoring the rollover hour. */
export function localDateOf(now: Date, rolloverHour = ROLLOVER_HOUR): string {
  const shifted = new Date(now.getTime() - rolloverHour * 3600_000);
  const y = shifted.getFullYear();
  const m = `${shifted.getMonth() + 1}`.padStart(2, "0");
  const d = `${shifted.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, n: number): string {
  return format(new Date(parse(date).getTime() + n * DAY_MS));
}

/** Sunday of the week containing `date` — weeks run Sunday→Saturday
 *  (ADR-0004 §1 as amended 2026-07-27). This is the single definition
 *  of "week" in the app: task windows, weekly grades, the edit window,
 *  and contentment check-in keys all derive from it. */
export function weekStart(date: string): string {
  const dt = parse(date);
  return format(new Date(dt.getTime() - dt.getUTCDay() * DAY_MS));
}

/** Sunday opening the fortnight containing `date`. Fortnights align to
 *  even weeks since the epoch Sunday, so the boundary is stable and
 *  independent of any task's creation or completion date. */
export function fortnightStart(date: string): string {
  const ws = parse(weekStart(date)).getTime();
  const weeksSinceEpoch = Math.round((ws - EPOCH_SUNDAY_MS) / (7 * DAY_MS));
  return format(new Date(ws - (((weeksSinceEpoch % 2) + 2) % 2) * 7 * DAY_MS));
}

/** First day of the calendar month containing `date`. */
export function monthStart(date: string): string {
  const dt = parse(date);
  return format(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 12)));
}

/** First day of the month after the one containing `date` — the
 *  exclusive upper bound for a month range query. */
export function nextMonthStart(date: string): string {
  const dt = parse(date);
  return format(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1, 12)));
}

/** First editable day: Sunday of the week before `today`'s week. */
export function editWindowStart(today: string): string {
  return addDays(weekStart(today), -7);
}

/** Editable = within the current or previous week, and not in the
 *  future. Days before the window are finalized forever. */
export function isEditable(date: string, today: string): boolean {
  return date >= editWindowStart(today) && date <= today;
}

/** Past the edit window: `finalized_at` is (or is due to be) stamped. */
export function isFinalized(date: string, today: string): boolean {
  return date < editWindowStart(today);
}
