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
  coverage,
  doneAheadOn,
  isCommitmentUnit,
  membershipsFor,
  scheduledDateFor,
  sessionFor,
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

describe("scheduledDateFor — the day off-schedule work is priced against", () => {
  // 2026-09-28 is a Monday.
  const recurring = (plannedWeekdays: string | null, timesPerWeek = 3) => ({
    oneOffSize: null,
    oneOffDate: null,
    plannedWeekdays,
    timesPerWeek,
  });
  const oneOff = (oneOffDate: string | null) => ({
    oneOffSize: "big",
    oneOffDate,
    plannedWeekdays: null,
    timesPerWeek: 1,
  });

  it("prices an assignment done early against its own planned day", () => {
    expect(scheduledDateFor(oneOff("2026-10-02"), "2026-09-29")).toBe("2026-10-02");
  });

  it("gives nothing for a one-off already due, which is simply eligible", () => {
    expect(scheduledDateFor(oneOff("2026-09-29"), "2026-09-29")).toBeNull();
    expect(scheduledDateFor(oneOff(null), "2026-09-29")).toBeNull();
  });

  it("finds a pinned session's next scheduled day", () => {
    // Mon/Wed/Fri, done on Saturday: next is Monday.
    expect(scheduledDateFor(recurring("1,3,5"), "2026-10-03")).toBe("2026-10-05");
    // Done on Tuesday: next is Wednesday.
    expect(scheduledDateFor(recurring("1,3,5"), "2026-09-29")).toBe("2026-09-30");
  });

  it("looks past today, even when today is itself a scheduled day", () => {
    expect(scheduledDateFor(recurring("1"), "2026-09-28")).toBe("2026-10-05");
  });

  it("reaches a fortnightly session in the other week", () => {
    const fortnightly = { ...recurring("1", 0), fortnightOffset: 1 };
    const next = scheduledDateFor(fortnightly, "2026-09-28");
    expect(next).not.toBeNull();
    expect(next! > "2026-09-28").toBe(true);
  });

  it("has nothing to borrow for an unpinned recurring task", () => {
    expect(scheduledDateFor(recurring(null), "2026-09-29")).toBeNull();
  });
});

describe("coverage — an early session stands in for the next (ADR-0032 §4)", () => {
  // 2026-09-28 is a Monday. A Mon/Wed/Fri session.
  const mwf = { plannedWeekdays: "1,3,5", timesPerWeek: 3 };
  const MON = "2026-09-28";
  const TUE = "2026-09-29";
  const WED = "2026-09-30";
  const THU = "2026-10-01";
  const FRI = "2026-10-02";
  const SAT = "2026-10-03";
  const SUN = "2026-10-04";
  const NEXT_MON = "2026-10-05";
  const NEXT_WED = "2026-10-07";

  it("takes the next scheduled session", () => {
    expect(coverage(mwf, [TUE])).toEqual(new Map([[TUE, WED]]));
  });

  it("ignores completions on the task's own days", () => {
    expect(coverage(mwf, [MON, WED, FRI]).size).toBe(0);
  });

  it("gives two early ticks two sessions rather than one", () => {
    // Saturday and Sunday would both reach Monday; each session is paid
    // once, so Sunday moves on to Wednesday.
    expect(coverage(mwf, [SAT, SUN])).toEqual(
      new Map([
        [SAT, NEXT_MON],
        [SUN, NEXT_WED],
      ]),
    );
  });

  it("skips a session already done on its own day", () => {
    // Wednesday was ticked on Wednesday; Tuesday's early tick, entered
    // later, takes Friday instead of doing Wednesday twice.
    expect(coverage(mwf, [WED, TUE]).get(TUE)).toBe(FRI);
  });

  it("answers the same however the rows were entered", () => {
    expect(coverage(mwf, [SUN, SAT, TUE])).toEqual(coverage(mwf, [TUE, SAT, SUN]));
  });

  it("never lets two completions share a session", () => {
    // Every off day of a fortnight, ticked.
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 28 + i));
      return d.toISOString().slice(0, 10);
    });
    const sessions = [...coverage(mwf, days).values()];
    expect(new Set(sessions).size).toBe(sessions.length);
  });

  it("covers nothing for a task with no scheduled days", () => {
    expect(coverage({ plannedWeekdays: null, timesPerWeek: 3 }, [TUE]).size).toBe(0);
  });

  describe("sessionFor — what an unticked off-day row would take", () => {
    it("is the next free session", () => {
      expect(sessionFor(mwf, TUE, [])).toBe(WED);
      expect(sessionFor(mwf, SUN, [SAT])).toBe(NEXT_WED);
    });

    it("is nothing on the task's own day", () => {
      expect(sessionFor(mwf, WED, [])).toBeNull();
    });

    it("matches what the tick then records", () => {
      const before = sessionFor(mwf, THU, [TUE]);
      expect(coverage(mwf, [TUE, THU]).get(THU)).toBe(before);
    });
  });

  describe("doneAheadOn — the session's own day", () => {
    it("names the day that did it early", () => {
      expect(doneAheadOn(mwf, WED, [TUE])).toBe(TUE);
    });

    it("is null for a session nobody covered", () => {
      expect(doneAheadOn(mwf, FRI, [TUE])).toBeNull();
      expect(doneAheadOn(mwf, WED, [])).toBeNull();
    });
  });
});
