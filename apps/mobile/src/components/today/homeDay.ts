/**
 * Home's day, in words and states (spec §5.1): which window is open,
 * what the day says before, between and after windows, how long the
 * open one has left, what a closed one says, when the evening card
 * comes, and when the weekly pass is offered. Pure, so it's tested
 * off-device.
 *
 * **Nothing here counts what wasn't done**: a past window says how
 * many were done, or only its times (P7, P8).
 */
import {
  addDays,
  formatMinutes,
  isoWeekday,
  weekStart,
  type PlannedWindow,
  type TimeRange,
} from "@glide/scoring";

/** Where a window is in the day. */
export type WindowState = "past" | "open" | "later";

/**
 * The window that starts open: the one you're in, or else the next one
 * (before the first window, or in a gap). Null after the last, on a day
 * with none, or on a day that isn't today (`now` null opens the first).
 */
export function openIndex(windows: readonly TimeRange[], now: number | null): number | null {
  if (windows.length === 0) return null;
  if (now === null) return 0;
  const i = windows.findIndex((w) => now < w.end);
  return i === -1 ? null : i;
}

export function windowState(index: number, open: number | null, windows: readonly TimeRange[], now: number | null): WindowState {
  if (index === open) return "open";
  if (now !== null && windows[index]!.end <= now) return "past";
  return "later";
}

/**
 * The line above the windows (spec §5.1's table): "First window at
 * 08:30" before the first, "Lunch until 13:00" in a named gap, "Next
 * window at 13:00" in another gap. Null in a window, after the last,
 * and on a day with none.
 */
export function situationLine(
  windows: readonly TimeRange[],
  gaps: readonly { range: TimeRange; name: string }[],
  now: number | null,
): string | null {
  if (now === null || windows.length === 0) return null;
  const next = windows.find((w) => now < w.end);
  if (!next || now >= next.start) return null;
  if (next === windows[0]) return `First window at ${formatMinutes(next.start)}`;
  const gap = gaps.find((g) => g.range.start <= now && now < g.range.end);
  if (gap) return `${gap.name} until ${formatMinutes(gap.range.end)}`;
  return `Next window at ${formatMinutes(next.start)}`;
}

/** "2 h 40 left", "35 min left": the open window's time to its end, in
 *  plain words. Before it starts, "Starts at 13:00". */
export function timeLeft(w: TimeRange, now: number): string {
  if (now < w.start) return `Starts at ${formatMinutes(w.start)}`;
  const m = Math.max(0, w.end - now);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min left`;
  return rest === 0 ? `${h} h left` : `${h} h ${rest} left`;
}

/** What a closed window says: a past one how many were done (or
 *  nothing), a later one how many tasks it holds. */
export function closedLabel(w: PlannedWindow, state: WindowState): string {
  if (state === "past") return w.done.length > 0 ? `✓ ${w.done.length} done` : "";
  const n = w.pinned.length + w.timed.length + w.suggested.length;
  return n === 0 ? "" : `${n} ${n === 1 ? "task" : "tasks"}`;
}

/** The evening card's default start (spec §5.1): an hour before the
 *  last window ends, or 6 pm on a day with none. */
export const EVENING_DEFAULT = 18 * 60;

export function eveningFrom(windows: readonly TimeRange[]): number {
  const last = windows[windows.length - 1];
  return last ? last.end - 60 : EVENING_DEFAULT;
}

/**
 * Whether Home offers the weekly pass (ADR-0039 §11, spec §5.1): from
 * Sunday 6 pm, the week's first evening (weeks run Sunday to Saturday,
 * ADR-0004 §1), until Monday's first window starts. Not now hides it
 * for the week, and nothing mentions a skipped pass (P15).
 */
export const PASS_FROM = 18 * 60;

export function passCardDue(input: {
  today: string;
  now: number;
  /** Monday's first window, if Monday has one. */
  mondayFirst: number | null;
  /** The week Not now was pressed in, by its Sunday. */
  hiddenWeek: string | null;
}): boolean {
  const { today, now, mondayFirst, hiddenWeek } = input;
  if (hiddenWeek === weekStart(today)) return false;
  const day = isoWeekday(today);
  if (day === 7) return now >= PASS_FROM;
  if (day === 1 && addDays(today, -1) === weekStart(today)) {
    return mondayFirst === null || now < mondayFirst;
  }
  return false;
}
