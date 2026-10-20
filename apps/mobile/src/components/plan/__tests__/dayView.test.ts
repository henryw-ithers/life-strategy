/**
 * The Plan day view's arithmetic and words (spec §5.3).
 */
import type { PlannedWindow } from "@glide/scoring";
import { describe, expect, it } from "vitest";

import type { PlanEvent } from "../../../db/dayPlan";
import {
  addableTo,
  dayHeading,
  fillLabel,
  hoursLabel,
  plannedMinutes,
  reasonLabel,
  spanLabel,
  timeline,
  weekDates,
  weekLabel,
} from "../dayView";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const r = (start: number, end: number) => ({ start, end });

const event = (id: string, start: number, end: number): PlanEvent => ({
  id,
  title: id,
  unitId: "school",
  areaId: "a",
  start,
  end,
  repeating: true,
  commitment: true,
  done: false,
});

const win = (over: Partial<PlannedWindow> = {}): PlannedWindow => ({
  range: r(h(9), h(11)),
  ended: false,
  done: [],
  pinned: [],
  timed: [],
  suggested: [],
  showAll: [],
  full: false,
  ...over,
});
const pin = (taskId: string) => ({ ruleId: `p-${taskId}`, taskId, kind: "window" as const, extra: false, carried: false });

describe("timeline", () => {
  it("lists windows, events, named gaps and buffers in time order", () => {
    const items = timeline(
      {
        windows: [r(h(8, 30), h(10, 50)), r(h(13), h(16))],
        gaps: [{ range: r(h(12, 30), h(13)), name: "Lunch" }],
        buffers: [r(h(12, 40), h(12, 55))],
      },
      [event("lecture", h(11), h(12, 30))],
    );
    expect(items.map((i) => i.kind)).toEqual(["window", "event", "gap", "buffer", "window"]);
  });

  it("puts an event before a window starting at the same time", () => {
    const items = timeline({ windows: [r(h(9), h(10))], gaps: [], buffers: [] }, [event("e", h(9), h(9, 30))]);
    expect(items.map((i) => i.kind)).toEqual(["event", "window"]);
  });
});

describe("labels", () => {
  it("writes spans and hours plainly", () => {
    expect(spanLabel(r(h(8, 30), h(10, 50)))).toBe("08:30–10:50");
    expect(hoursLabel(90)).toBe("1.5");
    expect(hoursLabel(120)).toBe("2");
    expect(hoursLabel(140)).toBe("2.3");
    expect(fillLabel(90, r(h(8, 30), h(10, 50)))).toBe("1.5 of 2.3 h");
  });

  it("heads a day with its windows and free time, to the half hour", () => {
    expect(dayHeading("2026-10-21", 3, 370)).toBe("Wednesday · 3 windows · about 6 h free");
    expect(dayHeading("2026-10-21", 1, 100)).toBe("Wednesday · 1 window · about 1.5 h free");
    expect(dayHeading("2026-10-24", 0, 0)).toBe("Saturday · no windows");
  });

  it("names the week by its Sunday", () => {
    expect(weekLabel("2026-10-21")).toBe("Week of 18 Oct");
    expect(weekDates("2026-10-21")).toEqual([
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
  });

  it("never calls carried work late", () => {
    expect(reasonLabel("carried")).toBe("Still open");
    expect(reasonLabel("due")).toBe("Due today");
  });
});

describe("plannedMinutes", () => {
  it("adds up what's done, pinned, timed and suggested by size", () => {
    const w = win({
      done: ["a"],
      pinned: [pin("b")],
      timed: ["c"],
      suggested: [{ taskId: "d", reason: "fits" }],
      showAll: [{ taskId: "e", reason: "fits" }],
    });
    const sizes: Record<string, "quick" | "normal" | "big" | null> = {
      a: "quick",
      b: "big",
      c: null,
      d: "normal",
      e: "big",
    };
    // 30 + 120 + 60 + 60; Show all isn't planned in it.
    expect(plannedMinutes(w, (id) => sizes[id] ?? null)).toBe(270);
  });
});

describe("addableTo", () => {
  it("offers every open task not already held by the window, suggestions here first", () => {
    const day = {
      windows: [
        win({ pinned: [pin("held")], suggested: [{ taskId: "here", reason: "fits" }] }),
        win({ range: r(h(13), h(15)), suggested: [{ taskId: "there", reason: "fits" }] }),
        win({ range: r(h(6), h(7)), ended: true, suggested: [{ taskId: "gone", reason: "fits" }] }),
      ],
      later: ["later"],
      doesntFit: ["big"],
      plannedAhead: ["friday"],
      unplacedPins: [{ taskId: "loose" }],
    };
    expect(addableTo(0, day)).toEqual(["here", "there", "loose", "later", "big", "friday"]);
  });
});
