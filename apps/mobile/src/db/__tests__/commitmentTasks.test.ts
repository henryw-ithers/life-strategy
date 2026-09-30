/**
 * Where a commitment task lives and how it is keyed (ADR-0029 §3,
 * ADR-0032).
 *
 * These are the rules the write seam in `tasks.ts` enforces; that
 * module imports the database and cannot be tested here.
 */
import { bandPointValues, type BandTask, type CommitmentDay } from "@glide/scoring";
import { describe, expect, it } from "vitest";

import {
  isCommitmentUnit,
  membershipsFor,
  toBandKeys,
} from "../commitmentPlan";

describe("isCommitmentUnit", () => {
  const unit = (isCustom: boolean, parentUnitId: string | null, commitmentShare: number | null) => ({
    isCustom,
    parentUnitId,
    commitmentShare,
  });

  it("recognises a commitment by its share and a part by its parent", () => {
    expect(isCommitmentUnit(unit(true, null, 50))).toBe(true);
    expect(isCommitmentUnit(unit(true, "school", null))).toBe(true);
  });

  it("leaves an ordinary custom life unit alone", () => {
    // Custom, but no share and no parent: it prices from the 18.
    expect(isCommitmentUnit(unit(true, null, null))).toBe(false);
  });

  it("never treats a built-in unit as one", () => {
    expect(isCommitmentUnit(unit(false, null, 50))).toBe(false);
  });
});

describe("membershipsFor", () => {
  const commitments = new Set(["school", "comp2521"]);

  it("makes a commitment task's life-unit tags notes", () => {
    expect(membershipsFor(["comp2521", "education-learning"], commitments)).toEqual([
      { unitId: "comp2521", membership: "scoring" },
      { unitId: "education-learning", membership: "note" },
    ]);
  });

  it("leaves an ordinary multi-unit task scoring everywhere (ADR-0019)", () => {
    expect(membershipsFor(["exercise-fitness", "hobbies"], commitments)).toEqual([
      { unitId: "exercise-fitness", membership: "scoring" },
      { unitId: "hobbies", membership: "scoring" },
    ]);
  });

  it("refuses a commitment anywhere but first", () => {
    expect(() => membershipsFor(["exercise-fitness", "school"], commitments)).toThrow(
      /listed under/,
    );
  });

  it("refuses two commitments on one task", () => {
    expect(() => membershipsFor(["school", "comp2521"], commitments)).toThrow();
  });

  it("returns nothing for nothing", () => {
    expect(membershipsFor([], commitments)).toEqual([]);
  });
});

describe("toBandKeys", () => {
  const day: CommitmentDay = {
    band: 40,
    commitments: [{ commitmentId: "school", share: 1, unitIds: ["school", "comp2521"] }],
    eligibleTaskIds: ["essay", "lab"],
    pools: [{ taskIds: ["essay", "lab"], plannedCount: 1 }],
  };
  const homes = new Map([
    ["essay", "comp2521"],
    ["lab", "school"],
  ]);

  it("rewrites eligible tasks and pool members onto membership keys", () => {
    const keyed = toBandKeys(day, homes);
    expect(keyed.eligibleTaskIds).toEqual(["essay::comp2521", "lab::school"]);
    expect(keyed.pools?.[0]?.taskIds).toEqual(["essay::comp2521", "lab::school"]);
    expect(keyed.band).toBe(40);
  });

  it("is what lets the band actually pay in the app", () => {
    // The regression: the app prices `taskId::unitId`, eligibility is
    // recorded by task. Unkeyed, the band found no eligible task and
    // paid nobody; keyed, it pays its whole 40.
    const tasks: BandTask[] = [
      { id: "essay::comp2521", unitId: "comp2521", timesPerWeek: 1, rankInUnit: 1 },
      { id: "lab::school", unitId: "school", timesPerWeek: 1, rankInUnit: 1 },
    ];
    const noPools = { ...day, pools: [] };
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

    expect(sum(bandPointValues([], tasks, noPools))).toBe(0);
    expect(sum(bandPointValues([], tasks, toBandKeys(noPools, homes)))).toBe(40);
  });

  it("leaves a task with no known home as it was, rather than inventing a key", () => {
    expect(toBandKeys({ ...day, pools: undefined }, new Map()).eligibleTaskIds).toEqual([
      "essay",
      "lab",
    ]);
  });
});
