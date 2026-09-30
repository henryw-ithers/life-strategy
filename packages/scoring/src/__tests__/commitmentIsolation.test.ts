/**
 * Commitment tasks ride in the same pricing input as life tasks, in
 * units with no weight of their own. They must not move a single life
 * task's value — on an ordinary day or a commitment day.
 *
 * The risk is concrete: the variable band divides among units holding
 * non-daily work, so a zero-weight unit joining that set is exactly the
 * kind of change that could shift the divisor without anyone noticing.
 */
import { describe, expect, it } from "vitest";

import { bandPointValues, type BandTask, type BandUnit, type CommitmentDay } from "../bands";

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
  { id: "run", unitId: "fitness", timesPerWeek: 3, rankInUnit: 1 },
  { id: "read", unitId: "learning", timesPerWeek: 7, rankInUnit: 1 },
  { id: "course", unitId: "learning", timesPerWeek: 2, rankInUnit: 2 },
  { id: "brush", unitId: "hygiene", timesPerWeek: 7, rankInUnit: 1 },
];
const school: BandTask[] = [
  { id: "lecture", unitId: "school", timesPerWeek: 2, rankInUnit: 1 },
  { id: "essay", unitId: "comp2521", timesPerWeek: 1, rankInUnit: 1 },
  { id: "tutorial", unitId: "comp2521", timesPerWeek: 7, rankInUnit: 2 },
];

const lifeValues = (m: Map<string, number>) =>
  Object.fromEntries(life.map((t) => [t.id, m.get(t.id)]));

describe("commitment tasks leave life values alone", () => {
  it("on an ordinary day", () => {
    const without = bandPointValues(LIFE, life);
    const withSchool = bandPointValues([...LIFE, ...COMMITMENT_UNITS], [...life, ...school]);
    expect(lifeValues(withSchool)).toEqual(lifeValues(without));
    for (const t of school) expect(withSchool.get(t.id)).toBe(0);
  });

  it("on a commitment day, where only the band scale moves them", () => {
    const day: CommitmentDay = {
      band: 40,
      commitments: [{ commitmentId: "school", share: 1, unitIds: ["school", "comp2521"] }],
      eligibleTaskIds: ["lecture", "essay"],
    };
    // The same day priced with the commitment tasks absent from the
    // input but the band still applying — so any difference is the
    // extra tasks, not the band.
    const onlyLife = bandPointValues(LIFE, [...life, school[0]!], {
      ...day,
      eligibleTaskIds: ["lecture"],
    });
    const withSchool = bandPointValues([...LIFE, ...COMMITMENT_UNITS], [...life, ...school], day);
    expect(lifeValues(withSchool)).toEqual(lifeValues(onlyLife));
  });
});
