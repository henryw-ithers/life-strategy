/**
 * Achievements (ADR-0047): defined and awarded by the app, never set
 * up. Each is a **series** counting one thing, with five **ranks**
 * whose thresholds climb steeply to a top that takes years.
 *
 * Pure: the data layer gathers the counts, and this says what they've
 * earned and what's next. **Never a grade** (ADR-0047): nothing here
 * reaches a `DayScore`.
 *
 * The rules a series keeps (ADR-0047 §§4–5):
 *
 * - **Earned is kept.** A run's rank comes from its longest run, a
 *   count's from its total, so nothing earned is ever taken back.
 * - **Progress is honest and quiet.** A locked rank shows progress, a
 *   run's from its current run; a run that ends just starts counting
 *   again, and nothing here says so.
 * - **Plan weeks are counts and runs only**: never a rate, a
 *   percentage, or a count of weeks not met.
 */
import { computeStreak, type Streak } from "./streak";
import { sizeMinutes } from "./fill";
import type { TaskSize } from "./windows";

export const RANKS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export type Rank = (typeof RANKS)[number];

/** A threshold for each rank, Bronze first. */
export type Thresholds = readonly [number, number, number, number, number];

/** What a series is earned for. */
export type Subject = "task" | "unit" | "area" | "commitment" | "all";

export type SeriesId =
  | "taskCompletions"
  | "unitCompletions"
  | "areaCompletions"
  | "unitHours"
  | "commitmentHours"
  | "everyDayStreak"
  | "weeklyTargetTotal"
  | "weeklyTargetRun"
  | "wholeUnitTotal"
  | "wholeUnitRun"
  | "attended"
  | "goodDays"
  | "greatDays"
  | "greatDayRun"
  | "activities"
  | "flaggedDays";

export interface Series {
  readonly id: SeriesId;
  readonly subject: Subject;
  /** A run (in a row) rather than a total. */
  readonly run: boolean;
  readonly thresholds: Thresholds;
  /** What a threshold counts, for "Gold: 100 completions". */
  readonly counts: string;
}

/**
 * The catalogue (ADR-0047 §3). A first pass at the thresholds,
 * accepted with the ADR: steep, so the first rank comes soon and the
 * top is a genuine feat (Henry, 2026-10-21: peaks "all the way to
 * 1000"). Weeks peak lower than days: 520 weeks is ten years.
 */
export const SERIES: readonly Series[] = [
  { id: "taskCompletions", subject: "task", run: false, thresholds: [20, 50, 100, 250, 1000], counts: "completions" },
  { id: "unitCompletions", subject: "unit", run: false, thresholds: [50, 150, 400, 1000, 2500], counts: "completions" },
  { id: "areaCompletions", subject: "area", run: false, thresholds: [50, 150, 400, 1000, 2500], counts: "completions" },
  { id: "unitHours", subject: "unit", run: false, thresholds: [10, 50, 150, 500, 1000], counts: "hours" },
  { id: "commitmentHours", subject: "commitment", run: false, thresholds: [10, 50, 150, 500, 1000], counts: "hours" },
  { id: "everyDayStreak", subject: "task", run: true, thresholds: [7, 30, 100, 365, 1000], counts: "days in a row" },
  { id: "weeklyTargetTotal", subject: "task", run: false, thresholds: [4, 12, 52, 156, 520], counts: "weeks on target" },
  { id: "weeklyTargetRun", subject: "task", run: true, thresholds: [2, 4, 12, 52, 156], counts: "weeks in a row on target" },
  { id: "wholeUnitTotal", subject: "unit", run: false, thresholds: [4, 12, 52, 156, 520], counts: "weeks with every task on target" },
  { id: "wholeUnitRun", subject: "unit", run: true, thresholds: [2, 4, 12, 52, 156], counts: "weeks in a row with every task on target" },
  { id: "attended", subject: "commitment", run: false, thresholds: [10, 25, 100, 250, 1000], counts: "events attended" },
  { id: "goodDays", subject: "all", run: false, thresholds: [10, 30, 100, 365, 1000], counts: "days at 80 or above" },
  { id: "greatDays", subject: "all", run: false, thresholds: [5, 20, 100, 365, 1000], counts: "days at 90 or above" },
  { id: "greatDayRun", subject: "all", run: true, thresholds: [3, 7, 30, 100, 365], counts: "days in a row at 90 or above" },
  { id: "activities", subject: "all", run: false, thresholds: [10, 50, 150, 500, 1000], counts: "things logged" },
  { id: "flaggedDays", subject: "all", run: false, thresholds: [10, 50, 150, 500, 1000], counts: "days worth remembering" },
];

export const seriesById = (id: SeriesId): Series => SERIES.find((s) => s.id === id)!;

/** How many ranks a value has reached, 0 to 5. */
export function ranksReached(thresholds: Thresholds, value: number): number {
  return thresholds.filter((t) => value >= t).length;
}

/** The highest rank reached, or null. */
export function topRank(thresholds: Thresholds, value: number): Rank | null {
  const n = ranksReached(thresholds, value);
  return n === 0 ? null : RANKS[n - 1]!;
}

/** The next rank and what it needs, or null once Diamond is earned. */
export function nextRank(thresholds: Thresholds, value: number): { rank: Rank; threshold: number } | null {
  const n = ranksReached(thresholds, value);
  return n >= RANKS.length ? null : { rank: RANKS[n]!, threshold: thresholds[n]! };
}

// ── Runs ────────────────────────────────────────────────────────────

/** One week of one task (or one unit), for plan-week series. */
export interface PlanWeek {
  /** Its Sunday. */
  readonly weekStart: string;
  /** Met: the week's target was reached by its end. */
  readonly met: boolean;
  /** A week with nothing asked (Away all week, no target): it neither
   *  counts nor breaks a run. */
  readonly skipped: boolean;
}

/** Weeks met in total, and the current and longest run of them. Weeks
 *  are in order; skipped weeks are passed over. */
export function weekRuns(weeks: readonly PlanWeek[]): { total: number; current: number; longest: number } {
  let total = 0;
  let run = 0;
  let longest = 0;
  for (const w of weeks) {
    if (w.skipped) continue;
    if (w.met) {
      total += 1;
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return { total, current: run, longest };
}

/** A settled day for score series: its grade, or null when it wasn't
 *  graded (a day off, Away, nothing due), which neither counts nor
 *  breaks a run. */
export interface GradedDay {
  readonly date: string;
  readonly grade: number | null;
}

/** Days at or above `floor`, in total and as runs. Days are in order. */
export function gradeRuns(days: readonly GradedDay[], floor: number): { total: number; current: number; longest: number } {
  return weekRuns(
    days.map((d) => ({ weekStart: d.date, met: d.grade !== null && d.grade >= floor, skipped: d.grade === null })),
  );
}

/** An every-day task's run (ADR-0004 §5's streak rules): days off and
 *  Away days bridge it, and today not done yet isn't a break. */
export function everyDayRun(done: readonly string[], daysOff: readonly string[], today: string): Streak {
  return computeStreak({ done, daysOff, today });
}

// ── Time ────────────────────────────────────────────────────────────

/** "Took about…", in minutes: 1 minute to 12 hours. */
export const TOOK_ABOUT_RANGE = { min: 1, max: 12 * 60 } as const;

export function clampTookAbout(minutes: number): number {
  if (!Number.isFinite(minutes)) return TOOK_ABOUT_RANGE.min;
  return Math.min(TOOK_ABOUT_RANGE.max, Math.max(TOOK_ABOUT_RANGE.min, Math.round(minutes)));
}

/**
 * The time a tick counts for, in minutes: "Took about…" when set, else
 * an event's own length, else the task's size (0.5, 1 or 2 hours; no
 * size is Normal), either of the last two scaled by how much was done.
 */
export function tickMinutes(tick: {
  readonly size: TaskSize | null;
  readonly durationMinutes?: number | null;
  readonly tookMinutes?: number | null;
  readonly fraction?: number;
}): number {
  const took = tick.tookMinutes;
  if (took != null) return clampTookAbout(took);
  const duration = tick.durationMinutes;
  const whole = duration != null && duration > 0 ? duration : sizeMinutes(tick.size);
  return whole * Math.min(1, Math.max(0, tick.fraction ?? 1));
}
