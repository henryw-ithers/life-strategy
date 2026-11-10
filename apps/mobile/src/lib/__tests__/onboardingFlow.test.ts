/**
 * The onboarding flow (ADR-0045 as amended by ADR-0048): pages that
 * explain, in order, and where an older flow's stored step resumes.
 */
import { describe, expect, it } from "vitest";

import { nextStep, ONBOARDING_STEPS, previousStep, readStep, SHOWN_STEPS } from "../onboardingFlow";

describe("the pages", () => {
  it("explain, then ask about the reminder", () => {
    expect(SHOWN_STEPS).toEqual(["welcome", "tiers", "day", "time", "start", "notify"]);
  });

  it("each lead to the next, and done stays done", () => {
    expect(nextStep("welcome")).toBe("tiers");
    // Back (Henry, 2026-11-10): one step back, and none before the start.
    expect(previousStep("tiers")).toBe("welcome");
    expect(previousStep("notify")).toBe("start");
    expect(previousStep("welcome")).toBe("welcome");
    expect(nextStep("start")).toBe("notify");
    expect(nextStep("notify")).toBe("done");
    expect(nextStep("done")).toBe("done");
  });
});

describe("readStep", () => {
  it("reads every current page back as itself", () => {
    for (const s of ONBOARDING_STEPS) expect(readStep(s)).toBe(s);
  });

  it("resumes an older flow at the nearest page", () => {
    expect(readStep("diagnostic")).toBe("tiers");
    expect(readStep("priorities")).toBe("tiers");
    expect(readStep("commitments")).toBe("start");
    expect(readStep("week")).toBe("start");
  });

  it("starts from the top when nothing or nonsense is stored", () => {
    expect(readStep(null)).toBe("welcome");
    expect(readStep("elsewhere")).toBe("welcome");
  });
});
