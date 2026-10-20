/**
 * The rules behind stored hours, window edits, pins, choices, skips and
 * Away (ADR-0039, ADR-0040), as pure functions.
 *
 * Split out from `hours.ts`, `pins.ts` and `skips.ts` so they can be
 * tested without React Native, as `commitmentPlan.ts` is for
 * `commitments.ts`. The queries live there; the rules live here.
 *
 * **Strict on write, tolerant on read.** Each `…Problem` returns what's
 * wrong with something about to be saved, or null, and the writer
 * throws it. Each parser drops what it can't read rather than throwing,
 * so a bad stored row can't break the day screen; it only loses the
 * piece it can't make sense of.
 */
import {
  addDays,
  DAY_END_LIMIT,
  isFinalized,
  isLocalDate,
  isoWeekday,
  parseWeekdays,
  rangeError,
  weekStart,
  type DayEdit,
  type HoursVersion,
  type NamedGap,
  type PinKind,
  type PinRule,
  type ScheduleBounds,
  type TimeRange,
  type Weekday,
  type WorkSchedule,
} from "@glide/scoring";

import { MAX_CHOICE_TASKS } from "./commitmentPlan";

// ── Working hours ───────────────────────────────────────────────────

function isWeekday(n: unknown): n is Weekday {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 7;
}

function readRange(value: unknown): TimeRange | null {
  if (typeof value !== "object" || value === null) return null;
  const { start, end } = value as { start?: unknown; end?: unknown };
  if (typeof start !== "number" || typeof end !== "number") return null;
  const range = { start, end };
  return rangeError(range) === null ? range : null;
}

function readWeekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isWeekday))].sort((a, b) => a - b);
}

function readJson(json: string | null | undefined): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** A version's groups, as stored. Groups with no valid weekdays or no
 *  valid ranges are dropped. */
export function parseSchedules(json: string | null | undefined): WorkSchedule[] {
  const value = readJson(json);
  if (!Array.isArray(value)) return [];
  const out: WorkSchedule[] = [];
  for (const g of value) {
    if (typeof g !== "object" || g === null) continue;
    const weekdays = readWeekdays((g as { weekdays?: unknown }).weekdays);
    const rawRanges = (g as { ranges?: unknown }).ranges;
    const ranges = Array.isArray(rawRanges)
      ? rawRanges.map(readRange).filter((r): r is TimeRange => r !== null)
      : [];
    if (weekdays.length > 0 && ranges.length > 0) out.push({ weekdays, ranges });
  }
  return out;
}

/** A version's named gaps, as stored. */
export function parseGaps(json: string | null | undefined): NamedGap[] {
  const value = readJson(json);
  if (!Array.isArray(value)) return [];
  const out: NamedGap[] = [];
  for (const g of value) {
    if (typeof g !== "object" || g === null) continue;
    const { weekdays, range, name } = g as { weekdays?: unknown; range?: unknown; name?: unknown };
    const days = readWeekdays(weekdays);
    const r = readRange(range);
    if (days.length > 0 && r !== null && typeof name === "string" && name.trim() !== "") {
      out.push({ weekdays: days, range: r, name: name.trim() });
    }
  }
  return out;
}

/** One date's own ranges, as stored. An override that can't be read
 *  at all reads as no override (null), so the day falls back to the
 *  template rather than losing its hours. Only a stored `[]` is a day
 *  with no working hours. */
export function parseRanges(json: string | null | undefined): TimeRange[] | null {
  const value = readJson(json);
  if (!Array.isArray(value)) return null;
  const ranges = value.map(readRange).filter((r): r is TimeRange => r !== null);
  return value.length > 0 && ranges.length === 0 ? null : ranges;
}

/** Whether a stored version can't be read at all: groups were saved and
 *  none survive. Such a version is skipped, so it doesn't pass for a
 *  template with no hours and hide the version before it. */
export function unreadableVersion(row: { schedules: string }): boolean {
  const value = readJson(row.schedules);
  return !Array.isArray(value) || (value.length > 0 && parseSchedules(row.schedules).length === 0);
}

/** A `work_hours` row as the engine's `HoursVersion`. */
export function toHoursVersion(row: {
  fromDate: string;
  schedules: string;
  gaps: string;
}): HoursVersion {
  return { from: row.fromDate, schedules: parseSchedules(row.schedules), gaps: parseGaps(row.gaps) };
}

function rangesProblem(ranges: readonly TimeRange[]): string | null {
  for (const r of ranges) {
    const problem = rangeError(r);
    if (problem !== null) return problem;
  }
  return null;
}

/** What's wrong with a version about to be saved, or null. A weekday
 *  is in at most one group (ADR-0039 §1). */
export function hoursProblem(
  fromDate: string,
  schedules: readonly WorkSchedule[],
  gaps: readonly NamedGap[],
): string | null {
  if (!isLocalDate(fromDate)) return `The first day isn't a date: ${fromDate}`;
  const seen = new Set<Weekday>();
  for (const s of schedules) {
    if (s.weekdays.length === 0) return "Each group needs at least one day.";
    if (s.ranges.length === 0) return "Each group needs at least one time range.";
    for (const d of s.weekdays) {
      if (!isWeekday(d)) return `Not a weekday: ${String(d)}`;
      if (seen.has(d)) return "A day can be in only one group.";
      seen.add(d);
    }
    const problem = rangesProblem(s.ranges);
    if (problem !== null) return problem;
  }
  for (const g of gaps) {
    if (g.name.trim() === "") return "A gap needs a name.";
    if (g.weekdays.length === 0 || !g.weekdays.every(isWeekday)) return "A gap needs its days.";
    const problem = rangeError(g.range);
    if (problem !== null) return problem;
  }
  return null;
}

/** What's wrong with a day's own ranges about to be saved, or null. */
export function overrideProblem(localDate: string, ranges: readonly TimeRange[]): string | null {
  if (!isLocalDate(localDate)) return `Not a date: ${localDate}`;
  return rangesProblem(ranges);
}

/** The JSON a version's groups are stored as. Weekdays are sorted so
 *  equal versions store equal text. */
export function serializeSchedules(schedules: readonly WorkSchedule[]): string {
  return JSON.stringify(
    schedules.map((s) => ({
      weekdays: [...s.weekdays].sort((a, b) => a - b),
      ranges: s.ranges.map(({ start, end }) => ({ start, end })),
    })),
  );
}

export function serializeGaps(gaps: readonly NamedGap[]): string {
  return JSON.stringify(
    gaps.map((g) => ({
      weekdays: [...g.weekdays].sort((a, b) => a - b),
      range: { start: g.range.start, end: g.range.end },
      name: g.name.trim(),
    })),
  );
}

export function serializeRanges(ranges: readonly TimeRange[]): string {
  return JSON.stringify(ranges.map(({ start, end }) => ({ start, end })));
}

// ── Day window edits ────────────────────────────────────────────────

export interface DayEditRow {
  localDate: string;
  seq: number;
  kind: "add" | "remove" | "change";
  startMinute: number;
  endMinute: number;
  toStartMinute: number | null;
  toEndMinute: number | null;
  madeOn: string;
}

/**
 * A day's edits, in the order they were made, as the engine's
 * `DayEdit`s. `onTheDay` is an edit made on the date it changes: the
 * commitment share leaves those out (ADR-0044 §5, EC-56). A `change`
 * missing its new range is dropped.
 */
export function toDayEdits(rows: readonly DayEditRow[]): DayEdit[] {
  const out: DayEdit[] = [];
  for (const r of [...rows].sort((a, b) => a.seq - b.seq)) {
    const range = { start: r.startMinute, end: r.endMinute };
    const onTheDay = r.madeOn === r.localDate;
    if (r.kind === "change") {
      if (r.toStartMinute === null || r.toEndMinute === null) continue;
      out.push({
        kind: "change",
        from: range,
        to: { start: r.toStartMinute, end: r.toEndMinute },
        onTheDay,
      });
    } else {
      out.push({ kind: r.kind, range, onTheDay });
    }
  }
  return out;
}

export type DayEditInput =
  | { kind: "add" | "remove"; range: TimeRange }
  | { kind: "change"; from: TimeRange; to: TimeRange };

/** What's wrong with an edit about to be saved, or null. Only days from
 *  today on can be edited (windows-and-pins §1.4). */
export function dayEditProblem(localDate: string, edit: DayEditInput, today: string): string | null {
  if (!isLocalDate(localDate)) return `Not a date: ${localDate}`;
  if (localDate < today) return "A past day's windows can't be changed.";
  if (edit.kind === "change") return rangeError(edit.from) ?? rangeError(edit.to);
  return rangeError(edit.range);
}

// ── Pins ────────────────────────────────────────────────────────────

export interface PinRow {
  id: string;
  taskId: string;
  kind: PinKind;
  anchorMinute: number;
  repeat: "once" | "weekly";
  localDate: string | null;
  extra: boolean;
  weekdays: string | null;
  fromDate: string | null;
  untilDate: string | null;
  sortOrder: number;
}

/**
 * A `window_placement` row as the engine's `PinRule`, with its
 * exception dates. Null for a row the engine couldn't place: a pin for
 * one date with no date, or a weekly one with no days or first day.
 */
export function toPinRule(row: PinRow, exceptDates: readonly string[] = []): PinRule | null {
  const base = {
    id: row.id,
    taskId: row.taskId,
    kind: row.kind,
    anchor: row.anchorMinute,
    order: row.sortOrder,
  };
  if (row.repeat === "once") {
    if (row.localDate === null) return null;
    return { ...base, when: { repeat: "once", date: row.localDate, extra: row.extra } };
  }
  const weekdays = parseWeekdays(row.weekdays);
  if (weekdays.length === 0 || row.fromDate === null) return null;
  return {
    ...base,
    when: {
      repeat: "weekly",
      weekdays: new Set(weekdays),
      from: row.fromDate,
      until: row.untilDate,
      exceptDates: new Set(exceptDates),
    },
  };
}

export type PinWhen =
  | { repeat: "once"; date: string; extra?: boolean }
  | { repeat: "weekly"; weekdays: readonly Weekday[]; from: string; until?: string | null };

/** What's wrong with a pin about to be saved, or null. Pins are made
 *  from today on, never on a past day (§2.4). */
export function pinProblem(anchor: number, when: PinWhen, today: string): string | null {
  if (!Number.isInteger(anchor) || anchor < 0 || anchor >= DAY_END_LIMIT) {
    return "A pin's time must be within the day.";
  }
  if (when.repeat === "once") {
    if (!isLocalDate(when.date)) return `Not a date: ${when.date}`;
    if (when.date < today) return "A past day can't be pinned.";
    return null;
  }
  if (when.weekdays.length === 0 || !when.weekdays.every(isWeekday)) {
    return "A repeating pin needs at least one day.";
  }
  if (!isLocalDate(when.from)) return `Not a date: ${when.from}`;
  if (when.from < today) return "A repeating pin starts today or later.";
  if (when.until != null) {
    if (!isLocalDate(when.until)) return `Not a date: ${when.until}`;
    if (when.until < when.from) return "The last day is before the first.";
  }
  return null;
}

/** Whether a stored weekly pin covers `date`, ignoring exceptions. */
export function weeklyCovers(
  row: Pick<PinRow, "repeat" | "weekdays" | "fromDate" | "untilDate">,
  date: string,
): boolean {
  if (row.repeat !== "weekly" || row.fromDate === null) return false;
  if (date < row.fromDate || (row.untilDate !== null && date > row.untilDate)) return false;
  return parseWeekdays(row.weekdays).includes(isoWeekday(date));
}

/**
 * How a new weekly pin on `weekdays` from `from` to `until` changes the
 * task's existing weekly pins, so the task keeps one pin a day (§2.7).
 *
 * Each existing pin that overlaps it is ended the day before `from`, or
 * removed if it starts on or after `from`. Whatever of it falls outside
 * the new pin carries on in a copy: its other weekdays from `from`, and
 * the named weekdays again after `until`. The newest choice wins on the
 * days it names and nothing else moves.
 */
export interface WeeklySplit {
  readonly end: { id: string; until: string }[];
  readonly remove: string[];
  readonly carry: {
    source: PinRow;
    weekdays: Weekday[];
    fromDate: string;
    untilDate: string | null;
  }[];
}

export function splitForWeekly(
  existing: readonly PinRow[],
  weekdays: readonly Weekday[],
  from: string,
  until: string | null,
): WeeklySplit {
  const named = new Set(weekdays);
  const split = { end: [], remove: [], carry: [] } as {
    end: WeeklySplit["end"][number][];
    remove: string[];
    carry: WeeklySplit["carry"][number][];
  };
  for (const row of existing) {
    if (row.repeat !== "weekly" || row.fromDate === null) continue;
    const days = parseWeekdays(row.weekdays);
    if (!days.some((d) => named.has(d))) continue;
    if (row.untilDate !== null && row.untilDate < from) continue;
    if (until !== null && row.fromDate > until) continue;

    if (row.fromDate < from) split.end.push({ id: row.id, until: addDays(from, -1) });
    else split.remove.push(row.id);

    const rest = days.filter((d) => !named.has(d));
    const start = row.fromDate > from ? row.fromDate : from;
    if (rest.length > 0) {
      split.carry.push({ source: row, weekdays: rest, fromDate: start, untilDate: row.untilDate });
    }
    if (until !== null && (row.untilDate === null || row.untilDate > until)) {
      split.carry.push({
        source: row,
        weekdays: days.filter((d) => named.has(d)),
        fromDate: addDays(until, 1),
        untilDate: row.untilDate,
      });
    }
  }
  return split;
}

// ── "Do N of these" ─────────────────────────────────────────────────

export interface ChoiceInput {
  taskIds: readonly string[];
  plannedCount: number;
  /** Each member's commitment (its root unit), or null for a life task. */
  commitmentOf: ReadonlyMap<string, string | null>;
  /** Tasks already in another choice in the same window. */
  elsewhere: ReadonlySet<string>;
}

/**
 * What's wrong with a choice about to be saved, or null (ADR-0033 §3,
 * windows-and-pins §2.13): two or three tasks, all from one commitment,
 * none already in another choice in the window. Equal value is a fact
 * of the day, so the screen offers a choice only when it holds.
 */
export function choiceProblem(input: ChoiceInput): string | null {
  const { taskIds } = input;
  if (taskIds.length < 2) return "A choice needs at least two tasks.";
  if (taskIds.length > MAX_CHOICE_TASKS) {
    return `A choice holds at most ${MAX_CHOICE_TASKS} tasks.`;
  }
  if (new Set(taskIds).size !== taskIds.length) return "A task can only be in a choice once.";
  if (taskIds.some((id) => input.elsewhere.has(id))) {
    return "That task is already in a choice in this window.";
  }
  const roots = new Set(taskIds.map((id) => input.commitmentOf.get(id) ?? null));
  if (roots.has(null) || roots.size !== 1) return "A choice's tasks all come from one commitment.";
  if (!Number.isInteger(input.plannedCount) || input.plannedCount < 1) {
    return "Choose how many to do.";
  }
  return null;
}

/** The planned count kept between 1 and the number of tasks. */
export function clampPlanned(count: number, members: number): number {
  return Math.max(1, Math.min(Math.round(count), Math.max(1, members)));
}

// ── Skips and Away ──────────────────────────────────────────────────

export interface SkipRow {
  kind: "occurrence" | "taskWeek" | "commitmentWeek";
  taskId: string | null;
  unitId: string | null;
  localDate: string;
  madeOn: string;
}

function weekDates(date: string): string[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Each task's skipped dates (ADR-0040 §2), for
 * `ScheduleBounds.skippedDates`. A commitment's week covers every task
 * homed in it or its sub-commitments: `commitmentOf` maps each task to
 * its commitment, or null.
 */
export function skippedDatesFor(
  skips: readonly SkipRow[],
  commitmentOf: ReadonlyMap<string, string | null>,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (taskId: string, dates: readonly string[]) => {
    const set = out.get(taskId) ?? new Set<string>();
    for (const d of dates) set.add(d);
    out.set(taskId, set);
  };
  for (const s of skips) {
    if (!isLocalDate(s.localDate)) continue;
    if (s.kind === "occurrence" && s.taskId) add(s.taskId, [s.localDate]);
    else if (s.kind === "taskWeek" && s.taskId) add(s.taskId, weekDates(s.localDate));
    else if (s.kind === "commitmentWeek" && s.unitId) {
      const dates = weekDates(s.localDate);
      for (const [taskId, root] of commitmentOf) if (root === s.unitId) add(taskId, dates);
    }
  }
  return out;
}

export type SkipInput =
  | { kind: "occurrence"; taskId: string; date: string }
  | { kind: "taskWeek"; taskId: string; date: string }
  | { kind: "commitmentWeek"; unitId: string; date: string };

/** What's wrong with a skip about to be saved, or null. A single run
 *  can be skipped from today on; a whole week only before it starts
 *  (ADR-0040 §2, EC-25), so skipping can never empty a day already
 *  under way, or one already past. */
export function skipProblem(skip: SkipInput, today: string): string | null {
  if (!isLocalDate(skip.date)) return `Not a date: ${skip.date}`;
  if (skip.kind === "occurrence") {
    return skip.date < today ? "A past day can't be skipped." : null;
  }
  if (weekStart(skip.date) <= today) return "A week that has started can't be skipped as a whole.";
  return null;
}

/** Every Away day from `start` to `end`, inclusive, for
 *  `computeDayLoad`'s `away`. */
export function awayDatesBetween(
  ranges: readonly { startDate: string; endDate: string }[],
  start: string,
  end: string,
): Set<string> {
  const out = new Set<string>();
  for (const r of ranges) {
    if (!isLocalDate(r.startDate) || !isLocalDate(r.endDate)) continue;
    const from = r.startDate > start ? r.startDate : start;
    const to = r.endDate < end ? r.endDate : end;
    for (let d = from; d <= to; d = addDays(d, 1)) out.add(d);
  }
  return out;
}

/** What's wrong with an Away range about to be saved, or null. Past
 *  days only while their grades haven't settled (ADR-0040 §5): Away
 *  can't remove a settled day's grade. */
export function awayProblem(startDate: string, endDate: string, today: string): string | null {
  if (!isLocalDate(startDate)) return `The start isn't a date: ${startDate}`;
  if (!isLocalDate(endDate)) return `The end isn't a date: ${endDate}`;
  if (endDate < startDate) return "The end is before the start.";
  if (isFinalized(startDate, today)) return "Away can only start from last week on.";
  return null;
}

// ── Each task's schedule (ADR-0040 §§1–5) ───────────────────────────

/** What takes a task's runs away, besides its own bounds. */
export interface ScheduleInputs {
  readonly skips: readonly SkipRow[];
  /** Away days. No events are due on one (ADR-0040 §5). */
  readonly away: ReadonlySet<string>;
  /** Days cleared with Clear today: their unticked events are skipped
   *  (ADR-0040 §4). */
  readonly cleared: ReadonlySet<string>;
  /** `taskId|date` for each event ticked on a cleared day: a ticked
   *  event stays due, so its tick still counts. */
  readonly eventDoneOn: ReadonlySet<string>;
}

/**
 * Each task's skipped dates: its skips, its commitment's skipped weeks,
 * and for an event, Away days and cleared days it wasn't ticked on.
 *
 * With `startOf`, the skips and the clear made on that day itself are
 * left out: what the day asked for when it began, which decides whether
 * an empty day was emptied on the day (`emptiedToday`, ADR-0040 §3).
 */
export function skippedByTask(
  tasks: readonly { id: string; kind: "task" | "event" }[],
  commitmentOf: ReadonlyMap<string, string | null>,
  inputs: ScheduleInputs,
  { startOf }: { startOf?: string } = {},
): Map<string, Set<string>> {
  const skips = startOf
    ? inputs.skips.filter((s) => !(s.madeOn === startOf && s.kind === "occurrence" && s.localDate === startOf))
    : inputs.skips;
  const out = skippedDatesFor(skips, commitmentOf);
  for (const t of tasks) {
    if (t.kind !== "event") continue;
    const set = out.get(t.id) ?? new Set<string>();
    for (const d of inputs.away) set.add(d);
    for (const d of inputs.cleared) {
      if (d === startOf) continue;
      if (!inputs.eventDoneOn.has(`${t.id}|${d}`)) set.add(d);
    }
    if (set.size > 0) out.set(t.id, set);
  }
  return out;
}

const NO_DATES: ReadonlySet<string> = new Set();

/**
 * A task row with every `ScheduleBounds` field filled in, so whatever
 * asks "is this due" sees its bounds and skips. One mapper, typed with
 * `Required`, so no field can be forgotten on the way to the engine.
 */
export function withSchedule<T extends { id: string; repeatFrom: string | null; repeatUntil: string | null }>(
  row: T,
  skipped: ReadonlyMap<string, ReadonlySet<string>>,
): T & Required<ScheduleBounds> {
  return {
    ...row,
    repeatFrom: row.repeatFrom,
    repeatUntil: row.repeatUntil,
    skippedDates: skipped.get(row.id) ?? NO_DATES,
  };
}

/** Each unit's commitment (its root), or null for a life unit. */
export function commitmentRoots(
  units: readonly { id: string; parentUnitId: string | null; isCustom: boolean; commitmentShare: number | null }[],
): Map<string, string | null> {
  return new Map(
    units.map((u) => [
      u.id,
      u.parentUnitId ?? (u.isCustom && u.commitmentShare !== null ? u.id : null),
    ]),
  );
}
