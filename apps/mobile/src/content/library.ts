/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: docs/content/library.md
 * Regenerate: npm run content:build
 *
 * Edits here are lost on the next build, and `npm run content:check`
 * fails the moment this file and its source disagree.
 */

/** Which situation a suggestion suits (ADR-0006 §1). */
export type Profile = "gap-closing" | "maintenance" | "light";

export interface GoalTemplate {
  id: string;
  title: string;
  description: string | null;
  profiles: Profile[];
  /** Ordered rung titles; empty when the goal has none. */
  milestones: string[];
  /** ADR-0015 §1. Null when the goal is not countable. */
  metric: {
    kind: "cumulative" | "target";
    unit: string;
    suggestedTarget: number | null;
  } | null;
}

export interface TaskTemplate {
  id: string;
  title: string;
  /** The self-contract: what counts as done. Never scored. */
  description: string | null;
  profiles: Profile[];
  /** 0 = once a fortnight, 7 = daily. */
  timesPerWeek: number;
  /** Order within the unit; proposed tasks arrive pre-ranked so
   *  onboarding needs no pairwise comparisons (ADR-0006 §2). */
  defaultRank: number;
  /** A goal in the same unit, or null for a habit on the unit itself. */
  goalId: string | null;
}

export interface UnitLibrary {
  goals: GoalTemplate[];
  tasks: TaskTemplate[];
}

/** Keyed by unit id. Communal units carry goals but never tasks
 *  (ADR-0025 §5); the build refuses to generate them. */
export const LIBRARY: Record<string, UnitLibrary> = {
  "exercise-fitness": {
    "goals": [
      {
        "id": "run-5k",
        "title": "Run 5k without stopping",
        "description": "A single continuous 5k, at any pace.",
        "profiles": [
          "gap-closing"
        ],
        "milestones": [
          "Run 1k without stopping",
          "Run 3k without stopping",
          "Run 5k without stopping"
        ],
        "metric": {
          "kind": "target",
          "unit": "km",
          "suggestedTarget": 5
        }
      },
      {
        "id": "strength-base",
        "title": "Build a strength base",
        "description": "Squat, hinge, push, and pull all part of a regular week.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "Two sessions a week for a month",
          "Add weight to every main lift",
          "Three sessions a week for a month"
        ],
        "metric": null
      },
      {
        "id": "stay-active",
        "title": "Stay as active as you are now",
        "description": "Hold the routine that already works, through a busy stretch.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [],
        "metric": null
      }
    ],
    "tasks": [
      {
        "id": "strength-session",
        "title": "Strength training session",
        "description": "Squat, hinge, push, pull. Warm-up counts as part of it.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 3,
        "goalId": "strength-base",
        "defaultRank": 1
      },
      {
        "id": "easy-run",
        "title": "Easy run",
        "description": "Conversational pace. Distance does not matter.",
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 2,
        "goalId": "run-5k",
        "defaultRank": 2
      },
      {
        "id": "daily-walk",
        "title": "Walk",
        "description": "Twenty minutes or more, in one go or spread out.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "mobility",
        "title": "Mobility work",
        "description": "Ten minutes. Hips, shoulders, ankles.",
        "profiles": [
          "maintenance"
        ],
        "timesPerWeek": 3,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "long-effort",
        "title": "One longer effort",
        "description": "The week's one session that goes past comfortable.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 1,
        "goalId": "run-5k",
        "defaultRank": 5
      },
      {
        "id": "move-break",
        "title": "Get up and move",
        "description": "Break up a sitting day. Any movement counts.",
        "profiles": [
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 6
      }
    ]
  }
};
