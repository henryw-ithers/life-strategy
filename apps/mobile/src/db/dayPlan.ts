/**
 * A day as Plan shows it (spec §5.3, windows-and-pins.md §§1–3): its
 * windows, events, gaps and buffers, and the tasks filled into the
 * windows by `planDay`, worked out each time and never saved. And a
 * week of those days for the strip across the top.
 *
 * **Never changes a score** (ADR-0039 §12). The day's tasks come from
 * `loadDay`, which owns what's due; this only arranges them. Points
 * never rank a suggestion.
 */
import {
  addDays,
  DAY_END_LIMIT,
  appliesOn,
  dayHours,
  dayMinute,
  pinsOn,
  planDay,
  totalMinutes,
  weekStart,
  type DayEdit,
  type DayHours,
  type HoursVersion,
  type PlanDayInput,
  type PlannedDay,
  type TimeRange,
} from "@glide/scoring";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";

import { currentLocalDate } from "../lib/calendar";
import { db } from "./client";
import {
  eventRange,
  eventsOn,
  isFlexible,
  spreadDays,
  spreadsTo,
  tierRankOf,
  toOpenTask,
} from "./dayPlanRules";
import { loadHoursVersions } from "./hours";
import { loadChoices, loadPinRules, type WindowChoice } from "./pins";
import { loadSchedule } from "./schedule";
import {
  dayClear,
  dayGrade,
  dayWindowEdit,
  lifeUnit,
  task,
  taskCompletion,
  workDayOverride,
} from "./schema";
import { loadAwayRanges } from "./skips";
import { loadDay, type DayData, type TodayTask } from "./today";
import {
  awayDatesBetween,
  parseRanges,
  toDayEdits,
  withSchedule,
} from "./windowRules";

/** An event on the day, shown at its time (ADR-0038). */
export interface PlanEvent {
  readonly id: string;
  readonly title: string;
  readonly unitId: string;
  readonly areaId: string;
  readonly start: number;
  readonly end: number;
  readonly repeating: boolean;
  readonly commitment: boolean;
  /** Ticked as attended. Never counted against anything (ADR-0035). */
  readonly done: boolean;
}

/** What marks a day on the week strip (spec §5.3). */
export type DayMarker = "special" | "dayOff" | "away" | null;

export interface WeekDay {
  readonly date: string;
  /** The day's windows added up, for "about 6 h free" and for
   *  spreading flexible runs (§3.5). */
  readonly freeMinutes: number;
  /** A pin applies on the day: the strip's dot. */
  readonly hasPins: boolean;
  /** A Special day, a day off or an Away day: the strip's line. */
  readonly marker: DayMarker;
}

export interface DayPlan {
  readonly day: DayData;
  readonly hours: DayHours;
  readonly events: readonly PlanEvent[];
  readonly planned: PlannedDay;
  /** Every task `planned` names, by id, for its row. */
  readonly tasks: ReadonlyMap<string, TodayTask>;
  /** "Do N of these" choices on the day (ADR-0039 §6). */
  readonly choices: readonly WindowChoice[];
  readonly freeMinutes: number;
  /** The minute it is now, on today; null on any other day. */
  readonly now: number | null;
  /** What `planned` was filled from, so a screen can fill it again with
   *  a swap or a "Pull in another" without reading the rows again. */
  readonly input: PlanDayInput;
}

// ── Reading the rows ────────────────────────────────────────────────

/** Active events in units still in use, with their schedule around
 *  `date`: skips, Away days and cleared days (`withSchedule`). */
export async function eventRowsAround(date: string) {
  const rows = await db
    .select({
      id: task.id,
      title: task.title,
      unitId: task.unitId,
      kind: task.kind,
      startMinute: task.startMinute,
      endMinute: task.endMinute,
      plannedWeekdays: task.plannedWeekdays,
      timesPerWeek: task.timesPerWeek,
      fortnightOffset: task.fortnightOffset,
      oneOffSize: task.oneOffSize,
      oneOffDate: task.oneOffDate,
      repeatFrom: task.repeatFrom,
      repeatUntil: task.repeatUntil,
      description: task.description,
      areaId: lifeUnit.areaId,
    })
    .from(task)
    .innerJoin(lifeUnit, eq(lifeUnit.id, task.unitId))
    .where(and(eq(task.active, true), eq(task.kind, "event"), isNull(lifeUnit.archivedAt)));
  const schedule = await loadSchedule(date, rows);
  return rows.map((r) => withSchedule(r, schedule.skipped));
}

/** Each date's own hours and window edits from `start` to `end`. */
async function dayRowsBetween(start: string, end: string) {
  const [overrides, edits] = await Promise.all([
    db
      .select()
      .from(workDayOverride)
      .where(and(gte(workDayOverride.localDate, start), lte(workDayOverride.localDate, end))),
    db
      .select()
      .from(dayWindowEdit)
      .where(and(gte(dayWindowEdit.localDate, start), lte(dayWindowEdit.localDate, end))),
  ]);
  const overrideOn = new Map<string, TimeRange[] | null>(
    overrides.map((o) => [o.localDate, parseRanges(o.ranges)]),
  );
  const editsOn = new Map<string, DayEdit[]>();
  for (const date of new Set(edits.map((e) => e.localDate))) {
    editsOn.set(date, toDayEdits(edits.filter((e) => e.localDate === date)));
  }
  return { overrideOn, editsOn };
}

/** Away days, days off and Special days from `start` to `end`. */
async function markersBetween(start: string, end: string): Promise<Map<string, DayMarker>> {
  const [ranges, kinds] = await Promise.all([
    loadAwayRanges(),
    db
      .select({ localDate: dayGrade.localDate, kind: dayGrade.kind })
      .from(dayGrade)
      .where(and(gte(dayGrade.localDate, start), lte(dayGrade.localDate, end))),
  ]);
  const out = new Map<string, DayMarker>();
  for (const k of kinds) {
    if (k.kind === "special") out.set(k.localDate, "special");
    if (k.kind === "rest") out.set(k.localDate, "dayOff");
  }
  // Away wins: it's the range the day sits in.
  for (const d of awayDatesBetween(ranges, start, end)) out.set(d, "away");
  return out;
}

interface HoursInputs {
  readonly versions: readonly HoursVersion[];
  readonly overrideOn: ReadonlyMap<string, TimeRange[] | null>;
  readonly editsOn: ReadonlyMap<string, DayEdit[]>;
  readonly events: readonly TimeRange[];
  /** An Away day, a day off, or a cleared day sets its windows aside
   *  (ADR-0040 §§4–5); its events still show. */
  readonly setAside: boolean;
}

function hoursOn(date: string, input: HoursInputs): DayHours {
  const hours = dayHours({
    date,
    versions: input.versions,
    override: input.overrideOn.get(date) ?? null,
    edits: input.editsOn.get(date) ?? [],
    events: input.events,
  });
  return input.setAside ? { ...hours, windows: [], buffers: [] } : hours;
}

// ── The week strip ──────────────────────────────────────────────────

/**
 * The seven days of the week holding `date`, for the strip: free time,
 * pins and markers. Sunday first: the app's weeks run Sunday to
 * Saturday (ADR-0004 §1), and the strip shows the week the grade
 * counts.
 */
export async function loadWeek(date: string): Promise<WeekDay[]> {
  const first = weekStart(date);
  const last = addDays(first, 6);
  const [versions, rows, events, markers, rules, clears] = await Promise.all([
    loadHoursVersions(),
    dayRowsBetween(first, last),
    eventRowsAround(addDays(first, 3)),
    markersBetween(first, last),
    loadPinRules(),
    clearedBetween(first, last),
  ]);
  const out: WeekDay[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const marker = markers.get(date) ?? null;
    const hours = hoursOn(date, {
      versions,
      ...rows,
      events: eventsOn(events, date).map(eventRange),
      setAside: marker === "away" || marker === "dayOff" || clears.has(date),
    });
    out.push({
      date,
      freeMinutes: totalMinutes(hours.windows),
      hasPins: rules.some((r) => appliesOn(r, date)),
      marker,
    });
  }
  return out;
}

async function clearedBetween(start: string, end: string): Promise<Set<string>> {
  const rows = await db
    .select({ localDate: dayClear.localDate })
    .from(dayClear)
    .where(and(gte(dayClear.localDate, start), lte(dayClear.localDate, end)));
  return new Set(rows.map((r) => r.localDate));
}

// ── One day ─────────────────────────────────────────────────────────

/** The minute of the day a completion was made, if it was made on
 *  `date` itself; null otherwise (logged afterwards). */
function minuteOfTick(completedAt: string, date: string): number | null {
  const at = new Date(completedAt);
  if (Number.isNaN(at.getTime())) return null;
  const m = dayMinute(at.getHours(), at.getMinutes());
  // Before the rollover the wall-clock date is the next day's.
  const wall = m >= 24 * 60 ? addDays(date, 1) : date;
  const local = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
  return local === wall ? m : null;
}

/** The day `date` as Plan shows it. */
export async function loadDayPlan(date: string, at: Date = new Date()): Promise<DayPlan> {
  const today = currentLocalDate();
  const day = await loadDay(date);
  const all = [...day.due, ...day.week, ...day.doneThisWeek];
  const ids = all.map((t) => t.id);

  const [versions, rows, events, rules, choices, facts, ticks] = await Promise.all([
    loadHoursVersions(),
    dayRowsBetween(date, date),
    eventRowsAround(date),
    loadPinRules(),
    loadChoices(date),
    ids.length
      ? db
          .select({
            id: task.id,
            rankInUnit: task.rankInUnit,
            createdAt: task.createdAt,
            tier: lifeUnit.tier,
          })
          .from(task)
          .innerJoin(lifeUnit, eq(lifeUnit.id, task.unitId))
          .where(inArray(task.id, ids))
      : Promise.resolve([]),
    ids.length
      ? db
          .select({ taskId: taskCompletion.taskId, completedAt: taskCompletion.completedAt })
          .from(taskCompletion)
          .where(and(eq(taskCompletion.localDate, date), inArray(taskCompletion.taskId, ids)))
      : Promise.resolve([]),
  ]);

  const byId = new Map(all.map((t) => [t.id, t]));
  const factsOf = new Map(facts.map((f) => [f.id, f]));
  const dayEvents = eventsOn(events, date);
  const setAside = day.away !== null || day.kind === "rest" || day.cleared;
  const hours = hoursOn(date, {
    versions,
    ...rows,
    events: dayEvents.map(eventRange),
    setAside,
  });

  // Flexible runs on a future day go to the days with the most room.
  const future = date > today;
  const flexible = future ? all.filter(isFlexible) : [];
  const free =
    flexible.length > 0
      ? (await loadWeek(date))
          .filter((d) => spreadDays(date, today).includes(d.date))
          .map((d) => ({ date: d.date, freeMinutes: d.freeMinutes }))
      : [];

  const open = all
    .map((t) => {
      const f = factsOf.get(t.id);
      return toOpenTask(
        t,
        date,
        {
          tierRank: tierRankOf(f?.tier),
          unitOrder: f?.rankInUnit ?? 0,
          createdAt: f?.createdAt ?? "",
        },
        { spreadHere: !(future && isFlexible(t)) || spreadsTo(t, date, free) },
      );
    })
    .filter((t) => t !== null);

  const now =
    date === today ? dayMinute(at.getHours(), at.getMinutes()) : date < today ? DAY_END_LIMIT : null;
  // Every tick on the day is done, so it's never suggested again. One
  // logged afterwards, or with a time that can't be read, sits in no
  // window (minute -1) rather than being left open.
  const done = ticks
    .map((c) => {
      const t = byId.get(c.taskId);
      return t && t.kind === "task"
        ? { taskId: t.id, size: t.size ?? t.oneOffSize, minute: minuteOfTick(c.completedAt, date) ?? -1 }
        : null;
    })
    .filter((d) => d !== null);

  const openIds = new Set(open.map((t) => t.taskId));
  const lastDone = await lastDoneBefore(ids, date);
  const pins = pinsOn(rules, date, {
    open: openIds,
    lastDone,
    oneOffs: new Set(all.filter((t) => t.oneOffSize !== null).map((t) => t.id)),
  });

  const input: PlanDayInput = { windows: hours.windows, now, open, pins, done };
  const planned = planDay(input);

  return {
    day,
    hours,
    events: dayEvents.map((e) => ({
      id: e.id,
      title: e.title,
      unitId: e.unitId,
      areaId: e.areaId,
      start: e.startMinute!,
      end: e.endMinute!,
      repeating: e.oneOffSize === null,
      commitment: byId.get(e.id)?.commitment ?? false,
      done: byId.get(e.id)?.completedToday ?? false,
    })),
    planned,
    tasks: byId,
    choices,
    freeMinutes: totalMinutes(hours.windows),
    now: date === today ? now : null,
    input,
  };
}

/** Each task's latest completion before `date`, for carried pins. */
async function lastDoneBefore(ids: readonly string[], date: string): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ taskId: taskCompletion.taskId, localDate: taskCompletion.localDate })
    .from(taskCompletion)
    .where(and(inArray(taskCompletion.taskId, [...ids]), lte(taskCompletion.localDate, addDays(date, -1))));
  const out = new Map<string, string>();
  for (const r of rows) {
    const held = out.get(r.taskId);
    if (held === undefined || r.localDate > held) out.set(r.taskId, r.localDate);
  }
  return out;
}
