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
}

export interface UnitLibrary {
  tasks: TaskTemplate[];
}

/** Keyed by unit id. Communal units carry no tasks (ADR-0025 §5); the
 *  build refuses to generate them. Goals went with ADR-0047. */
export const LIBRARY: Record<string, UnitLibrary> = {
  "exercise-fitness": {
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
        "defaultRank": 8
      }
    ]
  },
  "nutrition": {
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
        "defaultRank": 8
      }
    ]
  },
  "sleep-recovery": {
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
        "defaultRank": 7
      }
    ]
  },
  "mental-health": {
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
        "defaultRank": 8
      }
    ]
  },
  "spirituality": {
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
        "defaultRank": 6
      }
    ]
  },
  "giving-service": {
    "tasks": [
      {
        "id": "volunteer",
        "title": "Volunteer",
        "description": null,
        "profiles": [
          "gap-closing"
        ],
        "timesPerWeek": 0,
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
        "defaultRank": 7
      }
    ]
  },
  "job-career": {
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
        "defaultRank": 8
      }
    ]
  },
  "education-learning": {
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
        "defaultRank": 7
      }
    ]
  },
  "finances": {
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
        "defaultRank": 7
      }
    ]
  },
  "living-space": {
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
        "defaultRank": 9
      }
    ]
  },
  "nature-surroundings": {
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
        "defaultRank": 7
      }
    ]
  },
  "hygiene": {
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
        "defaultRank": 8
      }
    ]
  },
  "hobbies-interests": {
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
        "defaultRank": 7
      }
    ]
  },
  "art-media": {
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
        "defaultRank": 7
      }
    ]
  },
  "adventure-experiences": {
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
        "defaultRank": 6
      }
    ]
  },
  "significant-other": {
    "tasks": []
  },
  "family": {
    "tasks": []
  },
  "friendship": {
    "tasks": []
  }
};
