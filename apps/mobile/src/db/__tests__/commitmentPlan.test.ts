import { describe, expect, it } from "vitest";

import {
  buildCommitmentDay,
  eligibleTaskIds,
  groupCommitments,
  type CommitmentUnitRow,
  type EligibilityRow,
} from "../commitmentPlan";

const unit = (
  id: string,
  parentUnitId: string | null = null,
  commitmentShare: number | null = null,
): CommitmentUnitRow => ({ id, parentUnitId, commitmentShare });

const pinned = (id: string, unitId: string, days: string): EligibilityRow => ({
  id,
  unitId,
  plannedWeekdays: days,
  timesPerWeek: days.split(",").length,
  oneOffSize: null,
  oneOffDate: null,
});

const oneOff = (
  id: string,
  unitId: string,
  oneOffDate: string | null,
): EligibilityRow => ({
  id,
  unitId,
  plannedWeekdays: null,
  timesPerWeek: 1,
  oneOffSize: "normal",
  oneOffDate,
});

// 2026-09-14 is a Monday (ISO weekday 1); 2026-09-15 a Tuesday.
const MONDAY = "2026-09-14";
const TUESDAY = "2026-09-15";

describe("groupCommitments — ADR-0029 §1", () => {
  it("folds sub-commitments into their parent", () => {
    const groups = groupCommitments([
      unit("school", null, 50),
      unit("comp2521", "school"),
      unit("math1231", "school"),
      unit("work", null, 30),
    ]);
    expect(groups).toEqual([
      {
        commitmentId: "school",
        share: 50,
        unitIds: ["school", "comp2521", "math1231"],
      },
      { commitmentId: "work", share: 30, unitIds: ["work"] },
    ]);
  });

  it("never lists a sub-commitment as a commitment in its own right", () => {
    const groups = groupCommitments([
      unit("school", null, 50),
      // A sub-commitment carrying a share is still a sub-commitment:
      // shares belong to the parent, and sub-commitments price nothing.
      unit("comp2521", "school", 99),
    ]);
    expect(groups.map((g) => g.commitmentId)).toEqual(["school"]);
  });

  it("ignores a custom unit with no share — it is not a commitment", () => {
    expect(groupCommitments([unit("stray", null, null)])).toEqual([]);
  });
});

describe("eligibleTaskIds — ADR-0032 §3", () => {
  const rows = [
    pinned("lecture", "comp2521", "1,3"), // Mon + Wed
    pinned("tutorial", "comp2521", "2"), // Tue
    oneOff("essay", "comp2521", MONDAY),
  ];

  it("includes work pinned to this weekday", () => {
    expect(eligibleTaskIds(rows, new Set(), MONDAY)).toContain("lecture");
    expect(eligibleTaskIds(rows, new Set(), MONDAY)).not.toContain("tutorial");
    expect(eligibleTaskIds(rows, new Set(), TUESDAY)).toContain("tutorial");
  });

  it("includes an outstanding one-off from its date onward", () => {
    expect(eligibleTaskIds(rows, new Set(), MONDAY)).toContain("essay");
    expect(eligibleTaskIds(rows, new Set(), TUESDAY)).toContain("essay");
  });

  it("excludes a one-off finished on an earlier day", () => {
    expect(eligibleTaskIds(rows, new Set(["essay"]), TUESDAY)).not.toContain(
      "essay",
    );
  });

  it("excludes a one-off dated in the future", () => {
    const later = [oneOff("exam", "comp2521", TUESDAY)];
    expect(eligibleTaskIds(later, new Set(), MONDAY)).toEqual([]);
  });

  it("excludes unpinned recurring work, which belongs to no day", () => {
    // ADR-0033 requires commitment sessions to be scheduled, and this
    // is why: an unscheduled one could never be paid by any day's band.
    const flexible: EligibilityRow[] = [
      {
        id: "reading",
        unitId: "comp2521",
        plannedWeekdays: null,
        timesPerWeek: 3,
        oneOffSize: null,
        oneOffDate: null,
      },
    ];
    expect(eligibleTaskIds(flexible, new Set(), MONDAY)).toEqual([]);
  });
});

describe("buildCommitmentDay — the three routes to an ordinary day", () => {
  const groups = groupCommitments([unit("school", null, 50)]);

  it("is null when no band is set", () => {
    expect(buildCommitmentDay(null, groups, ["lecture"])).toBeNull();
  });

  it("is null when there are no commitments", () => {
    expect(buildCommitmentDay(40, [], ["lecture"])).toBeNull();
  });

  it("is null when nothing is scheduled today — ADR-0032 §1", () => {
    // The band exists only on days it can be earned. This is what stops
    // an empty Sunday capping below 100 through someone else's
    // timetable, and it is the case most likely to be broken by a
    // refactor, because the other two are obvious.
    expect(buildCommitmentDay(40, groups, [])).toBeNull();
  });

  it("builds a day when all three hold", () => {
    expect(buildCommitmentDay(40, groups, ["lecture"])).toEqual({
      band: 40,
      commitments: groups,
      eligibleTaskIds: ["lecture"],
    });
  });
});
