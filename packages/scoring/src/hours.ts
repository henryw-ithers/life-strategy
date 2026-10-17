/**
 * The day's windows, from your working hours (ADR-0039 §§1–3;
 * docs/design/windows-and-pins.md §1).
 *
 *     windows = working ranges (the template, or that day's own)
 *               − named gaps
 *               then that day's edits (add, remove, change a window)
 *               − events, each widened by the buffer on both sides
 *               − pieces under 30 minutes, which show as buffers
 *
 * Times are **minutes from local midnight on the wall clock**, never
 * instants, so a day the clocks change keeps its times and nothing
 * appears twice (EC-03, EC-04). A range may run past midnight up to the
 * rollover and belongs to the day it starts on (EC-01): 1 am is 1500.
 *
 * Pure, like everything in this package. The data layer (Phase 5)
 * stores the template, its versions, the day overrides and the edits;
 * this side only turns them into a day.
 *
 * This replaces `windows.ts`'s gaps-between-commitments windows
 * (ADR-0033 §1) once Home and Plan are rebuilt; until then the app
 * still draws those.
 */
import { ROLLOVER_HOUR } from "./days";
import { isoWeekday, type Weekday } from "./schedule";

/** A stretch of a day, in wall-clock minutes from local midnight. */
export interface TimeRange {
  readonly start: number;
  readonly end: number;
}

/** The latest a range may end: the rollover, the next morning (EC-01). */
export const DAY_END_LIMIT = 24 * 60 + ROLLOVER_HOUR * 60;
/** A stretch shorter than this is a buffer, not a window. */
export const MIN_WINDOW = 30;
/** Space kept around each event, by default (Settings, spec §3.4). */
export const EVENT_BUFFER = 10;
/** A day's windows before any hours are set: 9–12, 1–5, 6–9 (ADR-0039 §2). */
export const DEFAULT_RANGES: readonly TimeRange[] = [
  { start: 9 * 60, end: 12 * 60 },
  { start: 13 * 60, end: 17 * 60 },
  { start: 18 * 60, end: 21 * 60 },
];

/** One group of weekdays and its ranges, as iOS Sleep schedules are set. */
export interface WorkSchedule {
  readonly weekdays: readonly Weekday[];
  readonly ranges: readonly TimeRange[];
}

/** A named stretch between windows ("Lunch") on some weekdays. */
export interface NamedGap {
  readonly weekdays: readonly Weekday[];
  readonly range: TimeRange;
  readonly name: string;
}

/** Working hours from one date on ("This week and after" starts a new
 *  version, so earlier days keep the hours they had, EC-15). */
export interface HoursVersion {
  /** First day this version applies, `YYYY-MM-DD`. */
  readonly from: string;
  readonly schedules: readonly WorkSchedule[];
  readonly gaps: readonly NamedGap[];
}

/**
 * One change to one day's windows (§1.4). Applied in the order made, so
 * the data layer keeps them in sequence. Edits are by time, not by
 * window: removing a range the day no longer has changes nothing.
 *
 * `onTheDay` marks an edit made on that day itself. The commitment
 * share reads the hours as they stood when the day began (ADR-0044 §5),
 * so it counts edits made ahead of time and not those made on the day
 * (EC-56).
 */
export type DayEdit = (
  | { readonly kind: "add"; readonly range: TimeRange }
  | { readonly kind: "remove"; readonly range: TimeRange }
  | { readonly kind: "change"; readonly from: TimeRange; readonly to: TimeRange }
) & { readonly onTheDay?: boolean };

export interface DayHoursInput {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** Every version of the template, any order. Empty: no hours set yet,
   *  so the day uses `DEFAULT_RANGES`. */
  readonly versions: readonly HoursVersion[];
  /** That date's own ranges ("Just this week"), replacing the template's
   *  and its named gaps. An empty list is a day with no working hours. */
  readonly override?: readonly TimeRange[] | null;
  /** That date's window edits, in the order they were made. */
  readonly edits?: readonly DayEdit[];
  /** That day's events still due (skipped ones left out), any order. */
  readonly events?: readonly TimeRange[];
  /** Minutes kept clear around each event. */
  readonly buffer?: number;
}

export interface DayHours {
  /** The working time the day began with: its ranges, less named gaps,
   *  with the edits made ahead of time, before events. What the
   *  commitment share reads as the day's hours (ADR-0044 §5). */
  readonly working: readonly TimeRange[];
  /** The day's windows, in order. */
  readonly windows: readonly TimeRange[];
  /** Pieces under `MIN_WINDOW`, shown as "· 10 min ·", not windows. */
  readonly buffers: readonly TimeRange[];
  /** Named gaps that fall on this day, for their labels. */
  readonly gaps: readonly { readonly range: TimeRange; readonly name: string }[];
  /** Whether no hours have been set, so the defaults are in use (a
   *  banner offers to set them, EC-13). */
  readonly usingDefaults: boolean;
}

/** What's wrong with a range, or null. For whatever saves one: ranges
 *  stored wrong are tolerated on read but never written (EC-01). */
export function rangeError(range: TimeRange): string | null {
  const { start, end } = range;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return "Times must be whole minutes.";
  if (start < 0 || start >= 24 * 60) return "A range must start during the day.";
  if (end <= start) return "A range must end after it starts.";
  if (end > DAY_END_LIMIT) return "A range can run past midnight only until the day rolls over.";
  return null;
}

/** The template version that applies on `date`: the latest one that has
 *  started. Null before any version starts. */
export function versionFor(versions: readonly HoursVersion[], date: string): HoursVersion | null {
  let best: HoursVersion | null = null;
  for (const v of versions) if (v.from <= date && (!best || v.from > best.from)) best = v;
  return best;
}

const length = (r: TimeRange) => r.end - r.start;
const valid = (r: TimeRange) => r.end > r.start;
const byStart = (a: TimeRange, b: TimeRange) => a.start - b.start || a.end - b.end;

/** `ranges` with `cut` taken out of each; a range can split in two. A
 *  cut of no length, or backwards, takes nothing out. */
export function subtract(ranges: readonly TimeRange[], cut: TimeRange): TimeRange[] {
  if (!valid(cut)) return [...ranges];
  const out: TimeRange[] = [];
  for (const r of ranges) {
    if (cut.end <= r.start || cut.start >= r.end) {
      out.push(r);
      continue;
    }
    if (cut.start > r.start) out.push({ start: r.start, end: cut.start });
    if (cut.end < r.end) out.push({ start: cut.end, end: r.end });
  }
  return out;
}

/**
 * Ranges joined where they overlap, in order. Events join where they
 * touch too (EC-09); working ranges that only touch stay two windows,
 * so `joinTouching` is false for them.
 */
export function merge(ranges: readonly TimeRange[], joinTouching = true): TimeRange[] {
  const out: { start: number; end: number }[] = [];
  for (const r of [...ranges].filter(valid).sort(byStart)) {
    const last = out[out.length - 1];
    if (last && (joinTouching ? r.start <= last.end : r.start < last.end)) {
      last.end = Math.max(last.end, r.end);
    } else out.push({ start: r.start, end: r.end });
  }
  return out;
}

/** Windows as `planDay` and `resolvePin` need them: real, in order, and
 *  not overlapping. `dayHours` always returns them so. */
export function normalizeWindows(ranges: readonly TimeRange[]): TimeRange[] {
  return merge(ranges, false);
}

/** One day's edits applied in order. An added window takes its time from
 *  any window it overlaps, which is shortened or split (EC-55); windows
 *  that only touch stay separate. */
export function applyEdits(ranges: readonly TimeRange[], edits: readonly DayEdit[]): TimeRange[] {
  let out = [...ranges];
  const add = (r: TimeRange) => {
    if (!valid(r)) return;
    out = [...subtract(out, r), r];
  };
  for (const e of edits) {
    if (e.kind === "add") add(e.range);
    else if (e.kind === "remove") out = subtract(out, e.range);
    else {
      out = subtract(out, e.from);
      add(e.to);
    }
  }
  return out.filter(valid).sort(byStart);
}

/** The time each event keeps clear, widened by the buffer and merged. */
function blocked(events: readonly TimeRange[], buffer: number): TimeRange[] {
  return merge(events.map((e) => ({ start: e.start - buffer, end: e.end + buffer })));
}

/**
 * The day's windows (ADR-0039 §2; windows-and-pins.md §1).
 *
 * Template ranges, or the day's own, less its named gaps; then its
 * edits; then events with their buffer. What's left under 30 minutes is
 * a buffer, not a window (EC-11). An event that fills a range leaves no
 * window there (EC-10), and one outside working hours leaves the
 * windows alone.
 */
export function dayHours(input: DayHoursInput): DayHours {
  const weekday = isoWeekday(input.date);
  const version = versionFor(input.versions, input.date);
  const usingDefaults = input.versions.length === 0 && input.override == null;

  const template = version
    ? version.schedules
        .filter((s) => s.weekdays.includes(weekday))
        .flatMap((s) => s.ranges)
    : usingDefaults
      ? DEFAULT_RANGES
      : [];
  // Two groups claiming the same weekday, or overlapping ranges, would
  // make overlapping windows: joined into one instead.
  const base = normalizeWindows(input.override ?? template);

  // Named gaps belong to the template; a day with its own hours has
  // none.
  const gaps =
    input.override != null
      ? []
      : (version?.gaps ?? [])
          .filter((g) => g.weekdays.includes(weekday))
          .map((g) => ({ range: g.range, name: g.name }));

  let free: TimeRange[] = [...base];
  for (const g of gaps) free = subtract(free, g.range);
  const edits = input.edits ?? [];
  const working = applyEdits(
    free,
    edits.filter((e) => e.onTheDay !== true),
  );

  let ranges = applyEdits(free, edits);
  const buffer = Math.max(0, input.buffer ?? EVENT_BUFFER);
  for (const b of blocked(input.events ?? [], buffer)) ranges = subtract(ranges, b);

  const sorted = ranges.filter(valid).sort(byStart);
  return {
    working,
    windows: sorted.filter((r) => length(r) >= MIN_WINDOW),
    buffers: sorted.filter((r) => length(r) < MIN_WINDOW),
    gaps,
    usingDefaults,
  };
}

/**
 * What adding a window would leave, once trimmed around the day's
 * events and their buffer (EC-53): the pieces of at least 30 minutes.
 * Empty means there's nothing to save, and the sheet says so.
 */
export function addedWindowPieces(
  range: TimeRange,
  events: readonly TimeRange[],
  buffer: number = EVENT_BUFFER,
): TimeRange[] {
  let pieces: TimeRange[] = [range];
  for (const b of blocked(events, buffer)) pieces = subtract(pieces, b);
  return pieces.filter((r) => length(r) >= MIN_WINDOW);
}

/** Total minutes in a set of ranges, overlaps counted once. */
export function totalMinutes(ranges: readonly TimeRange[]): number {
  return merge(ranges).reduce((a, r) => a + length(r), 0);
}

// ── Now ─────────────────────────────────────────────────────────────

/**
 * Where `hour:minute` on the wall clock falls in the planning day:
 * before the rollover it still belongs to the day before, so 1:30 am is
 * minute 1530 of that day (EC-07).
 */
export function dayMinute(hour: number, minute: number, rolloverHour: number = ROLLOVER_HOUR): number {
  const m = hour * 60 + minute;
  return hour < rolloverHour ? m + 24 * 60 : m;
}

/** Where the day is at minute `now`. */
export type DayPhase =
  | { readonly kind: "noWindows" }
  | { readonly kind: "before"; readonly next: number }
  | { readonly kind: "in"; readonly index: number }
  | { readonly kind: "gap"; readonly next: number }
  | { readonly kind: "after" };

/**
 * Which window is current (windows-and-pins.md §1.3). A window owns its
 * first minute and not its last, so at a boundary the next one is
 * current (EC-06). `next` is the index of the window coming up.
 */
export function dayPhase(windows: readonly TimeRange[], now: number): DayPhase {
  if (windows.length === 0) return { kind: "noWindows" };
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]!;
    if (now < w.start) return i === 0 ? { kind: "before", next: 0 } : { kind: "gap", next: i };
    if (now < w.end) return { kind: "in", index: i };
  }
  return { kind: "after" };
}

/** The current window, or null outside them. */
export function currentWindow(windows: readonly TimeRange[], now: number): TimeRange | null {
  const phase = dayPhase(windows, now);
  return phase.kind === "in" ? (windows[phase.index] ?? null) : null;
}
