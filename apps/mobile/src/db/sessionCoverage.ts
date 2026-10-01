/**
 * The database half of "an early session stands in for the next one"
 * (ADR-0032 §4, amended 2026-10-01). The rule itself is `coverage` in
 * `commitmentPlan.ts`, pure and tested; this only reads what it needs.
 */
import { addDays } from "@glide/scoring";
import { and, gte, inArray } from "drizzle-orm";

import { db } from "./client";
import { COVERAGE_LOOKBACK_DAYS } from "./commitmentPlan";
import { taskCompletion } from "./schema";

/**
 * Every completion date for these tasks from far enough before `date`
 * to decide its coverage — onward, not just up to it, because a session
 * done on its own day later still decides which session an earlier
 * off-schedule tick took.
 */
export async function completionDatesAround(
  taskIds: readonly string[],
  date: string,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (taskIds.length === 0) return out;
  const rows = await db
    .select({ taskId: taskCompletion.taskId, localDate: taskCompletion.localDate })
    .from(taskCompletion)
    .where(
      and(
        inArray(taskCompletion.taskId, [...taskIds]),
        gte(taskCompletion.localDate, addDays(date, -COVERAGE_LOOKBACK_DAYS)),
      ),
    );
  for (const r of rows) out.set(r.taskId, [...(out.get(r.taskId) ?? []), r.localDate]);
  return out;
}
