/**
 * The rules behind a day's plan (spec §§3–4, windows-and-pins.md §3):
 * which events a day holds, and how each open task reaches `planDay`.
 * Pure, so they're tested without a database; `dayPlan.ts` reads the
 * rows and calls them.
 *
 * **Never changes a score** (ADR-0039 §12). Nothing here reads a point
 * value, and nothing here is saved.
 */
import {
  addDays,
  isDueOn,
  spreadFlexibleRuns,
  weekStart,
  type OpenTask,
  type TierRank,
  type TimeRange,
} from "@glide/scoring";

import type { TodayTask } from "./today";

/** An event row as the day reads it: times, repeat and skips. */
export interface EventRow {
  readonly id: string;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  readonly plannedWeekdays: string | null;
  readonly timesPerWeek: number;
  readonly fortnightOffset: number;
  readonly oneOffSize: string | null;
  readonly oneOffDate: string | null;
  readonly repeatFrom: string | null;
  readonly repeatUntil: string | null;
  /** Skipped runs and weeks, Away days and cleared days (`withSchedule`). */
  readonly skippedDates: ReadonlySet<string>;
}

/**
 * The events on `date`, earliest first: a repeating one due that day
 * by its days, bounds and skips, or a one-time one dated that day. An
 * event without both times can't be placed and is left out; the event
 * sheet never saves one (ADR-0038).
 */
export function eventsOn<T extends EventRow>(rows: readonly T[], date: string): T[] {
  return rows
    .filter((e) => e.startMinute !== null && e.endMinute !== null)
    .filter((e) =>
      e.oneOffSize != null
        ? e.oneOffDate === date && !e.skippedDates.has(date)
        : isDueOn(e, date),
    )
    .sort((a, b) => a.startMinute! - b.startMinute! || a.id.localeCompare(b.id));
}

/** An event's time, for `dayHours`. */
export const eventRange = (e: EventRow): TimeRange => ({
  start: e.startMinute!,
  end: e.endMinute!,
});

/** A unit's tier as `planDay` ranks it. A commitment, which has no
 *  tier, ranks with Important: its work is scheduled, not ranked. */
export function tierRankOf(tier: string | null | undefined): TierRank {
  if (tier === "top") return 0;
  if (tier === "background") return 2;
  return 1;
}

/**
 * A flexible task: life work with runs to do this week on no day in
 * particular. Its runs on a future day are spread over the days with
 * the most room (§3.5); today it's offered until they're done.
 */
export function isFlexible(t: TodayTask): boolean {
  return (
    t.kind === "task" &&
    !t.commitment &&
    t.oneOffSize === null &&
    (t.plannedWeekdays === null || t.plannedWeekdays === "") &&
    t.timesPerWeek !== 7
  );
}

/** Runs a flexible task still owes this week. */
export const runsLeft = (t: TodayTask): number => Math.max(0, t.goalCount - t.doneCount);

/**
 * The days a future day's flexible runs are spread over: what's left
 * of its week, from tomorrow if that week is this one.
 */
export function spreadDays(date: string, today: string): string[] {
  const start = weekStart(date);
  const first = start > today ? start : addDays(today, 1);
  const out: string[] = [];
  for (let d = first; d <= addDays(start, 6); d = addDays(d, 1)) out.push(d);
  return out;
}

/** Whether a flexible task shows on a future `date`, given each day's
 *  free minutes this week (§3.5). Display only. */
export function spreadsTo(
  t: TodayTask,
  date: string,
  free: readonly { readonly date: string; readonly freeMinutes: number }[],
): boolean {
  return spreadFlexibleRuns(runsLeft(t), free).includes(date);
}

export interface TaskFacts {
  readonly tierRank: TierRank;
  /** Its place in your order within its unit. */
  readonly unitOrder: number;
  readonly createdAt: string;
  readonly goalLinked: boolean;
}

/**
 * One of the day's tasks as `planDay` sees it, or null when it isn't
 * open work on this day at all: an event (events cut windows, they
 * don't go in them), a skipped run, or a session already done early.
 *
 * - **Due** is due on this day itself: every day, pinned here, or a
 *   one-off dated here.
 * - **Carried** is open work from an earlier day: a one-off past its
 *   date, or a run pinned to a day this week that's gone (ADR-0039 §8).
 *   It's shown again, never counted as owed.
 * - **Planned later** is work planned for a later day: pinnable, never
 *   suggested (§3.2). On a future day a flexible task that isn't
 *   spread there counts as planned later too, so a pin still shows.
 */
export function toOpenTask(
  t: TodayTask,
  date: string,
  facts: TaskFacts,
  { spreadHere = true }: { spreadHere?: boolean } = {},
): OpenTask | null {
  if (t.kind === "event" || t.skippedToday || t.doneAheadOn !== null) return null;
  const plannedOn = t.plannedOn ?? (t.oneOffDate !== null ? t.oneOffDate : null);
  const plannedLater = (plannedOn !== null && plannedOn > date) || !spreadHere;
  const carried = plannedOn !== null && plannedOn < date;
  return {
    taskId: t.id,
    size: t.size ?? t.oneOffSize,
    dueToday: t.band === "due" && !carried && !plannedLater,
    carried,
    goalLinked: facts.goalLinked,
    partOfDay: t.partOfDay,
    tierRank: facts.tierRank,
    unitOrder: facts.unitOrder,
    createdAt: facts.createdAt,
    clockMinute: t.startMinute,
    dueDate: t.oneOffDue,
    owesRun: t.band !== "doneThisWeek",
    plannedLater,
  };
}
