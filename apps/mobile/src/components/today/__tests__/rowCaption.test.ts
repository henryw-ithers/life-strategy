/**
 * What a checklist row says under its title.
 */
import { describe, expect, it } from "vitest";

import { countsRuns, progressLabel, rowCaption, type CaptionTask } from "../rowCaption";

const weekly = (over: Partial<CaptionTask> = {}): CaptionTask => ({
  timesPerWeek: 5,
  band: "week",
  completedToday: false,
  doneCount: 2,
  goalCount: 5,
  pointsIfCompletedNow: 4,
  streak: null,
  progress: 0,
  allowsPartial: false,
  oneOffSize: null,
  ...over,
});

describe("the week's count", () => {
  it("still reads on an ordinary counted task", () => {
    expect(rowCaption(weekly())).toBe("3rd of 5 this week");
    expect(rowCaption(weekly({ completedToday: true }))).toBe("2nd of 5 this week");
  });

  it("is gone from a part-credit task, which is measured by progress", () => {
    // Henry, 2026-09-30: why would "3 of 5 this week" exist here?
    expect(countsRuns(weekly({ allowsPartial: true }))).toBe(false);
    expect(rowCaption(weekly({ allowsPartial: true }))).toBeNull();
    expect(
      rowCaption(weekly({ allowsPartial: true, band: "doneThisWeek", doneCount: 5 })),
    ).toBeNull();
  });

  it("is gone from a one-off, which has no week", () => {
    expect(rowCaption(weekly({ timesPerWeek: 1, goalCount: 1, doneCount: 0, oneOffSize: "big" }))).toBeNull();
  });

  it("never shows on a daily task", () => {
    expect(rowCaption(weekly({ timesPerWeek: 7, band: "daily" }))).toBeNull();
  });
});

describe("progress", () => {
  it("leads while a task is part done", () => {
    expect(rowCaption(weekly({ allowsPartial: true, progress: 0.5 }))).toBe("Half done");
    // Even where a count would otherwise have shown.
    expect(rowCaption(weekly({ progress: 0.25 }))).toBe("A quarter done");
  });

  it("says nothing at zero rather than naming what is left", () => {
    expect(progressLabel(0)).toBeNull();
  });

  it("counts up in every label", () => {
    for (const p of [0.25, 0.5, 0.75]) {
      expect(progressLabel(p)).toMatch(/done$/);
      expect(progressLabel(p)).not.toMatch(/left|remaining|to go|missing/i);
    }
  });
});

describe("a daily task's run", () => {
  const daily = (streak: number | null, over: Partial<CaptionTask> = {}) =>
    weekly({ timesPerWeek: 7, band: "daily", streak, ...over });

  it("shows from a week up, and not before", () => {
    expect(rowCaption(daily(6))).toBeNull();
    expect(rowCaption(daily(7))).toBe("7 days");
  });

  it("still shows on a part-credit daily task", () => {
    // Part credit drops the count, not the run: showing up counts.
    expect(rowCaption(daily(12, { allowsPartial: true }))).toBe("12 days");
  });

  it("gives way to progress on a part-done day", () => {
    expect(rowCaption(daily(12, { allowsPartial: true, progress: 0.75 }))).toBe(
      "Three quarters done",
    );
  });
});
