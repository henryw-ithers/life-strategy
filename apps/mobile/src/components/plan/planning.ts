/**
 * Weekday pins and part of day (ADR-0024 §1) — the planner's pure half:
 * labels and display order.
 *
 * Which days a task is *scheduled* on is a scoring rule, not a planner
 * one, so it lives in `@glide/scoring` (`schedule.ts`) and is
 * re-exported here for the screens that already import it from this
 * file. Clock times are optional on any task (ADR-0036) and are not
 * handled here.
 */

import type { Weekday } from "@glide/scoring";

import { MIN_TIMES_PER_WEEK } from "./frequency";

export { isDueOn, isoWeekday, parseWeekdays, type Weekday } from "@glide/scoring";

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

/**
 * Shown where a task is being **filed** under a communal unit — the add
 * dialog and the edit sheet (ADR-0027 §4). Not a gate: the unit takes
 * the task exactly like any other. One line, never a confirmation step.
 *
 * **Halved 2026-08-26, and dropped from the Tasks screen's unit panel.**
 * Two sentences and thirty words was a paragraph on a control, and on a
 * panel opened to look at a list it was the app explaining itself to
 * someone who had not asked. Both facts survive the cut: it scores
 * normally, and tagging exists. The reasoning behind them is
 * ADR-0025's, and an ADR is where reasoning belongs.
 */
export const COMMUNAL_TASK_NOTE =
  "Scores like anywhere else — and you can press and hold any completion to also count it here.";
