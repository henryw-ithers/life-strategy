/**
 * Onboarding state (ADR-0011). Two keys in `app_setting`: which step
 * the user is on, so quitting mid-flow resumes rather than restarts,
 * and whether the flow is finished at all.
 *
 * Resumption is at step granularity by design — a diagnostic
 * abandoned halfway begins that step again, because rankings are held
 * in component state and only written as a snapshot on completion.
 * See ADR-0011 decision 2 for the trigger that reopens this.
 */
import { getSetting, setSetting } from "./settings";

const COMPLETE_KEY = "onboarding.complete";
const STEP_KEY = "onboarding.step";

/** Ordered; `tasks` onward all require a saved snapshot. */
export const ONBOARDING_STEPS = [
  "welcome",
  "privacy",
  "diagnostic",
  "tasks",
  "notify",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

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
    const raw = await getSetting(STEP_KEY);
    const found = ONBOARDING_STEPS.find((s) => s === raw);
    return found ?? "welcome";
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
 * Replays the flow from the top (Settings → Run onboarding again).
 * Deliberately does not clear data or force a second diagnostic — the
 * diagnostic step self-skips once a snapshot exists, and re-running
 * the ritual is the monthly review's job, not this one.
 */
export async function resetOnboarding(): Promise<void> {
  await setSetting(STEP_KEY, "welcome");
  await setSetting(COMPLETE_KEY, "0");
}
