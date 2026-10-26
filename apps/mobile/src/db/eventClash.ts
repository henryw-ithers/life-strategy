/**
 * A new event, or a window, landing on an event already there (Henry,
 * 2026-10-26: "ask if I want to overwrite the existing event"). Pure:
 * which events clash, and what replacing each one means.
 *
 * Replacing never rewrites the past:
 *
 * - a repeating event clashing with a new repeating one **ends** from
 *   today (or is archived, if it hadn't started yet);
 * - a one-time event on a clashing date is **archived**;
 * - a repeating event clashing with something on one date is **skipped**
 *   that day only.
 */
import { inScheduleOn, isoWeekday, parseWeekdays, type TimeRange } from "@glide/scoring";

import type { EventInput } from "./events";
import type { Bounds } from "./seriesRules";

export interface ExistingEvent {
  id: string;
  title: string;
  plannedWeekdays: string | null;
  oneOffDate: string | null;
  startMinute: number | null;
  endMinute: number | null;
  repeatFrom: string | null;
  repeatUntil: string | null;
}

export type Replacement =
  | { id: string; title: string; action: "end" }
  | { id: string; title: string; action: "archive" }
  | { id: string; title: string; action: "skip"; date: string };

const overlaps = (a: TimeRange, b: TimeRange) => a.start < b.end && b.start < a.end;

const timeOf = (e: ExistingEvent): TimeRange | null =>
  e.startMinute !== null && e.endMinute !== null ? { start: e.startMinute, end: e.endMinute } : null;

/** On `date`, what replacing `e` means, or null if it isn't there. */
function onDate(e: ExistingEvent, date: string): Replacement | null {
  if (e.oneOffDate !== null) {
    return e.oneOffDate === date ? { id: e.id, title: e.title, action: "archive" } : null;
  }
  const days = parseWeekdays(e.plannedWeekdays);
  if (!days.includes(isoWeekday(date))) return null;
  if (!inScheduleOn({ repeatFrom: e.repeatFrom, repeatUntil: e.repeatUntil }, date)) return null;
  return { id: e.id, title: e.title, action: "skip", date };
}

/** What a time on one date clashes with: an added window, or a
 *  one-time event. Nothing before today: the past keeps its plan. */
export function clashesOn(
  date: string,
  time: TimeRange,
  existing: readonly ExistingEvent[],
  today: string,
): Replacement[] {
  if (date < today) return [];
  return existing.flatMap((e) => {
    const t = timeOf(e);
    if (t === null || !overlaps(t, time)) return [];
    const r = onDate(e, date);
    return r ? [r] : [];
  });
}

/** What a new event clashes with, from today on. */
export function eventClashes(
  input: EventInput,
  bounds: Bounds | null,
  existing: readonly ExistingEvent[],
  today: string,
): Replacement[] {
  if (input.startMinute === null || input.endMinute === null) return [];
  const time = { start: input.startMinute, end: input.endMinute };
  if (input.weekdays.length === 0) {
    return input.date ? clashesOn(input.date, time, existing, today) : [];
  }
  const from = bounds?.repeatFrom && bounds.repeatFrom > today ? bounds.repeatFrom : today;
  const until = bounds?.repeatUntil ?? null;
  const days = new Set(input.weekdays);
  return existing.flatMap((e): Replacement[] => {
    const t = timeOf(e);
    if (t === null || !overlaps(t, time)) return [];
    if (e.oneOffDate !== null) {
      const d = e.oneOffDate;
      const ahead = d >= from && (until === null || d <= until);
      return ahead && days.has(isoWeekday(d)) ? [{ id: e.id, title: e.title, action: "archive" }] : [];
    }
    const shared = parseWeekdays(e.plannedWeekdays).some((d) => days.has(d));
    const stillRuns = e.repeatUntil === null || e.repeatUntil >= today;
    if (!shared || !stillRuns) return [];
    // One that hasn't started has no past to keep: it goes whole.
    const started = e.repeatFrom === null || e.repeatFrom < today;
    return [{ id: e.id, title: e.title, action: started ? "end" : "archive" }];
  });
}
