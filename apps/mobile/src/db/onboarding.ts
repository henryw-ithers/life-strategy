/**
 * Onboarding state (ADR-0011, ADR-0045). Keys in `app_setting`: which
 * page the user is on, so quitting mid-flow resumes rather than
 * restarts, and whether the flow is finished. The pages and their order
 * are `lib/onboardingFlow.ts`.
 */
import { readStep, type OnboardingStep } from "../lib/onboardingFlow";
import { getSetting, setSetting } from "./settings";

export type { OnboardingStep } from "../lib/onboardingFlow";

const COMPLETE_KEY = "onboarding.complete";
const STEP_KEY = "onboarding.step";

/**
 * Fails **open**: onboarding sits between the user and their app, so a
 * read error must let them through rather than trap them behind a
 * flow they may have already completed (ADR-0011, Consequences).
 */
export async function isOnboardingComplete(): Promise<boolean> {
  try {
    return (await getSetting(COMPLETE_KEY)) === "1";
  } catch {
    return true;
  }
}

export async function loadOnboardingStep(): Promise<OnboardingStep> {
  try {
    return readStep(await getSetting(STEP_KEY));
  } catch {
    return "welcome";
  }
}

export async function saveOnboardingStep(step: OnboardingStep): Promise<void> {
  await setSetting(STEP_KEY, step);
}

export async function completeOnboarding(): Promise<void> {
  await setSetting(COMPLETE_KEY, "1");
}

/**
 * Shows the pages again (Settings → How it works, or after erasing
 * everything), from the welcome. It only explains, so it deletes and
 * changes nothing.
 */
export async function resetOnboarding(): Promise<void> {
  await setSetting(STEP_KEY, "welcome");
  await setSetting(COMPLETE_KEY, "0");
}
