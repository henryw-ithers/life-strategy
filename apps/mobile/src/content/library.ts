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
  /**
   * ADR-0015 §1, plus `habit` (decided 2026-08-16, unbuilt — see
   * docs/backburner.md). Null when the goal is not countable.
   *
   * A `habit` goal has **no target**: it is meant to be permanent, so
   * it never completes. Its rungs are day counts in `milestones`,
   * 7 · 30 · 66 by default, where 66 is Lally's median to automaticity.
   */
  metric: {
    kind: "cumulative" | "target" | "habit";
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
        "id": "pull-up",
        "title": "Do a pull-up",
        "description": "From a dead hang, chin over the bar.",
        "profiles": [
          "gap-closing"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "reps",
          "suggestedTarget": 1
        }
      },
      {
        "id": "gym-twice-weekly",
        "title": "Two gym sessions a week for three months",
        "description": "Two a week is the strength recommendation, and three months is long enough to feel it.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "8 sessions",
          "16 sessions",
          "24 sessions"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "sessions",
          "suggestedTarget": 24
        }
      },
      {
        "id": "active-minutes",
        "title": "150 active minutes a week for a month",
        "description": "The weekly floor for a healthy adult. Walking counts.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "cumulative",
          "unit": "minutes",
          "suggestedTarget": 600
        }
      },
      {
        "id": "walk-daily",
        "title": "Walk every day",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      }
    ],
    "tasks": [
      {
        "id": "gym",
        "title": "Gym",
        "description": "Squat, hinge, push, pull. Warm-up counts.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 3,
        "goalId": "gym-twice-weekly",
        "defaultRank": 1
      },
      {
        "id": "run",
        "title": "Run",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 2,
        "goalId": "run-5k",
        "defaultRank": 2
      },
      {
        "id": "walk",
        "title": "Walk",
        "description": "Twenty minutes, in one go or spread out.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": "walk-daily",
        "defaultRank": 3
      },
      {
        "id": "stretch",
        "title": "Stretch",
        "description": "Ten minutes. Hips, shoulders, ankles.",
        "profiles": [
          "maintenance"
        ],
        "timesPerWeek": 3,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "steps",
        "title": "Steps",
        "description": "Around 8,000. Benefits flatten after that.",
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "swim",
        "title": "Swim",
        "description": null,
        "profiles": [
          "light",
          "gap-closing"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "sport",
        "title": "Sport",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 7
      },
      {
        "id": "hike",
        "title": "Hike",
        "description": "The one that takes half a morning.",
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 8
      }
    ]
  },
  "nutrition": {
    "goals": [
      {
        "id": "five-a-day",
        "title": "Five a day, every day",
        "description": "400g of fruit and veg. Frozen and tinned count.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "fibre-30",
        "title": "30g of fibre a day",
        "description": "The recommended amount. Most people manage about 17.",
        "profiles": [
          "gap-closing"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "cook-20",
        "title": "Cook 20 dinners this month",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "5 dinners",
          "10 dinners",
          "20 dinners"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "meals",
          "suggestedTarget": 20
        }
      },
      {
        "id": "no-weeknight-takeaway",
        "title": "No takeaway on weeknights",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      }
    ],
    "tasks": [
      {
        "id": "cook",
        "title": "Cook",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 5,
        "goalId": "cook-20",
        "defaultRank": 1
      },
      {
        "id": "five-a-day-task",
        "title": "Five a day",
        "description": "400g. Frozen and tinned count.",
        "profiles": [
          "maintenance",
          "gap-closing"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 2
      },
      {
        "id": "fibre",
        "title": "Fibre",
        "description": "30g. Most people manage about 17.",
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "protein",
        "title": "Protein",
        "description": "Something worth calling protein at each meal.",
        "profiles": [
          "maintenance",
          "gap-closing"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "water",
        "title": "Water",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "meal-prep",
        "title": "Meal prep",
        "description": "The shop and the chopping, so the week doesn't need deciding.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "supplements",
        "title": "Supplements",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 7
      },
      {
        "id": "no-late-snacking",
        "title": "No snacking after dinner",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 8
      }
    ]
  },
  "sleep-recovery": {
    "goals": [
      {
        "id": "phone-out-bedroom",
        "title": "Phone out of the bedroom",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "same-wake-time",
        "title": "Up at the same time every day",
        "description": "Weekends included. That's the part that does the work.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "caffeine-cutoff",
        "title": "No caffeine after midday",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "seven-hours",
        "title": "Seven hours a night for a fortnight",
        "description": "Seven to nine is the range for an adult.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [],
        "metric": {
          "kind": "cumulative",
          "unit": "nights",
          "suggestedTarget": 14
        }
      }
    ],
    "tasks": [
      {
        "id": "lights-out",
        "title": "Lights out",
        "description": "Pick the time once. The point is that it's the same one.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 1
      },
      {
        "id": "screens-off",
        "title": "Screens off",
        "description": "The last hour before bed.",
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 7,
        "goalId": "phone-out-bedroom",
        "defaultRank": 2
      },
      {
        "id": "wind-down",
        "title": "Wind-down",
        "description": "Whatever yours is. Not deciding each night is the point.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "up-same-time",
        "title": "Up at the same time",
        "description": "Harder than bedtime and matters more.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": "same-wake-time",
        "defaultRank": 4
      },
      {
        "id": "caffeine-cutoff-task",
        "title": "Caffeine cut-off",
        "description": "Midday. It's still half in you six hours later.",
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": "caffeine-cutoff",
        "defaultRank": 5
      },
      {
        "id": "nap",
        "title": "Nap",
        "description": "Twenty minutes or ninety. The ones in between are worse.",
        "profiles": [
          "light"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "daylight",
        "title": "Daylight",
        "description": "Ten minutes outside sets the clock for that night.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 7
      }
    ]
  },
  "mental-health": {
    "goals": [
      {
        "id": "write-daily",
        "title": "Write something down every day",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "name-feelings",
        "title": "Name how you're actually feeling, daily",
        "description": "Putting words to it is most of the work.",
        "profiles": [
          "gap-closing"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "ten-minutes-quiet",
        "title": "Ten minutes of quiet every day",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "proper-conversation",
        "title": "A proper conversation every week for two months",
        "description": "Not logistics. The other kind.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [],
        "metric": {
          "kind": "cumulative",
          "unit": "conversations",
          "suggestedTarget": 8
        }
      }
    ],
    "tasks": [
      {
        "id": "journal",
        "title": "Journal",
        "description": "Three lines is a journal.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": "write-daily",
        "defaultRank": 1
      },
      {
        "id": "meditate",
        "title": "Meditate",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": "ten-minutes-quiet",
        "defaultRank": 2
      },
      {
        "id": "breathwork",
        "title": "Breathwork",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 3,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "check-in",
        "title": "Check in with someone",
        "description": "Someone who'd notice if you weren't honest.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 1,
        "goalId": "proper-conversation",
        "defaultRank": 4
      },
      {
        "id": "screen-free-evening",
        "title": "Screen-free evening",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "therapy",
        "title": "Therapy",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "walk-no-headphones",
        "title": "Walk without headphones",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 7
      },
      {
        "id": "phone-another-room",
        "title": "Phone in another room",
        "description": "An hour, awake.",
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 8
      }
    ]
  },
  "spirituality": {
    "goals": [
      {
        "id": "quiet-practice",
        "title": "A quiet practice every day",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "gratitude-written",
        "title": "Three things, written down, every day",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      }
    ],
    "tasks": [
      {
        "id": "stillness",
        "title": "Stillness",
        "description": "Ten minutes, no input.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": "quiet-practice",
        "defaultRank": 1
      },
      {
        "id": "gratitude",
        "title": "Gratitude",
        "description": "Three things. Specific ones.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": "gratitude-written",
        "defaultRank": 2
      },
      {
        "id": "prayer",
        "title": "Prayer",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "read-old",
        "title": "Read something old",
        "description": null,
        "profiles": [
          "light",
          "gap-closing"
        ],
        "timesPerWeek": 3,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "service",
        "title": "Service",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "phone-free-hour",
        "title": "Phone-free hour",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 6
      }
    ]
  },
  "giving-service": {
    "goals": [
      {
        "id": "volunteer-six",
        "title": "Volunteer twice a month for three months",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "milestones": [
          "2 sessions",
          "4 sessions",
          "6 sessions"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "sessions",
          "suggestedTarget": 6
        }
      },
      {
        "id": "regular-donation",
        "title": "Set up a regular donation",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "set up",
          "suggestedTarget": 1
        }
      },
      {
        "id": "small-thing-daily",
        "title": "One small thing for someone, every day",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance",
          "light"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      }
    ],
    "tasks": [
      {
        "id": "volunteer",
        "title": "Volunteer",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 1
      },
      {
        "id": "help-someone",
        "title": "Help someone out",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 2,
        "goalId": "small-thing-daily",
        "defaultRank": 2
      },
      {
        "id": "check-on-someone",
        "title": "Check on someone",
        "description": null,
        "profiles": [
          "maintenance",
          "gap-closing"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "donate",
        "title": "Donate",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "give-away",
        "title": "Give something away",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "say-the-thing",
        "title": "Say the thing",
        "description": "Tell someone the good thing you thought about them.",
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "reply-properly",
        "title": "Reply properly",
        "description": "A real reply rather than a holding one.",
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 3,
        "goalId": null,
        "defaultRank": 7
      }
    ]
  },
  "job-career": {
    "goals": [
      {
        "id": "deep-work-month",
        "title": "Two hours of deep work a day for a month",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "milestones": [
          "10 hours",
          "20 hours",
          "40 hours"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "hours",
          "suggestedTarget": 40
        }
      },
      {
        "id": "leave-on-time",
        "title": "Leave on time every day",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "ask-for-raise",
        "title": "Ask for a raise",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "asked",
          "suggestedTarget": 1
        }
      },
      {
        "id": "finish-certification",
        "title": "Finish a certification",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "career-conversation",
        "title": "Have a career conversation with your manager",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      }
    ],
    "tasks": [
      {
        "id": "deep-work",
        "title": "Deep work",
        "description": "Two hours, one thing, nothing else open.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 5,
        "goalId": "deep-work-month",
        "defaultRank": 1
      },
      {
        "id": "plan-tomorrow",
        "title": "Plan tomorrow",
        "description": "Five minutes at the end of the day.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 5,
        "goalId": null,
        "defaultRank": 2
      },
      {
        "id": "inbox-zero",
        "title": "Inbox to zero",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 3,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "finish-something",
        "title": "Finish something",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "learn-for-work",
        "title": "Learn something for work",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 2,
        "goalId": "finish-certification",
        "defaultRank": 5
      },
      {
        "id": "leave-on-time-task",
        "title": "Leave on time",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 5,
        "goalId": "leave-on-time",
        "defaultRank": 6
      },
      {
        "id": "review-week",
        "title": "Review the week",
        "description": "What moved, what didn't, what's next.",
        "profiles": [
          "maintenance"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 7
      },
      {
        "id": "industry-contact",
        "title": "Talk to someone in your field",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 8
      }
    ]
  },
  "education-learning": {
    "goals": [
      {
        "id": "read-12",
        "title": "Read 12 books this year",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "3 books",
          "6 books",
          "12 books"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "books",
          "suggestedTarget": 12
        }
      },
      {
        "id": "fifty-hours",
        "title": "50 hours on one skill",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "milestones": [
          "10 hours",
          "25 hours",
          "50 hours"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "hours",
          "suggestedTarget": 50
        }
      },
      {
        "id": "practice-daily",
        "title": "Practice something every day",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "finish-course",
        "title": "Finish a course",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      }
    ],
    "tasks": [
      {
        "id": "read",
        "title": "Read",
        "description": "Twenty minutes.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": "read-12",
        "defaultRank": 1
      },
      {
        "id": "practice",
        "title": "Practice",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 5,
        "goalId": "fifty-hours",
        "defaultRank": 2
      },
      {
        "id": "course",
        "title": "Course",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 3,
        "goalId": "finish-course",
        "defaultRank": 3
      },
      {
        "id": "test-yourself",
        "title": "Test yourself",
        "description": "Closed book. The recall is what makes it stick.",
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "write-it-up",
        "title": "Write it up",
        "description": "Explaining it is how you find the holes.",
        "profiles": [
          "maintenance",
          "gap-closing"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "language",
        "title": "Language",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "podcast-lecture",
        "title": "Podcast or lecture",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 3,
        "goalId": null,
        "defaultRank": 7
      }
    ]
  },
  "finances": {
    "goals": [
      {
        "id": "three-months-saved",
        "title": "Three months of expenses saved",
        "description": "The standard buffer. It buys calm well beyond its size.",
        "profiles": [
          "gap-closing"
        ],
        "milestones": [
          "1 month",
          "2 months",
          "3 months"
        ],
        "metric": {
          "kind": "target",
          "unit": "months",
          "suggestedTarget": 3
        }
      },
      {
        "id": "weekly-check",
        "title": "Check the accounts every week for three months",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [],
        "metric": {
          "kind": "cumulative",
          "unit": "checks",
          "suggestedTarget": 12
        }
      },
      {
        "id": "clear-a-debt",
        "title": "Clear one debt",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "cleared",
          "suggestedTarget": 1
        }
      },
      {
        "id": "track-a-month",
        "title": "Track every expense for a month",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      }
    ],
    "tasks": [
      {
        "id": "check-accounts",
        "title": "Check the accounts",
        "description": "Five minutes.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 1,
        "goalId": "weekly-check",
        "defaultRank": 1
      },
      {
        "id": "log-spending",
        "title": "Log what you spent",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 7,
        "goalId": "track-a-month",
        "defaultRank": 2
      },
      {
        "id": "move-to-savings",
        "title": "Move money to savings",
        "description": null,
        "profiles": [
          "maintenance",
          "gap-closing"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "review-subscriptions",
        "title": "Review subscriptions",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "no-spend-day",
        "title": "No-spend day",
        "description": null,
        "profiles": [
          "light",
          "gap-closing"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "admin",
        "title": "Admin",
        "description": "One form, letter, or call.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "read-statement",
        "title": "Read the statement",
        "description": null,
        "profiles": [
          "maintenance"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 7
      }
    ]
  },
  "living-space": {
    "goals": [
      {
        "id": "make-bed",
        "title": "Make the bed every day",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "tidy-ten",
        "title": "Ten minutes of tidying every day",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "clear-a-room",
        "title": "Clear one room properly",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "deep-clean",
        "title": "Deep clean the whole place",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      }
    ],
    "tasks": [
      {
        "id": "tidy",
        "title": "Tidy",
        "description": "Ten minutes.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": "tidy-ten",
        "defaultRank": 1
      },
      {
        "id": "make-bed-task",
        "title": "Make the bed",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": "make-bed",
        "defaultRank": 2
      },
      {
        "id": "dishes",
        "title": "Dishes",
        "description": null,
        "profiles": [
          "maintenance",
          "gap-closing"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "laundry",
        "title": "Laundry",
        "description": null,
        "profiles": [
          "maintenance"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "hoover",
        "title": "Hoover",
        "description": null,
        "profiles": [
          "maintenance",
          "gap-closing"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "change-sheets",
        "title": "Change the sheets",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "bins",
        "title": "Bins",
        "description": null,
        "profiles": [
          "maintenance"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 7
      },
      {
        "id": "plants",
        "title": "Plants",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 8
      },
      {
        "id": "one-drawer",
        "title": "One drawer or shelf",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 9
      }
    ]
  },
  "nature-surroundings": {
    "goals": [
      {
        "id": "two-hours-outside",
        "title": "120 minutes outside a week for a month",
        "description": "Any combination, one long walk or ten short ones. Below two hours a week the benefit doesn't show.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "120 minutes",
          "240 minutes",
          "480 minutes"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "minutes",
          "suggestedTarget": 480
        }
      },
      {
        "id": "outside-daily",
        "title": "Outside every day",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "morning-daylight",
        "title": "Daylight before 10am every day",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "somewhere-new",
        "title": "Somewhere new every week for two months",
        "description": null,
        "profiles": [
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "cumulative",
          "unit": "places",
          "suggestedTarget": 8
        }
      }
    ],
    "tasks": [
      {
        "id": "get-outside",
        "title": "Get outside",
        "description": "Ten minutes counts.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": "outside-daily",
        "defaultRank": 1
      },
      {
        "id": "morning-daylight-task",
        "title": "Morning daylight",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 7,
        "goalId": "morning-daylight",
        "defaultRank": 2
      },
      {
        "id": "green-space",
        "title": "Green space",
        "description": "A park, trees, water.",
        "profiles": [
          "maintenance",
          "gap-closing"
        ],
        "timesPerWeek": 3,
        "goalId": "two-hours-outside",
        "defaultRank": 3
      },
      {
        "id": "sit-outside",
        "title": "Sit outside",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 3,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "walk-somewhere-new",
        "title": "Walk somewhere new",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 1,
        "goalId": "somewhere-new",
        "defaultRank": 5
      },
      {
        "id": "open-windows",
        "title": "Open the windows",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "day-out",
        "title": "A proper day out",
        "description": null,
        "profiles": [
          "light",
          "gap-closing"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 7
      }
    ]
  },
  "hygiene": {
    "goals": [
      {
        "id": "floss-daily",
        "title": "Floss every day",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "brush-twice",
        "title": "Brush twice a day, every day",
        "description": "Two minutes each time.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      },
      {
        "id": "book-dentist",
        "title": "Book the dentist",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "booked",
          "suggestedTarget": 1
        }
      },
      {
        "id": "skincare-daily",
        "title": "Skincare every day",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "milestones": [
          "7",
          "30",
          "66"
        ],
        "metric": {
          "kind": "habit",
          "unit": "days",
          "suggestedTarget": null
        }
      }
    ],
    "tasks": [
      {
        "id": "brush",
        "title": "Brush",
        "description": "Twice, two minutes.",
        "profiles": [
          "maintenance",
          "gap-closing"
        ],
        "timesPerWeek": 7,
        "goalId": "brush-twice",
        "defaultRank": 1
      },
      {
        "id": "floss",
        "title": "Floss",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": "floss-daily",
        "defaultRank": 2
      },
      {
        "id": "shower",
        "title": "Shower",
        "description": null,
        "profiles": [
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "skincare",
        "title": "Skincare",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 7,
        "goalId": "skincare-daily",
        "defaultRank": 4
      },
      {
        "id": "hygiene-laundry",
        "title": "Laundry",
        "description": null,
        "profiles": [
          "maintenance"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "shave-trim",
        "title": "Shave or trim",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "nails",
        "title": "Nails",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 7
      },
      {
        "id": "haircut",
        "title": "Haircut",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 8
      }
    ]
  },
  "hobbies-interests": {
    "goals": [
      {
        "id": "finish-project",
        "title": "Finish a project",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "learn-new-skill",
        "title": "Learn a new skill",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "hours-this-quarter",
        "title": "24 hours on a hobby this quarter",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "6 hours",
          "12 hours",
          "24 hours"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "hours",
          "suggestedTarget": 24
        }
      },
      {
        "id": "make-for-someone",
        "title": "Make something for someone",
        "description": null,
        "profiles": [
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      }
    ],
    "tasks": [
      {
        "id": "project-time",
        "title": "Project time",
        "description": "One hour.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 3,
        "goalId": "hours-this-quarter",
        "defaultRank": 1
      },
      {
        "id": "hobby-practice",
        "title": "Practice",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 3,
        "goalId": "learn-new-skill",
        "defaultRank": 2
      },
      {
        "id": "make-something",
        "title": "Make something",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "learn-technique",
        "title": "Learn a technique",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 4
      },
      {
        "id": "tidy-workspace",
        "title": "Tidy the workspace",
        "description": null,
        "profiles": [
          "maintenance"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "restock-supplies",
        "title": "Restock supplies",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "show-someone",
        "title": "Show someone",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 7
      }
    ]
  },
  "art-media": {
    "goals": [
      {
        "id": "watch-12-films",
        "title": "Watch 12 films this year",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [
          "3 films",
          "6 films",
          "12 films"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "films",
          "suggestedTarget": 12
        }
      },
      {
        "id": "read-6-novels",
        "title": "Read 6 novels this year",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "2 books",
          "4 books",
          "6 books"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "books",
          "suggestedTarget": 6
        }
      },
      {
        "id": "six-live-events",
        "title": "Go to 6 live events this year",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [
          "2 events",
          "4 events",
          "6 events"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "events",
          "suggestedTarget": 6
        }
      },
      {
        "id": "four-galleries",
        "title": "Visit 4 galleries or museums this year",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "milestones": [],
        "metric": {
          "kind": "cumulative",
          "unit": "visits",
          "suggestedTarget": 4
        }
      }
    ],
    "tasks": [
      {
        "id": "film",
        "title": "Film",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "timesPerWeek": 1,
        "goalId": "watch-12-films",
        "defaultRank": 1
      },
      {
        "id": "read-novel",
        "title": "Read",
        "description": null,
        "profiles": [
          "maintenance",
          "gap-closing"
        ],
        "timesPerWeek": 7,
        "goalId": "read-6-novels",
        "defaultRank": 2
      },
      {
        "id": "album",
        "title": "Album, start to finish",
        "description": null,
        "profiles": [
          "light"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "gallery",
        "title": "Gallery or museum",
        "description": null,
        "profiles": [
          "light",
          "gap-closing"
        ],
        "timesPerWeek": 0,
        "goalId": "four-galleries",
        "defaultRank": 4
      },
      {
        "id": "live-music",
        "title": "Live music",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 0,
        "goalId": "six-live-events",
        "defaultRank": 5
      },
      {
        "id": "new-genre",
        "title": "Try a new genre",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 6
      },
      {
        "id": "talk-about-it",
        "title": "Talk about it",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 7
      }
    ]
  },
  "adventure-experiences": {
    "goals": [
      {
        "id": "four-new-places",
        "title": "Visit 4 new places this year",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "1 place",
          "2 places",
          "4 places"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "places",
          "suggestedTarget": 4
        }
      },
      {
        "id": "four-weekends-away",
        "title": "4 weekends away this year",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "cumulative",
          "unit": "trips",
          "suggestedTarget": 4
        }
      },
      {
        "id": "trip-abroad",
        "title": "Take a trip abroad",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "ten-new-things",
        "title": "Try 10 new things this year",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [
          "3 things",
          "6 things",
          "10 things"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "things",
          "suggestedTarget": 10
        }
      }
    ],
    "tasks": [
      {
        "id": "plan-something",
        "title": "Plan something",
        "description": "Twenty minutes of booking.",
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 1,
        "goalId": null,
        "defaultRank": 1
      },
      {
        "id": "somewhere-new",
        "title": "Somewhere new",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 1,
        "goalId": "four-new-places",
        "defaultRank": 2
      },
      {
        "id": "day-trip",
        "title": "Day trip",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 3
      },
      {
        "id": "try-something-new",
        "title": "Try something new",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "timesPerWeek": 0,
        "goalId": "ten-new-things",
        "defaultRank": 4
      },
      {
        "id": "book-something",
        "title": "Book something",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "timesPerWeek": 0,
        "goalId": null,
        "defaultRank": 5
      },
      {
        "id": "long-way",
        "title": "Take the long way",
        "description": null,
        "profiles": [
          "light",
          "maintenance"
        ],
        "timesPerWeek": 2,
        "goalId": null,
        "defaultRank": 6
      }
    ]
  },
  "significant-other": {
    "goals": [
      {
        "id": "twelve-dates",
        "title": "Go on 12 dates this year",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "3 dates",
          "6 dates",
          "12 dates"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "dates",
          "suggestedTarget": 12
        }
      },
      {
        "id": "trip-together",
        "title": "Take a trip together",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "six-new-things",
        "title": "Do 6 new things together this year",
        "description": "Novelty keeps satisfaction alive where routine wears it down.",
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [
          "2 things",
          "4 things",
          "6 things"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "things",
          "suggestedTarget": 6
        }
      },
      {
        "id": "weekend-away",
        "title": "Plan a weekend away",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      }
    ],
    "tasks": []
  },
  "family": {
    "goals": [
      {
        "id": "visit-six",
        "title": "Visit 6 times this year",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [
          "2 visits",
          "4 visits",
          "6 visits"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "visits",
          "suggestedTarget": 6
        }
      },
      {
        "id": "standing-call",
        "title": "Set up a standing call",
        "description": "A set time each week that neither of you has to arrange.",
        "profiles": [
          "gap-closing",
          "maintenance",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "family-trip",
        "title": "Plan a family trip",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "family-story",
        "title": "Record a family story",
        "description": null,
        "profiles": [
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      }
    ],
    "tasks": []
  },
  "friendship": {
    "goals": [
      {
        "id": "host-something",
        "title": "Host something",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "trip-with-friends",
        "title": "Plan a trip with friends",
        "description": null,
        "profiles": [
          "gap-closing",
          "light"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "old-friend",
        "title": "Get back in touch with an old friend",
        "description": null,
        "profiles": [
          "gap-closing",
          "maintenance"
        ],
        "milestones": [],
        "metric": {
          "kind": "target",
          "unit": "done",
          "suggestedTarget": 1
        }
      },
      {
        "id": "twelve-things",
        "title": "Do 12 things with friends this year",
        "description": null,
        "profiles": [
          "maintenance",
          "light"
        ],
        "milestones": [
          "3 times",
          "6 times",
          "12 times"
        ],
        "metric": {
          "kind": "cumulative",
          "unit": "times",
          "suggestedTarget": 12
        }
      }
    ],
    "tasks": []
  }
};
