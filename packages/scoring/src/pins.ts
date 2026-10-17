/**
 * Pins (ADR-0039 §6 as amended 2026-10-17; docs/design/windows-and-pins.md
 * §2): the options you chose to prioritise in a window.
 *
 * A pin never changes what is due or what a day is worth (ADR-0039 §12).
 * Nothing here reads a point, a weight or a grade.
 *
 * **A pin holds a time in its day**, not a window: the start of the
 * window it was pinned into. Each time the day is drawn it goes to the
 * window containing that time, else the next window that day, else
 * Other open tasks (§2.6). That one rule survives every way a window can
 * change under it: hours edited, an event splitting it (EC-17), a
 * window shortened or removed (EC-16).
 */
import { addDays, weekStart } from "./days";
import { isoWeekday, type Weekday } from "./schedule";
import type { TimeRange } from "./hours";

/**
 * - `window`: holds the task in that window. If the window ends and the
 *   task isn't done, the pin is finished and the task carries forward
 *   like any open task.
 * - `untilDone`: the task stays pinned, and moves with you window to
 *   window and day to day, until it's ticked.
 *
 * Tapping the pin icon cycles not pinned → window → untilDone → not
 * pinned (`nextPinState`).
 */
export type PinKind = "window" | "untilDone";

/** The pin icon's tap cycle (§2.2). */
export function nextPinState(current: PinKind | null): PinKind | null {
  if (current === null) return "window";
  if (current === "window") return "untilDone";
  return null;
}

/**
 * A stored pin: a task held in the window at one time of day, on one
 * date or on chosen weekdays every week (§2.5). Every pin is a pin to a
 * window; there's no pin to a day. Outside the windows a task is pinned
 * to, it isn't pinned (§2.7), though it can still be suggested there.
 */
export interface PinRule {
  readonly id: string;
  readonly taskId: string;
  readonly kind: PinKind;
  /** The time it holds, in minutes from local midnight (§2.6). */
  readonly anchor: number;
  readonly when:
    | {
        readonly repeat: "once";
        readonly date: string;
        /** Pinned after the week's runs were done: an extra run on
         *  purpose, so it shows anyway (§2.8). A fact about one week, so
         *  only a pin for one date can be one. Life tasks only:
         *  commitment work has no week count (ADR-0032 §4). */
        readonly extra?: boolean;
      }
    | {
        readonly repeat: "weekly";
        /** The weekdays it applies: one ("Every Monday"), several, or
         *  all seven ("Every day"). */
        readonly weekdays: ReadonlySet<Weekday>;
        /** First and last day it applies, inclusive; no end until
         *  removed. */
        readonly from: string;
        readonly until: string | null;
        /** Dates it skips: "Just this day" changes and removals, each
         *  saved as an exception plus a pin for that date. */
        readonly exceptDates?: ReadonlySet<string>;
      };
  /** Order inside its window, lower first. */
  readonly order?: number;
}

/** A pin as it applies to one day. */
export type DayPin = {
  readonly ruleId: string;
  readonly taskId: string;
  readonly extra: boolean;
  readonly order: number;
} & (
  | {
      /** A pin made for this day, holding a time in it. */
      readonly carried: false;
      readonly kind: PinKind;
      readonly anchor: number;
    }
  | {
      /** A pin until done carried from an earlier day it wasn't done on
       *  (§2.9). It holds no time: it goes to the first window still to
       *  come. */
      readonly carried: true;
      readonly kind: "untilDone";
    }
);

/** Whether a rule applies on `date` itself. */
export function appliesOn(rule: PinRule, date: string): boolean {
  const w = rule.when;
  if (w.repeat === "once") return w.date === date;
  if (w.exceptDates?.has(date)) return false;
  if (date < w.from || (w.until !== null && date > w.until)) return false;
  return w.weekdays.has(isoWeekday(date));
}

/**
 * The latest date before `date` a rule applied. A pin for one date can
 * be any earlier date; a repeating one looks back a week, since it
 * comes round again within one.
 */
function lastBefore(rule: PinRule, date: string): string | null {
  const w = rule.when;
  if (w.repeat === "once") return w.date < date ? w.date : null;
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, -i);
    if (d < w.from) return null;
    if (appliesOn(rule, d)) return d;
  }
  return null;
}

export interface CarryContext {
  /** The day's open tasks: anything not here carries nothing. */
  readonly open: ReadonlySet<string>;
  /** Each task's latest completion before the day, `YYYY-MM-DD`. */
  readonly lastDone: ReadonlyMap<string, string>;
  /** The one-offs among them. A one-off keeps a pin until done for as
   *  long as it's open; a repeating task's stops at its week's end
   *  (ADR-0039 §8, EC-48), and last week's leftovers don't follow. */
  readonly oneOffs: ReadonlySet<string>;
}

/**
 * The pins for one day (§§2.5–2.9).
 *
 * - Rules that apply on the day.
 * - **Pins until done carried forward:** one that applied on an earlier
 *   day, whose task hasn't been ticked since and is still open today.
 *   A repeating task's carry stops at the end of its week.
 * - **One window per task per day** (§2.7): a pin made for the day
 *   beats a carried one, a pin for that date beats a repeating one,
 *   then the lower `order`. The data layer keeps one live pin per task
 *   per day (re-pinning moves it), so this only settles what shouldn't
 *   arrive.
 */
export function pinsOn(rules: readonly PinRule[], date: string, carry: CarryContext): DayPin[] {
  const best = new Map<string, { pin: DayPin; rank: number }>();
  const offer = (pin: DayPin, rank: number) => {
    const held = best.get(pin.taskId);
    if (!held || rank < held.rank || (rank === held.rank && pin.order < held.pin.order)) {
      best.set(pin.taskId, { pin, rank });
    }
  };
  const week = weekStart(date);

  for (const rule of rules) {
    const once = rule.when.repeat === "once";
    const base = {
      ruleId: rule.id,
      taskId: rule.taskId,
      extra: rule.when.repeat === "once" && rule.when.extra === true,
      order: rule.order ?? 0,
    };
    if (appliesOn(rule, date)) {
      offer({ ...base, carried: false, kind: rule.kind, anchor: rule.anchor }, once ? 0 : 1);
      continue;
    }
    if (rule.kind !== "untilDone" || !carry.open.has(rule.taskId)) continue;
    const from = lastBefore(rule, date);
    if (from === null) continue;
    if (from < week && !carry.oneOffs.has(rule.taskId)) continue;
    const done = carry.lastDone.get(rule.taskId);
    if (done !== undefined && done >= from) continue;
    // An extra run on purpose belongs to its own day, so it isn't carried.
    offer({ ...base, extra: false, carried: true, kind: "untilDone" }, 2);
  }

  return [...best.values()].map((b) => b.pin);
}

/**
 * The window a pin's time lands in (§2.6): the one containing it, else
 * the next one that day, else null (Other open tasks). Indexes into
 * `windows`, which are in order.
 */
export function resolvePin(windows: readonly TimeRange[], anchor: number): number | null {
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]!;
    if (anchor < w.end) return i;
  }
  return null;
}
