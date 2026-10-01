/**
 * Data layer for the daily checklist (ADR-0004/0009). Reads feed the
 * pure engine in @glide/scoring; writes denormalize points at
 * the moment they're earned and refuse to touch days outside the
 * edit window. Finalization runs lazily on load (no background job).
 */
import {
  addDays,
  commitmentBandOn,
  averageDayExpected,
  commitmentPointValues,
  computeDayScore,
  computeStreak,
  computeDayLoad,
  deriveChecklist,
  type LoadTask,
  editWindowStart,
  FORMULA_VERSION,
  fortnightStart,
  isEditable,
  EXTRA_RUN_RATE,
  isFinalized,
  isRestDay,
  plannedDateFor,
  plannedDayRunPoints,
  lifeShare,
  localDateOf,
  monthStart,
  nextMonthStart,
  normalizeFraction,
  partialPoints,
  PLANNED_BAND,
  progressOf,
  REST_DAY_UNPLANNED,
  restDayRunPoints,
  storedDayScore,
  UNPLANNED_BAND,
  weekStart,
  type ActivityCredit,
  type CommitmentDay,
  type DayScore,
  type TaskBand,
} from "@glide/scoring";
import { and, asc, eq, gte, inArray, isNull, lt, lte } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { loadCommitmentDay } from "./commitments";
import {
  COVERAGE_LOOKBACK_DAYS,
  doneAheadOn,
  isCommitmentUnit,
  scheduledDateFor,
  sessionFor,
} from "./commitmentPlan";
import { completionDatesAround } from "./sessionCoverage";
import { isDueOn } from "../components/plan/planning";
import { fractionsBefore, settledOf } from "./oneOffProgress";
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
  /** Whether its owner turned part credit on (ADR-0014 §1). */
  allowsPartial: boolean;
  /** Filed under a commitment or one of its parts (ADR-0035). */
  commitment: boolean;
  /**
   * Commitment work that is not scheduled for this day. Worth its
   * scheduled-day value, paid in full outside every cap (ADR-0032 §4).
   */
  offSchedule: boolean;
  /**
   * The earlier day this session was done on, when it was done ahead
   * (ADR-0032 §4). The session is finished: it pays nothing today and
   * reads as done; undoing it undoes that earlier tick.
   */
  doneAheadOn: string | null;
  /** A one-off's planned day, or null. Places a future one-off among
   *  "Planned for other days". */
  oneOffDate: string | null;
  /**
   * How much of it is done, 0–1. A one-off accumulates across days; a
   * recurring task's is today's own fraction, since its Tuesday is not
   * a continuation of its Monday.
   *
   * **Progress, never deficit** (ADR-0014 §5): 0.5 reads as "half
   * done", never as "half missing", and nothing conditions on it.
   */
  progress: number;
  /** What today's completion paid, when it was a partial one. */
  earnedToday: number | null;
  /**
   * The fraction today's own completion was for, or null for none.
   *
   * Distinct from `progress`, which for a one-off also carries earlier
   * days. The picker adds to `progress − fractionToday`, because a day
   * holds one completion and picking again replaces it.
   */
  fractionToday: number | null;
  /** Minutes from local midnight, or null (ADR-0036 §1). */
  startMinute: number | null;
  endMinute: number | null;
  /** Effort size, or null for unsized (ADR-0026 §1). */
  size: "quick" | "normal" | "big" | null;
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
  /** Today is a rest day (ADR-0037): automatic, scored from 70. */
  restDay: boolean;
  /**
   * The day asks nothing and there is a plan. A rest day already if
   * nothing is open later this week; otherwise it becomes one the moment
   * something is done early (ADR-0037 §1).
   */
  nothingDue: boolean;
  hasTasks: boolean;
  /** Anchored to today: every-day tasks and anything pinned here. */
  due: TodayTask[];
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

/** How far ahead commitment one-offs reach onto today (see `loadDay`). */
const AHEAD_DAYS = 7;

/**
 * What each off-schedule commitment task is worth: the value of the
 * scheduled session it stands in for (ADR-0032 §4, amended 2026-09-30
 * and 2026-10-01).
 *
 * - A **one-off** done ahead takes its own planned day.
 * - A **recurring** task takes the session its tick covers — the next
 *   one not already done, on its day or by an earlier early tick
 *   (`sessionFor`). So a session is paid once however far ahead it is
 *   worked.
 *
 * Each is priced against that real day **as scheduled** — the session
 * still in it, sharing the band with that day's other work. Not against
 * today, where on a free Sunday one assignment would take the whole
 * band; and not with the session already removed, which would price the
 * tick that removed it at nothing. Tasks sharing a day are priced in
 * one pass.
 */
async function scheduledDayValues(
  tasks: readonly (Parameters<typeof scheduledDateFor>[0] & { id: string; unitId: string })[],
  date: string,
  sessionDates: ReadonlyMap<string, string[]>,
): Promise<Map<string, number>> {
  const byDate = new Map<string, string[]>();
  for (const t of tasks) {
    const on =
      t.oneOffSize != null
        ? scheduledDateFor(t, date)
        : sessionFor(t, date, sessionDates.get(t.id) ?? []);
    if (on !== null) byDate.set(on, [...(byDate.get(on) ?? []), t.id]);
  }
  const values = new Map<string, number>();
  for (const [on, ids] of byDate) {
    const day = await loadCommitmentDay(on, { includeCovered: true });
    if (day === null) continue;
    const points = commitmentPointValues(day, await commitmentTasksOf(day));
    for (const id of ids) values.set(id, points.get(id) ?? 0);
  }
  return values;
}

/** The `{ id, unitId }` of a commitment day's eligible tasks — all
 *  `commitmentPointValues` needs to divide the band among them. */
async function commitmentTasksOf(
  day: CommitmentDay,
): Promise<{ id: string; unitId: string }[]> {
  if (day.eligibleTaskIds.length === 0) return [];
  return db
    .select({ id: task.id, unitId: task.unitId })
    .from(task)
    .where(inArray(task.id, [...day.eligibleTaskIds]));
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
 * A unit's notional day-rate for a logged activity (ADR-0023 §1, as
 * resized by ADR-0029 §2): `UNPLANNED_BAND`'s own 10% of the unit's
 * weight. A "big" activity (rate 1) draws a tenth of that unit's
 * standing; a "quick" one a quarter of that. The band it draws from is
 * 10 rather than 20 now, because planned work stopped sharing it.
 *
 * Before formula v7 this was derived from a unit's actual tasks, so an
 * activity in a unit with no weekly commitment credited nothing.
 * Nothing amortizes against task frequency any more, so this needs only
 * a unit's weight — not its tasks — and an excluded unit (weight 0)
 * still credits nothing, unchanged.
 */
async function unitVariableShares(
  /** The pool activities draw from: `UNPLANNED_BAND`, or
   *  `REST_DAY_UNPLANNED` on a rest day (ADR-0037 §2). */
  pool: number = UNPLANNED_BAND,
): Promise<Map<string, number>> {
  const units = await db.select().from(lifeUnit).where(isNull(lifeUnit.archivedAt));
  const weights = await latestWeights();
  const shares = new Map<string, number>();
  for (const u of units) {
    if (!u.includeInScoring) continue;
    shares.set(u.id, (pool / 100) * (weights.get(u.id) ?? 0));
  }
  return shares;
}

/**
 * Re-price a day's activities for the pool they now draw from.
 *
 * **A rest day's activities draw from 30, not 10, at three times the
 * rate** (ADR-0037 §2). At the ordinary rate a big activity in a
 * weight-8 unit earns one point, so a 30-point allowance would take
 * thirty activities to fill and the number would be decorative. The
 * rate follows the pool, so the same afternoon is worth the same share
 * of whichever pool it lands in.
 *
 * Whether a day is a rest day can change after something is logged —
 * a task added that is due today ends it — so credit is re-priced here,
 * on every edit to the day, rather than fixed at log time. Returns
 * whether anything moved.
 */
async function recreditActivities(date: string, restDay: boolean): Promise<boolean> {
  const rows = await db.select().from(activity).where(eq(activity.localDate, date));
  if (rows.length === 0) return false;
  const tags = await db
    .select()
    .from(activityTag)
    .where(inArray(activityTag.activityId, rows.map((a) => a.id)));
  const shares = await unitVariableShares(restDay ? REST_DAY_UNPLANNED : UNPLANNED_BAND);
  let moved = false;
  for (const tag of tags) {
    const size = rows.find((a) => a.id === tag.activityId)?.size;
    const credit = Math.round((size ? SIZE_RATE[size] : 0) * (shares.get(tag.unitId) ?? 0));
    if (credit === tag.pointsCredited) continue;
    moved = true;
    await db
      .update(activityTag)
      .set({ pointsCredited: credit })
      .where(
        and(eq(activityTag.activityId, tag.activityId), eq(activityTag.unitId, tag.unitId)),
      );
  }
  return moved;
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
/**
 * `"1,3,5"` → `[1, 3, 5]`, the ISO weekdays a task is pinned to.
 * Empty means flexible — due some day this week, not this one.
 *
 * Parsed here rather than in `@glide/scoring` because the
 * comma-separated string is a storage format, not a scoring concept;
 * the engine takes numbers.
 */
function parsePinnedWeekdays(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
}

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
  /**
   * **Settled means finished, not touched** (ADR-0014 §2). A one-off
   * someone did a quarter of on Tuesday is still outstanding, and
   * testing for *any* completion would have taken it off the list on
   * Wednesday with no way to ever finish it — the exact case §2 is
   * written to support.
   */
  const priorFractions = await fractionsBefore(oneOffIds, date);
  const settledBefore = settledOf(priorFractions);
  /** Active commitments and their parts — a task homed in one is on
   *  the day in its own right (see `tasks` below). */
  const commitmentUnitIds = new Set(
    units.filter(isCommitmentUnit).map((u) => u.id),
  );
  const aheadUntil = addDays(date, AHEAD_DAYS);
  const [dayRow] = await db.select().from(dayGrade).where(eq(dayGrade.localDate, date));
  const kind: DayKind = dayRow?.kind ?? "normal";
  /** Life one-offs planned for a later day. Shown only on a rest day,
   *  and never in the load: they are not today's work. */
  const aheadLifeIds = new Set<string>();
  const allTasks = everyTask.filter((t) => {
    if (t.oneOffSize == null) return true;
    if (settledBefore.has(t.id)) return false;
    if (t.oneOffDate == null || t.oneOffDate <= date) return true;
    // **Commitment work in the week ahead is on the day too**, in
    // "Planned for other days" (`pinnedElsewhere`). Doing it early is
    // exactly the case ADR-0032 §4 now pays for — "you're super ahead
    // on work" — and it can only be paid if it can be ticked. Bounded to
    // a week, the same reach a pinned task's other days have there, so
    // a term of assignments entered up front does not fill today.
    // A life one-off waits for its day — except on a rest day, when
    // doing it early is the point (ADR-0037 §3). Whether today is one
    // is only known once the load is, so it is read here and hidden
    // below on any other day.
    if (t.oneOffDate > aheadUntil) return false;
    if (!commitmentUnitIds.has(t.unitId)) aheadLifeIds.add(t.id);
    return true;
  });
  const memberships = allTasks.length
    ? await db
        .select()
        .from(taskUnit)
        .where(inArray(taskUnit.taskId, allTasks.map((t) => t.id)))
    : [];
  const scoredTaskIds = new Set(
    memberships
      .filter((m) => m.membership === "scoring" && scoredUnitIds.has(m.unitId))
      .map((m) => m.taskId),
  );
  /**
   * Commitment units are not among the 18 and never "in scoring" the way
   * a life unit is — they are paid from their own band (ADR-0032). So a
   * task whose home is an active commitment or one of its parts is on
   * the day in its own right. Without this the checklist dropped every
   * commitment task, while the band went on pricing work nobody could
   * see or tick. An archived commitment's units are filtered out above,
   * which is what pauses its tasks.
   */
  const tasks = allTasks.filter(
    (t) => scoredTaskIds.has(t.id) || commitmentUnitIds.has(t.unitId),
  );

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

  /**
   * What commitment work is worth **today** (ADR-0032, formula v10).
   *
   * On a day with eligible commitment work the band is that share of
   * the whole day, divided among today's commitment tasks
   * (`commitmentPointValues`); the life share — planned, unplanned and
   * extra runs alike — is scaled into what it leaves (`lifeShare`). On
   * every other day there is no band and the day is main's two-band
   * day exactly.
   */
  const commitmentDay = await loadCommitmentDay(date);
  const share = lifeShare(commitmentDay);
  const commitmentTasks = tasks.filter((t) => commitmentUnitIds.has(t.unitId));
  const bandValues = commitmentDay
    ? commitmentPointValues(commitmentDay, commitmentTasks)
    : new Map<string, number>();
  /** Which of today's rows the commitment band pays for (ADR-0032 §3). */
  const commitmentTaskIds = new Set(commitmentDay?.eligibleTaskIds ?? []);

  /**
   * Recurring commitment sessions **already done early** — the session
   * due today, done on an earlier off-schedule day (ADR-0032 §4, amended
   * 2026-10-01). It is done: it left today's band (`loadCommitmentDay`),
   * it pays nothing today, and it reads as finished rather than as one
   * more thing to tick.
   */
  const recurringCommitment = commitmentTasks.filter((t) => t.oneOffSize == null);
  const sessionDates = await completionDatesAround(
    recurringCommitment.map((t) => t.id),
    date,
  );
  const doneAhead = new Map<string, string>();
  for (const t of recurringCommitment) {
    const early = doneAheadOn(t, date, sessionDates.get(t.id) ?? []);
    if (early !== null) doneAhead.set(t.id, early);
  }

  /**
   * Commitment work on the day but **not scheduled for it** — ahead of
   * its day, or in place of something else — and what it is worth
   * (ADR-0032 §4, amended 2026-09-30).
   *
   * Priced at the session it stands in for, and paid in full outside
   * every band — beside extra runs, not in the unplanned pool.
   *
   * Decided by the schedule, not by whether a band happens to be set:
   * a one-off planned for later, or a recurring task on one of its
   * off days.
   */
  const offSchedule = commitmentTasks.filter(
    (t) =>
      !doneAhead.has(t.id) &&
      (t.oneOffSize != null
        ? scheduledDateFor(t, date) !== null
        : !isDueOn(t, date)),
  );
  const offScheduleValue = await scheduledDayValues(offSchedule, date, sessionDates);
  const offScheduleIds = new Set(offSchedule.map((t) => t.id));

  /** A commitment task's worth today, in points of the whole day. */
  const commitmentValue = (id: string) =>
    doneAhead.has(id)
      ? 0
      : offScheduleIds.has(id)
        ? (offScheduleValue.get(id) ?? 0)
        : (bandValues.get(id) ?? 0);

  /**
   * How much of each task is already done, and how much today's own
   * completion was for.
   *
   * **Scope is the difference between the two kinds of task.** A
   * one-off accumulates toward 1.0 across days — that is ADR-0014 §2's
   * "finishing on a later day pays only what is left". A recurring task
   * starts again every day: its Tuesday is not a continuation of its
   * Monday, and summing across days would have made its second
   * completion pay nothing at all.
   */
  const oneOffIdSet = new Set(oneOffIds);
  const progressByTask = new Map<string, number>();
  const fractionToday = new Map<string, number>();
  for (const t of tasks) {
    const todays = completions.find((c) => c.taskId === t.id && c.localDate === date);
    if (todays) fractionToday.set(t.id, todays.fraction);
    progressByTask.set(
      t.id,
      oneOffIdSet.has(t.id)
        ? progressOf([
            ...(priorFractions.get(t.id) ?? []),
            ...(todays ? [todays.fraction] : []),
          ])
        : progressOf(todays ? [todays.fraction] : []),
    );
  }
  /**
   * What today's completion of a task pays at `value`: the whole value,
   * or — for a part — the rounded running total minus what earlier
   * parts already paid (ADR-0014 §3). Live, so it follows the band.
   */
  const paidToday = (id: string, value: number): number => {
    const f = fractionToday.get(id);
    if (f === undefined) return 0;
    const prior = oneOffIdSet.has(id) ? (priorFractions.get(id) ?? []) : [];
    return f === 1 && prior.length === 0 ? value : partialPoints(value, prior, f);
  };

  /**
   * What the scoring engine needs to know about each life task
   * (ADR-0029 §1): one run's weight, how often it is owed, and which
   * weekdays it is pinned to. `point_value` is a weight since formula
   * v9 — a share of the portfolio's 100 — not a number of points.
   *
   * **Commitment tasks are not in the load.** They are priced by the
   * band, and a weight here as well would pay them twice (ADR-0035 §3).
   * They still get a status — band, counts — from the same derivation,
   * at no weight.
   */
  const toLoadTask = (t: (typeof tasks)[number]): LoadTask => ({
    taskId: t.id,
    weight: commitmentUnitIds.has(t.unitId) ? 0 : t.pointValue,
    timesPerWeek: t.timesPerWeek,
    pinnedWeekdays: parsePinnedWeekdays(t.plannedWeekdays),
    fortnightOffset: t.fortnightOffset,
    oneOff: t.oneOffSize != null,
  });
  const lifeTaskIds = new Set(
    tasks
      .filter((t) => !commitmentUnitIds.has(t.unitId) && !aheadLifeIds.has(t.id))
      .map((t) => t.id),
  );
  const aheadLifeTasks = tasks.filter((t) => aheadLifeIds.has(t.id));
  const loadTasks = tasks.filter((t) => lifeTaskIds.has(t.id)).map(toLoadTask);
  // A part-done run counts its fraction of the weight (ADR-0014).
  const loadCompletions = completions.map((c) => ({
    taskId: c.taskId,
    localDate: c.localDate,
    fraction: c.fraction,
  }));
  const lifeCompletions = loadCompletions.filter((c) => lifeTaskIds.has(c.taskId));
  const statuses = [
    ...deriveChecklist(loadTasks, lifeCompletions, date, share),
    ...deriveChecklist(
      [...commitmentTasks, ...aheadLifeTasks].map(toLoadTask),
      loadCompletions.filter((c) => !lifeTaskIds.has(c.taskId)),
      date,
    ),
  ];

  /**
   * Runs done off their planned day — pinned to another day this week —
   * and the day each was planned for (`plannedDateFor`). Paid what that
   * day would have paid, on any day, outside the bands (ADR-0037 §3 as
   * extended 2026-10-01: *"make busy days pay early work its planned
   * value too"*). So today's own load must not count them as well.
   */
  const offDayPlanned = new Map<string, string>();
  for (const lt of loadTasks) {
    if (lt.oneOff) continue;
    if (statuses.find((st) => st.taskId === lt.taskId)?.extraToday) continue;
    const d = plannedDateFor(lt, date);
    if (d !== null) offDayPlanned.set(lt.taskId, d);
  }
  const load = computeDayLoad(
    loadTasks,
    lifeCompletions.filter((c) => !(c.localDate === date && offDayPlanned.has(c.taskId))),
    date,
  );

  /**
   * A rest day (ADR-0037), decided rather than chosen. A day off stays a
   * day off. The day is a candidate when it asks nothing and there is a
   * plan; it *is* one when nothing is open later this week, or once
   * something open is done early today.
   */
  const averageExpected = averageDayExpected(loadTasks);
  const band = commitmentBandOn(commitmentDay);
  const hasPlan =
    averageExpected > 0 || commitmentTasks.some((t) => t.oneOffSize == null);
  const nothingDue = kind !== "rest" && load.expected <= 0 && band <= 0 && hasPlan;
  const weekEnd = addDays(weekStart(date), 6);
  const lifeCompletionsBefore = lifeCompletions.filter((c) => c.localDate < date);

  /**
   * Life work that can be done early, and the day it was planned for:
   * a run still owed this week but pinned to a later day, and a life
   * one-off planned for later. Each is worth **what its planned day
   * would have paid** (Henry: *"early tasks count as much as they would
   * if they were done on the day they were planned"*), priced with that
   * day's life share if it carries a commitment band.
   */
  const plannedDateOf = new Map(offDayPlanned);
  if (nothingDue) {
    for (const t of aheadLifeTasks) {
      if (t.oneOffDate) plannedDateOf.set(t.id, t.oneOffDate);
    }
  }
  const shareOn = new Map<string, number>();
  for (const d of new Set(plannedDateOf.values())) {
    shareOn.set(d, lifeShare(await loadCommitmentDay(d)));
  }
  const allLife = [...loadTasks, ...aheadLifeTasks.map(toLoadTask)];
  const earlyValue = new Map<string, number>();
  for (const [id, d] of plannedDateOf) {
    const lt = allLife.find((x) => x.taskId === id);
    if (!lt) continue;
    earlyValue.set(
      id,
      plannedDayRunPoints(loadTasks, lifeCompletionsBefore, lt, d, shareOn.get(d) ?? 1),
    );
  }

  /** Anything still owed later this week, measured from before today. */
  const datesBefore = (id: string) =>
    (sessionDates.get(id) ?? []).filter((d) => d !== date);
  const openThisWeek =
    [...plannedDateOf.values()].some((d) => d <= weekEnd) ||
    commitmentTasks.some((t) => {
      if (t.oneOffSize != null) {
        return t.oneOffDate != null && t.oneOffDate > date && t.oneOffDate <= weekEnd;
      }
      for (let d = addDays(date, 1); d <= weekEnd; d = addDays(d, 1)) {
        if (isDueOn(t, d) && doneAheadOn(t, d, datesBefore(t.id)) === null) return true;
      }
      return false;
    });
  const earlyToday =
    [...earlyValue.keys()].some((id) => fractionToday.has(id)) ||
    offSchedule.some((t) => fractionToday.has(t.id));
  const restDay =
    kind !== "rest" && isRestDay(load, band, { hasPlan, openThisWeek, earlyToday });
  /** Early life work done today, at its planned day's worth. */
  const earlyCredit = [...earlyValue].reduce(
    (a, [id, v]) => a + paidToday(id, v),
    0,
  );

  /** The band's spend today, and the off-schedule work beside it. */
  const commitmentEarned = commitmentTasks
    .filter((t) => commitmentTaskIds.has(t.id) && !offScheduleIds.has(t.id))
    .reduce((a, t) => a + paidToday(t.id, commitmentValue(t.id)), 0);
  const offScheduleCredit = offSchedule.reduce(
    (a, t) => a + paidToday(t.id, commitmentValue(t.id)),
    0,
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
   *
   * **Every completion row counts, whatever its fraction** — decided,
   * not incidental (ADR-0014 §4, 2026-09-30). A quarter done is a day
   * you showed up, and Henry's call is that showing up is what a run is
   * for: *"progress isn't linear and some days showing up is what
   * counts."* Do not filter this to whole completions.
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
    const status = statusById.get(t.id)!;
    /**
     * **Commitment work is scheduled, not counted** (Henry, 2026-09-30:
     * "the weekly count isn't really necessary for commitment tasks").
     * So it never graduates to "Done this week" and never pays the
     * extra-run rate for beating a count it does not have: it is worth
     * its scheduled value on its day and the same value, uncapped, on
     * any other.
     */
    const s = commitmentUnitIds.has(t.unitId)
      ? {
          ...status,
          band: status.band === "doneThisWeek" ? ("week" as const) : status.band,
          extraToday: false,
          pointsIfCompletedNow: commitmentValue(t.id),
        }
      : status;
    /**
     * A run's worth **today**, in points (ADR-0029 §4: "the checklist
     * shows the live number"). A life task's is its weight against the
     * day's load, in the life share; a commitment task's is its band
     * value. `point_value` itself is a weight and is never shown.
     */
    const early = earlyValue.get(t.id);
    const value = commitmentUnitIds.has(t.unitId)
      ? commitmentValue(t.id)
      : early !== undefined
        ? Math.round(early)
        : nothingDue
          ? Math.round(restDayRunPoints(t.pointValue, averageExpected))
          : load.expected > 0
            ? Math.round((share * PLANNED_BAND * t.pointValue) / load.expected)
            : 0;
    // A run off its planned day pays that day's worth, on any day; on a
    // day that asks nothing, a run beyond the week's count pays the
    // extra-run rate on an average day (ADR-0037 §3).
    const sRest =
      early !== undefined
        ? { ...s, pointsIfCompletedNow: value }
        : nothingDue && !commitmentUnitIds.has(t.unitId)
          ? {
              ...s,
              pointsIfCompletedNow: s.extraToday
                ? Math.round(EXTRA_RUN_RATE * restDayRunPoints(t.pointValue, averageExpected))
                : value,
            }
          : s;
    return {
      id: t.id,
      title: t.title,
      unitId: t.unitId,
      areaId: unitById.get(t.unitId)?.areaId ?? "",
      pointValue: value,
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
      band: sRest.band,
      completedToday: sRest.completedToday,
      doneCount: sRest.doneCount,
      goalCount: sRest.goalCount,
      extraToday: sRest.extraToday,
      pointsIfCompletedNow: sRest.pointsIfCompletedNow,
      tagUnitIds: tagsByTask.get(t.id) ?? [],
      streak: streakByTask.get(t.id) ?? null,
      allowsPartial: t.allowsPartial,
      commitment: commitmentUnitIds.has(t.unitId),
      offSchedule: offScheduleIds.has(t.id),
      doneAheadOn: doneAhead.get(t.id) ?? null,
      oneOffDate: t.oneOffDate,
      progress: progressByTask.get(t.id) ?? 0,
      earnedToday:
        (fractionToday.get(t.id) ?? 1) < 1 ? paidToday(t.id, value) : null,
      fractionToday: fractionToday.get(t.id) ?? null,
      startMinute: t.startMinute,
      endMinute: t.endMinute,
      size: t.size,
    };
  });


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

  // Extra-run credit is no longer summed from stored `points_earned`:
  // `computeDayLoad` already separates today's within-goal weight from
  // the weight done beyond it, and prices both against the same day
  // (ADR-0029 §1). The stored number remains the log's record of what a
  // completion was worth on the day it happened.
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
          load,
          // The band is that share of the whole day; everything else is
          // scaled into what it leaves (ADR-0032, formula v10).
          commitment: { band: commitmentBandOn(commitmentDay), earned: commitmentEarned },
          offScheduleCredit,
          activities: activityCredits,
          earlyCredit,
          restDay: { averageExpected, hasPlan, openThisWeek, earlyToday },
        });

  // Life one-offs planned for later can be done early on any day that
  // asks nothing — doing one is what can make it a rest day.
  const shown = todayTasks.filter((t) => nothingDue || !aheadLifeIds.has(t.id));

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
    restDay,
    nothingDue,
    hasTasks: tasks.length > 0,
    // Life one-offs planned for later are only listed on a day that
    // asks nothing.
    due: shown.filter((t) => t.band === "due"),
    week: shown.filter((t) => t.band === "week"),
    doneThisWeek: shown.filter((t) => t.band === "doneThisWeek"),
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
export async function toggleCompletion(
  taskId: string,
  date: string,
): Promise<void> {
  assertEditable(date);
  const cleared = await clearCompletion(taskId, date);
  if (!cleared) await writeCompletion(taskId, date, 1);
  await cacheDayScore(date);
  await recacheCoveredSessions(taskId, date);
}

/**
 * Record how much of a task was done today (ADR-0014 §4's picker).
 *
 * **Replaces the day's fraction rather than adding to it.** Within one
 * day there is one completion row per task, so picking a half after a
 * quarter means "actually, a half" — not "a quarter and then a half".
 * Across days a one-off still accumulates, which is what `settledFor`
 * scopes and what §2's "finishing on a later day" relies on.
 */
export async function setCompletionFraction(
  taskId: string,
  date: string,
  fraction: number,
): Promise<void> {
  assertEditable(date);
  await clearCompletion(taskId, date);
  await writeCompletion(taskId, date, fraction);
  await cacheDayScore(date);
  await recacheCoveredSessions(taskId, date);
}

/**
 * Re-score the days whose session an off-schedule tick on `date` may
 * have taken or given back (ADR-0032 §4, amended 2026-10-01).
 *
 * Ticking Tuesday takes Wednesday's session out of Wednesday's band;
 * unticking it puts it back. If Wednesday has already been scored, its
 * stored grade would otherwise describe a band it no longer has. Only
 * days already holding a grade are touched — a day never opened is
 * computed when it is — and only up to today, since no later day has a
 * grade to correct.
 */
async function recacheCoveredSessions(taskId: string, date: string): Promise<void> {
  const [row] = await db.select().from(task).where(eq(task.id, taskId));
  if (!row || row.oneOffSize != null || isDueOn(row, date)) return;
  const [home] = await db.select().from(lifeUnit).where(eq(lifeUnit.id, row.unitId));
  if (!home || !isCommitmentUnit(home)) return;

  const today = currentLocalDate();
  for (let i = 1; i <= COVERAGE_LOOKBACK_DAYS; i++) {
    const day = addDays(date, i);
    if (day > today) break;
    if (!isDueOn(row, day)) continue;
    const [graded] = await db
      .select({ localDate: dayGrade.localDate })
      .from(dayGrade)
      .where(eq(dayGrade.localDate, day));
    if (graded) await cacheDayScore(day);
  }
}

/** Removes the day's completion if there is one. Returns whether there was. */
async function clearCompletion(taskId: string, date: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(taskCompletion)
    .where(and(eq(taskCompletion.taskId, taskId), eq(taskCompletion.localDate, date)));
  if (existing.length === 0) return false;
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
  return true;
}

/** Writes one completion for `date`, priced per ADR-0014 §3. */
async function writeCompletion(
  taskId: string,
  date: string,
  fraction: number,
): Promise<void> {
  const day = await loadDay(date);
  const status = [...day.due, ...day.week, ...day.doneThisWeek].find(
    (t) => t.id === taskId,
  );
  if (!status) return;
  // What a partial completion pays: the rounded running total minus
  // what earlier fractions already paid (ADR-0014 §3). Never more
  // than the task is worth, however it is split up.
  const applied = status.allowsPartial ? normalizeFraction(fraction) : 1;
  const settled = await settledFor(taskId, date, status.oneOffSize != null);
  const points =
    applied === 1 && settled.length === 0
      ? status.pointsIfCompletedNow
      : partialPoints(status.pointsIfCompletedNow, settled, applied);

  await db.insert(taskCompletion).values({
    id: Crypto.randomUUID(),
    taskId,
    localDate: date,
    completedAt: new Date().toISOString(),
    pointsEarned: points,
    fraction: applied,
  });
  // ADR-0015 §2. A goal that nominated this task gets a visible,
  // deletable progress row — the completion scores, the row does not
  // (§7 keeps the two meanings apart).
  await autocountForTask(taskId, date);
}

/**
 * Fractions already settled against a task, before `date`.
 *
 * Progress is their **sum** (ADR-0014 §2) — there is deliberately no
 * stored progress on `task`, so nothing can disagree with the
 * completion history.
 *
 * **Only a one-off accumulates across days.** A recurring task's
 * Tuesday is a fresh instance, not a continuation of its Monday:
 * summing every day's fraction would have made its second completion
 * pay `round(1×v) − round(1×v)` — nothing at all — for the rest of the
 * task's life.
 */
async function settledFor(
  taskId: string,
  date: string,
  oneOff: boolean,
): Promise<number[]> {
  if (!oneOff) return [];
  const rows = await db
    .select({ fraction: taskCompletion.fraction })
    .from(taskCompletion)
    .where(and(eq(taskCompletion.taskId, taskId), lt(taskCompletion.localDate, date)));
  return rows.map((r) => r.fraction);
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
  let day = await loadDay(date, { recompute: true });
  if (await recreditActivities(date, day.restDay)) {
    day = await loadDay(date, { recompute: true });
  }
  const plan: PlanSnapshotTask[] = [...day.due, ...day.week, ...day.doneThisWeek].map(
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

/**
 * How far ahead a day can be planned: the next four weeks.
 *
 * **Not the edit window.** `editWindowDays` reaches backward — last
 * week plus this one — because that is the range a person might still
 * be correcting. Planning reaches the other way, and until now it
 * borrowed that window and so could not see past Saturday. The two
 * horizons have nothing to do with each other and now say so.
 *
 * Four weeks rather than open-ended, because a placement further out
 * than the monthly checkpoint is stale before it arrives: the
 * diagnostic re-ranks, point values move, and an arrangement made
 * against a plan that no longer exists is worse than no arrangement.
 * The bound is the product's own rhythm, not a round number.
 *
 * Starts **tomorrow**. Today is not planned, it is lived; the Home
 * screen already arranges it.
 */
export function planningDays(today: string): string[] {
  return Array.from({ length: 28 }, (_, i) => addDays(today, i + 1));
}

/** Whether `date` is a day the planner will open. */
export function isPlannable(date: string, today: string): boolean {
  return date > today && date <= addDays(today, 28);
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
