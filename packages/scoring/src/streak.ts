/**
 * Streaks, for habit goals and daily tasks (decided 2026-08-16; the
 * reasoning is in docs/backburner.md's Streaks entry).
 *
 * **A streak is shown, never enforced** (ADR-0004 §5). Nothing here
 * feeds `computeDayScore`, and nothing here may. The grade is purely
 * additive and a run of days is a statistic beside it, not a
 * multiplier on it.
 *
 * Two rules decide everything below:
 *
 * - **Strict consecutive days.** One miss resets to zero. Henry's call
 *   over the gentler alternative; Lally's finding that a single missed
 *   occasion doesn't materially affect habit formation would have
 *   supported forgiving one, and didn't win.
 * - **A declared day off is skipped, never a break** (ADR-0004 §3
 *   already requires this). It is not a done day either: it drops out
 *   of the sequence entirely, exactly as it drops out of the grade.
 */
import { addDays } from "./days";

export interface StreakInput {
  /** Local dates the thing was done, `'YYYY-MM-DD'`. Order and
   *  duplicates don't matter. */
  done: readonly string[];
  /** Declared days off. Skipped rather than counted or broken. */
  daysOff?: readonly string[];
  /** Today, `'YYYY-MM-DD'`. */
  today: string;
}

export interface Streak {
  /**
   * The run ending today, or ending yesterday when today is still
   * open. **An unfinished today never breaks a streak** — the day
   * hasn't happened yet, and a number that dropped to zero every
   * morning would be reporting the clock rather than the person.
   */
  current: number;
  /** The longest run ever recorded. Milestones read this rather than
   *  `current`, so passing 30 and then missing a day doesn't take the
   *  rung back. */
  longest: number;
}

/**
 * Walking back from today: a done day extends the run, a day off is
 * skipped, anything else ends it. The one exception is today itself,
 * which is allowed to be undone.
 */
function currentRun(
  doneSet: ReadonlySet<string>,
  offSet: ReadonlySet<string>,
  today: string,
  earliest: string,
): number {
  let streak = 0;
  let cursor = today;
  let atToday = true;
  // Bounded by the earliest done date: without it, a long tail of
  // days off would walk backwards forever.
  while (cursor >= earliest) {
    if (offSet.has(cursor)) {
      cursor = addDays(cursor, -1);
      atToday = false;
      continue;
    }
    if (doneSet.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
      atToday = false;
      continue;
    }
    if (atToday) {
      // Today is still open. Skip it and keep looking back.
      cursor = addDays(cursor, -1);
      atToday = false;
      continue;
    }
    break;
  }
  return streak;
}

/** The longest run anywhere in the history, days off bridging rather
 *  than breaking. */
function longestRun(
  done: readonly string[],
  offSet: ReadonlySet<string>,
  doneSet: ReadonlySet<string>,
): number {
  const sorted = [...new Set(done)].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    if (previous === null) {
      run = 1;
    } else {
      // Walk the gap: it only counts as contiguous if every day in
      // between was a declared day off.
      let cursor = addDays(previous, 1);
      let contiguous = true;
      while (cursor < day) {
        if (!offSet.has(cursor) && !doneSet.has(cursor)) {
          contiguous = false;
          break;
        }
        cursor = addDays(cursor, 1);
      }
      run = contiguous ? run + 1 : 1;
    }
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}

export function computeStreak(input: StreakInput): Streak {
  const doneSet = new Set(input.done);
  const offSet = new Set(input.daysOff ?? []);
  if (doneSet.size === 0) return { current: 0, longest: 0 };

  const earliest = [...doneSet].sort()[0]!;
  return {
    current: currentRun(doneSet, offSet, input.today, earliest),
    longest: longestRun(input.done, offSet, doneSet),
  };
}

/**
 * Which habit rungs the run has passed, in days.
 *
 * **Computed, not stored** (ADR-0030 §5). This used to read
 * `milestone` rows that `setGoalMetric` seeded from `HABIT_LADDER` at
 * the moment a goal became a habit — which meant the app wrote three
 * rows to record a constant it already had, and a habit goal's only
 * structure lived in a table it shared with a completely different
 * concept. The ladder is a research number and the streak is the
 * measurement; between them there is nothing left to persist.
 *
 * Reads `longest`, not `current`: a rung you reached is reached, and
 * hitting 30 then missing a day should not take it back.
 */
export function habitRungsReached(streak: Streak): number[] {
  return HABIT_LADDER.filter((days) => streak.longest >= days);
}

/**
 * The date a run **first** reached `days`, or null if it never has.
 *
 * A rung is an achievement, and an achievement belongs in the month it
 * happened. The old ladder asked the user when — a rung was often
 * noticed late, and filing "I passed 30 days" in the wrong month puts a
 * false entry in the log of a life (ADR-0015 §5). Nothing has to ask
 * any more: the completion dates *are* the evidence, so the day is
 * derived rather than remembered.
 *
 * Walks the same contiguity rule `longestRun` does — a declared day off
 * bridges a run, anything else ends it — and returns the first date at
 * which any run stood at `days` days long.
 */
export function rungReachedOn(input: StreakInput, days: number): string | null {
  if (days <= 0) return null;
  const doneSet = new Set(input.done);
  const offSet = new Set(input.daysOff ?? []);
  const sorted = [...doneSet].sort();

  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    if (previous === null) {
      run = 1;
    } else {
      let cursor = addDays(previous, 1);
      let contiguous = true;
      while (cursor < day) {
        if (!offSet.has(cursor) && !doneSet.has(cursor)) {
          contiguous = false;
          break;
        }
        cursor = addDays(cursor, 1);
      }
      run = contiguous ? run + 1 : 1;
    }
    if (run >= days) return day;
    previous = day;
  }
  return null;
}

/** The ladder every habit goal in the content library uses. 66 is
 *  Lally's median time to automaticity, so the top rung is a research
 *  number rather than a round one. */
export const HABIT_LADDER = [7, 30, 66] as const;
