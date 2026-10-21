/**
 * The onboarding flow's rules (ADR-0045), pure so they can be tested
 * off the device: the seven steps in order, where a stored step from
 * the old flow lands, and which steps can be skipped.
 *
 * Priorities is the one step a first run can't skip: suggestions need
 * tiers to fill windows from. Once a snapshot exists, on a re-run from
 * Settings or after resuming past it, every step can be skipped
 * (ADR-0045 §2).
 */

/** In order. `done` is the finished state, not a screen. */
export const ONBOARDING_STEPS = [
  "welcome",
  "priorities",
  "commitments",
  "hours",
  "tasks",
  "week",
  "notify",
  "done",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The screens the progress track counts: all seven. */
export const SHOWN_STEPS: readonly OnboardingStep[] = ONBOARDING_STEPS.filter(
  (s) => s !== "done",
);

/**
 * The flow before ADR-0045, mapped to the nearest step now. Someone
 * who quit mid-flow on an older build resumes rather than restarts:
 * everything before the old diagnostic is Priorities, everything after
 * it is the first step past Priorities.
 */
const OLD_STEPS: Record<string, OnboardingStep> = {
  method: "priorities",
  diagnostic: "priorities",
  weights: "commitments",
  rhythm: "commitments",
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

/**
 * Whether a step offers Skip. Welcome has only its one button, and
 * Priorities can be skipped only once tiers exist.
 */
export function canSkip(step: OnboardingStep, hasSnapshot: boolean): boolean {
  if (step === "welcome" || step === "done") return false;
  if (step === "priorities") return hasSnapshot;
  return true;
}

/**
 * Where running onboarding again starts: at Priorities, with your
 * current tiers (ADR-0045 §2), or at the welcome when there's nothing
 * yet, as after erasing everything.
 */
export function rerunStep(hasSnapshot: boolean): OnboardingStep {
  return hasSnapshot ? "priorities" : "welcome";
}
