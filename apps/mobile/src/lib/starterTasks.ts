/**
 * Onboarding's "A few tasks" step (ADR-0045 §1 step 5): two or three
 * starter tasks from the library for each Top unit, to tap to add.
 * Nothing is selected for you, and Not now units are skipped by being
 * not Top. A starter you already have shows as added, ticked, so a
 * tap can't make it twice and a re-run shows what's there.
 */
import type { Tier } from "@glide/scoring";

import type { TaskTemplate, UnitLibrary } from "../content/library";

/** At most this many starters per unit. */
export const STARTERS_PER_UNIT = 3;

export interface StarterUnitInput {
  id: string;
  name: string;
  areaId: string;
  tier: Tier | null;
  tierOrder: number | null;
  /** The titles of the tasks it already has. */
  taskTitles: readonly string[];
}

export interface StarterUnit {
  id: string;
  name: string;
  areaId: string;
  /** Library tasks to offer, best first. May be empty: Add your own. */
  starters: { task: TaskTemplate; added: boolean }[];
}

const key = (title: string) => title.trim().toLowerCase();

/** Top units in your order, each with its starters. */
export function starterUnits(
  units: readonly StarterUnitInput[],
  library: Readonly<Record<string, UnitLibrary>>,
): StarterUnit[] {
  return units
    .filter((u) => u.tier === "top")
    .sort((a, b) => (a.tierOrder ?? 0) - (b.tierOrder ?? 0))
    .map((u) => {
      const have = new Set(u.taskTitles.map(key));
      const starters = [...(library[u.id]?.tasks ?? [])]
        .sort((a, b) => a.defaultRank - b.defaultRank)
        .slice(0, STARTERS_PER_UNIT)
        .map((task) => ({ task, added: have.has(key(task.title)) }));
      return { id: u.id, name: u.name, areaId: u.areaId, starters };
    });
}
