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

export type Part = PartOfDay | "anytime";

export const PART_LABEL: Record<Part, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  anytime: "Anytime",
};

const PARTS: readonly PartOfDay[] = ["morning", "afternoon", "evening"];

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

/** The part of the day a minute is in, either side of midnight; outside
 *  them all (as a pin to Anytime is), Anytime. */
export function partOfMinute(m: number): Part {
  for (const p of PARTS) {
    const b = PART_OF_DAY_BOUNDS[p];
    if ((m >= b.start && m < b.end) || (m >= b.start + 1440 && m < b.end + 1440)) return p;
  }
  return "anytime";
}

/** The time a pin to a part of the day holds: its start, or for
 *  Anytime, midnight, which is in none of them. */
export function anchorOf(part: Part): number {
  return part === "anytime" ? 0 : PART_OF_DAY_BOUNDS[part].start;
}

export function partRange(part: Part): TimeRange | null {
  return part === "anytime" ? null : PART_OF_DAY_BOUNDS[part];
}

/**
 * The day's sections, earliest first, before "Other open tasks".
 *
 * - With windows: each window, plus a section for each part of the day
 *   no window touches that holds a task kept to it.
 * - With none: Morning, Afternoon, Evening and Anytime, holding the
 *   day's open tasks by where you put them today, else their part of
 *   the day. All four are always there, so each can take a drop.
 */
export function homeSections(input: {
  planned: PlannedDay;
  partOf: (taskId: string) => PartOfDay | null;
  dayOrder: ReadonlyMap<string, number>;
}): HomeSection[] {
  const { planned, partOf, dayOrder } = input;
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
      rows: inYourOrder(
        planned.byPart[p].map((taskId) => ({ taskId, reason: "partOfDay" as const, swappable: false })),
        dayOrder,
      ),
    }));
    const start = (s: HomeSection) => (s.kind === "window" ? s.window.range.start : (s.range?.start ?? 0));
    return [...windows, ...parts].sort((a, b) => start(a) - start(b));
  }

  const held: Record<Part, SectionRow[]> = { morning: [], afternoon: [], evening: [], anytime: [] };
  const pinned = new Set<string>();
  for (const p of planned.unplacedPins) {
    pinned.add(p.taskId);
    held[p.anchor === null ? "anytime" : partOfMinute(p.anchor)].push({ taskId: p.taskId, swappable: false });
  }
  for (const taskId of planned.later) {
    if (pinned.has(taskId)) continue;
    held[partOf(taskId) ?? "anytime"].push({ taskId, swappable: false });
  }
  return (["morning", "afternoon", "evening", "anytime"] as const).map((part) => ({
    key: partKey(part),
    kind: "part" as const,
    part,
    range: partRange(part),
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
