/**
 * Filling a day's windows (ADR-0039 §§5–8; docs/design/windows-and-pins.md
 * §§2–3): pins first, then tasks with a clock time, then live
 * suggestions, worked out each time Home or Plan opens and never saved.
 *
 * **Never changes a score** (ADR-0039 §12, §5 of the doc). This module
 * reads no point, weight or grade, so the same day with different pins
 * is the same day to the score (EC-20). **Points never rank a
 * suggestion**: the order is due, carried, goal, part of day, tier, your
 * order, oldest.
 *
 * **Every open task, once** (EC-19): each task in `open` that owes a
 * run and wasn't ticked today lands in exactly one place in the result.
 * An extra-run task (§2.8) shows only while its pin does.
 */
import { normalizeWindows, type TimeRange } from "./hours";
import { resolvePin, type DayPin, type PinKind } from "./pins";
// The same unions and bounds the ADR-0033 windows use; they move here
// when `windows.ts` is retired with the old Home and Plan.
import { PART_OF_DAY_BOUNDS, type PartOfDay, type TaskSize } from "./windows";

/**
 * Hours used for fitting a task into a window (ADR-0039 §4): Quick 0.5,
 * Normal 1, Big 2. A task with no size counts as Normal. Never a price:
 * size doesn't make one task worth more than another (ADR-0026 §2).
 *
 * Replaces `windows.ts`'s `SIZE_HOURS` (0.25 / 0.5 / 1) when Home and
 * Plan are rebuilt.
 */
export const TASK_SIZE_HOURS: Readonly<Record<TaskSize, number>> = {
  quick: 0.5,
  normal: 1,
  big: 2,
};

/** How full a window is filled by suggestions, by default, and the
 *  setting's range (spec §3.4). */
export const DEFAULT_FILL = 0.8;
export const FILL_RANGE = { min: 0.6, max: 1 } as const;
/** Rows a window shows before "Show all" (spec §4.3). Pins always show. */
export const MAX_ROWS = 5;

export const sizeMinutes = (size: TaskSize | null | undefined): number =>
  TASK_SIZE_HOURS[size ?? "normal"] * 60;

/** A unit's tier as a rank: Top 0, Important 1, Background 2. */
export type TierRank = 0 | 1 | 2;

/** A task that could go in a window today. */
export interface OpenTask {
  readonly taskId: string;
  readonly size: TaskSize | null;
  /** Due today: pinned to today, every day, or a one-off due by today. */
  readonly dueToday: boolean;
  /** Carried forward from an earlier window or day (§3.4). */
  readonly carried: boolean;
  /** Linked to an active goal (ADR-0042 §4). */
  readonly goalLinked: boolean;
  /** Its preferred part of the day, if it has one. */
  readonly partOfDay: PartOfDay | null;
  /** Its unit's tier, 0 for Top, 1 Important, 2 Background. A Not now
   *  unit holds no tasks. */
  readonly tierRank: TierRank;
  /** Its place in your order within its unit. */
  readonly unitOrder: number;
  /** When it was made, for "oldest first". */
  readonly createdAt: string;
  /** Its clock time today, in minutes, if it has one (§2.10). */
  readonly clockMinute?: number | null;
  /** Its due date, for "Suggest tasks by: due date" and the due sort. */
  readonly dueDate?: string | null;
  /**
   * Whether the week still owes it a run. False for a task whose runs
   * are done: it shows only for a pin marked extra (§2.8), and otherwise
   * steps aside, as a spare pin does.
   */
  readonly owesRun: boolean;
  /**
   * Planned for a later day: a run pinned to a later weekday, a one-off
   * dated later, or commitment work scheduled later. Never suggested
   * (§3.2), but a pin you made still shows, and it's listed under
   * `plannedAhead` so it can be done early (ADR-0037 §3).
   */
  readonly plannedLater?: boolean;
}

/** A task ticked today, and when. It counts toward its window's room so
 *  a refill only comes when there's room left (§3.3). */
export interface DoneToday {
  readonly taskId: string;
  readonly size: TaskSize | null;
  /** Minute of the day it was ticked. */
  readonly minute: number;
}

export type SuggestOrder = "suggested" | "dueDate" | "priority";

export interface PlanDayInput {
  /** The day's windows (`dayHours`). Put in order and kept from
   *  overlapping here too, since everything below is positional. */
  readonly windows: readonly TimeRange[];
  /** Today: the minute it is now (`dayMinute`). A future day: null, so
   *  no window has ended. */
  readonly now: number | null;
  readonly open: readonly OpenTask[];
  /** The day's pins (`pinsOn`). */
  readonly pins: readonly DayPin[];
  /** Ticked today. A task here is never pinned or suggested again today
   *  (one tick a day, §2.7), even if it's also in `open`. */
  readonly done?: readonly DoneToday[];
  /** How full suggestions fill a window, 0.6–1. */
  readonly fill?: number;
  readonly maxRows?: number;
  /** Settings → "Suggest tasks by" (spec §4.3). */
  readonly suggestBy?: SuggestOrder;
  /** Suggestions swapped away from a window (swipe left), by its start. */
  readonly declined?: ReadonlyMap<number, ReadonlySet<string>>;
  /** "Pull in another" presses for a window, by its start (§3.3). */
  readonly pulledIn?: ReadonlyMap<number, number>;
}

/** Why a suggestion is there: the reason line under it (§3.3). */
export type SuggestionReason = "due" | "carried" | "goal" | "partOfDay" | "fits";

export interface PlacedPin {
  /** The rule behind it, so a screen can move or remove it, or change
   *  one day of a repeating pin. */
  readonly ruleId: string;
  readonly taskId: string;
  readonly kind: PinKind;
  readonly extra: boolean;
  /** A pin until done carried from an earlier window or day. */
  readonly carried: boolean;
}

export interface Suggestion {
  readonly taskId: string;
  readonly reason: SuggestionReason;
}

export interface PlannedWindow {
  readonly range: TimeRange;
  /** Today, it has ended; it shows what was done in it. */
  readonly ended: boolean;
  /** Ticked in this window today. */
  readonly done: readonly string[];
  /** Every pin, always shown (§3.3), in your order. */
  readonly pinned: readonly PlacedPin[];
  /** Tasks whose clock time falls in it. */
  readonly timed: readonly string[];
  /** Suggestions shown, up to the row limit. */
  readonly suggested: readonly Suggestion[];
  /** Suggestions that fit but are under "Show all" (EC-18). */
  readonly showAll: readonly Suggestion[];
  /**
   * Everything shown in it is done and the next task doesn't fit:
   * "That's this window" and "Pull in another" (ADR-0039 §7). Never true
   * while it still shows open work, however many pins it holds, so it
   * can't read as a load warning (ADR-0026 §3, windows-and-pins.md §2.1).
   */
  readonly full: boolean;
}

export interface PlannedDay {
  readonly windows: readonly PlannedWindow[];
  /** Timed tasks no window holds: shown at their time, like an event. */
  readonly atTime: readonly string[];
  /** Pinned tasks with no window left that day (Other open tasks). */
  readonly unplacedPins: readonly PlacedPin[];
  /** Bigger than any window still to come (EC-12). Can still be pinned. */
  readonly doesntFit: readonly string[];
  /** Ranked below what the windows hold: "More for today", and on a day
   *  with no windows left, the one list (§4). */
  readonly later: readonly string[];
  /** Open work planned for a later day and not pinned here, ranked:
   *  listed last, so it can be done early (ADR-0037 §3). */
  readonly plannedAhead: readonly string[];
}

/** Which part of the day a window mostly sits in, by its midpoint. A
 *  late window past midnight is evening. */
export function partOfDayOf(w: TimeRange): PartOfDay {
  const mid = (w.start + w.end) / 2;
  if (mid < PART_OF_DAY_BOUNDS.afternoon.start) return "morning";
  if (mid < PART_OF_DAY_BOUNDS.evening.start) return "afternoon";
  return "evening";
}

/** Minutes of a window suggestions may fill: its length × `fill`,
 *  rounded down to whole minutes so a boundary fit is exact. */
function capacity(w: TimeRange, fill: number): number {
  return Math.floor((w.end - w.start) * fill + 1e-6);
}

/** The ranking (spec §4.3), for one window's part of day. */
function compareFor(window: TimeRange | null, suggestBy: SuggestOrder) {
  const part = window ? partOfDayOf(window) : null;
  const flag = (b: boolean) => (b ? 0 : 1);
  return (a: OpenTask, b: OpenTask): number => {
    if (suggestBy === "dueDate") {
      const da = a.dueDate ?? "9999-99-99";
      const db = b.dueDate ?? "9999-99-99";
      if (da !== db) return da < db ? -1 : 1;
    }
    if (suggestBy === "priority" && a.tierRank !== b.tierRank) return a.tierRank - b.tierRank;
    return (
      flag(a.dueToday) - flag(b.dueToday) ||
      flag(a.carried) - flag(b.carried) ||
      flag(a.goalLinked) - flag(b.goalLinked) ||
      flag(part !== null && a.partOfDay === part) - flag(part !== null && b.partOfDay === part) ||
      a.tierRank - b.tierRank ||
      a.unitOrder - b.unitOrder ||
      (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) ||
      (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0)
    );
  };
}

function reasonFor(task: OpenTask, window: TimeRange): SuggestionReason {
  if (task.dueToday) return "due";
  if (task.carried) return "carried";
  if (task.goalLinked) return "goal";
  if (task.partOfDay !== null && task.partOfDay === partOfDayOf(window)) return "partOfDay";
  return "fits";
}

/** The window holding minute `m`, by index, or null. */
function windowHolding(windows: readonly TimeRange[], m: number): number | null {
  const i = windows.findIndex((w) => w.start <= m && m < w.end);
  return i === -1 ? null : i;
}

/**
 * The day's windows, filled (windows-and-pins.md §§2–3).
 *
 * 1. **Pins** go to the window holding their time (`resolvePin`). Today,
 *    a window pin in a window that has ended is finished: its task
 *    carries forward like any other. A pin until done moves, still
 *    pinned, to the first window still to come (§2.9). A pin with no
 *    window left that day is listed under Other open tasks.
 * 2. **Timed tasks** go in the window holding their time; with none,
 *    they show at their time. One whose window has ended carries
 *    forward like any other.
 * 3. **Suggestions**: in each window still to come, in order, the
 *    ranked tasks that fit the room left (its length × `fill`, less what
 *    is done, pinned and timed there). A task too big for every window
 *    still to come doesn't fit today (EC-12); the rest are "More for
 *    today".
 */
export function planDay(input: PlanDayInput): PlannedDay {
  const windows = normalizeWindows(input.windows);
  const { now } = input;
  const fillSetting = Number.isFinite(input.fill) ? input.fill! : DEFAULT_FILL;
  const fill = Math.min(FILL_RANGE.max, Math.max(FILL_RANGE.min, fillSetting));
  const maxRows = Math.max(1, Math.floor(input.maxRows ?? MAX_ROWS));
  const suggestBy = input.suggestBy ?? "suggested";
  const ended = (w: TimeRange) => now !== null && w.end <= now;
  const firstLive = windows.findIndex((w) => !ended(w));
  const live = firstLive === -1 ? null : firstLive;

  const doneIds = new Set((input.done ?? []).map((d) => d.taskId));
  const byId = new Map(
    input.open.filter((t) => !doneIds.has(t.taskId)).map((t) => [t.taskId, t]),
  );
  const pinnedIds = new Set<string>();
  const carriedHere = new Set<string>();

  const slots = windows.map((range) => ({
    range,
    done: [] as string[],
    usedMinutes: 0,
    pinned: [] as (PlacedPin & { order: number })[],
    timed: [] as string[],
    suggested: [] as Suggestion[],
    pulled: 0,
  }));
  const unplacedPins: PlacedPin[] = [];
  const atTime: string[] = [];

  // Ticked today: they sit where they were done, and use its room.
  for (const d of input.done ?? []) {
    const i = windowHolding(windows, d.minute);
    if (i === null) continue;
    slots[i]!.done.push(d.taskId);
    slots[i]!.usedMinutes += sizeMinutes(d.size);
  }

  // 1. Pins. A task with no run owed shows only for an extra pin (§2.8).
  for (const pin of input.pins) {
    const task = byId.get(pin.taskId);
    if (!task || pinnedIds.has(task.taskId)) continue;
    if (!task.owesRun && !pin.extra) continue;
    let i = pin.carried ? live : resolvePin(windows, pin.anchor);
    let moved = pin.carried;
    if (i !== null && ended(windows[i]!)) {
      if (pin.kind === "window") {
        // The window is over and the pin is finished. The task carries
        // forward like any open task; an extra run, owing nothing, steps
        // aside instead.
        if (task.owesRun) carriedHere.add(task.taskId);
        else pinnedIds.add(task.taskId);
        continue;
      }
      i = live;
      moved = true;
    }
    pinnedIds.add(task.taskId);
    const placed: PlacedPin = {
      ruleId: pin.ruleId,
      taskId: task.taskId,
      kind: pin.kind,
      extra: pin.extra,
      carried: moved,
    };
    if (i === null) {
      unplacedPins.push(placed);
      continue;
    }
    slots[i]!.pinned.push({ ...placed, order: pin.order });
    slots[i]!.usedMinutes += sizeMinutes(task.size);
  }
  for (const slot of slots) slot.pinned.sort((a, b) => a.order - b.order);

  // A task with no run owed and no live extra pin isn't open at all.
  // Work planned for a later day is never suggested (§3.2).
  const unpinned = [...byId.values()].filter((t) => t.owesRun && !pinnedIds.has(t.taskId));
  const candidates = unpinned.filter((t) => t.plannedLater !== true);
  const plannedAhead = unpinned
    .filter((t) => t.plannedLater === true)
    .sort(compareFor(null, suggestBy))
    .map((t) => t.taskId);

  // 2. Timed tasks go at their time; the rest are ranked. A task whose
  // window has ended carries forward, ranked as carried.
  const ranked: OpenTask[] = [];
  for (const task of candidates) {
    const m = task.clockMinute;
    const i = m == null ? null : windowHolding(windows, m);
    if (m != null && i === null) {
      atTime.push(task.taskId);
    } else if (i !== null && !ended(windows[i]!)) {
      slots[i]!.timed.push(task.taskId);
      slots[i]!.usedMinutes += sizeMinutes(task.size);
    } else if (i !== null || carriedHere.has(task.taskId)) {
      ranked.push({ ...task, carried: true });
    } else {
      ranked.push(task);
    }
  }

  // 3. Suggestions, window by window, from the room each has left.
  const remaining = new Map(ranked.map((t) => [t.taskId, t]));
  slots.forEach((slot) => {
    if (ended(slot.range)) return;
    const declined = input.declined?.get(slot.range.start);
    let room = capacity(slot.range, fill) - slot.usedMinutes;
    let pulls = input.pulledIn?.get(slot.range.start) ?? 0;
    const order = [...remaining.values()].sort(compareFor(slot.range, suggestBy));
    for (const task of order) {
      if (declined?.has(task.taskId)) continue;
      const need = sizeMinutes(task.size);
      if (need <= room) {
        room -= need;
      } else if (pulls > 0) {
        // "Pull in another": the next ranked task, past the room.
        pulls -= 1;
        slot.pulled += 1;
      } else {
        continue;
      }
      slot.suggested.push({ taskId: task.taskId, reason: reasonFor(task, slot.range) });
      remaining.delete(task.taskId);
    }
    slot.usedMinutes = capacity(slot.range, fill) - room;
  });

  // What's left: too big for any window still to come, or ranked lower.
  const biggest = Math.max(0, ...windows.filter((w) => !ended(w)).map((w) => capacity(w, fill)));
  const doesntFit: string[] = [];
  const later: string[] = [];
  for (const task of [...remaining.values()].sort(compareFor(null, suggestBy))) {
    if (biggest > 0 && sizeMinutes(task.size) > biggest) doesntFit.push(task.taskId);
    else later.push(task.taskId);
  }

  const planned: PlannedWindow[] = slots.map((slot) => {
    // Pulled-in tasks are shown: pressing "Pull in another" must change
    // what you see.
    const free = Math.max(0, maxRows - slot.pinned.length - slot.timed.length) + slot.pulled;
    const declined = input.declined?.get(slot.range.start);
    const nextSizes = [...remaining.values()]
      .filter((t) => !declined?.has(t.taskId))
      .map((t) => sizeMinutes(t.size));
    const roomLeft = capacity(slot.range, fill) - slot.usedMinutes;
    const showsOpenWork =
      slot.pinned.length > 0 || slot.timed.length > 0 || slot.suggested.length > 0;
    return {
      range: slot.range,
      ended: ended(slot.range),
      done: slot.done,
      pinned: slot.pinned.map(({ order: _order, ...p }) => p),
      timed: slot.timed,
      suggested: slot.suggested.slice(0, free),
      showAll: slot.suggested.slice(free),
      full:
        !ended(slot.range) &&
        !showsOpenWork &&
        nextSizes.length > 0 &&
        Math.min(...nextSizes) > roomLeft,
    };
  });

  return { windows: planned, atTime, unplacedPins, doesntFit, later, plannedAhead };
}

// ── Outside windows (§4) ────────────────────────────────────────────

export type OpenSort = "suggested" | "dueDate" | "size" | "points" | "priority";

/**
 * The one list of open tasks, before, between or after windows, on a
 * day with none, or after Clear today (§4), in the sort you chose.
 * "points" is display only (`points` is today's worth of each): it
 * never orders a suggestion.
 */
export function sortOpenTasks(
  tasks: readonly OpenTask[],
  sort: OpenSort,
  points?: ReadonlyMap<string, number>,
): OpenTask[] {
  const ranked = [...tasks].sort(compareFor(null, "suggested"));
  const rank = new Map(ranked.map((t, i) => [t, i]));
  const keep = (a: OpenTask, b: OpenTask) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
  switch (sort) {
    case "suggested":
      return ranked;
    case "dueDate":
      return [...tasks].sort((a, b) => compareFor(null, "dueDate")(a, b));
    case "size":
      return [...tasks].sort((a, b) => sizeMinutes(a.size) - sizeMinutes(b.size) || keep(a, b));
    case "priority":
      return [...tasks].sort((a, b) => a.tierRank - b.tierRank || keep(a, b));
    case "points":
      return [...tasks].sort(
        (a, b) => (points?.get(b.taskId) ?? 0) - (points?.get(a.taskId) ?? 0) || keep(a, b),
      );
  }
}

// ── Future days (§3.5) ──────────────────────────────────────────────

/**
 * Where a flexible task's runs still owed this week land in the Plan
 * preview: on the days with the most free time, one run a day at most,
 * kept in date order. Display only; it changes nothing that's due.
 */
export function spreadFlexibleRuns(
  runs: number,
  days: readonly { readonly date: string; readonly freeMinutes: number }[],
): string[] {
  return [...days]
    .sort((a, b) => b.freeMinutes - a.freeMinutes || a.date.localeCompare(b.date))
    .slice(0, Math.max(0, runs))
    .map((d) => d.date)
    .sort();
}
