/**
 * How far along each one-off is, and which are finished — the one
 * answer the checklist and the commitment band both need.
 *
 * It lives here because two copies of it had already drifted. The
 * checklist learned that **settled means reached 1, not touched**
 * (ADR-0014 §2, amended 2026-09-15); the band's copy still treated a
 * quarter as finished. A commitment assignment done 25% on Tuesday then
 * stayed on Wednesday's checklist while the band stopped paying for it
 * — the "shows it" and "pays it" divergence `eligibleTaskIds` was
 * written to make impossible.
 */
import { isSettled } from "@glide/scoring";
import { and, inArray, lt } from "drizzle-orm";

import { db } from "./client";
import { taskCompletion } from "./schema";

/** Every fraction recorded against each of these tasks before `date`. */
export async function fractionsBefore(
  taskIds: readonly string[],
  date: string,
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (taskIds.length === 0) return out;
  const rows = await db
    .select({ taskId: taskCompletion.taskId, fraction: taskCompletion.fraction })
    .from(taskCompletion)
    .where(
      and(
        inArray(taskCompletion.taskId, [...taskIds]),
        lt(taskCompletion.localDate, date),
      ),
    );
  for (const r of rows) {
    out.set(r.taskId, [...(out.get(r.taskId) ?? []), r.fraction]);
  }
  return out;
}

/** The ones already finished — progress reached 1, not merely begun. */
export function settledOf(fractions: ReadonlyMap<string, number[]>): Set<string> {
  return new Set(
    [...fractions.entries()]
      .filter(([, f]) => isSettled(f))
      .map(([taskId]) => taskId),
  );
}
