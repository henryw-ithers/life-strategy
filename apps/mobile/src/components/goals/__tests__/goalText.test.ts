/**
 * How a goal reads (spec §5.6).
 */
import { describe, expect, it } from "vitest";

import { progressText, statusText, streakMarks } from "../goalText";

const goal = (over: Partial<Parameters<typeof progressText>[0]> = {}) => ({
  kind: "timesDone" as const,
  status: "active",
  value: 18,
  target: 30,
  reached: false,
  ...over,
});

describe("progressText", () => {
  it("is a running total, never a pace", () => {
    expect(progressText(goal())).toBe("18 / 30 times");
    expect(progressText(goal({ kind: "timeSpent", value: 12.46, target: 40 }))).toBe("12.5 / 40 hours");
    expect(progressText(goal({ kind: "pointsEarned", value: 180.4, target: 300 }))).toBe("180 / 300 points");
  });

  it("shows a streak's run only from 7 days", () => {
    expect(progressText(goal({ kind: "streak", value: null, target: null }))).toBeNull();
    expect(progressText(goal({ kind: "streak", value: 12, target: null }))).toBe("12 days in a row");
  });
});

describe("streakMarks", () => {
  it("lists the marks reached", () => {
    expect(streakMarks(null)).toEqual([]);
    expect(streakMarks(31)).toEqual([7, 30]);
    expect(streakMarks(66)).toEqual([7, 30, 66]);
  });
});

describe("statusText", () => {
  it("invites finishing a reached target and says nothing on an active one", () => {
    expect(statusText(goal())).toBeNull();
    expect(statusText(goal({ reached: true }))).toBe("Target reached. Finish it when you're ready.");
    expect(statusText(goal({ status: "paused" }))).toBe("Paused");
  });
});
