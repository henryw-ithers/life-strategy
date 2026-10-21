/**
 * Home's day in words and states (spec §5.1).
 */
import type { PlannedWindow } from "@glide/scoring";
import { describe, expect, it } from "vitest";

import {
  closedLabel,
  eveningFrom,
  openIndex,
  passCardDue,
  situationLine,
  timeLeft,
  windowState,
} from "../homeDay";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const r = (start: number, end: number) => ({ start, end });
const windows = [r(h(8, 30), h(10, 50)), r(h(12, 40), h(16)), r(h(18, 10), h(21, 30))];

const win = (over: Partial<PlannedWindow> = {}): PlannedWindow => ({
  range: windows[0]!,
  ended: false,
  done: [],
  pinned: [],
  timed: [],
  suggested: [],
  showAll: [],
  full: false,
  ...over,
});

describe("which window is open", () => {
  it("is the one you're in, or the next one", () => {
    expect(openIndex(windows, h(9))).toBe(0);
    expect(openIndex(windows, h(7))).toBe(0);
    expect(openIndex(windows, h(11))).toBe(1);
    expect(openIndex(windows, h(22))).toBeNull();
    expect(openIndex([], h(9))).toBeNull();
    // Not today: the first.
    expect(openIndex(windows, null)).toBe(0);
  });

  it("puts the others before or after it", () => {
    expect(windowState(0, 1, windows, h(13))).toBe("past");
    expect(windowState(1, 1, windows, h(13))).toBe("open");
    expect(windowState(2, 1, windows, h(13))).toBe("later");
  });
});

describe("the line above the windows", () => {
  const gaps = [{ range: r(h(12), h(12, 40)), name: "Lunch" }];

  it("says when the first window is, and what a gap is", () => {
    expect(situationLine(windows, gaps, h(7))).toBe("First window at 08:30");
    expect(situationLine(windows, gaps, h(12, 10))).toBe("Lunch until 12:40");
    expect(situationLine(windows, gaps, h(17))).toBe("Next window at 18:10");
  });

  it("says nothing inside a window, after the last, or on a day with none", () => {
    expect(situationLine(windows, gaps, h(9))).toBeNull();
    expect(situationLine(windows, gaps, h(22))).toBeNull();
    expect(situationLine([], gaps, h(9))).toBeNull();
  });
});

describe("time left", () => {
  it("is plain words", () => {
    expect(timeLeft(r(h(12, 40), h(16)), h(13, 20))).toBe("2 h 40 left");
    expect(timeLeft(r(h(12, 40), h(16)), h(15, 25))).toBe("35 min left");
    expect(timeLeft(r(h(12, 40), h(16)), h(14))).toBe("2 h left");
    expect(timeLeft(r(h(12, 40), h(16)), h(12))).toBe("Starts at 12:40");
  });
});

describe("a closed window", () => {
  it("says how many were done, or only its times; never what wasn't", () => {
    expect(closedLabel(win({ done: ["a", "b"] }), "past")).toBe("✓ 2 done");
    expect(closedLabel(win({ suggested: [{ taskId: "a", reason: "due" }] }), "past")).toBe("");
    expect(closedLabel(win({ suggested: [{ taskId: "a", reason: "due" }] }), "later")).toBe("1 task");
  });
});

describe("the evening card", () => {
  it("comes an hour before the last window ends, or at 6 pm", () => {
    expect(eveningFrom(windows)).toBe(h(20, 30));
    expect(eveningFrom([])).toBe(h(18));
  });
});

describe("the weekly pass card", () => {
  const SUN = "2026-10-18";
  const MON = "2026-10-19";
  const base = { mondayFirst: h(8, 30), hiddenWeek: null };

  it("shows from Sunday 6 pm until Monday's first window", () => {
    expect(passCardDue({ ...base, today: SUN, now: h(17) })).toBe(false);
    expect(passCardDue({ ...base, today: SUN, now: h(18) })).toBe(true);
    expect(passCardDue({ ...base, today: MON, now: h(8) })).toBe(true);
    expect(passCardDue({ ...base, today: MON, now: h(8, 30) })).toBe(false);
    expect(passCardDue({ ...base, today: "2026-10-21", now: h(8) })).toBe(false);
  });

  it("stays hidden for the week after Not now", () => {
    expect(passCardDue({ ...base, today: MON, now: h(7), hiddenWeek: SUN })).toBe(false);
  });
});
