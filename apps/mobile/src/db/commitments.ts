/**
 * Commitments, and what one day's commitment work looks like
 * (ADR-0029, ADR-0032).
 *
 * A commitment is a `life_unit` with `is_custom` set, holding tasks
 * and sub-commitments (`parent_unit_id`). It is scored from its own
 * band rather than from the 18 life units' pool — **what separates a
 * commitment from a life unit is its band, not its table.**
 */
import { type CommitmentDay } from "@glide/scoring";
import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";

import { db } from "./client";
import {
  buildCommitmentDay,
  eligibleTaskIds,
  groupCommitments,
} from "./commitmentPlan";
import { lifeUnit, task, taskCompletion } from "./schema";
import { loadCommitmentBand } from "./settings";

export interface CommitmentRow {
  id: string;
  name: string;
  share: number;
  subUnitIds: string[];
}

/**
 * Every active commitment, with its sub-commitments resolved.
 *
 * A commitment is custom, unparented, and carries a share. A custom
 * unit with a parent is a *sub-commitment* and is never one of these.
 */
export async function loadCommitments(): Promise<CommitmentRow[]> {
  const units = await db
    .select()
    .from(lifeUnit)
    .where(and(eq(lifeUnit.isCustom, true), isNull(lifeUnit.archivedAt)));

  const nameById = new Map(units.map((u) => [u.id, u.name]));
  return groupCommitments(units).map((g) => ({
    id: g.commitmentId,
    name: nameById.get(g.commitmentId) ?? "",
    share: g.share,
    subUnitIds: g.unitIds.filter((id) => id !== g.commitmentId),
  }));
}

/**
 * The commitment work eligible on `date` — scheduled sessions and work
 * planned for that day (ADR-0032 §3).
 *
 * Eligibility is deliberately the same test the checklist already
 * uses, so a task the day shows and a task the band pays for cannot
 * diverge:
 *
 * - **pinned to this weekday** (`isDueOn`, ADR-0024 §1), or
 * - **an outstanding one-off** dated on or before this date — the same
 *   rule `loadDay` uses to decide a one-off is still owed.
 *
 * A commitment task with no pin and no date is not eligible on any
 * particular day, which is why ADR-0033 requires commitment sessions
 * to be scheduled: an unscheduled one belongs to no day, so no day's
 * band could ever pay it.
 */
async function eligibleOn(date: string, unitIds: string[]): Promise<string[]> {
  if (unitIds.length === 0) return [];

  const rows = await db
    .select()
    .from(task)
    .where(and(eq(task.active, true), inArray(task.unitId, unitIds)));
  if (rows.length === 0) return [];

  const oneOffIds = rows.filter((t) => t.oneOffSize != null).map((t) => t.id);
  const settledBefore = new Set(
    oneOffIds.length > 0
      ? (
          await db
            .select({ taskId: taskCompletion.taskId })
            .from(taskCompletion)
            .where(
              and(
                inArray(taskCompletion.taskId, oneOffIds),
                lt(taskCompletion.localDate, date),
              ),
            )
        ).map((c) => c.taskId)
      : [],
  );

  return eligibleTaskIds(rows, settledBefore, date);
}

/**
 * What `bandPointValues` needs to price `date`, or **`null` for an
 * ordinary two-band day**.
 *
 * Null in three cases, and the distinction matters: no band set, no
 * commitments, or no commitment work scheduled today. The last is
 * ADR-0032 §1 — the band exists only on days it can be earned, which
 * is what stops an empty Sunday capping below 100 through somebody
 * else's timetable.
 *
 * Pools (ADR-0033 §3) are not passed yet: nothing in the schema stores
 * one. When they land they attach here, and `bandPointValues` already
 * takes them.
 */
export async function loadCommitmentDay(
  date: string,
): Promise<CommitmentDay | null> {
  const band = await loadCommitmentBand();
  if (band === null) return null;

  const units = await db
    .select()
    .from(lifeUnit)
    .where(and(eq(lifeUnit.isCustom, true), isNull(lifeUnit.archivedAt)));
  const groups = groupCommitments(units);
  if (groups.length === 0) return null;

  const eligible = await eligibleOn(
    date,
    groups.flatMap((g) => [...g.unitIds]),
  );
  return buildCommitmentDay(band, groups, eligible);
}

/** Whether any commitment exists at all — for deciding what to show. */
export async function hasCommitments(): Promise<boolean> {
  const [row] = await db
    .select({ id: lifeUnit.id })
    .from(lifeUnit)
    .where(
      and(
        eq(lifeUnit.isCustom, true),
        isNull(lifeUnit.archivedAt),
        isNull(lifeUnit.parentUnitId),
        isNotNull(lifeUnit.commitmentShare),
      ),
    )
    .limit(1);
  return row !== undefined;
}
