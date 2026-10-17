/**
 * Filling a day's windows (ADR-0039 §§5–8, §12;
 * docs/design/windows-and-pins.md §§2–6).
 */
import { describe, expect, it } from "vitest";

import { computeDayLoad, type LoadTask } from "../dayLoad";
import {
  planDay,
  sortOpenTasks,
  spreadFlexibleRuns,
  type OpenTask,
  type PlanDayInput,
  type PlannedDay,
} from "../fill";
import type { TimeRange } from "../hours";
import type { DayPin } from "../pins";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const r = (start: number, end: number): TimeRange => ({ start, end });

let seq = 0;
const task = (taskId: string, over: Partial<OpenTask> = {}): OpenTask => ({
  taskId,
  size: "normal",
  dueToday: false,
  carried: false,
  goalLinked: false,
  partOfDay: null,
  tierRank: 1,
  unitOrder: 0,
  createdAt: `2026-01-${String(++seq % 28 + 1).padStart(2, "0")}`,
  owesRun: true,
  ...over,
});
type HeldPin = Extract<DayPin, { carried: false }>;
const pin = (taskId: string, over: Partial<HeldPin> = {}): DayPin => ({
  ruleId: `pin-${taskId}`,
  taskId,
  kind: "window",
  anchor: h(9),
  extra: false,
  order: 0,
  carried: false,
  ...over,
});
const carriedPin = (taskId: string): DayPin => ({
  ruleId: `pin-${taskId}`,
  taskId,
  kind: "untilDone",
  extra: false,
  order: 0,
  carried: true,
});
const plan = (over: Partial<PlanDayInput>): PlannedDay =>
  planDay({ windows: [], now: null, open: [], pins: [], ...over });

/** Every place a task can land in a planned day. */
function everywhere(day: PlannedDay): string[] {
  return [
    ...day.windows.flatMap((w) => [
      ...w.pinned.map((p) => p.taskId),
      ...w.timed,
      ...w.suggested.map((s) => s.taskId),
      ...w.showAll.map((s) => s.taskId),
    ]),
    ...day.atTime,
    ...day.unplacedPins.map((p) => p.taskId),
    ...day.doesntFit,
    ...day.later,
  ];
}
const suggestedIn = (day: PlannedDay, i: number) =>
  [...(day.windows[i]?.suggested ?? []), ...(day.windows[i]?.showAll ?? [])].map((s) => s.taskId);

describe("suggestions (§3.1)", () => {
  it("ranks due, then carried, then goal, then part of day, tier, your order, oldest", () => {
    const quick = { size: "quick" as const };
    const open = [
      task("oldest", { ...quick, createdAt: "2025-01-01" }),
      task("top", { ...quick, tierRank: 0 }),
      task("evening", { ...quick, partOfDay: "evening" }),
      task("goal", { ...quick, goalLinked: true }),
      task("carried", { ...quick, carried: true }),
      task("due", { ...quick, dueToday: true }),
    ];
    const day = plan({ windows: [r(h(18), h(23))], open, maxRows: 10 });
    expect(suggestedIn(day, 0)).toEqual(["due", "carried", "goal", "evening", "top", "oldest"]);
  });

  it("gives each suggestion its reason", () => {
    const day = plan({
      windows: [r(h(18), h(23))],
      open: [task("a", { dueToday: true }), task("b", { carried: true }), task("c")],
    });
    expect(day.windows[0]?.suggested.map((s) => s.reason)).toEqual(["due", "carried", "fits"]);
  });

  it("fills a window to 80% of its length, and no more", () => {
    // 2 hours at 80% is 96 minutes: one Normal (60) and one Quick (30).
    const day = plan({
      windows: [r(h(9), h(11))],
      open: [task("n1"), task("n2"), task("q", { size: "quick" })],
    });
    expect(suggestedIn(day, 0)).toEqual(["n1", "q"]);
    expect(day.later).toEqual(["n2"]);
    // Not "full": it still shows open work.
    expect(day.windows[0]?.full).toBe(false);
  });

  it("puts each task in the earliest window with room", () => {
    const day = plan({
      windows: [r(h(9), h(10)), r(h(13), h(16))],
      open: [task("n1"), task("q", { size: "quick" }), task("n2")],
    });
    // The first window holds 48 minutes: only the Quick fits there.
    expect(suggestedIn(day, 0)).toEqual(["q"]);
    expect(suggestedIn(day, 1)).toEqual(["n1", "n2"]);
  });

  it("lists a task bigger than every window under Doesn't fit today (EC-12)", () => {
    const day = plan({ windows: [r(h(9), h(10))], open: [task("big", { size: "big" })] });
    expect(day.doesntFit).toEqual(["big"]);
  });

  it("treats a task with no size as Normal", () => {
    const day = plan({ windows: [r(h(9), h(10, 15))], open: [task("x", { size: null })] });
    expect(suggestedIn(day, 0)).toEqual(["x"]);
  });

  it("never uses points: sorting by points is for the list outside windows only", () => {
    const open = [task("a"), task("b")];
    const points = new Map([["b", 50], ["a", 1]]);
    expect(sortOpenTasks(open, "points", points).map((t) => t.taskId)).toEqual(["b", "a"]);
    // planDay takes no points at all, so it can't rank by them.
    expect(suggestedIn(plan({ windows: [r(h(9), h(12))], open }), 0)).toEqual(["a", "b"]);
  });

  it("can put due date or priority first (Suggest tasks by)", () => {
    const open = [task("later", { dueDate: "2026-08-01", dueToday: true }), task("soon", { dueDate: "2026-07-20" })];
    const day = plan({ windows: [r(h(9), h(12))], open, suggestBy: "dueDate" });
    expect(suggestedIn(day, 0)).toEqual(["soon", "later"]);
  });
});

describe("showing them (§3.3)", () => {
  it("shows 5 rows and keeps the rest under Show all, in a stable order (EC-18)", () => {
    const open = Array.from({ length: 40 }, (_, i) => task(`t${i}`, { size: "quick", createdAt: `2026-01-01T${String(i).padStart(2, "0")}` }));
    const windows = [r(h(8), h(23))];
    const day = plan({ windows, open });
    expect(day.windows[0]?.suggested).toHaveLength(5);
    expect(day.windows[0]?.showAll.length).toBeGreaterThan(0);
    expect(plan({ windows, open })).toEqual(day);
  });

  it("always shows every pin, and lets pins fill past a window's length with nothing said", () => {
    const open = Array.from({ length: 7 }, (_, i) => task(`p${i}`, { size: "big" }));
    const pins = open.map((t, i) => pin(t.taskId, { order: i }));
    const day = plan({ windows: [r(h(9), h(10))], open: [...open, task("s", { size: "quick" })], pins });
    expect(day.windows[0]?.pinned).toHaveLength(7);
    // The window is past full, so it takes no suggestions.
    expect(day.windows[0]?.suggested).toEqual([]);
    expect(day.later).toEqual(["s"]);
  });

  it("skips a swapped suggestion in that window and offers the next", () => {
    const windows = [r(h(9), h(10)), r(h(13), h(14))];
    const open = [task("a", { size: "quick" }), task("b", { size: "quick" })];
    const day = plan({ windows, open, maxRows: 1, declined: new Map([[h(9), new Set(["a"])]]) });
    expect(day.windows[0]?.suggested.map((s) => s.taskId)).toEqual(["b"]);
    expect(day.windows[1]?.suggested.map((s) => s.taskId)).toEqual(["a"]);
  });

  it("counts what's done toward the room, then refills when there's room", () => {
    const windows = [r(h(9), h(11))];
    const open = [task("next", { size: "quick" }), task("more")];
    const done = [{ taskId: "d", size: "normal" as const, minute: h(9, 30) }];
    const day = plan({ windows, open, done, now: h(10) });
    expect(day.windows[0]?.done).toEqual(["d"]);
    // 96 minutes of room, 60 used: the Quick fits, the Normal doesn't.
    expect(suggestedIn(day, 0)).toEqual(["next"]);
  });

  it("pulls in another past the room when asked", () => {
    const windows = [r(h(9), h(10))];
    const open = [task("a", { size: "quick" }), task("b", { size: "quick" })];
    expect(suggestedIn(plan({ windows, open }), 0)).toEqual(["a"]);
    expect(suggestedIn(plan({ windows, open, pulledIn: new Map([[h(9), 1]]) }), 0)).toEqual(["a", "b"]);
  });
});

describe("pins (§2)", () => {
  const windows = [r(h(9), h(12)), r(h(13), h(17))];

  it("puts a pin in the window holding its time, ahead of suggestions", () => {
    const day = plan({
      windows,
      open: [task("due", { dueToday: true }), task("mine")],
      pins: [pin("mine", { anchor: h(13) })],
    });
    expect(day.windows[1]?.pinned.map((p) => p.taskId)).toEqual(["mine"]);
    expect(suggestedIn(day, 0)).toEqual(["due"]);
  });

  it("lists a pin with no window left that day under Other open tasks (EC-16)", () => {
    const day = plan({ windows, open: [task("x")], pins: [pin("x", { anchor: h(18) })] });
    expect(day.unplacedPins.map((p) => p.taskId)).toEqual(["x"]);
    expect(day.unplacedPins[0]?.ruleId).toBe("pin-x");
  });

  it("finishes a window pin when its window has ended, and carries the task forward", () => {
    const day = plan({ windows, now: h(14), open: [task("x")], pins: [pin("x", { anchor: h(9) })] });
    expect(day.windows[0]?.pinned).toEqual([]);
    expect(day.windows[1]?.suggested).toEqual([{ taskId: "x", reason: "carried" }]);
  });

  it("moves a pin until done, still pinned, to the next window (§2.9)", () => {
    const day = plan({
      windows,
      now: h(14),
      open: [task("x")],
      pins: [pin("x", { anchor: h(9), kind: "untilDone" })],
    });
    expect(day.windows[1]?.pinned).toEqual([
      { ruleId: "pin-x", taskId: "x", kind: "untilDone", extra: false, carried: true },
    ]);
  });

  it("puts a pin until done carried from an earlier day in the first window to come", () => {
    const day = plan({
      windows,
      now: h(12, 30),
      open: [task("x")],
      pins: [carriedPin("x")],
    });
    expect(day.windows[1]?.pinned[0]?.taskId).toBe("x");
  });

  it("lets a spare pin step aside once the week's runs are done, but shows an extra-run pin (§2.8)", () => {
    const spare = plan({ windows, open: [task("gym", { owesRun: false })], pins: [pin("gym")] });
    expect(everywhere(spare)).toEqual([]);
    const extra = plan({ windows, open: [task("gym", { owesRun: false })], pins: [pin("gym", { extra: true })] });
    expect(extra.windows[0]?.pinned[0]).toEqual(expect.objectContaining({ taskId: "gym", extra: true }));
  });

  it("orders pins in a window by your order", () => {
    const day = plan({
      windows,
      open: [task("a"), task("b")],
      pins: [pin("a", { order: 2 }), pin("b", { order: 1 })],
    });
    expect(day.windows[0]?.pinned.map((p) => p.taskId)).toEqual(["b", "a"]);
  });
});

describe("tasks with a clock time (§2.10)", () => {
  const windows = [r(h(9), h(12)), r(h(13), h(17))];

  it("goes in the window holding its time", () => {
    const day = plan({ windows, open: [task("call", { clockMinute: h(14) })] });
    expect(day.windows[1]?.timed).toEqual(["call"]);
  });

  it("shows at its time when no window holds it", () => {
    const day = plan({ windows, open: [task("call", { clockMinute: h(12, 30) })] });
    expect(day.atTime).toEqual(["call"]);
  });

  it("carries forward like any task once its window has ended", () => {
    const day = plan({ windows, now: h(13), open: [task("call", { clockMinute: h(10) })] });
    expect(day.windows[1]?.suggested).toEqual([{ taskId: "call", reason: "carried" }]);
  });

  it("follows a pin into another window when one was set", () => {
    const day = plan({
      windows,
      open: [task("call", { clockMinute: h(10) })],
      pins: [pin("call", { anchor: h(13) })],
    });
    expect(day.windows[1]?.pinned.map((p) => p.taskId)).toEqual(["call"]);
    expect(day.windows[0]?.timed).toEqual([]);
  });
});

describe("past and future (§§3.4–3.5)", () => {
  const windows = [r(h(9), h(12)), r(h(13), h(17))];

  it("suggests nothing into a window that has ended today", () => {
    const day = plan({ windows, now: h(12, 30), open: [task("a")] });
    expect(day.windows[0]?.suggested).toEqual([]);
    expect(day.windows[0]?.ended).toBe(true);
    expect(suggestedIn(day, 1)).toEqual(["a"]);
  });

  it("lists everything in one list once the last window has ended", () => {
    const day = plan({ windows, now: h(18), open: [task("a"), task("b")] });
    expect(day.later).toEqual(["a", "b"]);
  });

  it("treats every window of a future day as still to come", () => {
    const day = plan({ windows, now: null, open: [task("a")] });
    expect(day.windows.every((w) => !w.ended)).toBe(true);
  });

  it("spreads a flexible task's runs over the days with the most room", () => {
    const days = [
      { date: "2026-07-15", freeMinutes: 60 },
      { date: "2026-07-16", freeMinutes: 300 },
      { date: "2026-07-17", freeMinutes: 200 },
    ];
    expect(spreadFlexibleRuns(2, days)).toEqual(["2026-07-16", "2026-07-17"]);
    expect(spreadFlexibleRuns(0, days)).toEqual([]);
  });
});

describe("every open task, once (§6, EC-19)", () => {
  it("places each open task in exactly one place, whatever the mix", () => {
    const windows = [r(h(9), h(10)), r(h(13), h(15)), r(h(18), h(21))];
    const sizes = ["quick", "normal", "big", null] as const;
    const open = Array.from({ length: 30 }, (_, i) =>
      task(`t${i}`, {
        size: sizes[i % 4],
        dueToday: i % 3 === 0,
        carried: i % 5 === 0,
        clockMinute: i % 7 === 0 ? h(9 + (i % 12)) : null,
      }),
    );
    const pins = [
      pin("t1", { anchor: h(13) }),
      pin("t2", { anchor: h(22) }),
      pin("t4", { kind: "untilDone", anchor: h(9) }),
    ];
    for (const now of [null, h(9, 30), h(14), h(22)]) {
      const placed = everywhere(plan({ windows, now, open, pins }));
      expect([...placed].sort()).toEqual(open.map((t) => t.taskId).sort());
    }
  });
});

describe("filling never touches a score (§5)", () => {
  it("leaves its inputs as they were: suggestions are worked out, never saved", () => {
    const windows = [r(h(9), h(12)), r(h(13), h(17))];
    const open = [task("a"), task("b")];
    const pins = [pin("a", { anchor: h(13) })];
    const before = JSON.stringify({ windows, open, pins });
    plan({ windows, open, pins });
    expect(JSON.stringify({ windows, open, pins })).toBe(before);
  });
  // The full EC-20 check, a day scored with two different sets of pins,
  // needs the day assembled from stored rows: it comes with the data
  // layer (Phase 5, windows-and-pins.md §7). Nothing here reads a point.
});

describe("what the reviews found", () => {
  const windows = [r(h(9), h(12)), r(h(13), h(17))];

  it("never says a window of open pins is full, however many it holds", () => {
    const pins = ["a", "b", "c"].map((id, i) => pin(id, { order: i }));
    const day = plan({
      windows: [r(h(9), h(10))],
      now: h(9),
      open: ["a", "b", "c", "d"].map((id) => task(id, { size: "big" })),
      pins,
    });
    expect(day.windows[0]?.full).toBe(false);
  });

  it("says a window is full only when what it shows is done and the next doesn't fit", () => {
    const done = [{ taskId: "d", size: "normal" as const, minute: h(9, 10) }];
    const full = plan({ windows: [r(h(9), h(10, 30))], now: h(10), open: [task("n")], done });
    expect(full.windows[0]?.full).toBe(true);
    const nothingLeft = plan({ windows: [r(h(9), h(12))], now: h(10), open: [] });
    expect(nothingLeft.windows[0]?.full).toBe(false);
  });

  it("never pins or suggests a task already ticked today (§2.7)", () => {
    const done = [{ taskId: "gym", size: "normal" as const, minute: h(9, 30) }];
    const day = plan({ windows, now: h(10), open: [task("gym")], pins: [pin("gym", { anchor: h(13) })], done });
    expect(day.windows[0]?.done).toEqual(["gym"]);
    expect(everywhere(day)).toEqual([]);
  });

  it("lets an extra-run task step aside once its window pin is finished", () => {
    const day = plan({
      windows,
      now: h(14),
      open: [task("gym", { owesRun: false })],
      pins: [pin("gym", { anchor: h(9), extra: true })],
    });
    expect(everywhere(day)).toEqual([]);
  });

  it("puts windows in order and joins overlaps before filling", () => {
    const day = plan({ windows: [r(h(13), h(14)), r(h(9), h(10)), r(h(9, 30), h(11))], open: [] });
    expect(day.windows.map((w) => w.range)).toEqual([r(h(9), h(11)), r(h(13), h(14))]);
  });

  it("shows a pulled-in task, not just files it under Show all", () => {
    const open = [task("a", { size: "quick" }), task("b", { size: "quick" })];
    const day = plan({ windows: [r(h(9), h(10))], open, maxRows: 1, pulledIn: new Map([[h(9), 1]]) });
    expect(day.windows[0]?.suggested.map((s) => s.taskId)).toEqual(["a", "b"]);
  });

  it("keeps the fill setting in its range", () => {
    // 0 would empty every window; it's held at 60%.
    const day = plan({ windows: [r(h(9), h(10))], open: [task("q", { size: "quick" })], fill: 0 });
    expect(suggestedIn(day, 0)).toEqual(["q"]);
  });
});

describe("the list outside windows (§4)", () => {
  const open = [
    task("big", { size: "big", tierRank: 2, dueDate: "2026-07-20" }),
    task("quick", { size: "quick", tierRank: 1 }),
    task("top", { tierRank: 0, dueDate: "2026-07-16" }),
  ];

  it("sorts by size, priority or due date", () => {
    expect(sortOpenTasks(open, "size").map((t) => t.taskId)).toEqual(["quick", "top", "big"]);
    expect(sortOpenTasks(open, "priority").map((t) => t.taskId)).toEqual(["top", "quick", "big"]);
    expect(sortOpenTasks(open, "dueDate").map((t) => t.taskId)).toEqual(["top", "big", "quick"]);
  });
});
