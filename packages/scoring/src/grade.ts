import { PLANNED_BAND, UNPLANNED_BAND } from "./bands";
import {
  DAILY_BUDGET,
  EXTRA_RUN_RATE,
  REST_DAY_BASE,
  REST_DAY_UNPLANNED,
} from "./constants";
import {
  computeDayLoad,
  isAnchoredOn,
  type DayLoad,
  type LoadCompletion,
  type LoadTask,
  runsBefore,
} from "./dayLoad";
import { addDays, fortnightStart, weekStart } from "./days";

/**
 * Daily checklist derivation and day-grade computation (ADR-0004 §4 as
 * amended by ADR-0029). Pure functions over plain data; the app's db
 * layer feeds them rows.
 */

export type ChecklistTask = LoadTask;
export type CompletionRow = LoadCompletion;
export type { DayLoad, LoadTask, LoadCompletion };

/**
 * - **due** — anchored to today: an every-day task, or one pinned here.
 * - **week** — owed this week but not anchored to today. Flexible work,
 *   or a run pinned to another day; both stay tappable and both still
 *   count in full when you do them (ADR-0029 §3).
 * - **doneThisWeek** — goal met on previous days; still tappable for an
 *   extra run at reduced credit.
 */
export type TaskBand = "due" | "week" | "doneThisWeek";

export interface TaskDayStatus {
  taskId: string;
  band: TaskBand;
  completedToday: boolean;
  /** Completions this week (fortnight for 0-frequency), incl. today. */
  doneCount: number;
  /** timesPerWeek, or 1 for fortnightly tasks and one-offs. */
  goalCount: number;
  /** True when today's (or the next) completion exceeds the goal. */
  extraToday: boolean;
  /**
   * What a completion now would earn **on this day**, in points.
   *
   * Day-relative since ADR-0029 §1: a task's worth is
   * `PLANNED_BAND × its weight ÷ the day's expected load`, so the same
   * task pays more on a light day than on a heavy one. That is not a
   * quirk to hide — it is the model saying what it means, which is that
   * a day is scored on the fraction of itself you got through.
   */
  pointsIfCompletedNow: number;
}

/** The counting window a task's weekly goal is measured over. */
function windowFor(task: ChecklistTask, date: string): string {
  return task.timesPerWeek === 0 && !task.oneOff
    ? fortnightStart(date)
    : weekStart(date);
}

/** Points one run is worth on a day of the given expected load. */
function runPoints(weight: number, expected: number): number {
  if (expected <= 0) return 0;
  return (PLANNED_BAND * weight) / expected;
}

/** Credit for a run beyond the weekly goal — ADR-0023 §2's exemption:
 *  the plan done harder, not spontaneity. */
export function extraRunPoints(weight: number, expected: number): number {
  return Math.round(EXTRA_RUN_RATE * runPoints(weight, expected));
}

/**
 * Band and progress for each task on `date`. Banding ignores today's
 * completions so rows never jump while the user watches: a task sits
 * in `doneThisWeek` only when previous days already met its goal.
 * One completion per task per day is assumed (enforced at write time).
 */
export function deriveChecklist(
  tasks: readonly ChecklistTask[],
  completions: readonly CompletionRow[],
  date: string,
  /** The life share of the day (`lifeShare`); 1 on an ordinary day. */
  scale = 1,
): TaskDayStatus[] {
  const load = computeDayLoad(tasks, completions, date);
  return tasks.map((t) => {
    const window = windowFor(t, date);
    const inWindow = completions.filter(
      (c) =>
        c.taskId === t.taskId && c.localDate >= window && c.localDate <= date,
    );
    const completedToday = inWindow.some((c) => c.localDate === date);
    // The same count the load uses, so a part-done one-off is still owed
    // here rather than banded as finished.
    const doneBeforeToday = runsBefore(
      t,
      inWindow.filter((c) => c.localDate !== date),
    );
    const goalCount = t.oneOff ? 1 : t.timesPerWeek === 0 ? 1 : t.timesPerWeek;
    const extraToday = doneBeforeToday >= goalCount;
    const band: TaskBand = extraToday
      ? "doneThisWeek"
      : isAnchoredOn(t, date)
        ? "due"
        : "week";
    return {
      taskId: t.taskId,
      band,
      completedToday,
      doneCount: inWindow.length,
      goalCount,
      extraToday,
      pointsIfCompletedNow: extraToday
        ? Math.round(scale * EXTRA_RUN_RATE * runPoints(t.weight, load.expected))
        : Math.round(scale * runPoints(t.weight, load.expected)),
    };
  });
}

/** One credited activity's tags, in log order. */
export type ActivityCredit = { unitId: string; pointsCredited: number }[];

export interface DayScoreInput {
  /** `rest` is stored; the UI calls it "Day off" (ADR-0023 §4). */
  kind: "normal" | "rest" | "special";
  /** Special days only: scales the rating bonus drawn from the
   *  unplanned band (ADR-0023 §3). No longer the whole grade. */
  satisfactionRating?: number | null;
  /** What the day asked for and what got done (`computeDayLoad`). */
  load: DayLoad;
  /** Credited activities, chronological (ADR-0009 §3). */
  activities?: ActivityCredit[];
  /**
   * The commitment band today (ADR-0032), or omitted on an ordinary
   * day.
   *
   * `band` is the share of the whole day it takes — `commitmentBandOn`,
   * so 0 on a day with no commitment work scheduled — and `earned` is
   * the points of it today's completions paid (`commitmentPointValues`
   * for each eligible task done, at its fraction). The planned and
   * unplanned bands are scaled into `100 − band`.
   */
  commitment?: { band: number; earned: number };
  /**
   * Commitment work done on a day it was not scheduled for, at its
   * scheduled-day worth (ADR-0032 §4). Paid **in full, outside every
   * band** — the plan done on another day — beside extra runs.
   */
  offScheduleCredit?: number;
  /**
   * What a rest day needs (ADR-0037). Omitted, a day with nothing due
   * is ungraded, as ADR-0029 has it.
   */
  restDay?: RestDayInput;
}

/** Points earned out of points possible, plus the rendered grade.
 *  Shared by a single day and by any aggregate over days. */
export interface Grade {
  possible: number;
  earned: number;
  base: number | null;
}

export interface DayScore extends Grade {
  /** Always 100 on a graded day (ADR-0027 §1). */
  possible: number;
  /** All points earned this day: the planned band's fraction, the
   *  capped unplanned band, and extra runs on top. */
  earned: number;
  /** Grade, or null when there is nothing to grade (a day off; a day
   *  with nothing due). Above 100 only via extra runs of your own plan
   *  (ADR-0023 §2); the two bands themselves cap at 100. */
  base: number | null;
  /** What the unplanned band actually paid, after the cap. Surfaced so
   *  the day can show "84 +6" rather than silently swallowing credit
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
 * after ADR-0029's `FORMULA_VERSION` 9, would restate it under a
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

/** Rating → its draw on the unplanned band (ADR-0023 §3). A 10-rated
 *  special day claims the whole band, a 6-rated one 60% of it — and
 *  only ever from the room the day's planned work left. */
export function specialDayBonus(rating: number | null | undefined): number {
  if (rating === null || rating === undefined) return 0;
  return Math.round((rating / 10) * UNPLANNED_BAND);
}

/**
 * The day's number (ADR-0029 §2, formula v9): a constant denominator of
 * 100, and two bands.
 *
 * **Planned (90).** The fraction of the day's expected load that got
 * done, times 90. `dayLoad.ts` decides what "expected" means; all that
 * happens here is the multiplication and the cap at 1. Do what the day
 * asked and the band pays in full — Henry's target, *"if you did every
 * task you planned for the week you should have around a 90 average"*,
 * arrived at by construction rather than by tuning.
 *
 * **Unplanned (10).** Activities and a special day's rating bonus,
 * capped. Planned work no longer competes for this pool, because
 * planned work now has a band of its own whatever its cadence — which
 * is what ADR-0023 §1 meant by `UNPLANNED_CAP` before ADR-0027 §3
 * widened it to cover weekly tasks.
 *
 * **Extra runs stay outside both bands** (ADR-0023 §2, unchanged):
 * doing more of your own plan is the one route above 100. They are
 * priced from the same day-relative rate as everything else, at
 * `EXTRA_RUN_RATE`.
 *
 * **A day with nothing due is not graded at all** (`base: null`, the
 * same shape as a day off). That happens when the week's flexible work
 * is already finished and no task is anchored to today — you owe the
 * day nothing, so there is nothing to score. It does mean a week's work
 * bunched into one day leaves the rest of the week ungraded; ADR-0029's
 * Consequences accepts that, on the grounds that a daily task cannot be
 * bunched and a plan made entirely of flexible work is the shape
 * ADR-0003 §6 already advises against.
 */
export function computeDayScore(input: DayScoreInput): DayScore {
  // "Day off" in the UI; `rest` on disk (ADR-0023 §4).
  if (input.kind === "rest") {
    return { possible: 0, earned: 0, base: null, unplanned: 0, unplannedForgone: 0 };
  }

  const { expected, earned: earnedWeight, extra } = input.load;
  const band = Math.max(0, input.commitment?.band ?? 0);

  // Nothing due of either kind, with a plan behind it: a rest day,
  // automatically (ADR-0037). Never chosen, never offered — the day
  // simply is one. A day off stays a day off (returned above).
  if (isRestDay(input.load, band, input.restDay)) {
    return restDayScore(input);
  }

  // Nothing due of either kind: not graded, as on an ordinary day.
  if (expected <= 0 && band <= 0) {
    return { possible: 0, earned: 0, base: null, unplanned: 0, unplannedForgone: 0 };
  }

  // The life share of the day (ADR-0032): all of it on an ordinary day,
  // `100 − band` on a commitment day. Planned work, unplanned credit and
  // extra runs are all scaled into it, so a commitment day still totals
  // 100 and the band is exactly the share it says it is.
  const life = (100 - band) / 100;

  // **Commitments are the band, never more** (Henry, 2026-10-01): *"a
  // true 100 day is one where you fulfil both your school/work related
  // commitments and keep up the other areas of your life. Sacrificing
  // one should be reflected in the score."* So finished commitment work
  // pays exactly the band, and nothing else can earn the life share.
  // On a commitment day with no life work due, that share holds nothing
  // to do — so it pays nothing, activities included, just as ADR-0029
  // grades nothing on an ordinary day with nothing due. The day tops out
  // at the band.
  const lifeDue = expected > 0;
  const lifePlanned = lifeDue ? PLANNED_BAND * life : 0;
  const commitmentEarned =
    band > 0 ? Math.min(band, input.commitment?.earned ?? 0) : 0;

  const planned = lifeDue ? lifePlanned * Math.min(1, earnedWeight / expected) : 0;
  const extraCredit = lifeDue ? life * EXTRA_RUN_RATE * runPoints(extra, expected) : 0;

  const activityCredit = (input.activities ?? []).reduce(
    (a, tags) => a + tags.reduce((b, tag) => b + tag.pointsCredited, 0),
    0,
  );
  const ratingBonus =
    input.kind === "special" ? specialDayBonus(input.satisfactionRating) * life : 0;
  const unplannedRaw = activityCredit + ratingBonus;
  const unplanned = Math.min(unplannedRaw, lifeDue ? UNPLANNED_BAND * life : 0);

  const earned =
    commitmentEarned +
    planned +
    unplanned +
    extraCredit +
    Math.max(0, input.offScheduleCredit ?? 0);

  // Rounded here, at the source, and `base` derived from the rounded
  // pair, so the day screen and the calendar can never read one point
  // apart from the same day.
  return {
    ...storedDayScore({
      earned: Math.round(earned),
      possible: DAILY_BUDGET,
    }),
    unplanned,
    unplannedForgone: unplannedRaw - unplanned,
  };
}

export interface RestDayInput {
  /** The plan's `averageDayExpected` — prices extra runs. */
  averageExpected: number;
  /** Whether there is a plan at all: any recurring task, life or
   *  commitment. Without one, nothing due is just nothing. */
  hasPlan: boolean;
  /** Anything still owed later this week — a run pinned to a later
   *  day, a one-off planned for later this week, a commitment session
   *  still to come. Measured from before today. */
  openThisWeek: boolean;
  /** Whether anything was done early today. */
  earlyToday: boolean;
  /** Early life work, already priced at its planned day's worth
   *  (`plannedDayRunPoints`). Commitment work done ahead comes in as
   *  `offScheduleCredit`. */
  earlyCredit?: number;
}

/**
 * Whether a day is a rest day (ADR-0037 §1) — decided, never chosen.
 *
 * Nothing of your own life is due today, no commitment work is
 * scheduled, there is a plan — and then **either** nothing is open for
 * the rest of the week (Henry: *"having any open tasks should prevent
 * rest day from occurring"*) **or** something was done early today,
 * which makes it one (Henry: doing Friday's task on an empty Tuesday
 * makes Tuesday "70 + the task"). An empty day with work still open
 * and none of it done is ungraded, as ADR-0029 has it.
 */
export function isRestDay(
  load: DayLoad,
  commitmentBand: number,
  rest: Pick<RestDayInput, "hasPlan" | "openThisWeek" | "earlyToday"> | undefined,
): boolean {
  if (!rest || load.expected > 0 || commitmentBand > 0 || !rest.hasPlan) return false;
  return !rest.openThisWeek || rest.earlyToday;
}

/** What one run is worth on a rest day when it has no planned day to
 *  borrow from — an extra run: its points on an average day of the plan
 *  (ADR-0037 §3). Zero when the plan holds nothing recurring. */
export function restDayRunPoints(weight: number, averageExpected: number): number {
  return runPoints(weight, averageExpected);
}

/**
 * What a task done early is worth: **what it would have paid on the day
 * it was planned for** (Henry: *"early tasks count as much as they would
 * if they were done on the day they were planned"*).
 *
 * That day is priced as it stands before today — the task still owed,
 * sharing it with whatever else that day expects — so the early tick
 * takes the value its own day would have given it. `scale` is that
 * day's life share, if it carries a commitment band.
 */
export function plannedDayRunPoints(
  tasks: readonly LoadTask[],
  completionsBefore: readonly LoadCompletion[],
  task: LoadTask,
  plannedDate: string,
  scale = 1,
): number {
  const all = tasks.some((t) => t.taskId === task.taskId) ? tasks : [...tasks, task];
  const load = computeDayLoad(all, completionsBefore, plannedDate);
  return scale * runPoints(task.weight, load.expected);
}

/**
 * A rest day's number (ADR-0037 §2): **70, then whatever the day held.**
 *
 * - Activities fill the last 30 (`REST_DAY_UNPLANNED`), with a special
 *   day's rating bonus if the day is also special.
 * - **Early work is paid on top, uncapped** — it is your own plan done
 *   ahead, the side of ADR-0023's line extra runs already sit on. Every
 *   piece of it pays **what its planned day would have paid** — a run
 *   pinned to a later day, a life one-off planned for later
 *   (`earlyCredit`, priced by `plannedDayRunPoints`), commitment work
 *   (`offScheduleCredit`). A run beyond the week's count has no planned
 *   day and pays the extra-run rate on an average day.
 */
function restDayScore(input: DayScoreInput): DayScore {
  const average = input.restDay?.averageExpected ?? 0;
  const early =
    Math.max(0, input.restDay?.earlyCredit ?? 0) +
    EXTRA_RUN_RATE * runPoints(input.load.extra, average) +
    Math.max(0, input.offScheduleCredit ?? 0);
  const unplannedRaw =
    (input.activities ?? []).reduce(
      (a, tags) => a + tags.reduce((b, tag) => b + tag.pointsCredited, 0),
      0,
    ) + (input.kind === "special" ? specialDayBonus(input.satisfactionRating) : 0);
  const unplanned = Math.min(unplannedRaw, REST_DAY_UNPLANNED);
  return {
    ...storedDayScore({
      earned: Math.round(REST_DAY_BASE + unplanned + early),
      possible: DAILY_BUDGET,
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
