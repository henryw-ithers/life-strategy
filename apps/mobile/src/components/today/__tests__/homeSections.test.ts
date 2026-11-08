/**
 * Home's sections (ADR-0048): your order inside each, the four parts
 * of a day with no windows, and ticks filed under their window.
 */
import { planDay, type OpenTask, type PlanDayInput } from "@glide/scoring";
import { describe, expect, it } from "vitest";

import {
  anchorOf,
  doneGroups,
  foldedLabel,
  homeSections,
  inYourOrder,
  notOnToday,
  notOnTodayGroup,
  partOfMinute,
  windowKey,
} from "../homeSections";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const task = (taskId: string, over: Partial<OpenTask> = {}): OpenTask => ({
  taskId,
  size: "quick",
  dueToday: false,
  carried: false,
  partOfDay: null,
  tierRank: 1,
  unitOrder: 0,
  createdAt: "2026-01-01",
  owesRun: true,
  ...over,
});
const plan = (over: Partial<PlanDayInput>) => planDay({ windows: [], now: null, open: [], pins: [], ...over });
const ids = (rows: readonly { taskId: string }[]) => rows.map((r) => r.taskId);

describe("your order", () => {
  it("puts rows you've ordered first, by your order, and keeps the rest as placed", () => {
    const rows = ["a", "b", "c", "d"].map((taskId) => ({ taskId }));
    expect(ids(inYourOrder(rows, new Map([["c", 1], ["a", 2]])))).toEqual(["c", "a", "b", "d"]);
  });

  it("orders a window's rows by it", () => {
    const planned = plan({ windows: [{ start: h(9), end: h(12) }], open: [task("a"), task("b")] });
    const [s] = homeSections({ planned, partOf: () => null, dayOrder: new Map([["b", 1]]) });
    expect(s?.kind === "window" && ids(s.rows)).toEqual(["b", "a"]);
    expect(s?.key).toBe(windowKey({ start: h(9), end: h(12) }));
  });
});

describe("a day with no windows", () => {
  it("always has Morning, Afternoon, Evening and Anytime, holding tasks by their part of the day", () => {
    const planned = plan({ open: [task("run", { partOfDay: "morning" }), task("read")] });
    const sections = homeSections({
      planned,
      partOf: (id) => (id === "run" ? "morning" : null),
      dayOrder: new Map(),
    });
    expect(sections.map((s) => s.key)).toEqual(["p-morning", "p-afternoon", "p-evening", "p-anytime"]);
    expect(ids(sections[0]!.rows)).toEqual(["run"]);
    expect(ids(sections[3]!.rows)).toEqual(["read"]);
  });

  it("puts a task where you moved it today, over its usual part of the day", () => {
    const planned = plan({
      open: [task("run", { partOfDay: "morning" })],
      pins: [{ ruleId: "p", taskId: "run", kind: "window", anchor: anchorOf("evening"), extra: false, order: 0, carried: false }],
    });
    const sections = homeSections({ planned, partOf: () => "morning", dayOrder: new Map() });
    expect(ids(sections[0]!.rows)).toEqual([]);
    expect(ids(sections[2]!.rows)).toEqual(["run"]);
  });

  it("reads midnight as Anytime, and a late morning past midnight as morning", () => {
    expect(partOfMinute(anchorOf("anytime"))).toBe("anytime");
    expect(partOfMinute(h(33))).toBe("morning");
  });
});

describe("events and Night (ADR-0051)", () => {
  const sectionsWith = (timed: { taskId: string; start: number }[], pins: PlanDayInput["pins"] = []) =>
    homeSections({
      planned: plan({ open: [task("read")], pins }),
      partOf: () => null,
      dayOrder: new Map(),
      timed: timed.map((t) => ({ ...t, event: true })),
    });
  const timedIn = (sections: ReturnType<typeof homeSections>, key: string) => {
    const s = sections.find((x) => x.key === key);
    return s?.kind === "part" ? ids(s.timed) : null;
  };

  it("puts events in their part by the clock, evening running to midnight", () => {
    const sections = sectionsWith([
      { taskId: "class", start: h(9) },
      { taskId: "late", start: h(23, 30) },
    ]);
    expect(timedIn(sections, "p-morning")).toEqual(["class"]);
    expect(timedIn(sections, "p-evening")).toEqual(["late"]);
  });

  it("puts 1am and 4am in Night, after Evening, by the clock", () => {
    // 1am after midnight is minute 25:00 of the day; 4am, with the day
    // starting at 3, is 04:00 of the day itself.
    const sections = sectionsWith([
      { taskId: "four", start: h(4) },
      { taskId: "one", start: h(25) },
    ]);
    expect(sections.map((s) => s.key)).toEqual(["p-morning", "p-afternoon", "p-evening", "p-night", "p-anytime"]);
    expect(timedIn(sections, "p-night")).toEqual(["one", "four"]);
  });

  it("shows Night only when it holds something", () => {
    expect(sectionsWith([]).map((s) => s.key)).not.toContain("p-night");
  });

  it("holds a task dragged to Night", () => {
    const sections = sectionsWith(
      [],
      [{ ruleId: "p", taskId: "read", kind: "window", anchor: anchorOf("night"), extra: false, order: 0, carried: false }],
    );
    const night = sections.find((s) => s.key === "p-night");
    expect(night && ids(night.rows)).toEqual(["read"]);
    expect(partOfMinute(anchorOf("night"))).toBe("night");
  });

  it("never has a window section", () => {
    expect(sectionsWith([{ taskId: "class", start: h(9) }]).every((s) => s.kind === "part")).toBe(true);
  });
});

describe("a part of the day with no window", () => {
  it("gets its own section, in time order with the windows", () => {
    const planned = plan({ windows: [{ start: h(13), end: h(17) }], open: [task("run", { partOfDay: "morning" })] });
    const sections = homeSections({ planned, partOf: () => "morning", dayOrder: new Map() });
    expect(sections.map((s) => s.key)).toEqual(["p-morning", windowKey({ start: h(13), end: h(17) })]);
  });
});

describe("what's done", () => {
  it("is filed under the window it was done in, whatever time it was ticked", () => {
    const windows = [{ start: h(9), end: h(12) }, { start: h(13), end: h(17) }];
    const groups = doneGroups({
      done: ["a", "b", "c"],
      doneIn: new Map([["a", h(13)], ["b", h(9)], ["c", null]]),
      windows,
    });
    expect(groups).toEqual([
      { range: windows[0], taskIds: ["b"] },
      { range: windows[1], taskIds: ["a"] },
      { range: null, taskIds: ["c"] },
    ]);
  });
});

describe("a folded window", () => {
  const section = (over: { rows?: string[]; done?: string[] }) => {
    const planned = plan({
      windows: [{ start: h(9), end: h(12) }],
      open: (over.rows ?? []).map((id) => task(id)),
      done: (over.done ?? []).map((taskId) => ({ taskId, size: "quick" as const, minute: h(10) })),
    });
    return homeSections({ planned, partOf: () => null, dayOrder: new Map() })[0]!;
  };

  it("counts only what's done once it's over, and nothing while tasks are open", () => {
    expect(foldedLabel(section({ done: ["a", "b"] }), "past")).toBe("✓ 2 done");
    expect(foldedLabel(section({ rows: ["a"], done: ["b"] }), "past")).toBe("");
  });

  it("says how many tasks one still to come holds", () => {
    expect(foldedLabel(section({ rows: ["a"] }), "later")).toBe("1 task");
  });
});

describe("extra runs and Not on today (Henry, 2026-11-07)", () => {
  const FRI = "2026-11-06";

  it("keeps a task whose week is done in its place, marked Extra", () => {
    const planned = plan({ open: [task("gym", { owesRun: false, partOfDay: "morning" })] });
    const [morning] = homeSections({ planned, partOf: () => "morning", dayOrder: new Map() });
    expect(morning?.rows).toEqual([{ taskId: "gym", reason: "extra", swappable: false }]);
  });

  it("groups a past day's run, a deadline with no day, and later work apart from today", () => {
    expect(notOnTodayGroup({ plannedOn: "2026-11-05", oneOffDate: null, oneOffDue: null, oneOffSize: null }, FRI)).toBe("earlier");
    expect(notOnTodayGroup({ plannedOn: null, oneOffDate: null, oneOffDue: "2026-11-20", oneOffSize: "normal" }, FRI)).toBe("deadline");
    expect(notOnTodayGroup({ plannedOn: null, oneOffDate: null, oneOffDue: null, oneOffSize: "normal" }, FRI)).toBeNull();
    expect(notOnTodayGroup({ plannedOn: FRI, oneOffDate: null, oneOffDue: null, oneOffSize: null }, FRI)).toBeNull();
  });

  it("takes them out of today's parts and lists them in order", () => {
    const planned = plan({ open: [task("thu"), task("essay"), task("read"), task("sat", { plannedLater: true })] });
    const group = (id: string) => (id === "thu" ? "earlier" : id === "essay" ? "deadline" : null);
    const sections = homeSections({ planned, partOf: () => null, dayOrder: new Map(), elsewhere: group });
    const anytime = sections.find((s) => s.key === "p-anytime")!;
    expect(ids(anytime.rows)).toEqual(["read"]);
    expect(notOnToday({ planned, group, dayOrder: new Map() })).toEqual([
      { group: "earlier", taskIds: ["thu"] },
      { group: "deadline", taskIds: ["essay"] },
      { group: "later", taskIds: ["sat"] },
    ]);
  });
});
