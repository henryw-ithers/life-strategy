/**
 * The weekly pass's data (spec §5.3.2, ADR-0039 §11): where last week
 * went, this week's events with a way to turn each off for the week,
 * and when the month's look at the tiers is due.
 *
 * **Last week is shares of what you did, and nothing else**: no missed
 * counts, no percentage of the plan, no comparison with the week before
 * (P15). Skipping the pass is never recorded or mentioned.
 */
import { workShares, type DoneWork } from "@glide/scoring";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "./client";
import { eventRowsAround } from "./dayPlan";
import {
  activity,
  activityTag,
  dayGrade,
  lifeUnit,
  scheduleSkip,
  task,
  taskCompletion,
} from "./schema";
import { getSetting, setSetting } from "./settings";
import { addSkip, removeSkip } from "./skips";
import { commitmentRoots } from "./windowRules";
import {
  activityMinutes,
  daysLeft,
  doneMinutes,
  isDueIgnoringSkips,
  lastWeek,
  monthOf,
  tiersDue,
} from "./weeklyPassRules";

export interface LastWeek {
  readonly start: string;
  readonly end: string;
  /** Each unit's share of the time spent, largest first; a commitment
   *  is one row with its sub-commitments in it. Empty when nothing was
   *  done. */
  readonly shares: readonly { unitId: string; name: string; areaId: string; share: number }[];
  /** Days you flagged ☆. */
  readonly flaggedDays: readonly string[];
  /** Activities you flagged ☆. */
  readonly flaggedActivities: readonly { title: string; date: string }[];
  /** How many things you logged. */
  readonly activities: number;
}

export async function loadLastWeek(today: string): Promise<LastWeek> {
  const { start, end } = lastWeek(today);
  const [units, ticks, acts, days] = await Promise.all([
    db
      .select({
        id: lifeUnit.id,
        name: lifeUnit.name,
        areaId: lifeUnit.areaId,
        parentUnitId: lifeUnit.parentUnitId,
        isCustom: lifeUnit.isCustom,
        commitmentShare: lifeUnit.commitmentShare,
      })
      .from(lifeUnit),
    db
      .select({
        unitId: task.unitId,
        kind: task.kind,
        size: task.size,
        oneOffSize: task.oneOffSize,
        startMinute: task.startMinute,
        endMinute: task.endMinute,
        fraction: taskCompletion.fraction,
      })
      .from(taskCompletion)
      .innerJoin(task, eq(task.id, taskCompletion.taskId))
      .where(and(gte(taskCompletion.localDate, start), lte(taskCompletion.localDate, end))),
    db
      .select()
      .from(activity)
      .where(and(gte(activity.localDate, start), lte(activity.localDate, end))),
    db
      .select({ localDate: dayGrade.localDate })
      .from(dayGrade)
      .where(
        and(gte(dayGrade.localDate, start), lte(dayGrade.localDate, end), eq(dayGrade.flagged, true)),
      ),
  ]);
  const tags = acts.length
    ? await db
        .select({ activityId: activityTag.activityId, unitId: activityTag.unitId })
        .from(activityTag)
        .where(inArray(activityTag.activityId, acts.map((a) => a.id)))
    : [];

  // A commitment's parts are filed under it: one row per commitment.
  const roots = commitmentRoots(units);
  const home = (unitId: string) => roots.get(unitId) ?? unitId;
  const done: DoneWork[] = [
    ...ticks.map((t) => ({
      unitId: home(t.unitId),
      minutes: doneMinutes({ ...t, size: t.size ?? t.oneOffSize }),
    })),
    ...acts.flatMap((a) =>
      activityMinutes(
        a.size,
        tags.filter((t) => t.activityId === a.id).map((t) => home(t.unitId)),
      ),
    ),
  ];
  const byId = new Map(units.map((u) => [u.id, u]));
  return {
    start,
    end,
    shares: workShares(done).map((s) => ({
      ...s,
      name: byId.get(s.unitId)?.name ?? s.unitId,
      areaId: byId.get(s.unitId)?.areaId ?? "",
    })),
    flaggedDays: days.map((d) => d.localDate).sort(),
    flaggedActivities: acts
      .filter((a) => a.flagged)
      .map((a) => ({ title: a.title, date: a.localDate })),
    activities: acts.length,
  };
}

/** An event as its edit sheet needs it (`saveEventEdit`). */
export interface PassEvent {
  readonly id: string;
  readonly title: string;
  readonly unitId: string;
  readonly areaId: string;
  readonly plannedWeekdays: string | null;
  readonly oneOffDate: string | null;
  readonly startMinute: number | null;
  readonly endMinute: number | null;
  readonly notes: string | null;
  readonly timesPerWeek: number;
  readonly repeatFrom: string | null;
  readonly repeatUntil: string | null;
}

/** One event this week, with its days left and which are off. */
export interface WeekEvent {
  readonly event: PassEvent;
  readonly days: readonly {
    readonly date: string;
    /** Off this week: skipped here, so it can be turned back on. */
    readonly skipId: string | null;
    /** Off for another reason (Away, a skipped week, Clear today); the
     *  switch can't turn it back on. */
    readonly offElsewhere: boolean;
  }[];
}

/** This week's events from today to Saturday, each with its days. */
export async function loadWeekEvents(today: string): Promise<WeekEvent[]> {
  const dates = daysLeft(today);
  const [rows, skips] = await Promise.all([
    eventRowsAround(today),
    db
      .select({ id: scheduleSkip.id, taskId: scheduleSkip.taskId, localDate: scheduleSkip.localDate })
      .from(scheduleSkip)
      .where(
        and(
          eq(scheduleSkip.kind, "occurrence"),
          gte(scheduleSkip.localDate, dates[0]!),
          lte(scheduleSkip.localDate, dates[dates.length - 1]!),
        ),
      ),
  ]);
  const skipOf = new Map(skips.map((s) => [`${s.taskId}|${s.localDate}`, s.id]));
  const out: WeekEvent[] = [];
  for (const r of rows) {
    const days = dates
      .filter((d) => isDueIgnoringSkips(r, d))
      .map((d) => {
        const skipId = skipOf.get(`${r.id}|${d}`) ?? null;
        return { date: d, skipId, offElsewhere: skipId === null && r.skippedDates.has(d) };
      });
    if (days.length === 0) continue;
    out.push({
      event: {
        id: r.id,
        title: r.title,
        unitId: r.unitId,
        areaId: r.areaId,
        plannedWeekdays: r.plannedWeekdays,
        oneOffDate: r.oneOffDate,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
        notes: r.description,
        timesPerWeek: r.timesPerWeek,
        repeatFrom: r.repeatFrom,
        repeatUntil: r.repeatUntil,
      },
      days,
    });
  }
  return out.sort(
    (a, b) =>
      a.days[0]!.date.localeCompare(b.days[0]!.date) ||
      (a.event.startMinute ?? 0) - (b.event.startMinute ?? 0),
  );
}

/** Whether an event is on this week: some day of it is neither
 *  skipped here nor off for another reason. */
export const isOnThisWeek = (e: WeekEvent): boolean =>
  e.days.some((d) => d.skipId === null && !d.offElsewhere);

/**
 * Turn an event off for the rest of this week, or back on: a skipped
 * run for each of its days (ADR-0040 §2), or those skips taken back.
 * A run off for another reason is left as it is.
 */
export async function setEventOffThisWeek(e: WeekEvent, off: boolean): Promise<void> {
  for (const d of e.days) {
    if (off && d.skipId === null && !d.offElsewhere) {
      await addSkip({ kind: "occurrence", taskId: e.event.id, date: d.date });
    } else if (!off && d.skipId !== null) {
      await removeSkip(d.skipId);
    }
  }
}

const TIERS_KEY = "weekly_pass_tiers_month";

/** Whether this pass offers "Still happy with your tiers?": the first
 *  pass of each month (spec §5.3.2). */
export async function tiersCheckDue(today: string): Promise<boolean> {
  return tiersDue(await getSetting(TIERS_KEY), today);
}

/** Note that this month's pass has offered the tiers. Skipping the
 *  step changes nothing else. */
export async function markTiersOffered(today: string): Promise<void> {
  await setSetting(TIERS_KEY, monthOf(today));
}
