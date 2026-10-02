/**
 * Events (ADR-0038) — the rules, free of React Native imports so
 * they can be tested here. The writes are `addEvent` and
 * `updateEvent` in `tasks.ts`.
 *
 * An event — the word iPhone Calendar uses for a block of time you
 * attend — is a class, a shift, a practice, a doctor's visit. It is a
 * task in every other way — ticked, and paid from its unit's weight or
 * its commitment's band — so it is stored as one,
 * with `kind = 'event'`. What makes it an event is that
 * **its time is the point of it**, so a start and an end are required.
 * That is the one place a clock time is required (ADR-0036 is about
 * tasks, and stays true of them).
 */

export interface EventInput {
  title: string;
  /** ISO weekdays it repeats on, Monday 1 … Sunday 7. Empty for a
   *  one-time event. */
  weekdays: readonly number[];
  /** The one day it happens, for a one-time event. */
  date: string | null;
  /** Minutes from local midnight. */
  startMinute: number | null;
  endMinute: number | null;
  /** Where it happens — a room, an address. Optional. */
  location?: string | null;
  /** Anything else worth having with it. Optional; stored as the
   *  task's description. */
  notes?: string | null;
}

/** Trimmed, with an empty string read as nothing. */
export function optionalText(value: string | null | undefined): string | null {
  const t = value?.trim() ?? "";
  return t.length > 0 ? t : null;
}

/** The shortest an event may be, matching the time picker. */
export const MIN_EVENT_MINUTES = 15;

/**
 * What is stopping this event being saved, in words, or null.
 * The sheet shows it in place of a disabled button that says nothing.
 */
export function eventProblem(a: EventInput): string | null {
  if (a.title.trim().length === 0) return "Give it a name.";
  if (a.weekdays.length === 0 && a.date === null) {
    return "Pick the days it repeats on, or the one day it happens.";
  }
  if (a.startMinute === null || a.endMinute === null) {
    return "An event needs a start and an end.";
  }
  if (a.endMinute - a.startMinute < MIN_EVENT_MINUTES) {
    return "It has to end at least 15 minutes after it starts.";
  }
  return null;
}

/** How often a repeating event happens: one run per day picked. */
export function eventTimesPerWeek(weekdays: readonly number[]): number {
  return Math.max(1, new Set(weekdays).size);
}
