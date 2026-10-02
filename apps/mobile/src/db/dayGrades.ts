/**
 * The stored day grade (`day_grade`): the cache the calendar, the week
 * and the month read. Written after every edit to a day, re-scored when
 * the plan changes under it, and filled for recent days that asked
 * nothing, so it always says what the day screen says.
 */
import {
  addDays,
  editWindowStart,
  FORMULA_VERSION,
  monthStart,
  nextMonthStart,
  storedDayScore,
} from "@glide/scoring";
import { and, eq, gte, isNull, lt } from "drizzle-orm";

import { assertEditable, currentLocalDate, editWindowDays } from "../lib/calendar";
import { recreditActivities } from "./activityCredit";
import { db } from "./client";
import { dayGrade } from "./schema";
import { gradesAreStale, markGradesStale, takeGradesStale } from "./settings";
import { loadDay, type DayData, type DayKind } from "./today";

export interface MonthDay {
  grade: number | null;
  kind: DayKind;
}

/**
 * Cached day scores over an arbitrary range, `end` exclusive, keyed by
 * local date. A day with no stored row is simply absent.
 *
 * Both calendar surfaces read this. They need different spans — the
 * grid wants a calendar month, the week strip wants the 14-day edit
 * window, and those only coincide mid-month — so the range is the
 * caller's to choose rather than being fixed to a month.
 */
export async function loadGradesBetween(
  start: string,
  end: string,
): Promise<Map<string, MonthDay>> {
  await refreshStaleGrades();
  const rows = await db
    .select()
    .from(dayGrade)
    .where(and(gte(dayGrade.localDate, start), lt(dayGrade.localDate, end)));
  // One derivation, shared with `loadDay`'s finalized path, with no
  // per-kind branching left here at all.
  //
  // This used to re-derive the grade itself, and got two things wrong.
  // It scored special days as `rating × 10` — the model ADR-0023
  // retired — so a special day showed one number in the calendar and a
  // completely different one above it. And it divided the *stored
  // integers* while the day screen divided the raw floats, which put
  // ordinary days a point apart. A day off needs no special case
  // either: it is stored as {0, 0} and `storedDayScore` returns null.
  return new Map(
    rows.map((r) => [
      r.localDate,
      {
        kind: r.kind,
        grade: storedDayScore({
          earned: r.pointsEarned,
          possible: r.pointsPossible,
        }).base,
      },
    ]),
  );
}

/**
 * Grades for everything the day surface can show, in one query: the recent strip,
 * today's month, and — since any past month is now browsable — the
 * month currently on screen, which may be years back.
 */
export async function loadCalendarGrades(
  today: string,
  viewMonth: string = today,
): Promise<Map<string, MonthDay>> {
  const windowDays = editWindowDays(today);
  const start = [monthStart(today), monthStart(viewMonth), windowDays[0]!].sort()[0]!;
  const ends = [
    nextMonthStart(today),
    nextMonthStart(viewMonth),
    addDays(windowDays[13]!, 1),
  ].sort();
  return loadGradesBetween(start, ends[ends.length - 1]!);
}

export async function setDayKind(
  date: string,
  kind: DayKind,
  opts: { title?: string | null; satisfactionRating?: number | null } = {},
): Promise<void> {
  assertEditable(date);
  const values = {
    kind,
    title: kind === "special" ? (opts.title ?? null) : null,
    satisfactionRating:
      kind === "special" ? (opts.satisfactionRating ?? null) : null,
  };
  const [existing] = await db.select().from(dayGrade).where(eq(dayGrade.localDate, date));
  if (existing) {
    await db.update(dayGrade).set(values).where(eq(dayGrade.localDate, date));
  } else {
    await db.insert(dayGrade).values({ localDate: date, ...values });
  }
  await cacheDayScore(date);
}

/** One task as it stood on a given day (`day_grade.plan_snapshot`). */
export interface PlanSnapshotTask {
  taskId: string;
  unitId: string;
  pointValue: number;
  timesPerWeek: number;
}

/** Store the day's earned/possible on `day_grade`, which the calendar,
 *  the week and the month read; the day screen recomputes live. Returns
 *  the day as scored. */
export async function cacheDayScore(date: string): Promise<DayData> {
  // `recompute`: this only ever runs straight after the user changed
  // something about this day, and that edit must land even on a day
  // that has settled.
  let day = await loadDay(date, { recompute: true });
  if (await recreditActivities(date, day.restDay)) {
    day = await loadDay(date, { recompute: true });
  }
  const plan: PlanSnapshotTask[] = [...day.due, ...day.week, ...day.doneThisWeek].map(
    (t) => ({
      taskId: t.id,
      unitId: t.unitId,
      pointValue: t.pointValue,
      timesPerWeek: t.timesPerWeek,
    }),
  );
  const values = {
    pointsEarned: Math.round(day.score.earned),
    pointsPossible: Math.round(day.score.possible),
    formulaVersion: FORMULA_VERSION,
    // Re-written on every touch, so the last edit before a day settles
    // is the plan that sticks with it.
    planSnapshot: JSON.stringify(plan),
  };
  const [existing] = await db.select().from(dayGrade).where(eq(dayGrade.localDate, date));
  if (existing) {
    await db.update(dayGrade).set(values).where(eq(dayGrade.localDate, date));
  } else {
    await db.insert(dayGrade).values({ localDate: date, kind: "normal", ...values });
  }
  return day;
}

/**
 * Give each recent elapsed day in `[start, end)` that has no stored
 * grade the one it actually earned.
 *
 * A row is otherwise written only when a day is edited, and
 * `periodDays` fills a day with no row as a zero. That is right for a
 * day with work due and nothing done, and wrong for the days that ask
 * nothing: an automatic rest day scores 70 (ADR-0037) and a day with
 * nothing due is ungraded (ADR-0029), yet neither gives you anything to
 * tick. Scoring them here writes exactly what the day screen shows.
 *
 * Only days still in the recent window, so each is scored once before
 * it settles, and never today, which is not over.
 */
export async function recordUntouchedDays(start: string, end: string): Promise<void> {
  const today = currentLocalDate();
  const recent = editWindowStart(today);
  const from = start > recent ? start : recent;
  const to = end < today ? end : today;
  if (from >= to) return;
  const rows = await db
    .select({ localDate: dayGrade.localDate })
    .from(dayGrade)
    .where(and(gte(dayGrade.localDate, from), lt(dayGrade.localDate, to)));
  const stored = new Set(rows.map((r) => r.localDate));
  for (let d = from; d < to; d = addDays(d, 1)) {
    if (!stored.has(d)) await cacheDayScore(d);
  }
}

let staleRefresh: Promise<void> | null = null;

/**
 * Re-score live stored grades if the plan changed since they were
 * written (`markGradesStale`). Plan edits mark rather than re-score,
 * because one save of the task sheet runs several setters and each
 * full re-score is a `loadDay` per live day; the next read of the
 * stored grades pays for it once. Concurrent readers share one pass.
 */
export function refreshStaleGrades(): Promise<void> {
  staleRefresh ??= (async () => {
    try {
      if (!(await gradesAreStale())) return;
      try {
        await recacheAllDayScores();
      } catch (error) {
        await markGradesStale();
        throw error;
      }
    } finally {
      staleRefresh = null;
    }
  })();
  return staleRefresh;
}

/**
 * Re-cache every stored day's score.
 *
 * `day_grade.points_earned/possible` is a denormalized cache, and it is
 * only ever written for the one day being touched. The day screen's own
 * number is computed live by `loadDay`, so the moment weights move —
 * a new diagnostic, or a re-rank — the live number and the calendar
 * disagree with each other and with the weekly and monthly grades built
 * on top of the cache. This is what reconciles them.
 *
 * **Finalized days are excluded.** Grades finalize (ADR-0002), so a
 * settled day is a historical fact and re-deriving it at today's
 * weights would silently restate the past. That mattered less when the
 * only drift was a weight change; after ADR-0023 bumped
 * `FORMULA_VERSION` to 5 it would also re-score days under a formula
 * they were never graded by — a tester's rated special day would
 * collapse from `rating × 10` to tasks-plus-a-capped-bonus, weeks
 * after the fact. `loadDay` reads the same rows back rather than
 * recomputing them, so the two stay in agreement.
 *
 * What remains is exactly the reconciliation this exists for: the days
 * still inside the edit window, which are live anyway.
 */
export async function recacheAllDayScores(): Promise<void> {
  // This pass is what a stale mark asks for, so it answers one.
  await takeGradesStale();
  const rows = await db
    .select({ localDate: dayGrade.localDate })
    .from(dayGrade)
    .where(isNull(dayGrade.finalizedAt));
  for (const r of rows) await cacheDayScore(r.localDate);
}
