/**
 * The default Strategic Life Areas and Units (vision.md) — revised
 * from Strack's original taxonomy (2026-07-16 revision: physical and
 * mental health split into their own areas, personal care dissolved
 * into them, community area replaced by Home & environment, giving
 * moved into Mental wellbeing, spirituality kept with an inclusive
 * framing, leisure rebuilt around making vs. taking in; 2026-07-27
 * revision: Home & environment reframed as Wellness, then renamed back
 * to Environment on 2026-08-26 — the maintenance
 * area, low-effort/high-return upkeep where most other areas are
 * about growth — keeping living space and nature and gaining hygiene,
 * which partially revives Strack's dissolved personal-care dimension).
 *
 * Ids are stable slugs (ADR-0002): units that continue a life
 * dimension KEEP their id across revisions (renames/re-homes are
 * labels), so rating history stays connected — which is why the area
 * carries the `home-environment` id and its amber hue throughout. Retired
 * units are archived by the sync, never deleted. Unit descriptions
 * and guidelines live in src/content/units.ts, keyed by these ids.
 */
export interface SeedUnit {
  id: string;
  name: string;
  /**
   * ADR-0025 §1. Omitted means `instrumental`, which is 15 of the 18 —
   * only the three Relationships units are `communal`, and they are
   * **dimensions rather than containers**: no tasks of their own, and
   * anything may tag them instead.
   *
   * There is deliberately no `autotelic` value. That distinction is
   * editorial only (§13) and lives in the unit's guidance copy, the
   * same way ADR-0021 keeps areas presentational.
   */
  motivationKind?: "instrumental" | "communal";
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
      // The three communal units (ADR-0025 §1). Giving & service is
      // deliberately NOT here: Clark & Mills concerns dyadic close
      // relationships, and service to strangers carries no comparable
      // ledger risk.
      {
        id: "significant-other",
        name: "Significant other",
        motivationKind: "communal",
      },
      { id: "family", name: "Family", motivationKind: "communal" },
      { id: "friendship", name: "Friendship", motivationKind: "communal" },
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
    // The id was always right; only the label wandered. Kept through
    // both renames (see header note).
    id: "home-environment",
    name: "Environment",
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
