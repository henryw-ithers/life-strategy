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

/**
 * Ordered. Six screens (ADR-0011 as amended twice).
 *
 * The 2026-07-30 amendment cut this to four, and nothing here puts
 * back what it removed: that pass deleted a Begin screen standing in
 * front of another Begin screen, and a private half-copy of the Tasks
 * screen. Both were duplication, not explanation. What it left behind
 * was an app that never said what a unit is, why ranking two things at
 * a time produces a number, or why a day is scored the way it is.
 *
 * `method` is the only screen that explains anything before the
 * payoff, and it earns that slot by sitting immediately in front of
 * the five minutes it is asking for.
 *
 * `weights` and `rhythm` come *after* the diagnostic on purpose. They
 * are the same bet the 2026-07-30 amendment made when it handed the
 * user to the real Tasks screen: the model teaches better against the
 * user's own numbers than against a diagram. Both read live from the
 * snapshot the user just produced.
 *
 * `diagnostic` is a waiting state, not a screen. It means "the
 * diagnostic route is on top of us"; a cold start there renders the
 * welcome again rather than a blank screen.
 */
export const ONBOARDING_STEPS = [
  "welcome",
  "method",
  "diagnostic",
  "weights",
  "rhythm",
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
