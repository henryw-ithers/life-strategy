/**
 * The onboarding flow's rules (ADR-0045 as amended by ADR-0048), pure so
 * they can be tested off the device: the steps in order, and where a
 * stored step from an older flow lands.
 *
 * **Onboarding explains; it fills nothing in** (Henry, 2026-11-02). A
 * few short pages say what the app is for and how it works, then where
 * to start. Nothing is set up for you: no templates, no starter tasks,
 * no hours.
 */

/** In order. `done` is the finished state, not a screen. */
export const ONBOARDING_STEPS = ["welcome", "tiers", "day", "time", "start", "notify", "done"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The screens the progress track counts. */
export const SHOWN_STEPS: readonly OnboardingStep[] = ONBOARDING_STEPS.filter((s) => s !== "done");

/**
 * Older flows' steps, mapped to the nearest one now, so someone who quit
 * mid-flow on an older build resumes rather than restarts.
 */
const OLD_STEPS: Record<string, OnboardingStep> = {
  method: "tiers",
  diagnostic: "tiers",
  priorities: "tiers",
  weights: "start",
  rhythm: "start",
  commitments: "start",
  hours: "start",
  tasks: "start",
  week: "start",
};

/** A stored step, read back. Anything unknown starts from the top. */
export function readStep(raw: string | null): OnboardingStep {
  if (raw === null) return "welcome";
  const found = ONBOARDING_STEPS.find((s) => s === raw);
  return found ?? OLD_STEPS[raw] ?? "welcome";
}

/** The step after this one. `done` stays `done`. */
export function nextStep(step: OnboardingStep): OnboardingStep {
  const i = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[Math.min(i + 1, ONBOARDING_STEPS.length - 1)] ?? "done";
}
