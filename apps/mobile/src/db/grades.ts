/**
 * Weekly and monthly grade review (ADR-0004 §5). Reads the same
 * `day_grade.pointsEarned`/`pointsPossible` cache `loadMonthGrades`
 * (db/today.ts) writes for the calendar tint — `cacheDayScore` keeps
 * it in sync with the engine after every mutation.
 *
 * A row exists only for a day the user touched, so the stored rows are
 * not the period on their own: `periodDays` fills each elapsed day
 * that has none with a **zero against a full denominator**, which is
 * what keeps a skipped day costing something instead of silently
 * shrinking the week. A day the user marked off is stored as {0, 0}
 * and drops out — that is the opt-out. See `periodDays` for the two
 * exclusions (pre-diagnostic days, and the unfinished current day).
 */
import {
  addDays,
  aggregateGrade,
  dayShare,
  localDateOf,
  monthStart,
  nextMonthStart,
  periodDays,
  weekStart,
  type PeriodGrade,
} from "@glide/scoring";
import { and, eq, gte, isNull, lt } from "drizzle-orm";

import { db } from "./client";
import { dayGrade, lifeUnit, task } from "./schema";
import { currentLocalDate } from "./today";

/**
 * The denominator every normal day shares (ADR-0004 §4, formula v2):
 * each active task's weekly commitment spread across the week. Rounded
 * to match how `cacheDayScore` stores it, so a filled day and a stored
 * day weigh the same.
 */
async function standardDayPossible(): Promise<number> {
  const units = await db
    .select()
    .from(lifeUnit)
    .where(isNull(lifeUnit.archivedAt));
  const scored = new Set(
    units.filter((u) => u.includeInScoring).map((u) => u.id),
  );
  const tasks = (
    await db.select().from(task).where(eq(task.active, true))
  ).filter((t) => scored.has(t.unitId));
  return Math.round(
    tasks.reduce((sum, t) => sum + dayShare(t.pointValue, t.timesPerWeek), 0),
  );
}

/** The local date of the first diagnostic — nothing before it was ever
 *  gradeable. Null until the first one is taken. */
async function gradingStart(): Promise<string | null> {
  const [first] = await db.query.snapshot.findMany({
    orderBy: (s, { asc }) => asc(s.takenAt),
    limit: 1,
  });
  return first ? localDateOf(new Date(first.takenAt)) : null;
}

async function loadRangeGrade(start: string, end: string): Promise<PeriodGrade> {
  const [rows, dailyPossible, start0] = await Promise.all([
    db
      .select()
      .from(dayGrade)
      .where(and(gte(dayGrade.localDate, start), lt(dayGrade.localDate, end))),
    standardDayPossible(),
    gradingStart(),
  ]);
  return aggregateGrade(
    periodDays({
      start,
      end,
      today: currentLocalDate(),
      recorded: rows.map((r) => ({
        localDate: r.localDate,
        earned: r.pointsEarned,
        possible: r.pointsPossible,
      })),
      dailyPossible,
      gradingStart: start0,
    }),
  );
}

/** The week containing `date` (Sunday-first, ADR-0004 §1 as
 *  amended 2026-07-27). */
export async function loadWeekGrade(date: string): Promise<PeriodGrade> {
  const start = weekStart(date);
  return loadRangeGrade(start, addDays(start, 7));
}

/** The calendar month containing `date`. */
export async function loadMonthGrade(date: string): Promise<PeriodGrade> {
  return loadRangeGrade(monthStart(date), nextMonthStart(date));
}
