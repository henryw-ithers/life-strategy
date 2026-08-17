/**
 * Weekday pins and part of day (ADR-0024 §1) — the pure half.
 *
 * A plan is a weekday and a part of day, never a clock time. There is
 * no time parsing here and no time anywhere in the app, on purpose:
 * nothing consumes one, so it would buy ordering `partOfDay` already
 * provides (ADR-0024 §1, reaffirmed under challenge in ADR-0025 §7).
 */

/** ISO weekday numbers: Monday is 1, Sunday is 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type PartOfDay = "morning" | "afternoon" | "evening";

/**
 * Display order is **Sunday-first**, matching `WeekStrip` and the
 * `weekStart` the grade window uses (ADR-0004 §1 as amended). Storage
 * stays ISO, so the two never have to agree about anything but this
 * array.
 */
export const WEEKDAY_ORDER: readonly Weekday[] = [7, 1, 2, 3, 4, 5, 6];

export const WEEKDAY_LETTER: Record<Weekday, string> = {
  1: "M",
  2: "T",
  3: "W",
  4: "T",
  5: "F",
  6: "S",
  7: "S",
};

export const WEEKDAY_NAME: Record<Weekday, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export const PART_OF_DAY_ORDER: readonly PartOfDay[] = [
  "morning",
  "afternoon",
  "evening",
];

export const PART_OF_DAY_LABEL: Record<PartOfDay, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

/** What an unpinned part of day is called. Null is a first-class
 *  value, not a missing one — most of a plan is deliberately flexible. */
export const ANYTIME_LABEL = "Anytime";

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

/** `[3, 1, 5]` → `"1,3,5"`. Empty means flexible, which stores as null. */
export function formatWeekdays(days: readonly Weekday[]): string | null {
  if (days.length === 0) return null;
  return [...new Set(days)].sort((a, b) => a - b).join(",");
}

/**
 * Picking days sets the frequency — 3 days picked is 3×/week
 * (ADR-0024 §Schema). One mental model, so the two settings can never
 * contradict each other.
 *
 * Zero days is the flexible case and leaves frequency alone: clearing
 * the last pin reverts to "any N days" at whatever N was already
 * chosen, rather than silently rewriting it to nothing.
 */
export function frequencyForWeekdays(
  days: readonly Weekday[],
  current: number,
): number {
  return days.length === 0 ? current : days.length;
}

/** Sunday-first display order, for rendering a stored pin set. */
export function sortForDisplay(days: readonly Weekday[]): Weekday[] {
  return [...days].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b),
  );
}

/**
 * "Mon, Wed, Fri" · "Every day" · null when flexible.
 * Used as row metadata on the plan screen, never as a status.
 */
export function formatWeekdaySummary(days: readonly Weekday[]): string | null {
  if (days.length === 0) return null;
  if (days.length === 7) return "Every day";
  return sortForDisplay(days)
    .map((d) => WEEKDAY_NAME[d].slice(0, 3))
    .join(", ");
}

/** Is this task planned for the given date? Dates are 'YYYY-MM-DD'. */
export function isPinnedOn(days: readonly Weekday[], localDate: string): boolean {
  if (days.length === 0) return false;
  return days.includes(isoWeekday(localDate));
}

/**
 * ISO weekday for a local date string, without constructing a Date in
 * the device timezone — `new Date('2026-08-16')` parses as UTC and can
 * land on the wrong day west of Greenwich, which is exactly the class
 * of bug `local_date` exists to avoid (ADR-0002).
 */
export function isoWeekday(localDate: string): Weekday {
  const y = Number(localDate.slice(0, 4));
  const m = Number(localDate.slice(5, 7));
  const d = Number(localDate.slice(8, 10));
  // Zeller-style: Date.UTC is safe because we supply all three parts.
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return (day === 0 ? 7 : day) as Weekday;
}
