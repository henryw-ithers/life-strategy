/**
 * Onboarding state (ADR-0011, ADR-0045). Keys in `app_setting`: which
 * step the user is on, so quitting mid-flow resumes rather than
 * restarts; whether the flow is finished; and the schedule picked on
 * the commitments step, which fills in the hours step.
 *
 * The steps and their rules are `lib/onboardingFlow.ts`. Each step
 * writes as it goes (a snapshot, commitments, events, hours, tasks), so
 * resuming shows what's already there rather than making it again.
 */
import { readStep, rerunStep, type OnboardingStep } from "../lib/onboardingFlow";
import { hasPriorities } from "./priorities";
import { getSetting, setSetting } from "./settings";

export type { OnboardingStep } from "../lib/onboardingFlow";

const COMPLETE_KEY = "onboarding.complete";
const STEP_KEY = "onboarding.step";
const TEMPLATE_KEY = "onboarding.template";

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

/** The schedule picked on the commitments step, if any. */
export async function loadOnboardingTemplate(): Promise<string | null> {
  return getSetting(TEMPLATE_KEY);
}

export async function saveOnboardingTemplate(id: string): Promise<void> {
  await setSetting(TEMPLATE_KEY, id);
}

/**
 * Runs the flow again (Settings → Run setup again, or after erasing
 * everything). Deletes nothing and forces nothing (ADR-0045 §2): with
 * tiers already set it opens at Priorities, showing them, and every
 * step can be skipped.
 */
export async function resetOnboarding(): Promise<void> {
  await setSetting(STEP_KEY, rerunStep(await hasPriorities()));
  await setSetting(COMPLETE_KEY, "0");
}
