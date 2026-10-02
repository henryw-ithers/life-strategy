/**
 * The day, assembled (ADR-0004, ADR-0029): what is on it, what each
 * row is worth today, and its score. A read path — `loadDay` feeds the
 * pure engine in @glide/scoring rows from the database and returns what
 * the day screens render. Writes live beside it: completions.ts,
 * activities.ts, journal.ts, photos.ts, placements.ts, and the stored
 * grade in dayGrades.ts.
 */
import {
  addDays,
  averageDayExpected,
  commitmentBandOn,
  commitmentPointValues,
  computeDayLoad,
  computeDayScore,
  computeStreak,
  deriveChecklist,
  editWindowStart,
  EXTRA_RUN_RATE,
  fortnightStart,
  isDueOn,
  isEditable,
  isFinalized,
  isRestDay,
  lifeShare,
  parseWeekdays,
  partialPoints,
  PLANNED_BAND,
  plannedDateFor,
  plannedDayRunPoints,
  progressOf,
  restDayRunPoints,
  storedDayScore,
  weekStart,
  type ActivityCredit,
  type CommitmentDay,
  type DayScore,
  type LoadTask,
  type TaskBand,
} from "@glide/scoring";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
} from "drizzle-orm";

import { currentLocalDate } from "../lib/calendar";
import { type ActivitySize } from "./activityCredit";
import { db } from "./client";
import { loadCommitmentDay } from "./commitments";
import {
  doneAheadOn,
  isCommitmentUnit,
  scheduledDateFor,
  sessionFor,
} from "./commitmentPlan";
import { fractionsBefore, settledOf } from "./oneOffProgress";
import { resolvePhotoUri } from "./photos";
import { loadPlacements } from "./placements";
import {
  activity,
  activityTag,
  dayGrade,
  journalEntry,
  lifeUnit,
  photo,
  task,
  taskCompletion,
  taskCompletionTag,
  taskUnit,
} from "./schema";
import { completionDatesAround } from "./sessionCoverage";
import { latestWeights } from "./tasks";

export type DayKind = "normal" | "rest" | "special";

export interface TodayTask {
  id: string;
  title: string;
  unitId: string;
  areaId: string;
  pointValue: number;
  timesPerWeek: number;
  /** ADR-0024. Since formula v9 these decide which days a task is due
   *  on, so they reach the day's load (ADR-0029 §1). */
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
   * The day this task is planned for when that is not today — a later
   * pinned day, a one-off's date, a commitment's next session — or null.
   * Orders "Planned for other days" soonest first.
   */
  plannedOn: string | null;
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
  /** `event` for a time you attend (ADR-0038); otherwise `task`. */
  kind: "task" | "event";
  /** Where an event happens; null otherwise. */
  location: string | null;
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
  /**
   * Open one-offs planned for later that this load left out — listed
   * only once "Planned for other days" is opened (`loadPlannedAhead`).
   * Zero when loaded with `includeAhead`.
   */
  aheadCount: number;
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
  {
    recompute = false,
    includeAhead = false,
  }: {
    recompute?: boolean;
    /**
     * List every open one-off planned for a later day, priced. Off by
     * default: "Planned for other days" opens collapsed and asks for
     * them only when opened (`loadPlannedAhead`), since each later date
     * has to be priced and a term of assignments is a lot of dates.
     * The day's score never needs them — only the ones already done
     * today, which are always loaded.
     */
    includeAhead?: boolean;
  } = {},
): Promise<DayData> {
  const today = currentLocalDate();
  await finalizePastDays(today);

  const weights = await latestWeights(db);

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
  const [dayRow] = await db.select().from(dayGrade).where(eq(dayGrade.localDate, date));
  const kind: DayKind = dayRow?.kind ?? "normal";
  /** Life one-offs planned for a later day, when listed. Never in the
   *  load: they are not today's work. */
  const aheadLifeIds = new Set<string>();
  const futureIds = everyTask
    .filter(
      (t) =>
        t.oneOffSize != null &&
        !settledBefore.has(t.id) &&
        t.oneOffDate != null &&
        t.oneOffDate > date,
    )
    .map((t) => t.id);
  /** Future one-offs already done today: always loaded, since the
   *  score pays them and Completed shows them. */
  const futureDoneToday = new Set(
    futureIds.length
      ? (
          await db
            .select({ taskId: taskCompletion.taskId })
            .from(taskCompletion)
            .where(
              and(eq(taskCompletion.localDate, date), inArray(taskCompletion.taskId, futureIds)),
            )
        ).map((r) => r.taskId)
      : [],
  );
  /** Future one-offs left out until "Planned for other days" is opened. */
  const deferred: (typeof everyTask)[number][] = [];
  const allTasks = everyTask.filter((t) => {
    if (t.oneOffSize == null) return true;
    if (settledBefore.has(t.id)) return false;
    if (t.oneOffDate == null || t.oneOffDate <= date) return true;
    // **Every open task is on the day before its date**, at the bottom,
    // in "Planned for other days" (`pinnedElsewhere`) — Henry: *"you
    // should always be able to view and complete any open task before
    // the planned date however it should appear at the bottom of the
    // list."* Done early it pays what its planned day would have paid
    // (ADR-0032 §4, ADR-0037 §3). A life one-off is kept out of the
    // load: it is not today's work.
    if (!includeAhead && !futureDoneToday.has(t.id)) {
      deferred.push(t);
      return false;
    }
    if (!commitmentUnitIds.has(t.unitId)) aheadLifeIds.add(t.id);
    return true;
  });
  /** Deferred one-offs that would be on the day: homed in a commitment
   *  or a unit still in scoring. Counted, not priced. */
  const deferredListed = deferred.filter(
    (t) => commitmentUnitIds.has(t.unitId) || scoredUnitIds.has(t.unitId),
  );
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
    pinnedWeekdays: parseWeekdays(t.plannedWeekdays),
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
  for (const t of aheadLifeTasks) {
    if (t.oneOffDate) plannedDateOf.set(t.id, t.oneOffDate);
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
    // Later only: a pinned day already past lapses (ADR-0024 §2).
    [...plannedDateOf.values()].some((d) => d > date && d <= weekEnd) ||
    deferredListed.some((t) => t.oneOffDate != null && t.oneOffDate <= weekEnd) ||
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
      plannedOn:
        plannedDateOf.get(t.id) ??
        (commitmentUnitIds.has(t.unitId) && !isDueOn(t, date)
          ? scheduledDateFor(t, date)
          : null),
      progress: progressByTask.get(t.id) ?? 0,
      earnedToday:
        (fractionToday.get(t.id) ?? 1) < 1 ? paidToday(t.id, value) : null,
      fractionToday: fractionToday.get(t.id) ?? null,
      startMinute: t.startMinute,
      endMinute: t.endMinute,
      size: t.size,
      kind: t.kind,
      location: t.location,
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
  // written under — see `db/photos.ts`.
  const photos = await Promise.all(
    photoRows.map(async (p) => ({ ...p, uri: await resolvePhotoUri(p.fileUri) })),
  );

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
    aheadCount: deferredListed.length,
    hasTasks: tasks.length > 0,
    due: todayTasks.filter((t) => t.band === "due"),
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

/**
 * Every open one-off planned for a later day, priced at what its
 * planned day would pay — what "Planned for other days" lists once it
 * is opened (ADR-0037 §3). Loaded on request, not with the day: each
 * later date has to be priced, and the day's own score never needs the
 * ones not yet done.
 */
export async function loadPlannedAhead(date: string): Promise<TodayTask[]> {
  const day = await loadDay(date, { includeAhead: true });
  return [...day.due, ...day.week, ...day.doneThisWeek].filter(
    (t) => t.oneOffDate != null && t.oneOffDate > date && !t.completedToday,
  );
}

/** The local date `finalizePastDays` last ran for — its work only
 *  changes when the date rolls over, and `loadDay` calls it every time. */
let finalizedFor: string | null = null;

/** Stamp finalized_at on day rows that have left the edit window. */
async function finalizePastDays(today: string): Promise<void> {
  if (finalizedFor === today) return;
  await db
    .update(dayGrade)
    .set({ finalizedAt: new Date().toISOString() })
    .where(
      and(
        lt(dayGrade.localDate, editWindowStart(today)),
        isNull(dayGrade.finalizedAt),
      ),
    );
  finalizedFor = today;
}
