/**
 * Commitments, and what one day's commitment work looks like
 * (ADR-0035, ADR-0032).
 *
 * A commitment is a `life_unit` with `is_custom` set, holding tasks
 * and sub-commitments (`parent_unit_id`). It is scored from its own
 * band rather than from the 18 life units' pool — **what separates a
 * commitment from a life unit is its band, not its table.**
 */
import {
  commitmentDayFromShare,
  commitmentShare,
  isDueOn,
  MAX_COMMITMENTS,
  type CommitmentDay,
} from "@glide/scoring";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { db } from "./client";
import { fractionsBefore, settledOf } from "./oneOffProgress";
import {
  doneAheadOn,
  eligibleTaskIds,
  groupCommitments,
  shareWorkFor,
  subCommitmentsOn,
  type EligibilityRow,
  type ScheduledTask,
} from "./commitmentPlan";
import { startingHours } from "./hours";
import { loadSchedule } from "./schedule";
import { withSchedule } from "./windowRules";
import { completionDatesAround } from "./sessionCoverage";
import { lifeUnit, pool, poolMember, task, taskCompletion } from "./schema";

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
 * The commitment work eligible on `date`: scheduled sessions and work
 * planned for that day (ADR-0032 §3), from rows that already carry
 * their bounds and skips (`withSchedule`).
 *
 * Eligibility is deliberately the same test the checklist uses, so a
 * task the day shows and a task the band pays for cannot diverge:
 *
 * - **due on this date** (`isDueOn`: its weekday, inside its bounds,
 *   not skipped), or
 * - **an outstanding one-off** dated this day, or undated.
 *
 * **A one-off dated earlier and still open is carried, not eligible**
 * (formula v11). A carried task is never added to a later day's load:
 * done late, it is paid what its own day would have paid, outside the
 * band (`loadDay`'s off-schedule work).
 */
async function eligibleOn(
  date: string,
  rows: readonly (EligibilityRow & ScheduledTask)[],
  includeCovered: boolean,
): Promise<string[]> {
  if (rows.length === 0) return [];

  // The checklist's own rule, from the one place it now lives: settled
  // means finished, so a part-done assignment is still owed today.
  const oneOffIds = rows.filter((t) => t.oneOffSize != null).map((t) => t.id);
  const settledBefore = settledOf(await fractionsBefore(oneOffIds, date));
  const eligible = eligibleTaskIds(rows, settledBefore, date).filter((id) => {
    const t = rows.find((r) => r.id === id);
    return !(t?.oneOffSize != null && t.oneOffDate != null && t.oneOffDate < date);
  });
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
 * ordinary day**.
 *
 * The band is **the commitments' share of the day** (ADR-0044, formula
 * v11): each one's events and scheduled task sizes over the working
 * hours the day began with (`startingHours`), kept between 10 and the
 * limit for how many commitments there are. A share set on the
 * commitment replaces the automatic one. The old `commitment.band`
 * setting and relative shares no longer price anything.
 *
 * Null when there are no commitments, the day is Away, or no
 * commitment work is scheduled (ADR-0032 §1): the band exists only on
 * days it can be earned. After Clear today only what was ticked counts
 * (ADR-0040 §4), so a cleared day with none ticked has no share.
 *
 * Pools (ADR-0033 §3) are read for the date and passed through. A pool
 * contributes its **planned count** to the divisor rather than its
 * member count.
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
  const units = await db
    .select()
    .from(lifeUnit)
    .where(and(eq(lifeUnit.isCustom, true), isNull(lifeUnit.archivedAt)));
  const groups = groupCommitments(units);
  if (groups.length === 0) return null;
  const commitmentUnits = new Set(groups.flatMap((g) => [...g.unitIds]));

  // Commitment work, and the life events whose time outside working
  // hours is part of the day too.
  const raw = await db
    .select()
    .from(task)
    .where(
      and(
        eq(task.active, true),
        or(inArray(task.unitId, [...commitmentUnits]), eq(task.kind, "event")),
      ),
    );
  const schedule = await loadSchedule(date, raw);
  if (schedule.away.has(date)) return null;
  const rows = raw.map((t) => withSchedule(t, schedule.skipped));
  const work = rows.filter((t) => commitmentUnits.has(t.unitId));

  let eligible = await eligibleOn(date, work, options.includeCovered === true);
  const ticked = new Set(
    work.length
      ? (
          await db
            .select({ taskId: taskCompletion.taskId })
            .from(taskCompletion)
            .where(
              and(
                eq(taskCompletion.localDate, date),
                inArray(taskCompletion.taskId, work.map((t) => t.id)),
              ),
            )
        ).map((r) => r.taskId)
      : [],
  );
  if (schedule.cleared) eligible = eligible.filter((id) => ticked.has(id));
  if (eligible.length === 0) return null;

  const setShareOf = new Map(units.map((u) => [u.id, u.setShare]));
  const share = commitmentShare({
    working: await startingHours(date),
    commitments: shareWorkFor(groups, work, new Set(eligible), ticked, date, setShareOf),
    commitmentCount: groups.length,
    otherEvents: rows
      .filter(
        (t) =>
          !commitmentUnits.has(t.unitId) &&
          t.startMinute !== null &&
          t.endMinute !== null &&
          isDueOn(t, date),
      )
      .map((t) => ({ start: t.startMinute!, end: t.endMinute! })),
  });
  return commitmentDayFromShare(
    share,
    groups,
    eligible,
    await poolsOn(date, new Set(eligible)),
  );
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
  /** For colour only (ADR-0021): the area it falls back to. */
  areaId: string;
  /** Its own palette key, or null to use its area's (ADR-0043 §4). */
  colour: string | null;
  archivedAt: string | null;
  subCommitments: { id: string; name: string; taskCount: number }[];
  /** Tasks hanging off the commitment itself, not off a class. */
  directTaskCount: number;
  taskCount: number;
}

export interface CommitmentsScreenData {
  commitments: CommitmentDetail[];
  archived: CommitmentDetail[];
  /** False once three are held, so the add control can say why. */
  canAddMore: boolean;
}

/** Everything the Commitments surface renders, in one read. A
 *  commitment's share comes from each day (ADR-0044), so none is shown
 *  here. */
export async function loadCommitmentsScreen(): Promise<CommitmentsScreenData> {
  const [units, taskRows] = await Promise.all([
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
      areaId: p.areaId,
      colour: p.colour,
      archivedAt: p.archivedAt,
      subCommitments: subs,
      directTaskCount: direct,
      taskCount: direct + subs.reduce((a, s) => a + s.taskCount, 0),
    };
  };

  const live = parents.filter((p) => p.archivedAt === null).map(detail);
  return {
    commitments: live,
    archived: parents.filter((p) => p.archivedAt !== null).map(detail),
    canAddMore: live.length < MAX_COMMITMENTS,
  };
}

// ── One commitment or sub-commitment, as its own screen ─────────────

/** A task or event as the commitment screens list it. */
export interface UnitItem {
  id: string;
  title: string;
  kind: "task" | "event";
  timesPerWeek: number;
  plannedWeekdays: string | null;
  startMinute: number | null;
  endMinute: number | null;
  /** A one-off's planned day; null for a repeating item. */
  oneOffDate: string | null;
  oneOffSize: "quick" | "normal" | "big" | null;
  notes: string | null;
  /** When a repeating series runs, either end open (ADR-0040 §1). */
  repeatFrom: string | null;
  repeatUntil: string | null;
}

export interface CommitmentUnitScreen {
  id: string;
  name: string;
  /** For colour only (ADR-0021): the area it falls back to. */
  areaId: string;
  /** Its own palette key, or null. */
  colour: string | null;
  /** A sub-commitment's commitment's palette key, which it shows when
   *  it has none of its own. Null on a commitment. */
  parentColour: string | null;
  archivedAt: string | null;
  /** The commitment this belongs to, for a sub-commitment; else null. */
  parent: { id: string; name: string } | null;
  /** A sub-commitment that is its commitment's only one: removing it
   *  moves its work back onto the commitment (ADR-0044 §7). */
  lastSub: boolean;
  /** Split into sub-commitments (ADR-0035 §1). Commitments only. */
  subsOn: boolean;
  subs: { id: string; name: string; eventCount: number; taskCount: number }[];
  /** Sub-commitments put away by turning the switch off — restored when
   *  it goes back on. */
  archivedSubCount: number;
  /** What this unit holds directly. Empty on a split commitment. */
  events: UnitItem[];
  tasks: UnitItem[];
}

/** What a commitment's nav bar shows: its name and the shape of its •••
 *  menu. */
export interface CommitmentHeading {
  name: string;
  /** A sub-commitment, whose only option is delete. */
  sub: boolean;
  archived: boolean;
  subsOn: boolean;
}

/**
 * A commitment's heading, read synchronously like `readGoalHeading`, so
 * the nav bar is right on the first frame of the push. Null if it's
 * gone.
 */
export function readCommitmentHeading(id: string): CommitmentHeading | null {
  const row = db.select().from(lifeUnit).where(eq(lifeUnit.id, id)).get();
  if (!row) return null;
  const liveSubs = db
    .select({ id: lifeUnit.id })
    .from(lifeUnit)
    .where(and(eq(lifeUnit.parentUnitId, id), isNull(lifeUnit.archivedAt)))
    .all();
  const sub = row.parentUnitId !== null;
  return {
    name: row.name,
    sub,
    archived: row.archivedAt !== null,
    subsOn: !sub && subCommitmentsOn(row, liveSubs.length),
  };
}

/**
 * Everything one commitment screen needs — the commitment itself or one
 * of its sub-commitments, which open their own screen (Henry,
 * 2026-10-02). Events and tasks are listed separately because they are
 * different kinds of thing to plan: one is a time you turn up for, the
 * other is work you fit in.
 */
export async function loadCommitmentUnit(id: string): Promise<CommitmentUnitScreen | null> {
  const units = await db.select().from(lifeUnit).where(eq(lifeUnit.isCustom, true));
  const row = units.find((u) => u.id === id);
  if (!row) return null;
  const parentRow = row.parentUnitId
    ? (units.find((u) => u.id === row.parentUnitId) ?? null)
    : null;

  const liveSubs = units.filter((u) => u.parentUnitId === id && u.archivedAt === null);
  const subsOn = parentRow === null && subCommitmentsOn(row, liveSubs.length);

  const holderIds = [id, ...liveSubs.map((s) => s.id)];
  const rows = await db
    .select()
    .from(task)
    .where(and(inArray(task.unitId, holderIds), eq(task.active, true)));
  const item = (t: (typeof rows)[number]): UnitItem => ({
    id: t.id,
    title: t.title,
    kind: t.kind,
    timesPerWeek: t.timesPerWeek,
    plannedWeekdays: t.plannedWeekdays,
    startMinute: t.startMinute,
    endMinute: t.endMinute,
    oneOffDate: t.oneOffDate,
    repeatFrom: t.repeatFrom,
    repeatUntil: t.repeatUntil,
    oneOffSize: t.oneOffSize,
    notes: t.description,
  });
  const own = subsOn ? [] : rows.filter((t) => t.unitId === id).map(item);
  const byStart = (a: UnitItem, b: UnitItem) =>
    (a.startMinute ?? 0) - (b.startMinute ?? 0) || a.title.localeCompare(b.title);


  return {
    id,
    name: row.name,
    areaId: row.areaId,
    colour: row.colour,
    parentColour: parentRow?.colour ?? null,
    archivedAt: row.archivedAt,
    parent: parentRow ? { id: parentRow.id, name: parentRow.name } : null,
    lastSub:
      parentRow !== null &&
      !units.some((u) => u.parentUnitId === parentRow.id && u.id !== id && u.archivedAt === null),
    subsOn,
    subs: subsOn
      ? liveSubs.map((s) => ({
          id: s.id,
          name: s.name,
          eventCount: rows.filter((t) => t.unitId === s.id && t.kind === "event").length,
          taskCount: rows.filter((t) => t.unitId === s.id && t.kind !== "event").length,
        }))
      : [],
    archivedSubCount: units.filter((u) => u.parentUnitId === id && u.archivedAt !== null)
      .length,
    events: own.filter((t) => t.kind === "event").sort(byStart),
    tasks: own.filter((t) => t.kind !== "event"),
  };
}
