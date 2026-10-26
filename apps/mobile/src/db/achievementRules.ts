/**
 * What each achievement series stands at (ADR-0047 §3), from the facts
 * the app already records. Pure, so it is tested off the device; the
 * reads and the awarding are `achievements.ts`.
 *
 * Each value carries two numbers:
 *
 * - **earned** is what ranks are awarded from: a count's total, or a
 *   run's longest. It reads only what has finished (§6): grades and
 *   every-day streaks up to yesterday, plan weeks up to last Saturday.
 * - **current** is what progress shows: the same total, or the run
 *   going now. When a run ends it starts again from nothing, and
 *   nothing here says so (§5).
 *
 * **Never a grade.** Nothing here reaches a `DayScore`, and nothing is
 * derived from an event that wasn't ticked (ADR-0038 §5): events count
 * only toward hours and attended, never toward a weekly target.
 */
import {
  addDays,
  everyDayRun,
  RANKS,
  gradeRuns,
  inScheduleOn,
  isoWeekday,
  localDateOf,
  parseWeekdays,
  storedDayScore,
  tickMinutes,
  weekRuns,
  weekStart,
  weeklyGoalFor,
  type GradedDay,
  type LoadTask,
  type PlanWeek,
  type Rank,
  type SeriesId,
  type Subject,
} from "@glide/scoring";

import { awayDatesBetween, commitmentRoots } from "./windowRules";

export interface AchievementFacts {
  today: string;
  areas: readonly { id: string; name: string }[];
  units: readonly {
    id: string;
    name: string;
    areaId: string;
    parentUnitId: string | null;
    isCustom: boolean;
    commitmentShare: number | null;
    archivedAt: string | null;
  }[];
  /** Live tasks only: an archived task's ranks stay earned, but it
   *  isn't counted on. */
  tasks: readonly {
    id: string;
    unitId: string;
    title: string;
    kind: "task" | "event";
    timesPerWeek: number;
    plannedWeekdays: string | null;
    fortnightOffset: number;
    oneOffSize: string | null;
    size: "quick" | "normal" | "big" | null;
    startMinute: number | null;
    endMinute: number | null;
    repeatFrom: string | null;
    repeatUntil: string | null;
    createdAt: string;
  }[];
  completions: readonly {
    taskId: string;
    localDate: string;
    fraction: number;
    actualMinutes: number | null;
    /** The local hour it was ticked, 0–23, for early bird and night
     *  owl; null when it was ticked on another day (backfilled), whose
     *  hour says nothing about when the work happened. */
    hour: number | null;
  }[];
  grades: readonly {
    localDate: string;
    kind: "normal" | "rest" | "special";
    pointsEarned: number;
    pointsPossible: number;
    flagged: boolean;
    /** An automatic rest day (ADR-0037), which scores 70 for asking
     *  nothing. Optional: false when left out. */
    restDay?: boolean;
  }[];
  activities: readonly { localDate: string; flagged: boolean }[];
  /** The days notes were written on, one per note. */
  journal: readonly string[];
  photos: number;
  away: readonly { startDate: string; endDate: string }[];
  /** Each task's skipped dates (`skippedDatesFor`). */
  skipped: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface SeriesValue {
  series: SeriesId;
  subjectKind: Subject;
  /** The task, unit, area or commitment id, or `all`. */
  subjectId: string;
  /** Its name now; empty for `all`. */
  subjectName: string;
  /** Where it's listed: a task under its unit or commitment, a unit
   *  and an area under the area, a commitment under itself. */
  groupId: string;
  /** What ranks are earned from: a total, or a run's longest. */
  earned: number;
  /** What progress shows: a total, or the run going now. */
  current: number;
}

/** The subject id of the whole-app series. */
export const ALL = "all";

const GOOD_DAY = 80;
const GREAT_DAY = 90;
const STEADY_DAY = 70;
const FULL_DAY = 100;
/** Before 8 am, from 9 pm. */
const EARLY_HOUR = 8;
const LATE_HOUR = 21;

const countBy = <T>(rows: readonly T[], key: (row: T) => string | null): Map<string, number> => {
  const out = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (k !== null) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
};

/** A task's first day: when it was made, or its own first day if
 *  that's later. */
function firstDay(t: AchievementFacts["tasks"][number]): string {
  const made = localDateOf(new Date(t.createdAt));
  return t.repeatFrom !== null && t.repeatFrom > made ? t.repeatFrom : made;
}

const isRecurringTask = (t: AchievementFacts["tasks"][number]) => t.kind === "task" && t.oneOffSize === null;

/**
 * Every series' value for every subject it's earned for. A subject
 * with nothing yet is still listed, at zero, so the screen can show
 * what's ahead (§5).
 */
export function seriesValues(f: AchievementFacts): SeriesValue[] {
  const out: SeriesValue[] = [];
  const roots = commitmentRoots(f.units);
  const areaOfUnit = new Map(f.units.map((u) => [u.id, u.areaId]));
  const taskHome = new Map(f.tasks.map((t) => [t.id, roots.get(t.unitId) ?? t.unitId]));
  const groupOf = (kind: Subject, id: string): string =>
    kind === "task" ? taskHome.get(id) ?? id : kind === "unit" ? areaOfUnit.get(id) ?? id : id;
  const push = (
    series: SeriesId,
    subjectKind: Subject,
    subjectId: string,
    subjectName: string,
    earned: number,
    current = earned,
  ) =>
    out.push({ series, subjectKind, subjectId, subjectName, groupId: groupOf(subjectKind, subjectId), earned, current });

  const liveUnits = f.units.filter((u) => u.archivedAt === null);
  const lifeUnits = liveUnits.filter((u) => (roots.get(u.id) ?? null) === null);
  const commitments = liveUnits.filter((u) => roots.get(u.id) === u.id);
  const unitOf = new Map(f.units.map((u) => [u.id, u]));
  const taskById = new Map(f.tasks.map((t) => [t.id, t]));
  const ticks = f.completions.filter((c) => taskById.has(c.taskId));
  const awayAll = awayDatesBetween(f.away, "0000-01-01", f.today);

  // ── Counts: ticks, hours, attended ────────────────────────────────
  const ticksByTask = countBy(ticks, (c) => c.taskId);
  for (const t of f.tasks) {
    if (isRecurringTask(t)) push("taskCompletions", "task", t.id, t.title, ticksByTask.get(t.id) ?? 0);
  }

  const lifeTicks = ticks.filter((c) => {
    const t = taskById.get(c.taskId)!;
    return t.kind === "task" && (roots.get(t.unitId) ?? null) === null;
  });
  const ticksByUnit = countBy(lifeTicks, (c) => taskById.get(c.taskId)!.unitId);
  const ticksByArea = countBy(lifeTicks, (c) => unitOf.get(taskById.get(c.taskId)!.unitId)?.areaId ?? null);
  for (const u of lifeUnits) push("unitCompletions", "unit", u.id, u.name, ticksByUnit.get(u.id) ?? 0);
  const liveAreas = new Set(lifeUnits.map((u) => u.areaId));
  for (const a of f.areas) {
    if (liveAreas.has(a.id)) push("areaCompletions", "area", a.id, a.name, ticksByArea.get(a.id) ?? 0);
  }

  const minutesByUnit = new Map<string, number>();
  const minutesByRoot = new Map<string, number>();
  for (const c of ticks) {
    const t = taskById.get(c.taskId)!;
    const minutes = tickMinutes({
      size: t.size,
      durationMinutes: t.kind === "event" && t.startMinute !== null && t.endMinute !== null ? t.endMinute - t.startMinute : null,
      tookMinutes: c.actualMinutes,
      fraction: c.fraction,
    });
    const root = roots.get(t.unitId) ?? null;
    if (root === null) minutesByUnit.set(t.unitId, (minutesByUnit.get(t.unitId) ?? 0) + minutes);
    else minutesByRoot.set(root, (minutesByRoot.get(root) ?? 0) + minutes);
  }
  const hours = (minutes: number | undefined) => Math.floor((minutes ?? 0) / 60);
  for (const u of lifeUnits) push("unitHours", "unit", u.id, u.name, hours(minutesByUnit.get(u.id)));
  for (const u of commitments) push("commitmentHours", "commitment", u.id, u.name, hours(minutesByRoot.get(u.id)));

  const attendedByRoot = countBy(ticks, (c) => {
    const t = taskById.get(c.taskId)!;
    return t.kind === "event" ? roots.get(t.unitId) ?? null : null;
  });
  for (const u of commitments) push("attended", "commitment", u.id, u.name, attendedByRoot.get(u.id) ?? 0);

  // ── Every-day streaks (ADR-0004 §5's rules) ───────────────────────
  // Days off, Away days and days the task wasn't due bridge a run; a
  // cleared day doesn't. Ranks read the run up to yesterday (§6).
  const restDays = f.grades.filter((g) => g.kind === "rest").map((g) => g.localDate);
  const doneByTask = new Map<string, string[]>();
  for (const c of ticks) doneByTask.set(c.taskId, [...(doneByTask.get(c.taskId) ?? []), c.localDate]);
  for (const t of f.tasks) {
    if (!isRecurringTask(t) || t.timesPerWeek !== 7) continue;
    const done = doneByTask.get(t.id) ?? [];
    const bounds = { repeatFrom: firstDay(t), repeatUntil: t.repeatUntil, skippedDates: f.skipped.get(t.id) };
    const earliest = done.reduce((a, d) => (d < a ? d : a), f.today);
    const doneSet = new Set(done);
    // A day it wasn't due bridges the run, unless it was done anyway.
    const notDue: string[] = [];
    for (let d = earliest; d <= f.today; d = addDays(d, 1)) {
      if (!inScheduleOn(bounds, d) && !doneSet.has(d)) notDue.push(d);
    }
    const daysOff = [...restDays, ...awayAll, ...notDue];
    const finished = everyDayRun(
      done.filter((d) => d < f.today),
      daysOff,
      f.today,
    );
    const now = everyDayRun(done, daysOff, f.today);
    push("everyDayStreak", "task", t.id, t.title, finished.longest, now.current);
  }

  // ── Plan weeks (§4): weeks ended, a target met by the week's end ──
  const lastWeek = addDays(weekStart(f.today), -7);
  const weeksByTask = new Map<string, Map<string, PlanWeek>>();
  for (const t of f.tasks) {
    // Weekly targets only: a fortnightly task has none, and an event
    // is never judged by the ones not ticked.
    if (!isRecurringTask(t) || t.timesPerWeek < 1) continue;
    const from = firstDay(t);
    // Days off and Away days ask nothing, so they lower the week's
    // target rather than break a run (§4).
    const skippedDates = new Set([...(f.skipped.get(t.id) ?? []), ...awayAll, ...restDays]);
    const load: LoadTask = {
      taskId: t.id,
      weight: 0,
      timesPerWeek: t.timesPerWeek,
      pinnedWeekdays: parseWeekdays(t.plannedWeekdays),
      fortnightOffset: t.fortnightOffset,
      repeatFrom: from,
      repeatUntil: t.repeatUntil,
      skippedDates,
    };
    const done = doneByTask.get(t.id) ?? [];
    const weeks = new Map<string, PlanWeek>();
    for (let ws = weekStart(from); ws <= lastWeek; ws = addDays(ws, 7)) {
      if (t.repeatUntil !== null && t.repeatUntil < ws) break;
      const target = weeklyGoalFor(load, ws);
      const end = addDays(ws, 6);
      const runs = done.filter((d) => d >= ws && d <= end).length;
      weeks.set(ws, { weekStart: ws, met: target > 0 && runs >= target, skipped: target === 0 });
    }
    weeksByTask.set(t.id, weeks);
    const r = weekRuns([...weeks.values()]);
    push("weeklyTargetTotal", "task", t.id, t.title, r.total);
    push("weeklyTargetRun", "task", t.id, t.title, r.longest, r.current);
  }

  for (const u of lifeUnits) {
    const own = f.tasks.filter((t) => t.unitId === u.id && weeksByTask.has(t.id)).map((t) => weeksByTask.get(t.id)!);
    const starts = [...new Set(own.flatMap((w) => [...w.keys()]))].sort();
    const weeks: PlanWeek[] = starts.map((ws) => {
      const asked = own.map((w) => w.get(ws)).filter((w): w is PlanWeek => w !== undefined && !w.skipped);
      return { weekStart: ws, met: asked.length > 0 && asked.every((w) => w.met), skipped: asked.length === 0 };
    });
    const r = weekRuns(weeks);
    push("wholeUnitTotal", "unit", u.id, u.name, r.total);
    push("wholeUnitRun", "unit", u.id, u.name, r.longest, r.current);
  }

  // ── Score (§4): stored grades of days that have ended ─────────────
  // A day with no stored row scored nothing (`periodDays`); a day off
  // or an Away day is ungraded, and neither counts nor breaks a run.
  const stored = new Map(
    f.grades
      .filter((g) => g.localDate < f.today)
      .map((g) => [g.localDate, storedDayScore({ earned: g.pointsEarned, possible: g.pointsPossible }).base]),
  );
  const graded: GradedDay[] = [];
  const firstGraded = [...stored.keys()].sort()[0];
  if (firstGraded !== undefined) {
    for (let d = firstGraded; d < f.today; d = addDays(d, 1)) {
      graded.push({ date: d, grade: awayAll.has(d) ? null : stored.has(d) ? stored.get(d)! : 0 });
    }
  }
  push("goodDays", "all", ALL, "", gradeRuns(graded, GOOD_DAY).total);
  // An automatic rest day scores 70 for asking nothing, so it doesn't
  // count toward 70 (Henry, 2026-10-26).
  const autoRest = new Set(f.grades.filter((g) => g.restDay === true).map((g) => g.localDate));
  push(
    "days70",
    "all",
    ALL,
    "",
    gradeRuns(
      graded.map((d) => (autoRest.has(d.date) ? { ...d, grade: null } : d)),
      STEADY_DAY,
    ).total,
  );
  push("perfectDays", "all", ALL, "", gradeRuns(graded, FULL_DAY).total);
  const great = gradeRuns(graded, GREAT_DAY);
  push("greatDays", "all", ALL, "", great.total);
  push("greatDayRun", "all", ALL, "", great.longest, great.current);

  // ── The record ────────────────────────────────────────────────────
  push("activities", "all", ALL, "", f.activities.length);
  const flagged = new Set([
    ...f.grades.filter((g) => g.flagged).map((g) => g.localDate),
    ...f.activities.filter((a) => a.flagged).map((a) => a.localDate),
  ]);
  push("flaggedDays", "all", ALL, "", flagged.size);
  push("activityDays", "all", ALL, "", new Set(f.activities.map((a) => a.localDate)).size);
  push("journalEntries", "all", ALL, "", f.journal.length);
  push("photos", "all", ALL, "", f.photos);
  push("specialDays", "all", ALL, "", f.grades.filter((g) => g.kind === "special").length);

  // ── The wider catalogue (Henry, 2026-10-25) ───────────────────────
  // What you did, counted: never what you didn't.
  push("totalCompletions", "all", ALL, "", ticks.length);
  push("earlyBird", "all", ALL, "", ticks.filter((c) => c.hour !== null && c.hour < EARLY_HOUR).length);
  push("nightOwl", "all", ALL, "", ticks.filter((c) => c.hour !== null && c.hour >= LATE_HOUR).length);
  push("weekendTicks", "all", ALL, "", ticks.filter((c) => isoWeekday(c.localDate) >= 6).length);
  push("partialSteps", "all", ALL, "", ticks.filter((c) => c.fraction < 1).length);
  const sizeOf = (c: (typeof ticks)[number]) => {
    const t = taskById.get(c.taskId)!;
    return t.oneOffSize ?? t.size;
  };
  push("quickWins", "all", ALL, "", ticks.filter((c) => sizeOf(c) === "quick").length);
  push("bigTasks", "all", ALL, "", ticks.filter((c) => sizeOf(c) === "big").length);
  push("oneOffs", "all", ALL, "", ticks.filter((c) => taskById.get(c.taskId)!.oneOffSize !== null).length);
  push("eventsAttended", "all", ALL, "", ticks.filter((c) => taskById.get(c.taskId)!.kind === "event").length);
  push("tasksSetUp", "all", ALL, "", f.tasks.filter((t) => t.kind === "task").length);

  let allMinutes = 0;
  for (const m of minutesByUnit.values()) allMinutes += m;
  for (const m of minutesByRoot.values()) allMinutes += m;
  push("totalHours", "all", ALL, "", hours(allMinutes));
  const minutesByArea = new Map<string, number>();
  for (const [unitId, m] of minutesByUnit) {
    const area = areaOfUnit.get(unitId);
    if (area) minutesByArea.set(area, (minutesByArea.get(area) ?? 0) + m);
  }
  for (const a of f.areas) {
    if (liveAreas.has(a.id)) push("areaHours", "area", a.id, a.name, hours(minutesByArea.get(a.id)));
  }

  // Days with something done: in total, the best day, and in a row.
  // Days off and Away days bridge a run; nothing else does.
  const ticksByDay = countBy(ticks, (c) => c.localDate);
  push("activeDays", "all", ALL, "", ticksByDay.size);
  push("mostInOneDay", "all", ALL, "", Math.max(0, ...ticksByDay.values()));
  const bridge = new Set([...awayAll, ...restDays]);
  const firstActive = [...ticksByDay.keys()].sort()[0];
  const activeRun = (until: string) => {
    const days: PlanWeek[] = [];
    if (firstActive !== undefined) {
      for (let d = firstActive; d <= until; d = addDays(d, 1)) {
        const did = ticksByDay.has(d);
        days.push({ weekStart: d, met: did, skipped: !did && bridge.has(d) });
      }
    }
    return weekRuns(days);
  };
  // Ranks from days that have ended; progress counts today once it has
  // something, and a today with nothing yet isn't a break.
  const ended = activeRun(addDays(f.today, -1));
  push(
    "activeDayRun",
    "all",
    ALL,
    "",
    ended.longest,
    ticksByDay.has(f.today) ? activeRun(f.today).current : ended.current,
  );

  // Weeks that have ended: something done every day, the most units
  // touched, and every area touched.
  let fullWeeks = 0;
  let varietyWeeks = 0;
  let mostUnits = 0;
  const firstWeek = firstActive === undefined ? undefined : weekStart(firstActive);
  // Life units ticked, by week, in one pass rather than a scan per week.
  const unitsByWeek = new Map<string, Set<string>>();
  for (const c of lifeTicks) {
    const ws = weekStart(c.localDate);
    const set = unitsByWeek.get(ws) ?? new Set<string>();
    set.add(taskById.get(c.taskId)!.unitId);
    unitsByWeek.set(ws, set);
  }
  if (firstWeek !== undefined) {
    for (let ws = firstWeek; ws <= lastWeek; ws = addDays(ws, 7)) {
      const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
      // Away days and days off ask nothing, as they bridge a run of days.
      const asked = days.filter((d) => !bridge.has(d));
      if (asked.length > 0 && asked.every((d) => ticksByDay.has(d))) fullWeeks += 1;
      const units = unitsByWeek.get(ws) ?? new Set<string>();
      mostUnits = Math.max(mostUnits, units.size);
      const areas = new Set([...units].map((u) => areaOfUnit.get(u)));
      if (liveAreas.size > 0 && [...liveAreas].every((a) => areas.has(a))) varietyWeeks += 1;
    }
  }
  push("fullWeeks", "all", ALL, "", fullWeeks);
  push("mostUnitsWeek", "all", ALL, "", mostUnits);
  push("varietyWeeks", "all", ALL, "", varietyWeeks);

  return out;
}

// ── Marks ───────────────────────────────────────────────────────────

/** The highest rank earned among series, or null. */
export function highestRank(items: readonly { earned: readonly { rank: Rank }[] }[]): Rank | null {
  let best = -1;
  for (const i of items) for (const e of i.earned) best = Math.max(best, RANKS.indexOf(e.rank));
  return best === -1 ? null : RANKS[best]!;
}

/** What a unit's row shows (§7): its highest rank, and a run going now. */
export interface UnitBadge {
  rank: Rank | null;
  /** An every-day task's days, else its weeks. */
  streak: { length: number; per: "day" | "week" } | null;
}

/** The run a streak mark shows among series: days beat weeks, so one
 *  mark never mixes them, then the longer. */
export function runShown(items: readonly { series: SeriesId; streak: number | null }[]): UnitBadge["streak"] {
  let best: UnitBadge["streak"] = null;
  for (const i of items) {
    if (i.streak === null) continue;
    const mine = { length: i.streak, per: i.series === "everyDayStreak" ? ("day" as const) : ("week" as const) };
    if (best === null || (best.per === mine.per ? mine.length > best.length : mine.per === "day")) best = mine;
  }
  return best;
}
