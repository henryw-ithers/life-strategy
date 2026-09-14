import { isRoutine, normalizeBand, VARIABLE_BAND } from "./bands";
import { DAILY_BUDGET, EXTRA_RUN_RATE } from "./constants";
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
  /** Priced from the commitment band rather than the variable one
   *  (ADR-0032). Ignored when `commitmentBand` is null. */
  isCommitment?: boolean;
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
  /**
   * The commitment band's size on this date, or `null` on an ordinary
   * two-band day (ADR-0032 §1).
   *
   * When set, tasks flagged `isCommitment` are spent from **this** band
   * rather than from the variable one, and the routine and variable
   * bands are scaled into what remains. Without it a commitment task
   * would be counted as ordinary non-daily work and squashed into the
   * 20-point variable cap — the band would price at 60 and the grade
   * would pay 20.
   */
  commitmentBand?: number | null;
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
  /** Always 100 on a graded day (ADR-0027 §1): the whole of the
   *  diagnostic's budget, including weight nothing can earn. */
  possible: number;
  /** All points earned this day: within-goal completions at full
   *  value, extra runs at their reduced credit, and the capped
   *  unplanned pool. */
  earned: number;
  /** Grade, or null when there is nothing to grade (days off; an
   *  empty plan). Above 100 only via extra runs of your own plan
   *  (ADR-0023 §2); the two bands themselves cap at 100. */
  base: number | null;
  /** What the unplanned pool actually paid, after the cap. Surfaced so
   *  the day can show "84 +25" rather than silently swallowing credit
   *  the user logged (ADR-0023 §1). */
  unplanned: number;
  /** Credit that was logged but fell outside the cap. Zero on almost
   *  every day; non-zero is the signal the cap is biting. */
  unplannedForgone: number;
}

/**
 * The score of a **finalized** day, read back from its stored row
 * rather than recomputed.
 *
 * Grades finalize (ADR-0002): once a day is past the edit window its
 * number is a historical fact, not a function of whatever the weights
 * and formula happen to be today. Recomputing it would silently
 * restate the past every time a diagnostic moved the weights — and,
 * after ADR-0023's `FORMULA_VERSION` 5, would restate it under a
 * formula that day was never scored by.
 *
 * `unplanned` is not stored and reads back as 0. Only the day's grade
 * is a historical fact; the breakdown behind it is live-computed
 * detail, and no surface shows it for a settled day.
 */
export function storedDayScore(row: {
  earned: number;
  possible: number;
}): DayScore {
  return {
    possible: row.possible,
    earned: row.earned,
    base: row.possible > 0 ? Math.round((row.earned / row.possible) * 100) : null,
    unplanned: 0,
    unplannedForgone: 0,
  };
}

/** Rating → its draw on the variable band (ADR-0023 §3, ADR-0027 §3).
 *  A 10-rated special day claims the whole band, a 6-rated one 60% of
 *  it — and only ever from the room the day's planned work left. */
export function specialDayBonus(rating: number | null | undefined): number {
  if (rating === null || rating === undefined) return 0;
  return Math.round((rating / 10) * VARIABLE_BAND);
}


/**
 * The day's number (ADR-0027 §1, formula v7): a constant denominator of
 * 100 and two bands allocated separately.
 *
 * **Routine (80).** Daily tasks pay their stored `pointValue`, which
 * `bandPointValues` derived from 80% of their own unit's weight. A unit
 * with no daily task forfeits its share and nobody else receives it
 * (ADR-0027 §2) — that is what makes a plan's coverage decide its
 * ceiling.
 *
 * **Variable (20).** Everything that is not a daily task shares one
 * pool: non-daily completions are credited **first**, then activity
 * credit and a special day's rating fill whatever room is left. That
 * ordering is ADR-0023's "planned work is what pays" preserved inside a
 * single pool — a logged coffee can never displace a task you planned.
 *
 * **Extra runs stay outside both bands** (ADR-0023 §2, unchanged):
 * doing more of your own plan is the one route above 100.
 *
 * What went away, and why: formula v6 made the denominator the weekly
 * commitment spread over seven days (`dayShare`) while a completion
 * still paid its full value, so a completion was worth `7 ÷ f` times its
 * own share and a day of finished work could read **112**. Nothing is
 * amortized here, so nothing can pay more than its band holds.
 */
export function computeDayScore(input: DayScoreInput): DayScore {
  // "Day off" in the UI; `rest` on disk (ADR-0023 §4).
  if (input.kind === "rest") {
    return { possible: 0, earned: 0, base: null, unplanned: 0, unplannedForgone: 0 };
  }

  // The denominator is the whole 100 whenever there is a plan at all,
  // including the weight of units holding nothing — which is the point.
  // An empty plan is not a zero day, it is a day with nothing to grade,
  // and the app shows its own empty state for that.
  const possible = input.tasks.length > 0 ? DAILY_BUDGET : 0;

  // Whether the commitment band applies today, decided once. A band of
  // null is an ordinary two-band day and every branch below collapses
  // to exactly the v7 arithmetic.
  const onCommitmentDay =
    input.commitmentBand != null && input.commitmentBand > 0;
  const lifeScale = onCommitmentDay
    ? (100 - normalizeBand(input.commitmentBand ?? 0)) / 100
    : 1;

  const routineEarned = input.tasks.reduce(
    (a, t) =>
      a +
      (isRoutine(t.timesPerWeek) &&
      !(onCommitmentDay && t.isCommitment) &&
      t.completedToday &&
      !t.extraToday
        ? t.pointValue
        : 0),
    0,
  );

  // ── The commitment band (ADR-0032) ──
  // Spent separately, and *before* the variable band is measured,
  // because a commitment task is non-daily and would otherwise be
  // counted as ordinary variable work and capped at 20 — the band
  // would price at 60 and the grade would pay 20.
  //
  // The band's own cap is itself: `bandPointValues` already divides
  // exactly `band` points across the day's eligible commitment work, so
  // completing all of it earns the band once. The cap here catches
  // anything the two could disagree about rather than doing the
  // dividing a second time.
  const band = onCommitmentDay ? normalizeBand(input.commitmentBand ?? 0) : 0;
  const commitmentEarned = onCommitmentDay
    ? Math.min(
        input.tasks.reduce(
          (a, t) =>
            a + (t.isCommitment && t.completedToday && !t.extraToday ? t.pointValue : 0),
          0,
        ),
        band,
      )
    : 0;

  // What the life bands hold today. On a commitment day they are scaled
  // into what the band leaves, exactly as `bandPointValues` scales the
  // values that fill them — the two must agree or a day could pay more
  // than it priced.
  const variableBand = Math.round(VARIABLE_BAND * lifeScale);

  // Planned non-daily work has first claim on the variable band.
  const plannedVariable = input.tasks.reduce(
    (a, t) =>
      a +
      (!isRoutine(t.timesPerWeek) &&
      !(onCommitmentDay && t.isCommitment) &&
      t.completedToday &&
      !t.extraToday
        ? t.pointValue
        : 0),
    0,
  );
  const variableEarned = Math.min(plannedVariable, variableBand);

  // Then the unplanned pool, in the order it was earned: activities as
  // logged, then the special day's rating, which goes last because it is
  // the one credit not tied to a moment in the day.
  //
  // **Fill-first is deliberately NOT here** — see ADR-0025 §12's
  // 2026-08-16 note. Letting unplanned credit reach a unit's unearned
  // planned share scored a day with no tasks completed and two
  // activities logged at 100, the exact failure ADR-0023 was written
  // from.
  const activityCredit = (input.activities ?? []).reduce(
    (a, tags) => a + tags.reduce((b, tag) => b + tag.pointsCredited, 0),
    0,
  );
  const ratingBonus =
    input.kind === "special" ? specialDayBonus(input.satisfactionRating) : 0;
  const unplannedRaw = activityCredit + ratingBonus;
  // Floored at zero. Without the floor this goes **negative** whenever
  // `variableEarned` exceeds its band, silently cancelling the
  // overspend instead of surfacing it — which is precisely how a
  // mis-scaled cap would hide. Found by mutation testing 2026-09-14:
  // breaking the scale produced a correct-looking total built from a
  // 20-point overspend and a −12 credit.
  const unplanned = Math.max(
    0,
    Math.min(unplannedRaw, variableBand - variableEarned),
  );

  const earned =
    commitmentEarned +
    routineEarned +
    variableEarned +
    unplanned +
    (input.extraRunCredit ?? 0);

  // Rounded here, at the source, and `base` derived from the rounded
  // pair, so the day screen and the calendar can never read one point
  // apart from the same day.
  return {
    ...storedDayScore({
      earned: Math.round(earned),
      possible: Math.round(possible),
    }),
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
  /** The standard day denominator — constant across days (§4, v2). An
   *  elapsed day with no row occupies a full one and earns nothing. */
  dailyPossible: number;
  /** The first day the app could grade at all: the local date of the
   *  first diagnostic. Null when no diagnostic has been taken. */
  gradingStart: string | null;
}

/**
 * The days of a period that count toward its grade (ADR-0004 §5).
 *
 * A stored row exists only for a day the user touched, so aggregating
 * stored rows alone would quietly drop every ignored day out of the
 * denominator — a week with four good days and three skipped ones
 * grading like a flawless four-day week.
 *
 * **An elapsed day with no row therefore occupies a full
 * `dailyPossible` and earns nothing.** It scores zero.
 *
 * This is the third answer to the same question and the strictest.
 * Zero was the original; half credit replaced it on 2026-07-30 as too
 * punishing; N/A replaced *that* earlier on 2026-08-13, on the
 * grounds that a 50 asserted a passing day that never happened. N/A
 * in turn made skipping free, which is the opposite incentive from
 * the one the product wants. Zero is chosen deliberately now: the
 * weekly and monthly numbers should reward showing up every day.
 *
 * **The escape hatch is "Day off"** (ADR-0023 §4) — a declared day is
 * stored as {0, 0} and leaves the aggregate entirely. So the rule is
 * *record something, or mark the day off*; only silence costs you.
 * That only works while a day off can still be declared, which the
 * edit window bounds — see the ADR-0004 amendment.
 *
 * `gradedDays` still travels with the result. It no longer guards
 * against a grade resting on two days (every elapsed day counts now),
 * but it remains the honest denominator for anything that wants to
 * say how much of a period is actually behind its number.
 *
 * Two exclusions:
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
 * Days off are stored as {0, 0} and stay neutral; special days carry
 * their tasks and bonus in the stored row like any other. Recorded
 * rows always win over the fill.
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
        : // Silence costs a full day. Mark it off to opt out.
          { earned: 0, possible: input.dailyPossible },
    );
  }
  return days;
}

export interface PeriodGrade extends Grade {
  /**
   * How many days the grade stands on — every elapsed day since the
   * first diagnostic, minus days off. Not a warning any more (a
   * skipped day is a zero, not an absence), just the honest count of
   * what is behind the number.
   */
  gradedDays: number;
}

/**
 * Weekly and monthly grades (ADR-0004 §5): points earned ÷ points
 * possible over the period, purely additive — no curves or weighting.
 * Every day already reduces to an {earned, possible} pair (days off
 * are {0, 0} and drop out on their own), so this one reduce serves
 * both periods; only the input range differs. Feed it `periodDays`,
 * not the stored rows directly — see the note there.
 */
export function aggregateGrade(
  days: { earned: number; possible: number }[],
): PeriodGrade {
  const earned = days.reduce((a, d) => a + d.earned, 0);
  const possible = days.reduce((a, d) => a + d.possible, 0);
  return {
    possible,
    earned,
    base: possible > 0 ? Math.round((earned / possible) * 100) : null,
    gradedDays: days.length,
  };
}
