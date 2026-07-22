import { describe, expect, it } from "vitest";
import { advanceMilestone, nextGoalStatus } from "../goals";

describe("nextGoalStatus", () => {
  it("active ⇄ paused", () => {
    expect(nextGoalStatus("active", "pause")).toBe("paused");
    expect(nextGoalStatus("paused", "resume")).toBe("active");
  });

  it("active or paused → abandoned, and abandoned is revivable", () => {
    expect(nextGoalStatus("active", "abandon")).toBe("abandoned");
    expect(nextGoalStatus("paused", "abandon")).toBe("abandoned");
    expect(nextGoalStatus("abandoned", "revive")).toBe("active");
  });

  it("active → completed", () => {
    expect(nextGoalStatus("active", "complete")).toBe("completed");
  });

  it("terminal states (completed, revised) reject every action", () => {
    const actions = ["pause", "resume", "abandon", "revive", "complete"] as const;
    for (const status of ["completed", "revised"] as const) {
      for (const action of actions) {
        expect(() => nextGoalStatus(status, action)).toThrow();
      }
    }
  });

  it("rejects invalid transitions from active/paused", () => {
    expect(() => nextGoalStatus("active", "resume")).toThrow();
    expect(() => nextGoalStatus("paused", "pause")).toThrow();
    expect(() => nextGoalStatus("paused", "complete")).toThrow();
    expect(() => nextGoalStatus("active", "revive")).toThrow();
  });
});

describe("advanceMilestone", () => {
  const milestones = [
    { id: "a", sortOrder: 1, status: "completed" as const },
    { id: "b", sortOrder: 2, status: "current" as const },
    { id: "c", sortOrder: 3, status: "pending" as const },
  ];

  it("promotes the next pending milestone by sort order", () => {
    expect(advanceMilestone(milestones, "b")).toEqual({ nextCurrentId: "c" });
  });

  it("returns null when the completed milestone was the last one", () => {
    const last = [
      { id: "a", sortOrder: 1, status: "completed" as const },
      { id: "b", sortOrder: 2, status: "current" as const },
    ];
    expect(advanceMilestone(last, "b")).toEqual({ nextCurrentId: null });
  });

  it("skips already-completed milestones when picking the next one", () => {
    const mixed = [
      { id: "a", sortOrder: 1, status: "completed" as const },
      { id: "b", sortOrder: 2, status: "completed" as const },
      { id: "c", sortOrder: 3, status: "current" as const },
      { id: "d", sortOrder: 4, status: "pending" as const },
    ];
    expect(advanceMilestone(mixed, "c")).toEqual({ nextCurrentId: "d" });
  });
});
