/**
 * Data layer for the daily checklist (ADR-0004/0009). Reads feed the
 * pure engine in @glide/scoring; writes denormalize points at
 * the moment they're earned and refuse to touch days outside the
 * edit window. Finalization runs lazily on load (no background job).
 */
import {
  addDays,
  computeDayScore,
  computeStreak,
  deriveChecklist,
  editWindowStart,
  FORMULA_VERSION,
  fortnightStart,
  isEditable,
  isFinalized,
  localDateOf,
  monthStart,
  nextMonthStart,
  storedDayScore,
  VARIABLE_BAND,
  weekStart,
  type ActivityCredit,
  type DayScore,
  type TaskBand,
} from "@glide/scoring";
import { and, asc, eq, gte, inArray, isNull, lt, lte } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { autocountForTask, removeAutocountForTask } from "./goals";
import { latestWeights as latestIncludedWeights, type Tx } from "./tasks";
import {
  activity,
  activityTag,
  dayGrade,
  journalEntry,
  lifeUnit,
  photo,
  plannedOccurrence,
  task,
  taskCompletion,
  taskCompletionTag,
  taskUnit,
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
  /** ADR-0024. Presentation only — these order the checklist and never
   *  reach the grade. */
  plannedWeekdays: string | null;
  /** Which half of the fortnight a fortnightly task belongs to. */
  fortnightOffset: number;
  /** Non-null marks a one-off; the value is how it was sized. */
  oneOffSize: "quick" | "normal" | "big" | null;
  /** Its deadline, if it has one. Shown as context, never as a penalty. */
  oneOffDue: string | null;
  /** Where the row actually sits today: a placement for this date
   *  if one exists (ADR-0024 phase 3), otherwise the task's own. */
  partOfDay: "morning" | "afternoon" | "evening" | null;
  /** True when the slot above came from a placement rather than
   *  from the task — so the row can say it is only for today. */
  placedToday: boolean;
  /** Checklist order within its part of the day; null sorts last. */
  dayOrder: number | null;
  band: TaskBand;
  completedToday: boolean;
  doneCount: number;
  goalCount: number;
  extraToday: boolean;
  pointsIfCompletedNow: number;
  /**
   * Other units *this day's* completion counted toward (ADR-0025 §4).
   * Empty unless the task is completed today and was tagged.
   */
  tagUnitIds: string[];
  /**
   * Consecutive days, for daily tasks only. Null for everything else:
   * a run means nothing on a task that is meant to happen three times
   * a week, and showing one would invent a target the plan never set.
   *
   * Shown, never enforced (ADR-0004 §5). It does not reach the grade.
   */
  streak: number | null;
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
  /**
   * The communal units (ADR-0025 §1) — what the completion tag sheet
   * offers. These are dimensions rather than containers: they hold no
   * tasks, and anything may tag them.
   */
  communalUnits: { id: string; name: string; areaId: string }[];
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
 * A unit's notional day-rate for a logged activity (ADR-0027 §3):
 * `VARIABLE_BAND`'s own 20% of the unit's weight, the same proportion
 * the routine band takes at 80%. A "big" activity (rate 1) is worth as
 * much as a hypothetical lone weekly task in that unit would be; a
 * "quick" one a quarter of that.
 *
 * Under formula v6 this summed `dayShare` over a unit's actual tasks,
 * so an activity in a unit with no weekly commitment credited nothing.
 * The two bands no longer amortize against task frequency, so this
 * needs only a unit's weight — not its tasks — and an excluded unit
 * (weight 0) still credits nothing, unchanged.
 */
async function unitVariableShares(): Promise<Map<string, number>> {
  const units = await db.select().from(lifeUnit).where(isNull(lifeUnit.archivedAt));
  const weights = await latestWeights();
  const shares = new Map<string, number>();
  for (const u of units) {
    if (!u.includeInScoring) continue;
    shares.set(u.id, (VARIABLE_BAND / 100) * (weights.get(u.id) ?? 0));
  }
  return shares;
}

/** Renormalized over units still in scoring — see `db/tasks.ts`. Both
 *  surfaces have to agree on what a unit's weight is, so there is one
 *  implementation and this is a re-export of it. */
async function latestWeights(): Promise<Map<string, number>> {
  return latestIncludedWeights(db);
}

/**
 * @param recompute Ignore the finalized-day freeze and score the day
 *   from its current contents. Only `cacheDayScore` passes this, and
 *   only because the user just edited *this* day: settling a day
 *   protects it from weights drifting underneath it, never from its
 *   owner correcting it (ADR-0004 §3 — "only the future is
 *   off-limits"). Without this, marking a settled day off would change
 *   its kind and leave its cached score in place, so the day would
 *   keep counting.
 */
export async function loadDay(
  date: string,
  { recompute = false }: { recompute?: boolean } = {},
): Promise<DayData> {
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
  const everyTask = await db
    .select()
    .from(task)
    .where(eq(task.active, true))
    .orderBy(asc(task.rankInUnit));

  /**
   * One-offs earn their place on a day by a different rule to recurring
   * work: they are outstanding until they are done, so they appear from
   * their planned day onward and stop the day after they are ticked.
   *
   * **Shown on the day it was completed, not hidden immediately.** A row
   * that vanishes the instant you tick it cannot be unticked, and
   * `toggleCompletion` is a toggle. So the test is whether it was
   * finished *before* today, not whether it was finished at all.
   *
   * A one-off with no date has no start either: it is outstanding from
   * the moment it exists, which is what "no particular day" means.
   */
  const oneOffIds = everyTask.filter((t) => t.oneOffSize != null).map((t) => t.id);
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
  const allTasks = everyTask.filter((t) => {
    if (t.oneOffSize == null) return true;
    if (settledBefore.has(t.id)) return false;
    return t.oneOffDate == null || t.oneOffDate <= date;
  });
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
  const placements = await loadPlacements(date);

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

  // Tags belong to a completion, so only this date's completions have
  // any (ADR-0025 §4).
  const todaysCompletionIds = completions
    .filter((c) => c.localDate === date)
    .map((c) => ({ id: c.id, taskId: c.taskId }));
  const tagRowsForDay = todaysCompletionIds.length
    ? await db
        .select()
        .from(taskCompletionTag)
        .where(
          inArray(
            taskCompletionTag.completionId,
            todaysCompletionIds.map((c) => c.id),
          ),
        )
    : [];
  const tagsByTask = new Map<string, string[]>();
  for (const c of todaysCompletionIds) {
    const ids = tagRowsForDay
      .filter((r) => r.completionId === c.id)
      .map((r) => r.unitId);
    if (ids.length > 0) tagsByTask.set(c.taskId, ids);
  }

  /**
   * Runs for daily tasks. A separate query because the checklist's own
   * completion window is a fortnight, and a streak needs more than
   * that.
   *
   * Bounded at a year: a longer run is not worth widening every day's
   * read for, and the number stops being the interesting part well
   * before then.
   */
  const dailyTaskIds = tasks.filter((t) => t.timesPerWeek === 7).map((t) => t.id);
  const streakWindowStart = addDays(date, -365);
  const streakRows = dailyTaskIds.length
    ? await db
        .select({ taskId: taskCompletion.taskId, localDate: taskCompletion.localDate })
        .from(taskCompletion)
        .where(
          and(
            inArray(taskCompletion.taskId, dailyTaskIds),
            gte(taskCompletion.localDate, streakWindowStart),
            lte(taskCompletion.localDate, date),
          ),
        )
    : [];
  const dayOffRows = dailyTaskIds.length
    ? await db
        .select({ localDate: dayGrade.localDate })
        .from(dayGrade)
        .where(and(eq(dayGrade.kind, "rest"), gte(dayGrade.localDate, streakWindowStart)))
    : [];
  const daysOff = dayOffRows.map((d) => d.localDate);
  const streakByTask = new Map<string, number>();
  for (const id of dailyTaskIds) {
    streakByTask.set(
      id,
      computeStreak({
        done: streakRows.filter((r) => r.taskId === id).map((r) => r.localDate),
        daysOff,
        today: date,
      }).current,
    );
  }

  const todayTasks: TodayTask[] = tasks.map((t) => {
    const s = statusById.get(t.id)!;
    return {
      id: t.id,
      title: t.title,
      unitId: t.unitId,
      areaId: unitById.get(t.unitId)?.areaId ?? "",
      pointValue: t.pointValue,
      timesPerWeek: t.timesPerWeek,
      plannedWeekdays: t.plannedWeekdays,
      fortnightOffset: t.fortnightOffset,
      // `has`, not `get() ?? default`: a placement holding null is a
      // deliberate Anytime for today, not a missing one.
      oneOffSize: t.oneOffSize,
      oneOffDue: t.oneOffDue,
      partOfDay: placements.has(t.id)
        ? (placements.get(t.id) ?? null)
        : t.partOfDay,
      placedToday: placements.has(t.id),
      dayOrder: t.dayOrder,
      band: s.band,
      completedToday: s.completedToday,
      doneCount: s.doneCount,
      goalCount: s.goalCount,
      extraToday: s.extraToday,
      pointsIfCompletedNow: s.pointsIfCompletedNow,
      tagUnitIds: tagsByTask.get(t.id) ?? [],
      streak: streakByTask.get(t.id) ?? null,
    };
  });

  const [dayRow] = await db.select().from(dayGrade).where(eq(dayGrade.localDate, date));
  const kind: DayKind = dayRow?.kind ?? "normal";


  const journal = await db
    .select()
    .from(journalEntry)
    .where(eq(journalEntry.localDate, date))
    .orderBy(asc(journalEntry.createdAt));
  const photoRows = await db
    .select()
    .from(photo)
    .where(eq(photo.localDate, date))
    .orderBy(asc(photo.createdAt));
  // Rebuilt against this launch's container, not the one the row was
  // written under — see `documentsDir`.
  const docs = photoRows.length > 0 ? await documentsDir() : "";
  const photos = photoRows.map((p) => ({
    ...p,
    uri: `${docs}${toRelativePhotoPath(p.fileUri)}`,
  }));

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
  const score =
    dayRow?.finalizedAt && !recompute
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
    photos: photos.map((p) => ({ id: p.id, uri: p.uri, caption: p.caption })),
    units: units
      .filter((u) => u.includeInScoring)
      .map((u) => ({ id: u.id, name: u.name, areaId: u.areaId })),
    communalUnits: units
      .filter((u) => u.motivationKind === "communal")
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

/**
 * Rewrite a note in place.
 *
 * **Journal entries were append-only** (ADR-0002) on the grounds that
 * the log should be a faithful record. That was retired on 2026-08-13:
 * a typo you cannot fix is not fidelity, and the append-only rule had
 * no editing affordance to soften it — the day's record simply grew.
 *
 * Deliberately **not** gated on the edit window. Grades finalize;
 * memories don't (ADR-0002), and notes touch no score, so there is
 * nothing here that settling a day needs to protect.
 */
export async function updateJournalEntry(id: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    await deleteJournalEntry(id);
    return;
  }
  await db.update(journalEntry).set({ body: trimmed }).where(eq(journalEntry.id, id));
}

/** Remove a note. Hard delete: a journal entry has no downstream
 *  reader (see the ADR index's "nothing reads the life log back"), so
 *  there is nothing a soft delete would preserve. */
export async function deleteJournalEntry(id: string): Promise<void> {
  await db.delete(journalEntry).where(eq(journalEntry.id, id));
}

/** Remove a photo, and the file behind it — the row is the only thing
 *  that knows where the copy lives, so leaving the file would orphan
 *  it in app storage forever. A failed unlink is not worth surfacing:
 *  the user asked for the photo to be gone from their day, and it is. */
export async function deletePhoto(id: string): Promise<void> {
  const [row] = await db.select().from(photo).where(eq(photo.id, id));
  await db.delete(photo).where(eq(photo.id, id));
  if (row) {
    const FileSystem = await import("expo-file-system/legacy");
    // Resolved, not stored: the row holds a relative path now, and an
    // old absolute one would point at a container that no longer
    // exists anyway.
    await FileSystem.deleteAsync(await resolvePhotoUri(row.fileUri), {
      idempotent: true,
    }).catch(() => {});
  }
}

/**
 * Where photos live, resolved fresh each launch.
 *
 * **iOS moves the app container.** `documentDirectory` is
 * `file:///var/mobile/Containers/Data/Application/<UUID>/Documents/`,
 * and that UUID is reassigned on reinstall and can change across
 * updates. Anything that stored the absolute path is pointing at a
 * directory that no longer exists — which is exactly why photos
 * vanished after an update. Only the app-relative tail is durable.
 */
async function documentsDir(): Promise<string> {
  const FileSystem = await import("expo-file-system/legacy");
  return FileSystem.documentDirectory ?? "";
}

/** `photos/<id>.<ext>` — what actually goes in the database. Tolerates
 *  the absolute URIs written before 2026-08-13 by keeping only the
 *  tail, so old rows heal on read instead of needing a data migration
 *  that would itself have to guess at a stale container path. */
function toRelativePhotoPath(stored: string): string {
  const marker = "photos/";
  const i = stored.lastIndexOf(marker);
  return i >= 0 ? stored.slice(i) : stored;
}

/** Absolute URI for display, rebuilt against this launch's container. */
export async function resolvePhotoUri(stored: string): Promise<string> {
  return `${await documentsDir()}${toRelativePhotoPath(stored)}`;
}

/** Copies the picked image into app storage (picker URIs are cache)
 *  and records it against the day. Stores the **relative** path — see
 *  `documentsDir`. */
export async function addPhoto(date: string, sourceUri: string): Promise<void> {
  if (date > currentLocalDate()) throw new Error("Can't add a photo to a future day.");
  const FileSystem = await import("expo-file-system/legacy");
  const dir = `${FileSystem.documentDirectory}photos`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const id = Crypto.randomUUID();
  const raw = sourceUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const name = `${id}.${raw.length <= 4 ? raw : "jpg"}`;
  await FileSystem.copyAsync({ from: sourceUri, to: `${dir}/${name}` });
  await db.insert(photo).values({ id, localDate: date, fileUri: `photos/${name}` });
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
    // Tags hang off the completion, so unchecking takes them with it —
    // otherwise the row would be orphaned against its foreign key and
    // a re-check would silently inherit yesterday's tags.
    await db.delete(taskCompletionTag).where(
      inArray(
        taskCompletionTag.completionId,
        existing.map((c) => c.id),
      ),
    );
    await db
      .delete(taskCompletion)
      .where(and(eq(taskCompletion.taskId, taskId), eq(taskCompletion.localDate, date)));
    await removeAutocountForTask(taskId, date);
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
    // ADR-0015 §2. A goal that nominated this task gets a visible,
    // deletable progress row — the completion scores, the row does not
    // (§7 keeps the two meanings apart).
    await autocountForTask(taskId, date);
  }
  await cacheDayScore(date);
}

/**
 * Replace which other units this completion counted toward
 * (ADR-0025 §4).
 *
 * Units, never named people — an explicit non-goal of that ADR, and
 * the reason the UI asks *where does this count* rather than *who were
 * you with*. Recording that an hour counted toward Family is a fact
 * about the user; naming who was there would be a record about someone
 * who never agreed to be in this database.
 *
 * Rescores the day: since `FORMULA_VERSION` 6 a single tag earns the
 * unit's full daily share (ADR-0025 §3).
 */
export async function setCompletionTags(
  taskId: string,
  date: string,
  unitIds: readonly string[],
): Promise<void> {
  assertEditable(date);
  const [completion] = await db
    .select()
    .from(taskCompletion)
    .where(and(eq(taskCompletion.taskId, taskId), eq(taskCompletion.localDate, date)));
  // Nothing to hang a tag on. Reached only if the row was unchecked
  // between opening the sheet and saving it.
  if (!completion) return;

  await db.transaction(async (tx) => {
    await tx
      .delete(taskCompletionTag)
      .where(eq(taskCompletionTag.completionId, completion.id));
    if (unitIds.length > 0) {
      await tx.insert(taskCompletionTag).values(
        [...new Set(unitIds)].map((unitId) => ({
          completionId: completion.id,
          unitId,
        })),
      );
    }
  });
  // Since v6 a tag moves the number, so the cache has to follow it.
  // Before v6 tagging scored nothing and this call was deliberately
  // absent; leaving it absent after the formula changed would have let
  // the calendar, the week and the month read a stale day.
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
    const shares = await unitVariableShares();
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
    const shares = await unitVariableShares();
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
  // One derivation, shared with `loadDay`'s finalized path, with no
  // per-kind branching left here at all.
  //
  // This used to re-derive the grade itself, and got two things wrong.
  // It scored special days as `rating × 10` — the model ADR-0023
  // retired — so a special day showed one number in the calendar and a
  // completely different one above it. And it divided the *stored
  // integers* while the day screen divided the raw floats, which put
  // ordinary days a point apart. A day off needs no special case
  // either: it is stored as {0, 0} and `storedDayScore` returns null.
  return new Map(
    rows.map((r) => [
      r.localDate,
      {
        kind: r.kind,
        grade: storedDayScore({
          earned: r.pointsEarned,
          possible: r.pointsPossible,
        }).base,
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
/** One task as it stood on a given day (`day_grade.plan_snapshot`). */
export interface PlanSnapshotTask {
  taskId: string;
  unitId: string;
  pointValue: number;
  timesPerWeek: number;
}

async function cacheDayScore(date: string): Promise<void> {
  // `recompute`: this only ever runs straight after the user changed
  // something about this day, and that edit must land even on a day
  // that has settled.
  const day = await loadDay(date, { recompute: true });
  const plan: PlanSnapshotTask[] = [...day.daily, ...day.week, ...day.doneThisWeek].map(
    (t) => ({
      taskId: t.id,
      unitId: t.unitId,
      pointValue: t.pointValue,
      timesPerWeek: t.timesPerWeek,
    }),
  );
  const values = {
    pointsEarned: Math.round(day.score.earned),
    pointsPossible: Math.round(day.score.possible),
    formulaVersion: FORMULA_VERSION,
    // Re-written on every touch, so the last edit before a day settles
    // is the plan that sticks with it.
    planSnapshot: JSON.stringify(plan),
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

/**
 * Place a task into a part of **one day**, without changing the task
 * (ADR-0024 §1, phase 3 — the first use of `planned_occurrence`, which
 * that ADR created and nothing has touched until now).
 *
 * This is the "just for today" half of the move prompt; the permanent
 * half is `setTaskPartOfDay` in `db/tasks.ts`. Passing `partOfDay`
 * null clears the placement and the task falls back to its own.
 *
 * **A placement is an intention, not an obligation** (ADR-0024 §2).
 * Nothing here reaches the grade, no adherence statistic is derived
 * from it, and an unfulfilled placement simply lapses — it is not
 * surfaced, not counted, and never mentioned again.
 *
 * One row per task per day: placing twice replaces rather than
 * accumulates, so a day cannot end up with a task in two slots.
 */
/**
 * Put a task in a part of `date`, for that day only.
 *
 * **A null `partOfDay` is a placement, not the absence of one.** It
 * means "today, this one is Anytime" — a destination the checklist
 * offers like any other, and the reason a row is written rather than
 * skipped. Writing nothing used to look identical to having no
 * override at all, so dragging a morning task into Anytime and
 * choosing "just today" deleted the row, fell back to the task's own
 * `part_of_day`, and put it straight back under Morning while the
 * confirmation said it had moved.
 *
 * To remove an override, call `clearPlacementForDay` — the two are
 * different intentions and now have different functions.
 */
export async function placeTaskForDay(
  taskId: string,
  date: string,
  partOfDay: "morning" | "afternoon" | "evening" | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await deletePlacement(tx, taskId, date);
    await tx.insert(plannedOccurrence).values({
      id: Crypto.randomUUID(),
      taskId,
      localDate: date,
      partOfDay,
    });
  });
}

/** Drop the day's override so the task returns to its own schedule. */
export async function clearPlacementForDay(
  taskId: string,
  date: string,
): Promise<void> {
  await deletePlacement(db, taskId, date);
}

/** Scoped to live rows, matching what `loadPlacements` reads back: an
 *  archived row belongs to an archived task and is a record, not an
 *  override in play. */
async function deletePlacement(
  tx: Tx | typeof db,
  taskId: string,
  date: string,
): Promise<void> {
  await tx
    .delete(plannedOccurrence)
    .where(
      and(
        eq(plannedOccurrence.taskId, taskId),
        eq(plannedOccurrence.localDate, date),
        isNull(plannedOccurrence.archivedAt),
      ),
    );
}

/** Placements for one day, keyed by task id. */
/**
 * The day's overrides, keyed by task.
 *
 * **Presence is the override; the value is where it went.** A key
 * mapped to null means the task was explicitly placed in Anytime for
 * this day, which is why callers must ask `has()` before `get()` —
 * reading `get() ?? task.partOfDay` treats a deliberate Anytime as no
 * placement at all and sends the row back to its usual slot.
 */
export async function loadPlacements(
  date: string,
): Promise<Map<string, "morning" | "afternoon" | "evening" | null>> {
  const rows = await db
    .select()
    .from(plannedOccurrence)
    .where(
      and(
        eq(plannedOccurrence.localDate, date),
        isNull(plannedOccurrence.archivedAt),
      ),
    );
  return new Map(rows.map((r) => [r.taskId, r.partOfDay]));
}
