/**
 * Commitments, and what one day's commitment work looks like
 * (ADR-0035, ADR-0032).
 *
 * A commitment is a `life_unit` with `is_custom` set, holding tasks
 * and sub-commitments (`parent_unit_id`). It is scored from its own
 * band rather than from the 18 life units' pool — **what separates a
 * commitment from a life unit is its band, not its table.**
 */
import { MAX_COMMITMENTS, type CommitmentDay } from "@glide/scoring";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { db } from "./client";
import { fractionsBefore, settledOf } from "./oneOffProgress";
import {
  buildCommitmentDay,
  doneAheadOn,
  eligibleTaskIds,
  groupCommitments,
} from "./commitmentPlan";
import { completionDatesAround } from "./sessionCoverage";
import { lifeUnit, pool, poolMember, task } from "./schema";
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
async function eligibleOn(
  date: string,
  unitIds: string[],
  includeCovered: boolean,
): Promise<string[]> {
  if (unitIds.length === 0) return [];

  const rows = await db
    .select()
    .from(task)
    .where(and(eq(task.active, true), inArray(task.unitId, unitIds)));
  if (rows.length === 0) return [];

  // The checklist's own rule, from the one place it now lives: settled
  // means finished, so a part-done assignment is still owed today.
  const oneOffIds = rows.filter((t) => t.oneOffSize != null).map((t) => t.id);
  const settledBefore = settledOf(await fractionsBefore(oneOffIds, date));
  const eligible = eligibleTaskIds(rows, settledBefore, date);
  if (includeCovered) return eligible;

  // **A session done early is done** (ADR-0032 §4, amended 2026-10-01).
  // It leaves this day's band, which re-divides among what is left —
  // the band exists only where it can be earned (§1), so a day whose
  // one session was worked on Tuesday is an ordinary day, not one
  // stranded below 100.
  const recurring = rows.filter((t) => t.oneOffSize == null && eligible.includes(t.id));
  const dates = await completionDatesAround(recurring.map((t) => t.id), date);
  const covered = new Set(
    recurring
      .filter((t) => doneAheadOn(t, date, dates.get(t.id) ?? []) !== null)
      .map((t) => t.id),
  );
  return eligible.filter((id) => !covered.has(id));
}

/**
 * What `commitmentPointValues` needs to price `date`, or **`null` for an
 * ordinary two-band day**.
 *
 * Null in three cases, and the distinction matters: no band set, no
 * commitments, or no commitment work scheduled today. The last is
 * ADR-0032 §1 — the band exists only on days it can be earned, which
 * is what stops an empty Sunday capping below 100 through somebody
 * else's timetable.
 *
 * Pools (ADR-0033 §3) are read for the date and passed through. A pool
 * contributes its **planned count** to the divisor rather than its
 * member count, so planning three options you mean to pick one of does
 * not inflate the day's ceiling.
 */
export async function loadCommitmentDay(
  date: string,
  /**
   * Price the day **as scheduled**, with sessions already done early
   * left in. Used only to find what an off-schedule tick is worth — it
   * is worth its session's value with the session still in the day.
   * Without this, ticking Tuesday would take Wednesday's session out of
   * Wednesday and so price Tuesday's own tick at nothing.
   */
  options: { includeCovered?: boolean } = {},
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
    options.includeCovered === true,
  );
  const day = buildCommitmentDay(band, groups, eligible);
  if (day === null) return null;

  return { ...day, pools: await poolsOn(date, new Set(eligible)) };
}

/**
 * This date's pools, restricted to members the band actually pays for.
 *
 * A pool holding a task that is not eligible today would otherwise add
 * a slot the day cannot fill, quietly lowering what every other task in
 * the commitment is worth. Pools left empty by that filter are dropped.
 */
async function poolsOn(
  date: string,
  eligible: ReadonlySet<string>,
): Promise<{ taskIds: string[]; plannedCount: number }[]> {
  const rows = await db.select().from(pool).where(eq(pool.localDate, date));
  if (rows.length === 0) return [];

  const members = await db
    .select()
    .from(poolMember)
    .where(inArray(poolMember.poolId, rows.map((p) => p.id)));

  return rows
    .map((p) => ({
      taskIds: members
        .filter((m) => m.poolId === p.id && eligible.has(m.taskId))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => m.taskId),
      plannedCount: p.plannedCount,
    }))
    .filter((p) => p.taskIds.length > 0);
}

export interface PoolOnDay {
  id: string;
  /** The block this window follows — the cue (ADR-0036 §3). */
  afterTaskId: string | null;
  partOfDay: "morning" | "afternoon" | "evening" | null;
  /** How many of them you mean to get through (ADR-0033 §3). */
  plannedCount: number;
  taskIds: string[];
}

/**
 * Every pool on a date, for the planning UI.
 *
 * Deliberately **unfiltered**, unlike `poolsOn`. That one drops members
 * the band cannot pay for today, which is right for pricing and wrong
 * here: a task you put in a window has to stay visible in that window
 * even on a day it earns nothing, or removing it would be impossible
 * and the row would look as though it had been silently deleted.
 */
export async function loadPools(date: string): Promise<PoolOnDay[]> {
  const rows = await db.select().from(pool).where(eq(pool.localDate, date));
  if (rows.length === 0) return [];
  const members = await db
    .select()
    .from(poolMember)
    .where(inArray(poolMember.poolId, rows.map((p) => p.id)));
  return rows.map((p) => ({
    id: p.id,
    afterTaskId: p.afterTaskId,
    partOfDay: p.partOfDay,
    plannedCount: p.plannedCount,
    taskIds: members
      .filter((m) => m.poolId === p.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => m.taskId),
  }));
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

export interface CommitmentDetail {
  id: string;
  name: string;
  share: number;
  /** This commitment's share as a whole-number percent of the band. */
  sharePercent: number;
  archivedAt: string | null;
  subCommitments: { id: string; name: string; taskCount: number }[];
  /** Tasks hanging off the commitment itself, not off a class. */
  directTaskCount: number;
  taskCount: number;
}

export interface CommitmentsScreenData {
  /** Null when the user has never set one — every day is two-band. */
  band: number | null;
  commitments: CommitmentDetail[];
  archived: CommitmentDetail[];
  /** False once three are held, so the add control can say why. */
  canAddMore: boolean;
}

/**
 * Everything the Commitments surface renders, in one read.
 *
 * Shares are relative and need not sum to anything (ADR-0032 §3), so
 * the percentage shown beside each one is normalised here — the screen
 * should show what a commitment actually claims, not the raw number
 * behind it.
 */
export async function loadCommitmentsScreen(): Promise<CommitmentsScreenData> {
  const [band, units, taskRows] = await Promise.all([
    loadCommitmentBand(),
    db.select().from(lifeUnit).where(eq(lifeUnit.isCustom, true)),
    db
      .select({ unitId: task.unitId })
      .from(task)
      .where(eq(task.active, true)),
  ]);

  const counts = new Map<string, number>();
  for (const t of taskRows) {
    counts.set(t.unitId, (counts.get(t.unitId) ?? 0) + 1);
  }

  const parents = units.filter(
    (u) => u.parentUnitId === null && u.commitmentShare !== null,
  );
  const liveTotal = parents
    .filter((p) => p.archivedAt === null)
    .reduce((a, p) => a + (p.commitmentShare ?? 0), 0);

  const detail = (p: (typeof parents)[number]): CommitmentDetail => {
    const subs = units
      .filter((u) => u.parentUnitId === p.id && u.archivedAt === null)
      .map((u) => ({
        id: u.id,
        name: u.name,
        taskCount: counts.get(u.id) ?? 0,
      }));
    const direct = counts.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      share: p.commitmentShare ?? 0,
      sharePercent:
        liveTotal > 0 && p.archivedAt === null
          ? Math.round(((p.commitmentShare ?? 0) / liveTotal) * 100)
          : 0,
      archivedAt: p.archivedAt,
      subCommitments: subs,
      directTaskCount: direct,
      taskCount: direct + subs.reduce((a, s) => a + s.taskCount, 0),
    };
  };

  const live = parents.filter((p) => p.archivedAt === null).map(detail);
  return {
    band,
    commitments: live,
    archived: parents.filter((p) => p.archivedAt !== null).map(detail),
    canAddMore: live.length < MAX_COMMITMENTS,
  };
}
