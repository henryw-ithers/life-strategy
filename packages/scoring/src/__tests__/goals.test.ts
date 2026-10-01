import { describe, expect, it } from "vitest";
import { nextGoalStatus } from "../goals";

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
