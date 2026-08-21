
/**
 * Weekday pins and part of day (ADR-0024 §1) — the pure half.
 *
 * A plan is a weekday and a part of day, never a clock time. There is
 * no time parsing here and no time anywhere in the app, on purpose:
 * nothing consumes one, so it would buy ordering `partOfDay` already
 * provides (ADR-0024 §1, reaffirmed under challenge in ADR-0025 §7).
 */

import { weekOfFortnight } from "@glide/scoring";

import { MIN_TIMES_PER_WEEK } from "./frequency";

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

/** A part of the day with nothing planned in it. */
export const FREE_LABEL = "Free";

/** A part of the day whose tasks have all been ticked off. */
export const ALL_DONE_LABEL = "All done";

/**
 * What one of the three parts of the day reads when it holds no open
 * tasks (ADR-0024 §3 as amended 2026-08-17).
 *
 * Two states, and the only thing separating them is what happened: a
 * period with nothing planned was never claimed, and reads **Free**; a
 * period you have worked through reads **All done**. Saying "Free" for
 * both would report a morning you spent as a morning you skipped.
 *
 * Both are facts about what is left, and neither conditions on a
 * shortfall — there is deliberately no state for a period you have not
 * got to yet, which simply keeps its rows (ADR-0008).
 *
 * Not used for *Anytime*, which is not a time of day: an empty one is
 * nothing to report rather than free time, so it hides instead.
 */
export function emptyPeriodNote(anyCompletedHere: boolean): string {
  return anyCompletedHere ? ALL_DONE_LABEL : FREE_LABEL;
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
 *
 * **A fortnightly task keeps its cadence when it is pinned.** Days and
 * frequency answer one question for weekly work, but a fortnight is a
 * longer period than the days describe: pinning Wednesday to a
 * fortnightly task says *which* Wednesday-shaped slot it wants, not
 * that it now happens every week. Without this the function could
 * never return 0, so `SchedulePicker`'s week-switch — which renders
 * only when a pinned task is fortnightly — was unreachable, and
 * `task.fortnight_offset` had no way to be set from anywhere in the
 * app. Pinning a day also silently promoted a fortnightly task to
 * weekly, doubling how often it was expected.
 */
export function frequencyForWeekdays(
  days: readonly Weekday[],
  current: number,
): number {
  if (days.length === 0) return current;
  if (current === MIN_TIMES_PER_WEEK) return MIN_TIMES_PER_WEEK;
  return days.length;
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
 * Whether a pinned task belongs to `localDate`, accounting for
 * fortnightly cadence (ADR-0024 §1 as amended 2026-08-18).
 *
 * A weekly-or-more task is due on any weekday it is pinned to. A
 * **fortnightly** one (`timesPerWeek === 0`) is due on that weekday
 * only in the half of the fortnight it belongs to — "every other
 * Tuesday" rather than every Tuesday. Which half is the task's own
 * `fortnightOffset`, because the date alone cannot say: fortnights are
 * anchored to epoch-even weeks so their boundary never drifts, which
 * leaves the choice to the task and the flip control to the user.
 *
 * Unpinned tasks return false here, as they do from `isPinnedOn` —
 * flexible is not "due today", it is "due some day this week".
 */
export function isDueOn(
  task: {
    plannedWeekdays: string | null;
    timesPerWeek: number;
    fortnightOffset?: number;
  },
  localDate: string,
): boolean {
  const days = parseWeekdays(task.plannedWeekdays);
  if (!isPinnedOn(days, localDate)) return false;
  if (task.timesPerWeek !== 0) return true;
  return weekOfFortnight(localDate) === (task.fortnightOffset ?? 0);
}

/** The fields any surface needs to sort a day's rows. */
export interface DayOrderable {
  plannedWeekdays: string | null;
  timesPerWeek: number;
  fortnightOffset?: number;
  dayOrder?: number | null;
}

/**
 * A task pinned to days that are not this one (ADR-0024 §1).
 *
 * These must not sit in the day's periods. They used to, sorted last,
 * which padded a Tuesday morning with Monday's plan and stopped the
 * day describing the day — the same reason they get their own section
 * on the checklist and on the planner. They stay visible and worth
 * full points: doing Friday's run on Tuesday is still a perfect week.
 *
 * Flexible tasks are never "elsewhere" — an unpinned task belongs to
 * whichever day you give it.
 */
export function pinnedElsewhere(
  task: DayOrderable,
  localDate: string,
): boolean {
  return (
    parseWeekdays(task.plannedWeekdays).length > 0 && !isDueOn(task, localDate)
  );
}

/**
 * Where a task sits against the day's plan: due here, flexible, or
 * pinned elsewhere. Only a tiebreak — `compareForDay` reads it after
 * the user's own arrangement.
 */
export function planRank(task: DayOrderable, localDate: string): number {
  if (isDueOn(task, localDate)) return 0;
  if (parseWeekdays(task.plannedWeekdays).length === 0) return 1;
  return 2;
}

/**
 * Your own order first, the plan's second.
 *
 * `dayOrder` is what dragging writes — persistent, so yesterday's
 * arrangement follows you into today (ADR-0024 §3 as amended, on
 * Henry's call: *"if I put sunlight and supplements at the start of my
 * tasks I want it to stay there"*). Rows never dragged have none and
 * sort after the ones that have, falling back to the plan ordering, so
 * a first drag lifts one row to the top without scrambling the rest.
 *
 * Shared by the checklist and the planner because a day arranged one
 * way on Home and another way in the planner is the same day
 * disagreeing with itself.
 */
export function compareForDay(
  a: DayOrderable,
  b: DayOrderable,
  localDate: string,
): number {
  const ao = a.dayOrder ?? Number.MAX_SAFE_INTEGER;
  const bo = b.dayOrder ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return planRank(a, localDate) - planRank(b, localDate);
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

/**
 * Shown wherever a task is being filed under a communal unit — the add
 * dialog, the edit sheet, and the unit's own panel on the Tasks screen
 * (ADR-0027 §4). Not a gate: the unit takes the task exactly like any
 * other. One line, shown once per surface, never a confirmation step.
 */
export const COMMUNAL_TASK_NOTE =
  "Tasks here score like anywhere else. What matters most in a relationship often isn't a checklist item — press and hold a completion to also count it here, any time.";
