/**
 * Goal templates (ADR-0042 §7, spec §5.6): for each unit, and for any
 * commitment, one template per goal type that makes sense there. A
 * template fills in the type, a suggested target and the wording; the
 * sheet then asks only what that type needs (which tasks count), and
 * everything stays editable. "Start from scratch" is the same sheet,
 * empty.
 *
 * These replace the old goal library; the task library stays
 * (`library.ts`). A first pass, written 2026-10-21, for Henry to
 * revise. `{n}` in a title is the target.
 *
 * **Nothing here grades a day** (ADR-0042): reaching a target is an
 * achievement for the month, and a streak has no target at all.
 */
import type { GoalKind } from "@glide/scoring";

export interface GoalTemplate {
  readonly id: string;
  readonly kind: GoalKind;
  /** With `{n}` for the target; a streak has none. */
  readonly title: string;
  /** The suggested target: times, hours or points. Null for a streak. */
  readonly target: number | null;
  /** Time spent: count every task here rather than ones you choose. */
  readonly wholeUnit?: boolean;
}

/** Per unit: times done, time spent, points, streak — those that fit. */
const UNITS: Record<string, readonly Omit<GoalTemplate, "id">[]> = {
  "exercise-fitness": [
    { kind: "timesDone", title: "Work out {n} times", target: 30 },
    { kind: "timeSpent", title: "{n} hours of training", target: 20 },
    { kind: "pointsEarned", title: "Earn {n} Exercise points", target: 300 },
    { kind: "streak", title: "Stretch every day", target: null },
  ],
  nutrition: [
    { kind: "timesDone", title: "Cook at home {n} times", target: 20 },
    { kind: "pointsEarned", title: "Earn {n} Nutrition points", target: 300 },
    { kind: "streak", title: "Eat breakfast every day", target: null },
  ],
  "sleep-recovery": [
    { kind: "timesDone", title: "Wind down without screens {n} times", target: 20 },
    { kind: "pointsEarned", title: "Earn {n} Sleep points", target: 300 },
    { kind: "streak", title: "Lights out on time every day", target: null },
  ],
  "mental-health": [
    { kind: "timesDone", title: "Journal {n} times", target: 20 },
    { kind: "timeSpent", title: "{n} hours of quiet time", target: 10 },
    { kind: "streak", title: "Meditate every day", target: null },
  ],
  spirituality: [
    { kind: "timesDone", title: "Reflect {n} times", target: 20 },
    { kind: "timeSpent", title: "{n} hours of practice", target: 10 },
    { kind: "streak", title: "A moment of practice every day", target: null },
  ],
  "giving-service": [
    { kind: "timesDone", title: "Help out {n} times", target: 10 },
    { kind: "timeSpent", title: "{n} hours volunteering", target: 20 },
  ],
  "job-career": [
    { kind: "timesDone", title: "Reach out to {n} people", target: 10 },
    { kind: "timeSpent", title: "{n} hours on career growth", target: 20 },
    { kind: "pointsEarned", title: "Earn {n} Career points", target: 300 },
  ],
  "education-learning": [
    { kind: "timesDone", title: "Study {n} times", target: 30 },
    { kind: "timeSpent", title: "{n} hours of study", target: 40, wholeUnit: true },
    { kind: "pointsEarned", title: "Earn {n} Learning points", target: 300 },
    { kind: "streak", title: "Learn something every day", target: null },
  ],
  finances: [
    { kind: "timesDone", title: "Review your spending {n} times", target: 12 },
    { kind: "pointsEarned", title: "Earn {n} Finances points", target: 200 },
  ],
  "living-space": [
    { kind: "timesDone", title: "Tidy up {n} times", target: 20 },
    { kind: "timeSpent", title: "{n} hours on your space", target: 10 },
    { kind: "streak", title: "Make the bed every day", target: null },
  ],
  "nature-surroundings": [
    { kind: "timesDone", title: "Get outside {n} times", target: 20 },
    { kind: "timeSpent", title: "{n} hours outdoors", target: 20 },
  ],
  hygiene: [
    { kind: "pointsEarned", title: "Earn {n} Hygiene points", target: 200 },
    { kind: "streak", title: "Your routine every day", target: null },
  ],
  "hobbies-interests": [
    { kind: "timesDone", title: "Make time for it {n} times", target: 20 },
    { kind: "timeSpent", title: "{n} hours on your hobby", target: 20, wholeUnit: true },
    { kind: "streak", title: "Practise every day", target: null },
  ],
  "art-media": [
    { kind: "timesDone", title: "Read, watch or listen {n} times", target: 20 },
    { kind: "timeSpent", title: "{n} hours of reading", target: 20 },
    { kind: "streak", title: "Read every day", target: null },
  ],
  "adventure-experiences": [
    { kind: "timesDone", title: "Try {n} new things", target: 10 },
    { kind: "timeSpent", title: "{n} hours exploring", target: 20 },
  ],
  "significant-other": [
    { kind: "timesDone", title: "{n} date nights", target: 10 },
    { kind: "timeSpent", title: "{n} hours together", target: 20 },
  ],
  family: [
    { kind: "timesDone", title: "Call or visit family {n} times", target: 20 },
    { kind: "timeSpent", title: "{n} hours with family", target: 20 },
  ],
  friendship: [
    { kind: "timesDone", title: "Catch up with friends {n} times", target: 20 },
    { kind: "timeSpent", title: "{n} hours with friends", target: 20 },
  ],
};

/** Any commitment: a course, a job, a club. */
const COMMITMENT: readonly Omit<GoalTemplate, "id">[] = [
  { kind: "timeSpent", title: "{n} hours on {name}", target: 40, wholeUnit: true },
  { kind: "timesDone", title: "Get through {n} sessions", target: 20 },
  { kind: "pointsEarned", title: "Earn {n} {name} points", target: 300 },
];

/** For units with no templates of their own (a custom unit). */
const ANY: readonly Omit<GoalTemplate, "id">[] = [
  { kind: "timesDone", title: "Do it {n} times", target: 20 },
  { kind: "timeSpent", title: "{n} hours on {name}", target: 20, wholeUnit: true },
  { kind: "pointsEarned", title: "Earn {n} {name} points", target: 300 },
];

/** The templates for a unit or commitment, with its name filled in. */
export function goalTemplatesFor(
  unit: { id: string; name: string; commitment: boolean },
): GoalTemplate[] {
  const list = unit.commitment ? COMMITMENT : (UNITS[unit.id] ?? ANY);
  return list.map((t, i) => ({
    ...t,
    id: `${unit.id}:${t.kind}:${i}`,
    title: t.title.replace("{name}", unit.name),
  }));
}

/** A template's title with its target in it: "Work out 30 times". */
export function titleWith(title: string, target: number | null): string {
  return target === null ? title : title.replace("{n}", String(target));
}

/** Every unit that has templates of its own, for the content test. */
export const TEMPLATE_UNITS: readonly string[] = Object.keys(UNITS);
