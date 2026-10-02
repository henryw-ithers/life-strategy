/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: docs/content/areas.md
 * Regenerate: npm run content:build
 *
 * Edits here are lost on the next build, and `npm run content:check`
 * fails the moment this file and its source disagree.
 */

export interface AreaInfo {
  /** The area's display name, so a caller with only an id can title it. */
  name: string;
  description: string;
  /** What sits inside it, in plain language — one line per unit. */
  covers: string[];
}

export const AREA_INFO: Record<string, AreaInfo> = {
  "relationships": {
    "name": "Relationships",
    "description": "The people you are close to, and the standing you have with them.",
    "covers": [
      "Significant other: your romantic partnership, or your relationship with being single.",
      "Family: parents, siblings, children, chosen family.",
      "Friendship: the people you would call, and how much you actually do."
    ]
  },
  "physical-health": {
    "name": "Physical health",
    "description": "The body you live in and what you ask of it.",
    "covers": [
      "Exercise and fitness: moving on purpose, at whatever intensity is yours.",
      "Nutrition: what you eat, and how much thought goes into it.",
      "Sleep and recovery: hours, consistency, and whether you wake up restored."
    ]
  },
  "mental-wellbeing": {
    "name": "Mental wellbeing",
    "description": "Your inner life: what you think about, and what you do with it.",
    "covers": [
      "Mental and emotional health: mood, stress, and how you handle both.",
      "Spirituality: meaning, practice, or whatever you call the larger frame.",
      "Giving and service: what you do for people who are not close to you."
    ]
  },
  "work-money": {
    "name": "Work and money",
    "description": "What you do for a living and what it pays for.",
    "covers": [
      "Job and career: the work itself, and where it is heading.",
      "Learning and growth: skills you are building on purpose.",
      "Finances: what you earn, spend, owe, and keep."
    ]
  },
  "home-environment": {
    "name": "Environment",
    "description": "Where you live and what surrounds you, and the upkeep that keeps it liveable.",
    "covers": [
      "Living space: the state of where you live.",
      "Nature: time outdoors, in whatever form you get it.",
      "Hygiene: the daily maintenance nobody praises you for."
    ]
  },
  "leisure-creativity": {
    "name": "Leisure and creativity",
    "description": "What you do when nothing is being asked of you.",
    "covers": [
      "Hobbies and projects: the things you make or tinker with.",
      "Art and media: what you read, watch, and listen to on purpose.",
      "Adventure and experiences: travel, novelty, the days that stand out."
    ]
  }
};
