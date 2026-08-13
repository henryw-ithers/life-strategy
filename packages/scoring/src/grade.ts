import { EXTRA_RUN_RATE, MISSED_DAY_CREDIT, UNPLANNED_CAP } from "./constants";
import { addDays, fortnightStart, weekStart } from "./days";

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
  /** `rest` is stored; the UI calls it "Day off" (ADR-0023 §4). */
  kind: "normal" | "rest" | "special";
  /** Special days only: scales the rating bonus drawn from the
   *  unplanned pool (ADR-0023 §3). No longer the whole grade. */
  satisfactionRating?: number | null;
  /** Every active task, whatever its cadence. */
  tasks: DayTaskInput[];
  /** Sum of extra-run pointsEarned completed on this day. Outside the
   *  cap (ADR-0023 §2) — this is the plan done harder. */
  extraRunCredit?: number;
  /** Credited activities, chronological (ADR-0009 §3). */
  activities?: ActivityCredit[];
}

/** Points earned out of points possible, plus the rendered grade.
 *  Shared by a single day and by any aggregate over days. */
export interface Grade {
  possible: number;
  earned: number;
  base: number | null;
}

export interface DayScore extends Grade {
  /** The day's constant denominator: total weekly commitment ÷ 7. */
  possible: number;
  /** All points earned this day: within-goal completions at full
   *  value, extra runs at their reduced credit, and the capped
   *  unplanned pool. */
  earned: number;
  /** Grade, or null when there is nothing to grade (days off; days
   *  with no tasks). May exceed 100 — several weekly runs on one day
   *  show honestly (§4 amendment), and extra runs are uncapped. */
  base: number | null;
  /** What the unplanned pool actually paid, after the cap. Surfaced so
   *  the day can show "84 +25" rather than silently swallowing credit
   *  the user logged (ADR-0023 §1). */
  unplanned: number;
  /** Credit that was logged but fell outside the cap. Zero on almost
   *  every day; non-zero is the signal the cap is biting. */
  unplannedForgone: number;
}

/** Rating → its draw on the unplanned pool (ADR-0023 §3). A 10-rated
 *  special day contributes the whole cap, a 6-rated one 60% of it. */
export function specialDayBonus(rating: number | null | undefined): number {
  if (rating === null || rating === undefined) return 0;
  return Math.round((rating / 10) * UNPLANNED_CAP);
}

/** A task's share of every day's denominator: its weekly commitment
 *  spread evenly (fortnightly tasks spread over 14 days). */
export function dayShare(pointValue: number, timesPerWeek: number): number {
  return timesPerWeek === 0
    ? pointValue / 14
    : (pointValue * timesPerWeek) / 7;
}

/**
 * The day's number (ADR-0004 §4 as amended, formula v5): one
 * denominator for everything. Each task contributes its per-day share
 * of the weekly commitment to `possible`; any within-goal completion
 * earns its full point value that day and extra runs earn their
 * reduced credit, both without limit.
 *
 * Everything the user did *not* plan — activity credit, and a special
 * day's rating bonus — draws from one shared pool capped at
 * `UNPLANNED_CAP` (ADR-0023). Credit applies chronologically and
 * truncates at the cap, so the first thing logged is the thing that
 * pays; re-ordering the log can't buy more points.
 *
 * Special days are graded like normal days and *add* their rating
 * bonus, rather than replacing the grade with `rating × 10`. A day
 * where grading isn't a meaningful question is a day off, not a
 * special day.
 */
export function computeDayScore(input: DayScoreInput): DayScore {
  // "Day off" in the UI; `rest` on disk (ADR-0023 §4).
  if (input.kind === "rest") {
    return { possible: 0, earned: 0, base: null, unplanned: 0, unplannedForgone: 0 };
  }

  const possible = input.tasks.reduce(
    (a, t) => a + dayShare(t.pointValue, t.timesPerWeek),
    0,
  );
  const earnedDirect = input.tasks.reduce(
    (a, t) => a + (t.completedToday && !t.extraToday ? t.pointValue : 0),
    0,
  );

  // The pool, in the order it was earned: activities as logged, then
  // the special day's own rating. The rating goes last because it is
  // the one credit that isn't tied to a moment in the day.
  const activityCredit = (input.activities ?? []).reduce(
    (a, tags) => a + tags.reduce((b, tag) => b + tag.pointsCredited, 0),
    0,
  );
  const ratingBonus =
    input.kind === "special" ? specialDayBonus(input.satisfactionRating) : 0;
  const unplannedRaw = activityCredit + ratingBonus;
  const unplanned = Math.min(unplannedRaw, UNPLANNED_CAP);

  const earned = earnedDirect + (input.extraRunCredit ?? 0) + unplanned;
  return {
    possible,
    earned,
    base: possible > 0 ? Math.round((earned / possible) * 100) : null,
    unplanned,
    unplannedForgone: unplannedRaw - unplanned,
  };
}

export interface RecordedDay {
  localDate: string;
  earned: number;
  possible: number;
}

export interface PeriodInput {
  /** First day of the period. */
  start: string;
  /** Exclusive upper bound. */
  end: string;
  /** The app's current local date. */
  today: string;
  /** Stored day rows falling inside the period, in any order. */
  recorded: RecordedDay[];
  /** The standard day denominator — constant across days (§4, v3). */
  dailyPossible: number;
  /** The first day the app could grade at all: the local date of the
   *  first diagnostic. Null when no diagnostic has been taken. */
  gradingStart: string | null;
}

/**
 * The days of a period that count toward its grade (ADR-0004 §5).
 *
 * A stored row exists only for a day the user touched, so aggregating
 * over stored rows alone would quietly drop every ignored day out of
 * the denominator — a week where four days went well and three were
 * skipped would grade like a flawless four-day week. §4 is explicit
 * that the denominator is constant across days, so an elapsed normal
 * day with no row still occupies a full `dailyPossible`.
 *
 * What it *earns* is `MISSED_DAY_CREDIT` of that (ADR-0004 §5 as
 * amended 2026-07-30): a day you never opened is treated as half a
 * day rather than a zero. See the constant for the incentive this
 * knowingly accepts.
 *
 * Two exclusions keep that from overreaching:
 *
 * - **Days before `gradingStart`** never counted; there was no plan to
 *   fall short of yet.
 * - **The current day, and anything after it.** A day counts once it
 *   is over — the same reasoning §4 already applies within a week
 *   ("a missed Tuesday is not a miss until the week is out"). Counting
 *   an unfinished day would drop the period grade at every rollover
 *   and walk it back up as the day is worked, which is precisely the
 *   loss-aversion pattern the product excludes by design. Today is
 *   excluded from *both* sides, so it neither drags nor flatters.
 *
 * Rest days are stored as {0, 0} and stay neutral; special days carry
 * their rating in the stored row. Recorded rows always win over the
 * fill.
 */
export function periodDays(
  input: PeriodInput,
): { earned: number; possible: number }[] {
  const byDate = new Map(input.recorded.map((d) => [d.localDate, d]));
  const days: { earned: number; possible: number }[] = [];
  for (let d = input.start; d < input.end; d = addDays(d, 1)) {
    // Dates ascend, so the first unfinished day ends the period.
    if (d >= input.today) break;
    if (input.gradingStart === null || d < input.gradingStart) continue;
    const row = byDate.get(d);
    days.push(
      row
        ? { earned: row.earned, possible: row.possible }
        : {
            earned: Math.round(input.dailyPossible * MISSED_DAY_CREDIT),
            possible: input.dailyPossible,
          },
    );
  }
  return days;
}

/**
 * Weekly and monthly grades (ADR-0004 §5): points earned ÷ points
 * possible over the period, purely additive — no curves or weighting.
 * Every day already reduces to an {earned, possible} pair (rest days
 * are {0, 0} and drop out on their own), so this one reduce serves
 * both periods; only the input range differs. Feed it `periodDays`,
 * not the stored rows directly — see the note there.
 */
export function aggregateGrade(
  days: { earned: number; possible: number }[],
): Grade {
  const earned = days.reduce((a, d) => a + d.earned, 0);
  const possible = days.reduce((a, d) => a + d.possible, 0);
  return {
    possible,
    earned,
    base: possible > 0 ? Math.round((earned / possible) * 100) : null,
  };
}
