/**
 * Each task's schedule as the day reads it (ADR-0040): its repeat
 * bounds, skipped occurrences and weeks, Away days and Clear today, all
 * turned into `ScheduleBounds` so they reach `isDueOn`, `computeDayLoad`
 * and the commitment band through the one path (ADR-0040 §3).
 *
 * The rules are in `windowRules.ts`; this reads what they need.
 */
import { addDays } from "@glide/scoring";
import { and, gte, inArray, lte } from "drizzle-orm";

import { db } from "./client";
import { COVERAGE_LOOKBACK_DAYS } from "./commitmentPlan";
import { dayClear, lifeUnit, taskCompletion } from "./schema";
import { loadAwayRanges, loadSkipsBetween } from "./skips";
import {
  awayDatesBetween,
  commitmentRoots,
  skippedByTask,
  type ScheduleInputs,
} from "./windowRules";

export interface DaySchedule {
  /** Each task's skipped dates. */
  readonly skipped: ReadonlyMap<string, ReadonlySet<string>>;
  /** The same, without what was skipped or cleared on the day itself:
   *  what the day asked for when it began. */
  readonly skippedAtStart: ReadonlyMap<string, ReadonlySet<string>>;
  /** Away days near the date. */
  readonly away: ReadonlySet<string>;
  /** Whether the date itself was cleared. */
  readonly cleared: boolean;
  /** Whether anything was skipped or cleared on the day itself. */
  readonly changedOnTheDay: boolean;
}

/** How far either side of a date its schedule is read: far enough for
 *  an early session to find the one it stands for (`coverage`). */
const REACH = COVERAGE_LOOKBACK_DAYS + 7;

/** The schedule around `date` for these tasks. */
export async function loadSchedule(
  date: string,
  tasks: readonly { id: string; unitId: string; kind: "task" | "event" }[],
): Promise<DaySchedule> {
  const start = addDays(date, -REACH);
  const end = addDays(date, REACH);
  const [skips, ranges, clears, units] = await Promise.all([
    loadSkipsBetween(start, end),
    loadAwayRanges(),
    db
      .select({ localDate: dayClear.localDate })
      .from(dayClear)
      .where(and(gte(dayClear.localDate, start), lte(dayClear.localDate, end))),
    db
      .select({
        id: lifeUnit.id,
        parentUnitId: lifeUnit.parentUnitId,
        isCustom: lifeUnit.isCustom,
        commitmentShare: lifeUnit.commitmentShare,
      })
      .from(lifeUnit),
  ]);
  const cleared = new Set(clears.map((c) => c.localDate));
  const eventIds = tasks.filter((t) => t.kind === "event").map((t) => t.id);
  const eventDoneOn = new Set<string>();
  if (cleared.size > 0 && eventIds.length > 0) {
    const ticks = await db
      .select({ taskId: taskCompletion.taskId, localDate: taskCompletion.localDate })
      .from(taskCompletion)
      .where(
        and(
          inArray(taskCompletion.taskId, eventIds),
          inArray(taskCompletion.localDate, [...cleared]),
        ),
      );
    for (const t of ticks) eventDoneOn.add(`${t.taskId}|${t.localDate}`);
  }

  const roots = commitmentRoots(units);
  const commitmentOf = new Map(tasks.map((t) => [t.id, roots.get(t.unitId) ?? null]));
  const inputs: ScheduleInputs = {
    skips,
    away: awayDatesBetween(ranges, start, end),
    cleared,
    eventDoneOn,
  };
  return {
    skipped: skippedByTask(tasks, commitmentOf, inputs),
    skippedAtStart: skippedByTask(tasks, commitmentOf, inputs, { startOf: date }),
    away: inputs.away,
    cleared: cleared.has(date),
    changedOnTheDay:
      cleared.has(date) ||
      skips.some((s) => s.kind === "occurrence" && s.localDate === date && s.madeOn === date),
  };
}
