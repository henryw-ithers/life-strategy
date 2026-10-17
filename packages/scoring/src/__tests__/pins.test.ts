/**
 * Pins (ADR-0039 §6 as amended 2026-10-17;
 * docs/design/windows-and-pins.md §2).
 */
import { describe, expect, it } from "vitest";

import { dayHours, type TimeRange } from "../hours";
import {
  appliesOn,
  nextPinState,
  pinsOn,
  resolvePin,
  type CarryContext,
  type PinRule,
} from "../pins";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const r = (start: number, end: number): TimeRange => ({ start, end });

const MON = "2026-07-13";
const TUE = "2026-07-14";
const WED = "2026-07-15";
const FRI = "2026-07-17";
const NEXT_MON = "2026-07-20";

const once = (date: string, extra?: boolean): PinRule["when"] => ({ repeat: "once", date, extra });
type Day = 1 | 2 | 3 | 4 | 5 | 6 | 7;
const weekly = (days: Day | Day[], from: string, until: string | null = null, exceptDates?: ReadonlySet<string>): PinRule["when"] => ({
  repeat: "weekly",
  weekdays: new Set(Array.isArray(days) ? days : [days]),
  from,
  until,
  exceptDates,
});
const pin = (over: Partial<PinRule> & Pick<PinRule, "id" | "taskId" | "when">): PinRule => ({
  kind: "window",
  anchor: h(9),
  ...over,
});
const carry = (open: string[] = [], lastDone: [string, string][] = [], oneOffs: string[] = []): CarryContext => ({
  open: new Set(open),
  lastDone: new Map(lastDone),
  oneOffs: new Set(oneOffs),
});

describe("the pin icon's cycle (§2.2)", () => {
  it("goes not pinned → window → until done → not pinned", () => {
    expect(nextPinState(null)).toBe("window");
    expect(nextPinState("window")).toBe("untilDone");
    expect(nextPinState("untilDone")).toBeNull();
  });
});

describe("which days a pin applies (§§2.4–2.5)", () => {
  it("applies a one-day pin on its day only", () => {
    const p = pin({ id: "p", taskId: "t", when: once(TUE) });
    expect(appliesOn(p, TUE)).toBe(true);
    expect(appliesOn(p, WED)).toBe(false);
  });

  it("repeats on its weekday from its first day, until its last, minus exceptions", () => {
    const p = pin({ id: "p", taskId: "gym", when: weekly(1, MON, "2026-07-27", new Set([NEXT_MON])) });
    expect(appliesOn(p, MON)).toBe(true);
    expect(appliesOn(p, TUE)).toBe(false);
    expect(appliesOn(p, NEXT_MON)).toBe(false);
    expect(appliesOn(p, "2026-07-27")).toBe(true);
    expect(appliesOn(p, "2026-08-03")).toBe(false);
    expect(appliesOn(p, "2026-07-06")).toBe(false);
  });
});

describe("a pin on several weekdays (§2.5)", () => {
  it("applies on each chosen weekday, and every day when all seven are chosen", () => {
    const weekdaysOnly = pin({ id: "p", taskId: "t", when: weekly([1, 2, 3, 4, 5], MON) });
    expect(appliesOn(weekdaysOnly, WED)).toBe(true);
    expect(appliesOn(weekdaysOnly, "2026-07-18")).toBe(false);
    const everyDay = pin({ id: "p", taskId: "t", when: weekly([1, 2, 3, 4, 5, 6, 7], MON) });
    expect(appliesOn(everyDay, "2026-07-18")).toBe(true);
  });

  it("holds the task in its one window each day and pins it nowhere else (§2.7)", () => {
    const rules = [pin({ id: "p", taskId: "read", when: weekly([1, 2, 3, 4, 5, 6, 7], MON), anchor: h(20) })];
    const pins = pinsOn(rules, WED, carry(["read"]));
    expect(pins).toEqual([expect.objectContaining({ taskId: "read", carried: false, anchor: h(20) })]);
  });
});

describe("pinsOn (§§2.5–2.9)", () => {
  it("lets a pin for the day beat a repeating one for the same task (one window a day, §2.7)", () => {
    const rules = [
      pin({ id: "every", taskId: "gym", when: weekly(1, MON), anchor: h(18) }),
      pin({ id: "once", taskId: "gym", when: once(MON), anchor: h(13) }),
    ];
    const pins = pinsOn(rules, MON, carry());
    expect(pins).toHaveLength(1);
    expect(pins[0]?.ruleId).toBe("once");
  });

  it("carries a pin until done forward until the task is ticked (§2.9)", () => {
    const rules = [pin({ id: "p", taskId: "essay", kind: "untilDone", when: once(MON) })];
    expect(pinsOn(rules, WED, carry(["essay"]))).toEqual([
      expect.objectContaining({ taskId: "essay", carried: true, kind: "untilDone" }),
    ]);
    // Ticked on Tuesday: Wednesday has nothing to carry.
    expect(pinsOn(rules, WED, carry(["essay"], [["essay", TUE]]))).toEqual([]);
  });

  it("doesn't carry a window pin, or a task that's no longer open", () => {
    expect(pinsOn([pin({ id: "p", taskId: "a", when: once(MON) })], TUE, carry(["a"]))).toEqual([]);
    const untilDone = [pin({ id: "p", taskId: "a", kind: "untilDone", when: once(MON) })];
    expect(pinsOn(untilDone, TUE, carry())).toEqual([]);
  });

  it("stops a repeating task's carry at the end of its week (EC-48)", () => {
    // Pinned until done on Friday, not done: next Monday it doesn't
    // follow, even though Gym owes a run again in the new week.
    const rules = [pin({ id: "p", taskId: "gym", kind: "untilDone", when: once(FRI) })];
    expect(pinsOn(rules, NEXT_MON, carry(["gym"]))).toEqual([]);
    expect(pinsOn(rules, "2026-07-18", carry(["gym"]))[0]?.carried).toBe(true);
  });

  it("keeps carrying a one-off's pin until done across weeks", () => {
    const rules = [pin({ id: "p", taskId: "form", kind: "untilDone", when: once(FRI) })];
    expect(pinsOn(rules, NEXT_MON, carry(["form"], [], ["form"]))[0]?.carried).toBe(true);
  });

  it("carries a repeating pin until done from its last day this week", () => {
    const rules = [pin({ id: "p", taskId: "gym", kind: "untilDone", when: weekly(1, MON) })];
    expect(pinsOn(rules, WED, carry(["gym"]))[0]?.carried).toBe(true);
  });

  it("marks an extra-run pin, and never carries one (§2.8)", () => {
    const rules = [pin({ id: "p", taskId: "gym", kind: "untilDone", when: once(MON, true) })];
    expect(pinsOn(rules, MON, carry())[0]?.extra).toBe(true);
    expect(pinsOn(rules, TUE, carry(["gym"]))[0]?.extra).toBe(false);
  });
});

describe("resolvePin: what a pin holds on to (§2.6)", () => {
  const windows = [r(h(9), h(12)), r(h(13), h(17))];

  it("goes to the window holding its time", () => {
    expect(resolvePin(windows, h(10))).toBe(0);
    expect(resolvePin(windows, h(13))).toBe(1);
  });

  it("goes to the next window when its time is in a gap", () => {
    expect(resolvePin(windows, h(12, 30))).toBe(1);
    expect(resolvePin(windows, h(7))).toBe(0);
  });

  it("goes to Other open tasks when no window is left that day (EC-16)", () => {
    expect(resolvePin(windows, h(18))).toBeNull();
    expect(resolvePin([], h(9))).toBeNull();
  });

  it("stays in the piece holding its time when an event splits the window (EC-17)", () => {
    const split = dayHours({
      date: WED,
      versions: [],
      override: [r(h(9), h(17))],
      events: [r(h(12), h(13))],
    }).windows;
    expect(split).toEqual([r(h(9), h(11, 50)), r(h(13, 10), h(17))]);
    expect(resolvePin(split, h(9))).toBe(0);
    // A pin whose time the event now covers goes to the next piece.
    expect(resolvePin(split, h(12, 30))).toBe(1);
  });
});
