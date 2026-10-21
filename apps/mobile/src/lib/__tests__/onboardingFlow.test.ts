/**
 * The onboarding flow (ADR-0045): the order of the seven steps, where
 * an old stored step resumes, and which steps can be skipped.
 */
import { describe, expect, it } from "vitest";

import {
  canSkip,
  nextStep,
  ONBOARDING_STEPS,
  readStep,
  rerunStep,
  SHOWN_STEPS,
} from "../onboardingFlow";

describe("the steps", () => {
  it("run in ADR-0045's order", () => {
    expect(SHOWN_STEPS).toEqual([
      "welcome",
      "priorities",
      "commitments",
      "hours",
      "tasks",
      "week",
      "notify",
    ]);
  });

  it("each lead to the next, and done stays done", () => {
    expect(nextStep("welcome")).toBe("priorities");
    expect(nextStep("week")).toBe("notify");
    expect(nextStep("notify")).toBe("done");
    expect(nextStep("done")).toBe("done");
  });
});

describe("readStep", () => {
  it("reads every current step back as itself", () => {
    for (const s of ONBOARDING_STEPS) expect(readStep(s)).toBe(s);
  });

  it("resumes the old flow at the nearest step", () => {
    expect(readStep("method")).toBe("priorities");
    expect(readStep("diagnostic")).toBe("priorities");
    expect(readStep("weights")).toBe("commitments");
    expect(readStep("rhythm")).toBe("commitments");
  });

  it("starts from the top when nothing or nonsense is stored", () => {
    expect(readStep(null)).toBe("welcome");
    expect(readStep("elsewhere")).toBe("welcome");
  });
});

describe("canSkip", () => {
  it("never skips Priorities on a first run", () => {
    expect(canSkip("priorities", false)).toBe(false);
  });

  it("skips Priorities once tiers exist", () => {
    expect(canSkip("priorities", true)).toBe(true);
  });

  it("skips every step after Priorities", () => {
    for (const s of ["commitments", "hours", "tasks", "week", "notify"] as const) {
      expect(canSkip(s, false)).toBe(true);
    }
  });

  it("has no Skip on the welcome", () => {
    expect(canSkip("welcome", true)).toBe(false);
  });
});

describe("rerunStep", () => {
  it("opens at Priorities with tiers to show", () => {
    expect(rerunStep(true)).toBe("priorities");
  });

  it("opens at the welcome with nothing set up", () => {
    expect(rerunStep(false)).toBe("welcome");
  });
});
