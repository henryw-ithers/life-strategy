/**
 * Onboarding's stored state (ADR-0045 §2): where it resumes, a re-run
 * that opens at Priorities when tiers exist and deletes nothing, and
 * the schedule picked on the commitments step.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isOnboardingComplete,
  loadOnboardingStep,
  loadOnboardingTemplate,
  resetOnboarding,
  saveOnboardingStep,
  saveOnboardingTemplate,
  completeOnboarding,
} from "../onboarding";
import { setSetting } from "../settings";
import { lifeUnit, snapshot } from "../schema";
import { syncTaxonomy } from "../seed";
import { resetTestDb, testDb } from "./harness";

vi.mock("../client", async () => (await import("./harness")).mockClient());

/** The test database, as the type the app's helpers take: the same
 *  Drizzle API over better-sqlite3 rather than expo-sqlite. */
const appDb = () => testDb() as unknown as Parameters<typeof syncTaxonomy>[0];
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));

describe("onboarding's stored state", () => {
  beforeEach(async () => {
    resetTestDb();
    await syncTaxonomy(appDb());
  });

  it("starts at the welcome, and resumes where it was left", async () => {
    expect(await loadOnboardingStep()).toBe("welcome");
    await saveOnboardingStep("hours");
    expect(await loadOnboardingStep()).toBe("hours");
  });

  it("resumes the old flow's stored step at the nearest new one", async () => {
    await setSetting("onboarding.step", "diagnostic");
    expect(await loadOnboardingStep()).toBe("priorities");
  });

  it("marks itself complete", async () => {
    await completeOnboarding();
    expect(await isOnboardingComplete()).toBe(true);
  });

  it("runs again from the welcome when no tiers exist", async () => {
    await completeOnboarding();
    await resetOnboarding();
    expect(await isOnboardingComplete()).toBe(false);
    expect(await loadOnboardingStep()).toBe("welcome");
  });

  it("runs again from Priorities when tiers exist, deleting nothing", async () => {
    testDb().insert(snapshot).values({ id: "s1", takenAt: "2026-10-01T00:00:00Z", formulaVersion: 11 }).run();
    const units = testDb().select().from(lifeUnit).all().length;
    await resetOnboarding();
    expect(await loadOnboardingStep()).toBe("priorities");
    expect(testDb().select().from(snapshot).all()).toHaveLength(1);
    expect(testDb().select().from(lifeUnit).all()).toHaveLength(units);
  });

  it("keeps the schedule picked on the commitments step", async () => {
    expect(await loadOnboardingTemplate()).toBeNull();
    await saveOnboardingTemplate("shifts");
    expect(await loadOnboardingTemplate()).toBe("shifts");
  });
});
