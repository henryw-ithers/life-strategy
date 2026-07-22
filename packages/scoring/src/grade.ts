import { EXTRA_RUN_RATE } from "./constants";
import { fortnightStart, weekStart } from "./days";

/**
 * Daily checklist derivation and day-grade computation (ADR-0004 §4 as
 * amended by the checklist build, ADR-0009 §3). Pure functions over
 * plain data; the app's db layer feeds them rows.
 */

export interface ChecklistTask {
  taskId: string;
  unitId: string;
  pointValue: number;
  /** 1–7 (7 = daily); 0 = once per fortnight. */
  timesPerWeek: number;
}

export interface CompletionRow {
  taskId: string;
  localDate: string;
}

/**
 * daily: a 7×/week commitment — the day's denominator.
 * week: frequency task with runs remaining (or run today).
 * doneThisWeek: goal met on previous days; still tappable for an
 * extra run at reduced credit.
 */
export type TaskBand = "daily" | "week" | "doneThisWeek";

export interface TaskDayStatus {
  taskId: string;
  band: TaskBand;
  completedToday: boolean;
  /** Completions this week (fortnight for 0-frequency), incl. today. */
  doneCount: number;
  /** timesPerWeek, or 1 for fortnightly tasks. */
  goalCount: number;
  /** True when today's (or the next) completion exceeds the goal. */
  extraToday: boolean;
  /** What a completion now would earn: full value, or the extra rate. */
  pointsIfCompletedNow: number;
}

/** Credit for a run beyond the weekly goal (bonus pool, ADR-0009 cap). */
export function extraRunPoints(pointValue: number): number {
  return Math.round(pointValue * EXTRA_RUN_RATE);
}

/**
 * Band and progress for each task on `date`. Banding ignores today's
 * completions so rows never jump while the user watches: a task sits
 * in `doneThisWeek` only when previous days already met its goal.
 * One completion per task per day is assumed (enforced at write time).
 */
export function deriveChecklist(
  tasks: ChecklistTask[],
  completions: CompletionRow[],
  date: string,
): TaskDayStatus[] {
  const ws = weekStart(date);
  const fs = fortnightStart(date);
  return tasks.map((t) => {
    const windowStart = t.timesPerWeek === 0 ? fs : ws;
    const inWindow = completions.filter(
      (c) => c.taskId === t.taskId && c.localDate >= windowStart && c.localDate <= date,
    );
    const completedToday = inWindow.some((c) => c.localDate === date);
    const doneBeforeToday = inWindow.length - (completedToday ? 1 : 0);
    const goalCount = t.timesPerWeek === 0 ? 1 : t.timesPerWeek;
    const extraToday = doneBeforeToday >= goalCount;
    const band: TaskBand =
      t.timesPerWeek === 7 ? "daily" : extraToday ? "doneThisWeek" : "week";
    return {
      taskId: t.taskId,
      band,
      completedToday,
      doneCount: inWindow.length,
      goalCount,
      extraToday,
      pointsIfCompletedNow: extraToday ? extraRunPoints(t.pointValue) : t.pointValue,
    };
  });
}

export interface DayTaskInput {
  unitId: string;
  pointValue: number;
  /** 1–7 (7 = daily); 0 = once per fortnight. */
  timesPerWeek: number;
  completedToday: boolean;
  /** Today's completion was beyond the weekly goal (extra run). */
  extraToday?: boolean;
}

/** One credited activity's tags, in log order. */
export type ActivityCredit = { unitId: string; pointsCredited: number }[];

export interface DayScoreInput {
  kind: "normal" | "rest" | "special";
  /** Special days only: grade = rating × 10 (ADR-0004 §3). */
  satisfactionRating?: number | null;
  /** Every active task, whatever its cadence. */
  tasks: DayTaskInput[];
  /** Sum of extra-run pointsEarned completed on this day. */
  extraRunCredit?: number;
  /** Credited activities, chronological (ADR-0009 §3). */
  activities?: ActivityCredit[];
}

export interface DayScore {
  /** The day's constant denominator: total weekly commitment ÷ 7. */
  possible: number;
  /** All points earned this day: within-goal completions at full
   *  value, extra runs at their reduced credit, activity credit. */
  earned: number;
  /** Grade, or null when there is nothing to grade (rest days; special
   *  days without a rating yet; days with no tasks). May exceed 100 —
   *  several weekly runs on one day show honestly (§4 amendment). */
  base: number | null;
}

/** A task's share of every day's denominator: its weekly commitment
 *  spread evenly (fortnightly tasks spread over 14 days). */
export function dayShare(pointValue: number, timesPerWeek: number): number {
  return timesPerWeek === 0
    ? pointValue / 14
    : (pointValue * timesPerWeek) / 7;
}

/**
 * The day's number (ADR-0004 §4 as amended, formula v3): one
 * denominator for everything. Each task contributes its per-day share
 * of the weekly commitment to `possible`; any completion earns its
 * full point value that day, extra runs earn their reduced credit,
 * and activity credit adds directly — all one additive score, so
 * every check moves the number and the weekly grade is the plain
 * average of daily grades.
 */
export function computeDayScore(input: DayScoreInput): DayScore {
  if (input.kind === "rest") {
    return { possible: 0, earned: 0, base: null };
  }
  if (input.kind === "special") {
    const rating = input.satisfactionRating ?? null;
    return {
      possible: 100,
      earned: rating === null ? 0 : rating * 10,
      base: rating === null ? null : rating * 10,
    };
  }

  const possible = input.tasks.reduce(
    (a, t) => a + dayShare(t.pointValue, t.timesPerWeek),
    0,
  );
  const earnedDirect = input.tasks.reduce(
    (a, t) => a + (t.completedToday && !t.extraToday ? t.pointValue : 0),
    0,
  );
  const activityCredit = (input.activities ?? []).reduce(
    (a, tags) => a + tags.reduce((b, tag) => b + tag.pointsCredited, 0),
    0,
  );

  const earned = earnedDirect + (input.extraRunCredit ?? 0) + activityCredit;
  return {
    possible,
    earned,
    base: possible > 0 ? Math.round((earned / possible) * 100) : null,
  };
}

/**
 * Weekly and monthly grades (ADR-0004 §5): points earned ÷ points
 * possible over the period, purely additive — no curves or weighting.
 * Every day already reduces to an {earned, possible} pair (rest days
 * are {0, 0} and drop out on their own), so this one reduce serves
 * both periods; only the input range differs.
 */
export function aggregateGrade(
  days: { earned: number; possible: number }[],
): DayScore {
  const earned = days.reduce((a, d) => a + d.earned, 0);
  const possible = days.reduce((a, d) => a + d.possible, 0);
  return {
    possible,
    earned,
    base: possible > 0 ? Math.round((earned / possible) * 100) : null,
  };
}
