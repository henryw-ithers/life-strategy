/**
 * The one line of text under a checklist row — the pure half, so the
 * rules for what it says can be tested (ADR-0013).
 *
 * The line exists to say the most useful true thing about a row, and
 * there is only one line. What earns it, in order:
 *
 * 1. **Progress**, when the task is part done. It is the most specific
 *    fact about the row and the only one a tap is about to change, and
 *    it counts up — "Half done", never "half left" (ADR-0014 §5).
 * 2. **The week's count** — "2nd of 5 this week" — but only for a task
 *    whose goal *is* a count. See `countsRuns`.
 * 3. **A daily task's run**, from a week up.
 *
 * Ahead of all of them, a session **done ahead** says when — it is the
 * one thing about that row that is not obvious from a tick.
 */

/** The row fields the caption reads. */
export interface CaptionTask {
  timesPerWeek: number;
  band: "due" | "week" | "doneThisWeek";
  completedToday: boolean;
  doneCount: number;
  goalCount: number;
  pointsIfCompletedNow: number;
  streak: number | null;
  progress: number;
  allowsPartial: boolean;
  oneOffSize: string | null;
  /** Filed under a commitment or one of its parts. */
  commitment: boolean;
  /** The earlier day this session was done on, if it was done ahead. */
  doneAheadOn: string | null;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "Done ahead · Tue" — a fact about when, never about lateness. */
export function doneAheadLabel(localDate: string): string {
  // Noon UTC, so no time zone can move a `YYYY-MM-DD` onto another day.
  const day = new Date(`${localDate}T12:00:00Z`).getUTCDay();
  return `Done ahead · ${WEEKDAY[day]}`;
}

/** "Half done" — what a running total reads as (§5, never a deficit). */
export function progressLabel(progress: number): string | null {
  if (progress <= 0) return null;
  if (progress >= 1) return "Done";
  if (progress < 0.375) return "A quarter done";
  if (progress < 0.625) return "Half done";
  return "Three quarters done";
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/**
 * Whether "Nth of M this week" means anything for this task.
 *
 * It does for a task whose goal is a count — run three times this week,
 * on whichever days. It does not for:
 *
 * - **A part-credit task.** Its measure is how far through it you are,
 *   not how many times you touched it; a count would call a quarter on
 *   Monday and a quarter on Tuesday "2nd of 3", which is true of the
 *   rows and false of the work. Henry, 2026-09-30: *"for a task that
 *   has part credit, why would the 3 of 5 this week note even exist?"*
 * - **A one-off.** It happens once. "1st of 1 this week" states the
 *   cadence it does not have.
 * - **Commitment work.** It is scheduled, not counted — the lecture is
 *   on Monday, Wednesday and Friday, and "2nd of 3 this week" only
 *   restates the timetable. Henry, 2026-09-30: *"the weekly count isn't
 *   really necessary for commitment tasks."*
 * - **A daily task**, whose count is every day and whose line goes to
 *   its run instead.
 */
export function countsRuns(task: CaptionTask): boolean {
  return (
    task.timesPerWeek !== 7 &&
    !task.allowsPartial &&
    task.oneOffSize == null &&
    !task.commitment
  );
}

/**
 * A daily task's run of days.
 *
 * **Only once it's worth saying, and only while it's true.** Below a
 * week there is no run to speak of, and a row that announced "1 day"
 * every time you restarted would be reporting the break rather than
 * the habit. That is the one thing docs/backburner.md warned a streak
 * must never do: its emotional weight lives entirely in the reset.
 *
 * A part-done day **counts toward the run** (Henry, 2026-09-30:
 * "progress isn't linear and some days showing up is what counts"),
 * which `loadDay` gets by reading every completion row, whatever its
 * fraction.
 */
function streakCaption(task: CaptionTask): string | null {
  if (task.streak === null || task.streak < 7) return null;
  return `${task.streak} days`;
}

/** Progress copy stays factual — counts, never deficits (ADR-0008).
 *  Ordinal phrasing: the run at hand — "2nd of 5 this week" is the
 *  one just done (checked) or the one a tap would log (unchecked). */
function countCaption(task: CaptionTask): string | null {
  if (!countsRuns(task)) return null;
  const span = task.timesPerWeek === 0 ? "fortnight" : "week";
  const at = task.completedToday ? task.doneCount : task.doneCount + 1;
  if (task.band === "doneThisWeek") {
    return `${task.goalCount} of ${task.goalCount} this ${span} · +${task.pointsIfCompletedNow} for another`;
  }
  return `${ordinal(at)} of ${task.goalCount} this ${span}`;
}

/** The row's one line, or null when nothing is worth the space. */
export function rowCaption(task: CaptionTask): string | null {
  if (task.doneAheadOn !== null) return doneAheadLabel(task.doneAheadOn);
  if (task.progress > 0 && task.progress < 1) return progressLabel(task.progress);
  return countCaption(task) ?? streakCaption(task);
}
