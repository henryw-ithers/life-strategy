/**
 * Home's day as sections you can rearrange (ADR-0048): each window, a
 * part of the day no window touches, or, on a day with no windows,
 * Morning, Afternoon, Evening and Anytime. Then what's done, under the
 * window it was done in. Pure, so it's tested off-device.
 *
 * **Your order is the order** inside a section: the `day_order` you set
 * by dragging, then the order the day was filled in. Points never order
 * anything (ADR-0039 §12).
 */
import {
  PART_OF_DAY_BOUNDS,
  type PartOfDay,
  type PlannedDay,
  type PlannedWindow,
  type SuggestionReason,
  type TimeRange,
} from "@glide/scoring";

import type { WindowState } from "./homeDay";

/** A section of the day. Night (midnight to 5) is the app's own, for
 *  late events and what you drag there; no task is set to it
 *  (ADR-0051). */
export type Part = PartOfDay | "night" | "anytime";

export const PART_LABEL: Record<Part, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
  anytime: "Anytime",
};

const PARTS: readonly PartOfDay[] = ["morning", "afternoon", "evening"];

/** Night in the day's minutes: after midnight, so it follows Evening
 *  whatever hour the day starts. */
export const NIGHT_RANGE: TimeRange = { start: 24 * 60, end: 29 * 60 };

/** An event, or a task at a time, sitting in its part of the day. */
export interface TimedRow {
  readonly taskId: string;
  readonly start: number;
  readonly event: boolean;
}

export interface SectionRow {
  readonly taskId: string;
  /** Why it's here, under its title. */
  readonly reason?: SuggestionReason | "stillOpen";
  /** A suggestion, which can be swapped for the next that fits. */
  readonly swappable: boolean;
}

export type HomeSection =
  | {
      readonly key: string;
      readonly kind: "window";
      /** Its place in the day's windows. */
      readonly index: number;
      readonly window: PlannedWindow;
      readonly rows: readonly SectionRow[];
      /** Suggestions that fit but sit under "Show all" (EC-18). */
      readonly overflow: readonly SectionRow[];
    }
  | {
      readonly key: string;
      readonly kind: "part";
      readonly part: Part;
      /** Its hours, or null for Anytime. */
      readonly range: TimeRange | null;
      /** Its events and timed tasks, by time, above the rows. They
       *  stay at their time, so they aren't dragged. */
      readonly timed: readonly TimedRow[];
      readonly rows: readonly SectionRow[];
    };

export const windowKey = (r: TimeRange) => `w-${r.start}-${r.end}`;
export const partKey = (p: Part) => `p-${p}`;

/** Rows in your order: those with a `day_order` first, by it, then the
 *  rest as the day placed them. Stable. */
export function inYourOrder<T extends { taskId: string }>(
  rows: readonly T[],
  dayOrder: ReadonlyMap<string, number>,
): T[] {
  return rows
    .map((row, i) => ({ row, i, o: dayOrder.get(row.taskId) }))
    .sort((a, b) => {
      if (a.o !== undefined && b.o !== undefined) return a.o - b.o || a.i - b.i;
      if (a.o !== undefined) return -1;
      if (b.o !== undefined) return 1;
      return a.i - b.i;
    })
    .map((x) => x.row);
}

/** The rows a window shows, and those under "Show all". */
export function windowRows(
  w: PlannedWindow,
  dayOrder: ReadonlyMap<string, number>,
): { rows: SectionRow[]; overflow: SectionRow[] } {
  const rows: SectionRow[] = [
    ...w.pinned.map((p) => ({ taskId: p.taskId, reason: p.carried ? ("stillOpen" as const) : undefined, swappable: false })),
    ...w.timed.map((taskId) => ({ taskId, swappable: false })),
    ...w.suggested.map((s) => ({ taskId: s.taskId, reason: s.reason, swappable: true })),
  ];
  return {
    rows: inYourOrder(rows, dayOrder),
    overflow: w.showAll.map((s) => ({ taskId: s.taskId, reason: s.reason, swappable: true })),
  };
}

/** A day's events and timed tasks, for its parts. */
export function timedRows(
  plan: {
    readonly events: readonly { readonly id: string; readonly start: number }[];
    readonly tasks: ReadonlyMap<string, { readonly startMinute: number | null }>;
  },
  planned: Pick<PlannedDay, "atTime">,
): TimedRow[] {
  const tasks = planned.atTime.flatMap((id) => {
    const start = plan.tasks.get(id)?.startMinute ?? null;
    return start === null ? [] : [{ taskId: id, start, event: false }];
  });
  return [...plan.events.map((e) => ({ taskId: e.id, start: e.start, event: true })), ...tasks];
}

/** The part of the day a pin's minute is in, either side of midnight;
 *  midnight itself is a pin to Anytime. */
export function partOfMinute(m: number): Part {
  for (const p of PARTS) {
    const b = PART_OF_DAY_BOUNDS[p];
    if ((m >= b.start && m < b.end) || (m >= b.start + 1440 && m < b.end + 1440)) return p;
  }
  if (m >= NIGHT_RANGE.start && m < NIGHT_RANGE.end) return "night";
  return "anytime";
}

/** The part of the day a time is in, by the clock: midnight to 5 is
 *  Night, on whichever side of the day's start it falls. */
export function partAt(m: number): Part {
  const clock = ((m % 1440) + 1440) % 1440;
  return clock < PART_OF_DAY_BOUNDS.morning.start ? "night" : partOfMinute(clock);
}

/** The time a pin to a part of the day holds: its start, or for
 *  Anytime, midnight, which is in none of them. */
export function anchorOf(part: Part): number {
  if (part === "anytime") return 0;
  return part === "night" ? NIGHT_RANGE.start : PART_OF_DAY_BOUNDS[part].start;
}

export function partRange(part: Part): TimeRange | null {
  if (part === "anytime") return null;
  return part === "night" ? NIGHT_RANGE : PART_OF_DAY_BOUNDS[part];
}

/**
 * The day's sections, earliest first, before "Other open tasks".
 *
 * - With windows: each window, plus a section for each part of the day
 *   no window touches that holds a task kept to it.
 * - With none: Morning, Afternoon, Evening and Anytime, holding the
 *   day's open tasks by where you put them today, else their part of
 *   the day. All four are always there, so each can take a drop. Each
 *   holds its events and timed tasks too (`timed`), by the clock; Night
 *   is there only when it holds something (ADR-0051).
 */
export function homeSections(input: {
  planned: PlannedDay;
  partOf: (taskId: string) => PartOfDay | null;
  dayOrder: ReadonlyMap<string, number>;
  /** The day's events and timed tasks, placed in parts when there are
   *  no windows. */
  timed?: readonly TimedRow[];
}): HomeSection[] {
  const { planned, partOf, dayOrder, timed = [] } = input;
  if (planned.windows.length > 0) {
    const windows: HomeSection[] = planned.windows.map((w, index) => ({
      key: windowKey(w.range),
      kind: "window" as const,
      index,
      window: w,
      ...windowRows(w, dayOrder),
    }));
    const parts: HomeSection[] = PARTS.filter((p) => planned.byPart[p].length > 0).map((p) => ({
      key: partKey(p),
      kind: "part" as const,
      part: p,
      range: PART_OF_DAY_BOUNDS[p],
      timed: [],
      rows: inYourOrder(
        planned.byPart[p].map((taskId) => ({ taskId, reason: "partOfDay" as const, swappable: false })),
        dayOrder,
      ),
    }));
    const start = (s: HomeSection) => (s.kind === "window" ? s.window.range.start : (s.range?.start ?? 0));
    return [...windows, ...parts].sort((a, b) => start(a) - start(b));
  }

  const held: Record<Part, SectionRow[]> = { morning: [], afternoon: [], evening: [], night: [], anytime: [] };
  const pinned = new Set<string>();
  for (const p of planned.unplacedPins) {
    pinned.add(p.taskId);
    held[p.anchor === null ? "anytime" : partOfMinute(p.anchor)].push({ taskId: p.taskId, swappable: false });
  }
  for (const taskId of planned.later) {
    if (pinned.has(taskId)) continue;
    held[partOf(taskId) ?? "anytime"].push({ taskId, swappable: false });
  }
  const at: Record<Part, TimedRow[]> = { morning: [], afternoon: [], evening: [], night: [], anytime: [] };
  for (const row of timed) at[partAt(row.start)].push(row);
  // By the clock, so Night reads from midnight even when the day
  // starts at 3 and a 4am event is the day's first.
  const clock = (m: number) => ((m % 1440) + 1440) % 1440;
  return (["morning", "afternoon", "evening", "night", "anytime"] as const)
    .filter((part) => part !== "night" || held.night.length > 0 || at.night.length > 0)
    .map((part) => ({
      key: partKey(part),
      kind: "part" as const,
      part,
      range: partRange(part),
      timed: [...at[part]].sort((a, b) => clock(a.start) - clock(b.start)),
      rows: inYourOrder(held[part], dayOrder),
    }));
}

/** Today's ticks, under the window each was done in, in the day's
 *  order; ticks in no window last. */
export function doneGroups(input: {
  done: readonly string[];
  doneIn: ReadonlyMap<string, number | null>;
  windows: readonly TimeRange[];
}): { range: TimeRange | null; taskIds: string[] }[] {
  const { done, doneIn, windows } = input;
  const groups = windows.map((range) => ({ range: range as TimeRange | null, taskIds: [] as string[] }));
  const rest: string[] = [];
  for (const id of done) {
    const at = doneIn.get(id) ?? null;
    const i = at === null ? -1 : windows.findIndex((w) => at < w.end);
    if (i === -1) rest.push(id);
    else groups[i]!.taskIds.push(id);
  }
  return [...groups, { range: null, taskIds: rest }].filter((g) => g.taskIds.length > 0);
}

/** What a folded section says. One still to come, how many tasks it
 *  holds; one that's over, only how many were done there, and nothing
 *  while it still holds open rows, so it never counts what wasn't done
 *  (P7, P8). */
export function foldedLabel(section: HomeSection, state: WindowState): string {
  const n = section.rows.length + (section.kind === "window" ? section.overflow.length : section.timed.length);
  if (state === "past") {
    return n === 0 && section.kind === "window" && section.window.done.length > 0
      ? `✓ ${section.window.done.length} done`
      : "";
  }
  return n > 0 ? `${n} ${n === 1 ? "task" : "tasks"}` : "";
}
