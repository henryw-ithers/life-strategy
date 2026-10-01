/**
 * Commitment tasks can ride in the same weighting input as life tasks,
 * in units with no weight of their own. They must not move a single
 * life task's weight, and they must not take one themselves — a
 * commitment task is priced by its band, never by `taskWeights`
 * (ADR-0035 §3: a second price would double-pay it across two bands).
 */
import { describe, expect, it } from "vitest";

import { taskWeights, type BandTask, type BandUnit } from "../bands";

const LIFE: BandUnit[] = [
  { unitId: "fitness", weight: 40 },
  { unitId: "learning", weight: 35 },
  { unitId: "hygiene", weight: 25 },
];
const COMMITMENT_UNITS: BandUnit[] = [
  { unitId: "school", weight: 0 },
  { unitId: "comp2521", weight: 0 },
];

const life: BandTask[] = [
  { id: "run", unitId: "fitness", rankInUnit: 1 },
  { id: "read", unitId: "learning", rankInUnit: 1 },
  { id: "course", unitId: "learning", rankInUnit: 2 },
  { id: "brush", unitId: "hygiene", rankInUnit: 1 },
];
const school: BandTask[] = [
  { id: "lecture", unitId: "school", rankInUnit: 1 },
  { id: "essay", unitId: "comp2521", rankInUnit: 1 },
  { id: "tutorial", unitId: "comp2521", rankInUnit: 2 },
];

const lifeValues = (m: Map<string, number>) =>
  Object.fromEntries(life.map((t) => [t.id, m.get(t.id)]));

describe("commitment tasks leave life weights alone", () => {
  it("does not move a life task's weight", () => {
    const without = taskWeights(LIFE, life);
    const withSchool = taskWeights([...LIFE, ...COMMITMENT_UNITS], [...life, ...school]);
    expect(lifeValues(withSchool)).toEqual(lifeValues(without));
  });

  it("gives commitment tasks no weight of their own", () => {
    const withSchool = taskWeights([...LIFE, ...COMMITMENT_UNITS], [...life, ...school]);
    for (const t of school) expect(withSchool.get(t.id)).toBe(0);
  });
});
