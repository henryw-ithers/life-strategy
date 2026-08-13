/**
 * Data layer for the daily checklist (ADR-0004/0009). Reads feed the
 * pure engine in @glide/scoring; writes denormalize points at
 * the moment they're earned and refuse to touch days outside the
 * edit window. Finalization runs lazily on load (no background job).
 */
import {
  addDays,
  computeDayScore,
  dayShare,
  deriveChecklist,
  editWindowStart,
  fortnightStart,
  isEditable,
  isFinalized,
  localDateOf,
  monthStart,
  nextMonthStart,
  storedDayScore,
  weekStart,
  type ActivityCredit,
  type DayScore,
  type TaskBand,
} from "@glide/scoring";
import { and, asc, eq, gte, inArray, isNull, lt, lte } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import {
  activity,
  activityTag,
  dayGrade,
  journalEntry,
  lifeUnit,
  photo,
  task,
  taskCompletion,
  taskUnit,
  unitWeight,
} from "./schema";

export type DayKind = "normal" | "rest" | "special";
export type ActivitySize = "quick" | "normal" | "big";

export interface TodayTask {
  id: string;
  title: string;
  unitId: string;
  areaId: string;
  pointValue: number;
  timesPerWeek: number;
  band: TaskBand;
  completedToday: boolean;
  doneCount: number;
  goalCount: number;
  extraToday: boolean;
  pointsIfCompletedNow: number;
}

export interface TodayActivity {
  id: string;
  title: string;
  note: string | null;
  size: ActivitySize | null;
  tags: { unitId: string; unitName: string; areaId: string }[];
  creditedPoints: number;
}

export interface DayData {
  date: string;
  /** The app's current local date (3am rollover). */
  today: string;
  editable: boolean;
  finalized: boolean;
  kind: DayKind;
  title: string | null;
  satisfactionRating: number | null;
  score: DayScore;
  hasSnapshot: boolean;
  hasTasks: boolean;
  daily: TodayTask[];
  week: TodayTask[];
  doneThisWeek: TodayTask[];
  activities: TodayActivity[];
  /** The day's life-log: journal entries (append-only) and photos. */
  journal: { id: string; body: string }[];
  photos: { id: string; uri: string; caption: string | null }[];
  /** Scoring-included units, for activity tag pickers. */
  units: { id: string; name: string; areaId: string }[];
}

/** Rollover is a fixed 3am until settings ship (`app_setting` ready). */
export function currentLocalDate(): string {
  return localDateOf(new Date());
}

const SIZE_RATE: Record<ActivitySize, number> = {
  quick: 0.25,
  normal: 0.5,
  big: 1,
};

/**
 * Each scored unit's own contribution to a day's denominator — the sum
 * of `dayShare` over its tasks (ADR-0023 §5).
 *
 * This, not the unit's portfolio weight, is what activity credit is
 * denominated in. Weights sum to `DAILY_BUDGET` across the whole plan,
 * while the day's denominator spreads each task's weekly commitment
 * over seven days; crediting a full weight against that denominator
 * paid one logged activity more than a unit's entire day of planned
 * work. Same scale on both sides now.
 *
 * A task counts toward its home unit only, matching
 * `standardDayPossible` — a multi-unit task (ADR-0019) must not enter
 * the denominator twice.
 *
 * A unit with no tasks maps to nothing and credits zero: ADR-0003 §5
 * already reallocated its weight to units that do have tasks, so it
 * holds no share of the day to earn against.
 */
async function unitDailyShares(): Promise<Map<string, number>> {
  const units = await db.select().from(lifeUnit).where(isNull(lifeUnit.archivedAt));
  const scored = new Set(units.filter((u) => u.includeInScoring).map((u) => u.id));
  const tasks = await db.select().from(task).where(eq(task.active, true));
  const shares = new Map<string, number>();
  for (const t of tasks) {
    if (!scored.has(t.unitId)) continue;
    shares.set(
      t.unitId,
      (shares.get(t.unitId) ?? 0) + dayShare(t.pointValue, t.timesPerWeek),
    );
  }
  return shares;
}

async function latestWeights(): Promise<Map<string, number>> {
  const [latest] = await db.query.snapshot.findMany({
    orderBy: (s, { desc }) => desc(s.takenAt),
    limit: 1,
  });
  const rows = latest
    ? await db.select().from(unitWeight).where(eq(unitWeight.snapshotId, latest.id))
    : [];
  return new Map(rows.map((w) => [w.unitId, Math.round(w.override ?? w.derived)]));
}

export async function loadDay(date: string): Promise<DayData> {
  const today = currentLocalDate();
  await finalizePastDays(today);

  const weights = await latestWeights();

  const units = await db.select().from(lifeUnit).where(isNull(lifeUnit.archivedAt));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const scoredUnitIds = new Set(
    units.filter((u) => u.includeInScoring).map((u) => u.id),
  );

  // A task counts if *any* unit it serves is scored (ADR-0019) — an
  // excluded unit already contributes zero points to it, so filtering
  // on the home unit alone would drop legitimately-earned points from
  // its other units.
  const allTasks = await db
    .select()
    .from(task)
    .where(eq(task.active, true))
    .orderBy(asc(task.rankInUnit));
  const memberships = allTasks.length
    ? await db
        .select()
        .from(taskUnit)
        .where(inArray(taskUnit.taskId, allTasks.map((t) => t.id)))
    : [];
  const scoredTaskIds = new Set(
    memberships.filter((m) => scoredUnitIds.has(m.unitId)).map((m) => m.taskId),
  );
  const tasks = allTasks.filter((t) => scoredTaskIds.has(t.id));

  // Completions across the fortnight containing `date` cover both the
  // weekly and fortnightly counting windows.
  const windowStart = fortnightStart(date);
  const completions = tasks.length
    ? await db
        .select()
        .from(taskCompletion)
        .where(
          and(
            inArray(taskCompletion.taskId, tasks.map((t) => t.id)),
            gte(taskCompletion.localDate, windowStart),
            lte(taskCompletion.localDate, date),
          ),
        )
    : [];

  const statuses = deriveChecklist(
    tasks.map((t) => ({
      taskId: t.id,
      unitId: t.unitId,
      pointValue: t.pointValue,
      timesPerWeek: t.timesPerWeek,
    })),
    completions.map((c) => ({ taskId: c.taskId, localDate: c.localDate })),
    date,
  );
  const statusById = new Map(statuses.map((s) => [s.taskId, s]));

  const todayTasks: TodayTask[] = tasks.map((t) => {
    const s = statusById.get(t.id)!;
    return {
      id: t.id,
      title: t.title,
      unitId: t.unitId,
      areaId: unitById.get(t.unitId)?.areaId ?? "",
      pointValue: t.pointValue,
      timesPerWeek: t.timesPerWeek,
      band: s.band,
      completedToday: s.completedToday,
      doneCount: s.doneCount,
      goalCount: s.goalCount,
      extraToday: s.extraToday,
      pointsIfCompletedNow: s.pointsIfCompletedNow,
    };
  });

  const [dayRow] = await db.select().from(dayGrade).where(eq(dayGrade.localDate, date));
  const kind: DayKind = dayRow?.kind ?? "normal";

  const journal = await db
    .select()
    .from(journalEntry)
    .where(eq(journalEntry.localDate, date))
    .orderBy(asc(journalEntry.createdAt));
  const photos = await db
    .select()
    .from(photo)
    .where(eq(photo.localDate, date))
    .orderBy(asc(photo.createdAt));

  const dayActivities = await db
    .select()
    .from(activity)
    .where(eq(activity.localDate, date))
    .orderBy(asc(activity.createdAt));
  const tagRows = dayActivities.length
    ? await db
        .select()
        .from(activityTag)
        .where(inArray(activityTag.activityId, dayActivities.map((a) => a.id)))
    : [];

  const activities: TodayActivity[] = dayActivities.map((a) => {
    const tags = tagRows.filter((t) => t.activityId === a.id);
    return {
      id: a.id,
      title: a.title,
      note: a.note,
      size: a.size,
      tags: tags.map((t) => ({
        unitId: t.unitId,
        unitName: unitById.get(t.unitId)?.name ?? t.unitId,
        areaId: unitById.get(t.unitId)?.areaId ?? "",
      })),
      creditedPoints: tags.reduce((sum, t) => sum + t.pointsCredited, 0),
    };
  });

  const activityCredits: ActivityCredit[] = dayActivities.map((a) =>
    tagRows
      .filter((t) => t.activityId === a.id && t.pointsCredited > 0)
      .map((t) => ({ unitId: t.unitId, pointsCredited: t.pointsCredited })),
  );

  const completedTodayExtra = todayTasks.filter(
    (t) => t.completedToday && t.extraToday,
  );
  const extraRunCredit = completions
    .filter(
      (c) =>
        c.localDate === date &&
        completedTodayExtra.some((t) => t.id === c.taskId),
    )
    .reduce((sum, c) => sum + c.pointsEarned, 0);

  // A settled day reads its grade back; only a live one is computed.
  // Grades finalize (ADR-0002), so a past day's number must not move
  // when a diagnostic changes the weights under it — and must not be
  // restated under ADR-0023's formula v5, which that day was never
  // scored by. `recacheAllDayScores` leaves the same rows alone, so
  // the day screen, the calendar tint, and the weekly and monthly
  // grades all read the one stored number.
  const score = dayRow?.finalizedAt
    ? storedDayScore({ earned: dayRow.pointsEarned, possible: dayRow.pointsPossible })
    : computeDayScore({
        kind,
        satisfactionRating: dayRow?.satisfactionRating ?? null,
        tasks: todayTasks.map((t) => ({
          unitId: t.unitId,
          pointValue: t.pointValue,
          timesPerWeek: t.timesPerWeek,
          completedToday: t.completedToday,
          extraToday: t.extraToday,
        })),
        extraRunCredit,
        activities: activityCredits,
      });

  return {
    date,
    today,
    editable: isEditable(date, today),
    finalized: isFinalized(date, today) || dayRow?.finalizedAt != null,
    kind,
    title: dayRow?.title ?? null,
    satisfactionRating: dayRow?.satisfactionRating ?? null,
    score,
    hasSnapshot: weights.size > 0,
    hasTasks: tasks.length > 0,
    daily: todayTasks.filter((t) => t.band === "daily"),
    week: todayTasks.filter((t) => t.band === "week"),
    doneThisWeek: todayTasks.filter((t) => t.band === "doneThisWeek"),
    activities,
    journal: journal.map((j) => ({ id: j.id, body: j.body })),
    photos: photos.map((p) => ({ id: p.id, uri: p.fileUri, caption: p.caption })),
    units: units
      .filter((u) => u.includeInScoring)
      .map((u) => ({ id: u.id, name: u.name, areaId: u.areaId })),
  };
}

/** Journal is append-only and exempt from the edit window (ADR-0002:
 *  entries after the window just display a retroactive marker). */
export async function addJournalEntry(date: string, body: string): Promise<void> {
  if (date > currentLocalDate()) throw new Error("Can't journal a future day.");
  await db.insert(journalEntry).values({
    id: Crypto.randomUUID(),
    localDate: date,
    body,
  });
}

/** Copies the picked image into app storage (picker URIs are cache)
 *  and records it against the day. */
export async function addPhoto(date: string, sourceUri: string): Promise<void> {
  if (date > currentLocalDate()) throw new Error("Can't add a photo to a future day.");
  const FileSystem = await import("expo-file-system/legacy");
  const dir = `${FileSystem.documentDirectory}photos`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const id = Crypto.randomUUID();
  const ext = sourceUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const dest = `${dir}/${id}.${ext.length <= 4 ? ext : "jpg"}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  await db.insert(photo).values({ id, localDate: date, fileUri: dest });
}

function assertEditable(date: string): void {
  if (!isEditable(date, currentLocalDate())) {
    throw new Error("That day hasn't happened yet.");
  }
}

/** One completion per task per day: a second toggle unchecks. */
export async function toggleCompletion(taskId: string, date: string): Promise<void> {
  assertEditable(date);
  const existing = await db
    .select()
    .from(taskCompletion)
    .where(and(eq(taskCompletion.taskId, taskId), eq(taskCompletion.localDate, date)));
  if (existing.length > 0) {
    await db
      .delete(taskCompletion)
      .where(and(eq(taskCompletion.taskId, taskId), eq(taskCompletion.localDate, date)));
  } else {
    const day = await loadDay(date);
    const status = [...day.daily, ...day.week, ...day.doneThisWeek].find(
      (t) => t.id === taskId,
    );
    if (!status) return;
    await db.insert(taskCompletion).values({
      id: Crypto.randomUUID(),
      taskId,
      localDate: date,
      completedAt: new Date().toISOString(),
      pointsEarned: status.pointsIfCompletedNow,
    });
  }
  await cacheDayScore(date);
}

export async function logActivity(
  date: string,
  title: string,
  note: string | null,
  size: ActivitySize | null,
  unitIds: string[],
): Promise<void> {
  assertEditable(date);
  const id = Crypto.randomUUID();
  await db.insert(activity).values({ id, localDate: date, title, note, size });

  const tags = unitIds.slice(0, 3);
  if (tags.length > 0) {
    const shares = await unitDailyShares();
    const rate = size ? SIZE_RATE[size] : 0;
    for (const unitId of tags) {
      await db.insert(activityTag).values({
        activityId: id,
        unitId,
        pointsCredited: Math.round(rate * (shares.get(unitId) ?? 0)),
      });
    }
  }
  await cacheDayScore(date);
}

export async function deleteActivity(activityId: string, date: string): Promise<void> {
  assertEditable(date);
  await db.delete(activityTag).where(eq(activityTag.activityId, activityId));
  await db.delete(activity).where(eq(activity.id, activityId));
  await cacheDayScore(date);
}

/** Edit a logged activity: tags are replaced and credit re-denormalized
 *  at current daily shares (the edit window is live; sealed days can't
 *  get here). */
export async function updateActivity(
  activityId: string,
  date: string,
  title: string,
  note: string | null,
  size: ActivitySize | null,
  unitIds: string[],
): Promise<void> {
  assertEditable(date);
  await db
    .update(activity)
    .set({ title, note, size })
    .where(eq(activity.id, activityId));
  await db.delete(activityTag).where(eq(activityTag.activityId, activityId));

  const tags = unitIds.slice(0, 3);
  if (tags.length > 0) {
    const shares = await unitDailyShares();
    const rate = size ? SIZE_RATE[size] : 0;
    for (const unitId of tags) {
      await db.insert(activityTag).values({
        activityId,
        unitId,
        pointsCredited: Math.round(rate * (shares.get(unitId) ?? 0)),
      });
    }
  }
  await cacheDayScore(date);
}

export interface MonthDay {
  grade: number | null;
  kind: DayKind;
}

/** Cached grades for the calendar month containing `date`, keyed by
 *  local date. Days never touched have no row and are simply absent. */
/**
 * Cached day scores over an arbitrary range, `end` exclusive.
 *
 * Both calendar surfaces read this. They need different spans — the
 * grid wants a calendar month, the week strip wants the 14-day edit
 * window, and those only coincide mid-month — so the range is the
 * caller's to choose rather than being fixed to a month.
 */
export async function loadGradesBetween(
  start: string,
  end: string,
): Promise<Map<string, MonthDay>> {
  const rows = await db
    .select()
    .from(dayGrade)
    .where(and(gte(dayGrade.localDate, start), lt(dayGrade.localDate, end)));
  return new Map(
    rows.map((r) => [
      r.localDate,
      {
        kind: r.kind,
        grade:
          r.kind === "rest"
            ? null
            : r.kind === "special"
              ? r.satisfactionRating !== null
                ? r.satisfactionRating * 10
                : null
              : r.pointsPossible > 0
                ? Math.round((r.pointsEarned / r.pointsPossible) * 100)
                : null,
      },
    ]),
  );
}

/**
 * Everything both calendar surfaces need in one query: the month the
 * grid shows, widened to take in the edit window when it reaches back
 * into the previous month (which it does for the first ~two weeks of
 * every month).
 */
/**
 * Grades for everything the day surface can show: the recent strip,
 * today's month, and — since any past month is now browsable — the
 * month currently on screen, which may be years back.
 */
export async function loadCalendarGrades(
  today: string,
  viewMonth: string = today,
): Promise<Map<string, MonthDay>> {
  const windowDays = editWindowDays(today);
  const start = [monthStart(today), monthStart(viewMonth), windowDays[0]!].sort()[0]!;
  const ends = [
    nextMonthStart(today),
    nextMonthStart(viewMonth),
    addDays(windowDays[13]!, 1),
  ].sort();
  return loadGradesBetween(start, ends[ends.length - 1]!);
}

export async function setDayKind(
  date: string,
  kind: DayKind,
  opts: { title?: string | null; satisfactionRating?: number | null } = {},
): Promise<void> {
  assertEditable(date);
  const values = {
    kind,
    title: kind === "special" ? (opts.title ?? null) : null,
    satisfactionRating:
      kind === "special" ? (opts.satisfactionRating ?? null) : null,
  };
  const [existing] = await db.select().from(dayGrade).where(eq(dayGrade.localDate, date));
  if (existing) {
    await db.update(dayGrade).set(values).where(eq(dayGrade.localDate, date));
  } else {
    await db.insert(dayGrade).values({ localDate: date, ...values });
  }
  await cacheDayScore(date);
}

/** Cache the day's earned/possible on day_grade (calendar tinting will
 *  read it); the live screen always recomputes via the engine. */
async function cacheDayScore(date: string): Promise<void> {
  const day = await loadDay(date);
  const values = {
    pointsEarned: Math.round(day.score.earned),
    pointsPossible: Math.round(day.score.possible),
  };
  const [existing] = await db.select().from(dayGrade).where(eq(dayGrade.localDate, date));
  if (existing) {
    await db.update(dayGrade).set(values).where(eq(dayGrade.localDate, date));
  } else {
    await db.insert(dayGrade).values({ localDate: date, kind: "normal", ...values });
  }
}

/**
 * Re-cache every stored day's score.
 *
 * `day_grade.points_earned/possible` is a denormalized cache, and it is
 * only ever written for the one day being touched. The day screen's own
 * number is computed live by `loadDay`, so the moment weights move —
 * a new diagnostic, or a re-rank — the live number and the calendar
 * disagree with each other and with the weekly and monthly grades built
 * on top of the cache. This is what reconciles them.
 *
 * **Finalized days are excluded.** Grades finalize (ADR-0002), so a
 * settled day is a historical fact and re-deriving it at today's
 * weights would silently restate the past. That mattered less when the
 * only drift was a weight change; after ADR-0023 bumped
 * `FORMULA_VERSION` to 5 it would also re-score days under a formula
 * they were never graded by — a tester's rated special day would
 * collapse from `rating × 10` to tasks-plus-a-capped-bonus, weeks
 * after the fact. `loadDay` reads the same rows back rather than
 * recomputing them, so the two stay in agreement.
 *
 * What remains is exactly the reconciliation this exists for: the days
 * still inside the edit window, which are live anyway.
 */
export async function recacheAllDayScores(): Promise<void> {
  const rows = await db
    .select({ localDate: dayGrade.localDate })
    .from(dayGrade)
    .where(isNull(dayGrade.finalizedAt));
  for (const r of rows) await cacheDayScore(r.localDate);
}

/** Stamp finalized_at on day rows that have left the edit window. */
async function finalizePastDays(today: string): Promise<void> {
  await db
    .update(dayGrade)
    .set({ finalizedAt: new Date().toISOString() })
    .where(
      and(
        lt(dayGrade.localDate, editWindowStart(today)),
        isNull(dayGrade.finalizedAt),
      ),
    );
}

/** The 14 selectable days: last week's Sunday through this week's
 *  Sunday. Days after `today` are visible but disabled. */
export function editWindowDays(today: string): string[] {
  const start = editWindowStart(today);
  return Array.from({ length: 14 }, (_, i) => addDays(start, i));
}

/** The seven days (Sun-first) of the week containing `date`. */
export function weekOf(date: string): string[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
