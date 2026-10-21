/**
 * Achievements (ADR-0047): the app awards ranks from what it already
 * records, and the screens read them back with progress toward the
 * next. `achievementRules.ts` says what each series stands at; this
 * reads the facts, stores what's newly earned, and serves the screens.
 *
 * **Insert-only, never a grade.** A rank once earned stays (§6), and
 * nothing here touches a score, a weight or the plan.
 */
import {
  ranksReached,
  RANKS,
  seriesById,
  type Rank,
  type SeriesId,
  type Subject,
} from "@glide/scoring";
import { and, asc, eq, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { currentLocalDate } from "../lib/calendar";
import {
  highestRank,
  runShown,
  seriesValues,
  type AchievementFacts,
  type SeriesValue,
  type UnitBadge,
} from "./achievementRules";
import { db } from "./client";
import {
  achievement,
  activity,
  awayRange,
  dayGrade,
  lifeArea,
  lifeUnit,
  scheduleSkip,
  task,
  taskCompletion,
} from "./schema";
import type { Tx } from "./tasks";
import { commitmentRoots, skippedDatesFor } from "./windowRules";

/** Everything the series read, in one transaction, so a tick landing
 *  meanwhile can't leave two counts disagreeing. */
function readFacts(tx: Tx, today: string): AchievementFacts {
  const units = tx
    .select({
      id: lifeUnit.id,
      name: lifeUnit.name,
      areaId: lifeUnit.areaId,
      parentUnitId: lifeUnit.parentUnitId,
      isCustom: lifeUnit.isCustom,
      commitmentShare: lifeUnit.commitmentShare,
      archivedAt: lifeUnit.archivedAt,
    })
    .from(lifeUnit)
    .orderBy(asc(lifeUnit.sortOrder))
    .all();
  const tasks = tx.select().from(task).where(eq(task.active, true)).orderBy(asc(task.rankInUnit)).all();
  const skips = tx
    .select({
      kind: scheduleSkip.kind,
      taskId: scheduleSkip.taskId,
      unitId: scheduleSkip.unitId,
      localDate: scheduleSkip.localDate,
      madeOn: scheduleSkip.madeOn,
    })
    .from(scheduleSkip)
    .all();
  const roots = commitmentRoots(units);
  return {
    today,
    areas: tx.select({ id: lifeArea.id, name: lifeArea.name }).from(lifeArea).orderBy(asc(lifeArea.sortOrder)).all(),
    units,
    tasks,
    completions: tx
      .select({
        taskId: taskCompletion.taskId,
        localDate: taskCompletion.localDate,
        fraction: taskCompletion.fraction,
        actualMinutes: taskCompletion.actualMinutes,
      })
      .from(taskCompletion)
      .all(),
    grades: tx
      .select({
        localDate: dayGrade.localDate,
        kind: dayGrade.kind,
        pointsEarned: dayGrade.pointsEarned,
        pointsPossible: dayGrade.pointsPossible,
        flagged: dayGrade.flagged,
      })
      .from(dayGrade)
      .all(),
    activities: tx.select({ localDate: activity.localDate, flagged: activity.flagged }).from(activity).all(),
    away: tx.select({ startDate: awayRange.startDate, endDate: awayRange.endDate }).from(awayRange).all(),
    skipped: skippedDatesFor(skips, new Map(tasks.map((t) => [t.id, roots.get(t.unitId) ?? null]))),
  };
}

export interface EarnedAchievement {
  id: string;
  series: SeriesId;
  subjectKind: Subject;
  subjectId: string;
  subjectName: string;
  rank: Rank;
  threshold: number;
  earnedOn: string;
}

type AchievementRow = typeof achievement.$inferSelect;

const toEarned = (r: AchievementRow): EarnedAchievement => ({
  id: r.id,
  series: r.series as SeriesId,
  subjectKind: r.subjectKind,
  subjectId: r.subjectId,
  subjectName: r.subjectName,
  rank: r.rank,
  threshold: r.threshold,
  earnedOn: r.earnedOn,
});

/** A row's key: one rank of one series for one subject. */
const keyOf = (series: string, subjectId: string, rank: string) => `${series}|${subjectId}|${rank}`;

/**
 * Award every rank reached and not yet stored, and return the new ones
 * (§6). Safe to call as often as you like: a rank is stored once, and
 * one already stored is never removed or lowered.
 */
export async function awardAchievements(): Promise<EarnedAchievement[]> {
  const today = currentLocalDate();
  return db.transaction((tx) => {
    const values = seriesValues(readFacts(tx, today));
    const have = new Set(
      tx
        .select({ series: achievement.series, subjectId: achievement.subjectId, rank: achievement.rank })
        .from(achievement)
        .all()
        .map((r) => keyOf(r.series, r.subjectId, r.rank)),
    );
    const fresh: AchievementRow[] = [];
    for (const v of values) {
      const { thresholds } = seriesById(v.series);
      const reached = ranksReached(thresholds, v.earned);
      for (let i = 0; i < reached; i++) {
        const rank = RANKS[i]!;
        if (have.has(keyOf(v.series, v.subjectId, rank))) continue;
        const now = new Date().toISOString();
        fresh.push({
          id: Crypto.randomUUID(),
          series: v.series,
          subjectKind: v.subjectKind,
          subjectId: v.subjectId,
          subjectName: v.subjectName,
          rank,
          threshold: thresholds[i]!,
          earnedOn: today,
          celebratedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    if (fresh.length > 0) tx.insert(achievement).values(fresh).onConflictDoNothing().run();
    return fresh.map(toEarned);
  });
}

export { highestRank, runShown, type UnitBadge } from "./achievementRules";

// ── Reading them back ───────────────────────────────────────────────

export interface AchievementItem {
  series: SeriesId;
  subjectKind: Subject;
  subjectId: string;
  subjectName: string;
  /** Where it's listed (`SeriesValue.groupId`); null for a subject
   *  that's gone. */
  groupId: string | null;
  /** A run (in a row) rather than a total. */
  run: boolean;
  /** Ranks earned, lowest first, with the day each was earned. */
  earned: { rank: Rank; threshold: number; earnedOn: string }[];
  /** The next rank and what it needs; null once Diamond is earned,
   *  and for a subject that's gone. */
  next: { rank: Rank; threshold: number } | null;
  /** Toward the next rank: the total, or the run going now. Null for a
   *  subject that's gone, whose ranks are kept but no longer counted. */
  progress: number | null;
  /** A run going now that's reached the series' first rank: what the
   *  streak icon shows (§5). Null otherwise. */
  streak: number | null;
}

/**
 * The item for one series of one subject, with its stored ranks. `v`
 * is its value now, or null for a subject that's gone, which is then
 * read from its rows (there is at least one).
 */
function itemFor(v: SeriesValue | null, rows: readonly AchievementRow[]): AchievementItem {
  const subject = v ?? { ...rows[0]!, series: rows[0]!.series as SeriesId, groupId: null };
  const { thresholds, run } = seriesById(subject.series);
  const earned = [...rows]
    .sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank))
    .map((r) => ({ rank: r.rank, threshold: r.threshold, earnedOn: r.earnedOn }));
  const nextIndex = RANKS.findIndex((rank) => !rows.some((r) => r.rank === rank));
  return {
    series: subject.series,
    subjectKind: subject.subjectKind,
    subjectId: subject.subjectId,
    subjectName: subject.subjectName,
    groupId: subject.groupId,
    run,
    earned,
    next: v && nextIndex !== -1 ? { rank: RANKS[nextIndex]!, threshold: thresholds[nextIndex]! } : null,
    progress: v ? v.current : null,
    streak: v && run && v.current >= thresholds[0] ? v.current : null,
  };
}

/**
 * Every achievement, earned and locked (§7): each series for each live
 * subject, plus the ranks of subjects since removed. Awards anything
 * newly reached first, so the list never shows a rank as locked that
 * has been reached.
 */
export async function loadAchievements(): Promise<AchievementItem[]> {
  await awardAchievements();
  const today = currentLocalDate();
  const { values, rows } = db.transaction((tx) => ({
    values: seriesValues(readFacts(tx, today)),
    rows: tx.select().from(achievement).all(),
  }));
  const rowsBy = new Map<string, AchievementRow[]>();
  for (const r of rows) {
    const k = `${r.series}|${r.subjectId}`;
    rowsBy.set(k, [...(rowsBy.get(k) ?? []), r]);
  }
  const items: AchievementItem[] = [];
  for (const v of values) {
    const k = `${v.series}|${v.subjectId}`;
    const own = rowsBy.get(k) ?? [];
    rowsBy.delete(k);
    items.push(itemFor(v, own));
  }
  // Ranks of a task or unit since removed: kept, not counted on.
  for (const own of rowsBy.values()) items.push(itemFor(null, own));
  return items;
}

/**
 * What a unit's row shows (§7): its highest rank earned, and its
 * longest run going now, from the unit's own series and its tasks'.
 */
export function badgesByUnit(items: readonly AchievementItem[]): Map<string, UnitBadge> {
  const own = new Map<string, AchievementItem[]>();
  for (const i of items) {
    // A task is listed under its unit or commitment (`groupId`).
    const unitId =
      i.subjectKind === "unit" || i.subjectKind === "commitment"
        ? i.subjectId
        : i.subjectKind === "task"
          ? i.groupId
          : null;
    if (unitId === null) continue;
    own.set(unitId, [...(own.get(unitId) ?? []), i]);
  }
  return new Map([...own].map(([id, list]) => [id, { rank: highestRank(list), streak: runShown(list) }]));
}

// ── Celebrating ─────────────────────────────────────────────────────

/** Ranks earned and not yet celebrated, oldest first (§6). */
export async function loadUncelebrated(): Promise<EarnedAchievement[]> {
  const rows = await db.select().from(achievement).where(isNull(achievement.celebratedAt));
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toEarned);
}

/** Mark the celebration shown, so it's shown once. */
export async function markCelebrated(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  db.transaction((tx) => {
    for (const id of ids) {
      tx.update(achievement)
        .set({ celebratedAt: now })
        .where(and(eq(achievement.id, id), isNull(achievement.celebratedAt)))
        .run();
    }
  });
}
