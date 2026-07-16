/**
 * The default Strategic Life Areas and Units (vision.md), adapted from
 * Strack's strategic life portfolio. Ids are stable slugs: taxonomy
 * rows are never deleted or re-keyed (ADR-0002 §2), so ratings and
 * grades can reference them forever. Renames change `name` only.
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
    id: "body-mind-spirituality",
    name: "Body, mind, and spirituality",
    units: [
      { id: "physical-health", name: "Physical health/sports" },
      { id: "mental-health", name: "Mental health/mindfulness" },
      { id: "spirituality", name: "Spirituality/faith" },
    ],
  },
  {
    id: "community-society",
    name: "Community and society",
    units: [
      { id: "community", name: "Community/citizenship" },
      { id: "societal-engagement", name: "Societal engagement" },
    ],
  },
  {
    id: "job-learning-finances",
    name: "Job, learning, and finances",
    units: [
      { id: "job-career", name: "Job/career" },
      { id: "education-learning", name: "Education/learning" },
      { id: "finances", name: "Finances" },
    ],
  },
  {
    id: "interests-entertainment",
    name: "Interests and entertainment",
    units: [
      { id: "hobbies-interests", name: "Hobbies/interests" },
      { id: "online-entertainment", name: "Online entertainment" },
      { id: "offline-entertainment", name: "Offline entertainment" },
    ],
  },
  {
    id: "personal-care",
    name: "Personal care",
    units: [
      { id: "physiological-needs", name: "Physiological needs" },
      { id: "daily-living", name: "Activities of daily living" },
    ],
  },
];
