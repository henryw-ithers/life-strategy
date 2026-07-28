/**
 * The default Strategic Life Areas and Units (vision.md) — revised
 * from Strack's original taxonomy (2026-07-16 revision: physical and
 * mental health split into their own areas, personal care dissolved
 * into them, community area replaced by Home & environment, giving
 * moved into Mental wellbeing, spirituality kept with an inclusive
 * framing, leisure rebuilt around making vs. taking in; 2026-07-27
 * revision: Home & environment reframed as Wellness — the maintenance
 * area, low-effort/high-return upkeep where most other areas are
 * about growth — keeping living space and nature and gaining hygiene,
 * which partially revives Strack's dissolved personal-care dimension).
 *
 * Ids are stable slugs (ADR-0002): units that continue a life
 * dimension KEEP their id across revisions (renames/re-homes are
 * labels), so rating history stays connected — which is why Wellness
 * still carries the `home-environment` id and its amber hue. Retired
 * units are archived by the sync, never deleted. Unit descriptions
 * and guidelines live in src/content/units.ts, keyed by these ids.
 */
export interface SeedUnit {
  id: string;
  name: string;
}

export interface SeedArea {
  id: string;
  name: string;
  units: SeedUnit[];
}

export const DEFAULT_TAXONOMY: SeedArea[] = [
  {
    id: "relationships",
    name: "Relationships",
    units: [
      { id: "significant-other", name: "Significant other" },
      { id: "family", name: "Family" },
      { id: "friendship", name: "Friendship" },
    ],
  },
  {
    id: "physical-health",
    name: "Physical health",
    units: [
      { id: "exercise-fitness", name: "Exercise & fitness" },
      { id: "nutrition", name: "Nutrition" },
      { id: "sleep-recovery", name: "Sleep & recovery" },
    ],
  },
  {
    id: "mental-wellbeing",
    name: "Mental wellbeing",
    units: [
      // Continues the old "mental-health" unit (renamed, re-homed).
      { id: "mental-health", name: "Mental & emotional health" },
      // Continues the old "spirituality" unit, inclusively framed.
      { id: "spirituality", name: "Spirituality" },
      { id: "giving-service", name: "Giving & service" },
    ],
  },
  {
    id: "work-money",
    name: "Work & money",
    units: [
      { id: "job-career", name: "Job/career" },
      // Continues the old "education-learning" unit.
      { id: "education-learning", name: "Learning & growth" },
      { id: "finances", name: "Finances" },
    ],
  },
  {
    // Id predates the 2026-07-27 rename; keep it (see header note).
    id: "home-environment",
    name: "Wellness",
    units: [
      { id: "living-space", name: "Living space" },
      // Id predates the 2026-07-27 rename; keep it (see header note).
      { id: "nature-surroundings", name: "Nature" },
      { id: "hygiene", name: "Hygiene" },
    ],
  },
  {
    id: "leisure-creativity",
    name: "Leisure & creativity",
    units: [
      // Continues the old "hobbies-interests" unit.
      { id: "hobbies-interests", name: "Hobbies & projects" },
      { id: "art-media", name: "Art & media" },
      { id: "adventure-experiences", name: "Adventure & experiences" },
    ],
  },
];
