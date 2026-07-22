/**
 * Weekly and monthly grade review (ADR-0004 §5). Trusts the same
 * `day_grade.pointsEarned`/`pointsPossible` cache `loadMonthGrades`
 * (db/today.ts) already reads for the calendar tint — `cacheDayScore`
 * keeps it in sync with the engine after every mutation, kind-aware
 * (rest days cache as {0, 0} and drop out on their own).
 */
import {
  addDays,
  aggregateGrade,
  monthStart,
  nextMonthStart,
  weekStart,
  type DayScore,
} from "@life-strategy/scoring";
import { and, gte, lt } from "drizzle-orm";

import { db } from "./client";
import { dayGrade } from "./schema";

async function loadRangeGrade(start: string, end: string): Promise<DayScore> {
  const rows = await db
    .select()
    .from(dayGrade)
    .where(and(gte(dayGrade.localDate, start), lt(dayGrade.localDate, end)));
  return aggregateGrade(
    rows.map((r) => ({ earned: r.pointsEarned, possible: r.pointsPossible })),
  );
}

/** The week containing `date` (Monday-first, ADR-0004 §1). */
export async function loadWeekGrade(date: string): Promise<DayScore> {
  const start = weekStart(date);
  return loadRangeGrade(start, addDays(start, 7));
}

/** The calendar month containing `date`. */
export async function loadMonthGrade(date: string): Promise<DayScore> {
  return loadRangeGrade(monthStart(date), nextMonthStart(date));
}
