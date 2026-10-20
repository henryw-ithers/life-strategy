/**
 * Repeating series as the event sheet and the commitment screen change
 * them (ADR-0040 §§1–2, Phase 7), as pure functions so they're tested
 * off-device. The writes are in `seriesWrites.ts`.
 */
import { addDays, editWindowStart, isDueOn, weekStart } from "@glide/scoring";

export interface Bounds {
  repeatFrom: string | null;
  repeatUntil: string | null;
}

/** How far ahead a series with no end, or a commitment, lists weeks. */
export const WEEKS_AHEAD = 26;

export interface SeriesWeek {
  /** The week's first day (Sunday). */
  weekStart: string;
  /** Only weeks that haven't started can be skipped whole (EC-25). */
  skippable: boolean;
}

/**
 * A series' weeks for "Skip weeks ›" (spec §5.8): from this week, or the
 * series' first if that's later, to its last, or 26 weeks on with no
 * end. This week is listed but can't be switched off.
 */
export function seriesWeeks(bounds: Bounds, today: string): SeriesWeek[] {
  const thisWeek = weekStart(today);
  const first = bounds.repeatFrom && weekStart(bounds.repeatFrom) > thisWeek ? weekStart(bounds.repeatFrom) : thisWeek;
  const last = bounds.repeatUntil
    ? weekStart(bounds.repeatUntil)
    : addDays(thisWeek, (WEEKS_AHEAD - 1) * 7);
  const out: SeriesWeek[] = [];
  for (let w = first; w <= last && out.length < WEEKS_AHEAD; w = addDays(w, 7)) {
    out.push({ weekStart: w, skippable: w > thisWeek });
  }
  return out;
}

/** The next 26 weeks, from next week: "Skip a week…" on a commitment
 *  (spec §5.5). A week that has started can't be skipped whole. */
export function commitmentWeeks(today: string): string[] {
  const next = addDays(weekStart(today), 7);
  return Array.from({ length: WEEKS_AHEAD }, (_, i) => addDays(next, i * 7));
}

/**
 * "This and following" (ADR-0040 §2): the old series ends the day
 * before `date` and a new one starts on it. Null when `date` is on or
 * before the series' start, where "this and following" is the whole
 * series.
 */
export function splitSeries(
  bounds: Bounds,
  date: string,
): { old: Bounds; next: Bounds } | null {
  if (bounds.repeatFrom !== null && date <= bounds.repeatFrom) return null;
  return {
    old: { repeatFrom: bounds.repeatFrom, repeatUntil: addDays(date, -1) },
    next: { repeatFrom: date, repeatUntil: bounds.repeatUntil },
  };
}

/**
 * Which of a series' skips go with the new series when it splits on
 * `date` (EC-27): skipped runs from the date on, and skipped weeks that
 * start on or after it, move. A skipped week the split falls inside
 * covers days of both series, so it's copied.
 */
export function movedSkips(
  skips: readonly { id: string; kind: "occurrence" | "taskWeek"; localDate: string }[],
  date: string,
): { move: string[]; copy: string[] } {
  const move: string[] = [];
  const copy: string[] = [];
  for (const s of skips) {
    if (s.kind === "occurrence") {
      if (s.localDate >= date) move.push(s.id);
    } else if (s.localDate >= date) {
      move.push(s.id);
    } else if (addDays(s.localDate, 6) >= date) {
      copy.push(s.id);
    }
  }
  return { move, copy };
}

/**
 * Whether an ended series can be archived (ADR-0040 §1, clarified
 * 2026-10-20): once its last day is before the edit window, so every
 * day it ran on has settled and archiving it can't take its ticks off a
 * day still being graded. A day reads only active tasks.
 */
export function archiveDue(repeatUntil: string | null, today: string): boolean {
  return repeatUntil !== null && repeatUntil < editWindowStart(today);
}

/**
 * Whether new bounds take away a run due today (ADR-0040 §3, clarified
 * 2026-10-20). Such a change empties today on the day itself, like a
 * same-day skip, so it's recorded as one: the day can then never
 * become a rest day by being emptied.
 */
export function boundsCutToday(
  task: { plannedWeekdays: string | null; timesPerWeek: number; fortnightOffset?: number },
  before: Bounds,
  after: Bounds,
  today: string,
): boolean {
  return isDueOn({ ...task, ...before }, today) && !isDueOn({ ...task, ...after }, today);
}
