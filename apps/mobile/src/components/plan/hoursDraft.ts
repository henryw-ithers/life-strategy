/**
 * The working-hours editor's draft (spec §5.3.1, ADR-0039 §1): groups
 * of weekdays with time ranges, set like iOS Sleep schedules, and named
 * gaps. Pure, so it's tested off-device; `app/hours.tsx` draws it and
 * saves it.
 */
import {
  addDays,
  isoWeekday,
  normalizeWindows,
  subtract,
  versionFor,
  weekStart,
  type HoursVersion,
  type NamedGap,
  type TimeRange,
  type Weekday,
  type WorkSchedule,
} from "@glide/scoring";

/** What the editor holds: the template as you're changing it. */
export interface HoursDraft {
  readonly schedules: readonly WorkSchedule[];
  readonly gaps: readonly NamedGap[];
}

/** The space left between ranges drawn by hand (spec §3.3). */
export const DRAW_GAP = 15;

/** Weekdays Monday to Friday, and the weekend. */
const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5];

/**
 * Where the editor starts: the hours in force today, or, with none set
 * yet, weekdays nine to five, a plain start to change.
 */
export function draftFrom(
  versions: readonly HoursVersion[],
  today: string,
  /** Hours to start from when none are set: onboarding's template. */
  fallback?: readonly WorkSchedule[],
): HoursDraft {
  const version = versionFor(versions, today);
  if (version) return { schedules: version.schedules, gaps: version.gaps };
  return {
    schedules: fallback ? [...fallback] : [{ weekdays: WEEKDAYS, ranges: [{ start: 9 * 60, end: 17 * 60 }] }],
    gaps: [],
  };
}

/** Days other groups already have, for group `index`'s day buttons. */
export function takenElsewhere(schedules: readonly WorkSchedule[], index: number): Weekday[] {
  return schedules.flatMap((s, i) => (i === index ? [] : [...s.weekdays]));
}

/** A new range after a group's last one, an hour long, `DRAW_GAP`
 *  after it; null when the day has no room left. */
export function nextRange(ranges: readonly TimeRange[]): TimeRange | null {
  const last = [...ranges].sort((a, b) => b.end - a.end)[0];
  const start = last ? last.end + DRAW_GAP : 9 * 60;
  const end = start + 60;
  return end <= 24 * 60 ? { start, end } : null;
}

/** A new group with the days no group has yet, or null when every day
 *  is taken. */
export function nextSchedule(schedules: readonly WorkSchedule[]): WorkSchedule | null {
  const taken = new Set(schedules.flatMap((s) => s.weekdays));
  const free = ([1, 2, 3, 4, 5, 6, 7] as const).filter((d) => !taken.has(d));
  if (free.length === 0) return null;
  return { weekdays: free, ranges: [{ start: 10 * 60, end: 14 * 60 }] };
}

/**
 * One date's own ranges from the draft, for "Just this week": its
 * group's ranges less the gaps named for that weekday. A day's own
 * hours carry no named gaps (`dayHours`), so they're taken out here.
 */
export function rangesOn(draft: HoursDraft, date: string): TimeRange[] {
  const day = isoWeekday(date);
  let ranges = normalizeWindows(
    draft.schedules.filter((s) => s.weekdays.includes(day)).flatMap((s) => s.ranges),
  );
  for (const g of draft.gaps) if (g.weekdays.includes(day)) ranges = subtract(ranges, g.range);
  return ranges;
}

/** The dates "Just this week" covers: today to the week's Saturday. */
export function restOfWeek(today: string): string[] {
  const out: string[] = [];
  for (let d = today; d <= addDays(weekStart(today), 6); d = addDays(d, 1)) out.push(d);
  return out;
}

/** Whether saving needs to ask "Just this week" or "This week and
 *  after": only once the week has begun (spec §5.3.1). */
export const weekHasBegun = (today: string): boolean => today !== weekStart(today);
