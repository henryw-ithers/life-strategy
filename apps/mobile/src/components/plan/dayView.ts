/**
 * The Plan day view's arithmetic and words (spec §5.3): the day as one
 * list in time order, how much each window holds, and the lines under
 * a suggestion. Pure, so it's tested off-device.
 *
 * **No load warnings** (P3, ADR-0026 §3): how full a window is reads as
 * a plain amount, the same at any level.
 */
import {
  addDays,
  formatMinutes,
  sizeMinutes,
  weekStart,
  type PlannedWindow,
  type SuggestionReason,
  type DayHours,
  type TimeRange,
} from "@glide/scoring";

import type { PlanEvent } from "../../db/dayPlan";

export type TimelineItem =
  | { readonly kind: "window"; readonly index: number; readonly range: TimeRange }
  | { readonly kind: "event"; readonly event: PlanEvent }
  | { readonly kind: "gap"; readonly range: TimeRange; readonly name: string }
  | { readonly kind: "buffer"; readonly range: TimeRange };

/** Windows, events, named gaps and buffers, earliest first. At one
 *  time an event comes before a window, so a class is read before the
 *  time after it. */
export function timeline(
  hours: Pick<DayHours, "windows" | "gaps" | "buffers">,
  events: readonly PlanEvent[],
): TimelineItem[] {
  const rank = { event: 0, gap: 1, buffer: 2, window: 3 } as const;
  const items: TimelineItem[] = [
    ...hours.windows.map((range, index) => ({ kind: "window" as const, index, range })),
    ...events.map((event) => ({ kind: "event" as const, event })),
    ...hours.gaps.map((g) => ({ kind: "gap" as const, range: g.range, name: g.name })),
    ...hours.buffers.map((range) => ({ kind: "buffer" as const, range })),
  ];
  const start = (i: TimelineItem) => (i.kind === "event" ? i.event.start : i.range.start);
  return items.sort((a, b) => start(a) - start(b) || rank[a.kind] - rank[b.kind]);
}

/** "09:00–10:30". */
export const spanLabel = (r: TimeRange): string => `${formatMinutes(r.start)}–${formatMinutes(r.end)}`;

/** "09:00 to 10:30", for VoiceOver. */
export const spokenSpan = (r: TimeRange): string => `${formatMinutes(r.start)} to ${formatMinutes(r.end)}`;

/** Hours to one decimal place, without a trailing ".0": "1.5", "2". */
export function hoursLabel(minutes: number): string {
  const h = Math.round((Math.max(0, minutes) / 60) * 10) / 10;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

/** Minutes of work a window holds: done, pinned, timed and suggested,
 *  each by its size (an unsized task counts as Normal). */
export function plannedMinutes(
  w: PlannedWindow,
  sizeOf: (taskId: string) => "quick" | "normal" | "big" | null,
): number {
  const ids = [
    ...w.done,
    ...w.pinned.map((p) => p.taskId),
    ...w.timed,
    ...w.suggested.map((s) => s.taskId),
  ];
  return ids.reduce((sum, id) => sum + sizeMinutes(sizeOf(id)), 0);
}

/** "1.5 of 2.3 h": what's in a window, out of its length. */
export function fillLabel(planned: number, w: TimeRange): string {
  return `${hoursLabel(planned)} of ${hoursLabel(w.end - w.start)} h`;
}

/** "Wednesday · 3 windows · about 6 h free". Free time rounds to the
 *  half hour: the sizes it's set against are rough. */
export function dayHeading(date: string, windows: number, freeMinutes: number): string {
  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString("en-AU", { weekday: "long" });
  if (windows === 0) return `${weekday} · no windows`;
  const half = Math.round(freeMinutes / 30) / 2;
  const free = Number.isInteger(half) ? String(half) : half.toFixed(1);
  return `${weekday} · ${windows} ${windows === 1 ? "window" : "windows"} · about ${free} h free`;
}

/** "Week of 18 Oct", by the week's Sunday (ADR-0004 §1). */
export function weekLabel(date: string): string {
  const first = new Date(`${weekStart(date)}T12:00:00`);
  return `Week of ${first.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
}

/** The seven dates of the week holding `date`, Sunday first. */
export function weekDates(date: string): string[] {
  const first = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

/** The line under a suggestion (windows-and-pins §3.3). Never "late",
 *  "overdue" or "missed": carried work is "Still open". */
export function reasonLabel(reason: SuggestionReason): string {
  switch (reason) {
    case "due":
      return "Due today";
    case "carried":
      return "Still open";
    case "goal":
      return "For your goal";
    case "partOfDay":
      return "Fits this time of day";
    case "fits":
      return "Fits here";
  }
}

/**
 * What "Add from open" offers a window: every open task the day lists
 * that isn't already pinned, timed or done in it, in the order the day
 * ranks them. Pinning one moves it here (one window per task per day).
 */
export function addableTo(
  index: number,
  day: {
    readonly windows: readonly PlannedWindow[];
    readonly later: readonly string[];
    readonly doesntFit: readonly string[];
    readonly plannedAhead: readonly string[];
    readonly unplacedPins: readonly { readonly taskId: string }[];
  },
): string[] {
  const here = day.windows[index];
  const taken = new Set([
    ...(here?.pinned.map((p) => p.taskId) ?? []),
    ...(here?.timed ?? []),
    ...(here?.done ?? []),
  ]);
  const out: string[] = [];
  const add = (id: string) => {
    if (!taken.has(id) && !out.includes(id)) out.push(id);
  };
  // Suggested here first: pinning one keeps it.
  here?.suggested.forEach((s) => add(s.taskId));
  here?.showAll.forEach((s) => add(s.taskId));
  day.windows.forEach((w, i) => {
    if (i === index || w.ended) return;
    w.suggested.forEach((s) => add(s.taskId));
    w.showAll.forEach((s) => add(s.taskId));
    w.pinned.forEach((p) => add(p.taskId));
  });
  day.unplacedPins.forEach((p) => add(p.taskId));
  day.later.forEach(add);
  day.doesntFit.forEach(add);
  day.plannedAhead.forEach(add);
  return out;
}
