/**
 * The rules behind the weekly pass (spec §5.3.2, ADR-0039 §11): which
 * week is "last week", how long a piece of completed work counts for,
 * and when the month's look at the tiers is offered. Pure, so they're
 * tested without a database.
 *
 * **Nothing here counts what wasn't done**: no missed counts, no share
 * of the plan, no comparison with the week before (P15).
 */
import { addDays, sizeMinutes, weekStart } from "@glide/scoring";

import { eventsOn, type EventRow } from "./dayPlanRules";

/** Last week, Sunday to Saturday (ADR-0004 §1): the week before the
 *  one holding `today`. */
export function lastWeek(today: string): { start: string; end: string } {
  const start = addDays(weekStart(today), -7);
  return { start, end: addDays(start, 6) };
}

/** What's left of this week, from today to Saturday: the days the pass
 *  plans. */
export function daysLeft(today: string): string[] {
  const out: string[] = [];
  for (let d = today; d <= addDays(weekStart(today), 6); d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * How long a tick counts for: an event by its length; a task by its
 * size (Normal when it has none); times how much of it was done. Never
 * "Took about…": that's an hours achievement's measure (ADR-0047), and
 * many ticks don't have it.
 */
export function doneMinutes(t: {
  kind: "task" | "event";
  size: "quick" | "normal" | "big" | null;
  startMinute: number | null;
  endMinute: number | null;
  fraction: number;
}): number {
  const whole =
    t.kind === "event" && t.startMinute !== null && t.endMinute !== null
      ? Math.max(0, t.endMinute - t.startMinute)
      : sizeMinutes(t.size);
  return whole * Math.max(0, Math.min(1, t.fraction));
}

/** An activity's minutes, shared evenly across the units it's tagged
 *  with. One logged with no size is a note and counts for nothing. */
export function activityMinutes(
  size: "quick" | "normal" | "big" | null,
  unitIds: readonly string[],
): { unitId: string; minutes: number }[] {
  if (size === null || unitIds.length === 0) return [];
  const each = sizeMinutes(size) / unitIds.length;
  return unitIds.map((unitId) => ({ unitId, minutes: each }));
}

/** The month the tiers were last offered, `YYYY-MM`, is stored; the
 *  first pass of a new month offers them again (spec §5.3.2). */
export const monthOf = (date: string): string => date.slice(0, 7);
export const tiersDue = (lastOffered: string | null, today: string): boolean =>
  lastOffered !== monthOf(today);

/** Whether an event falls on `date` by its days and bounds, skipped or
 *  not: the pass lists a run it turned off, so it can be turned on. */
export const isDueIgnoringSkips = (e: EventRow, date: string): boolean =>
  eventsOn([{ ...e, skippedDates: new Set<string>() }], date).length > 0;
