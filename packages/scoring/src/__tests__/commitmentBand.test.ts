/**
 * Pricing the commitment band (ADR-0032) and pools (ADR-0033 §3).
 *
 * Every assertion here is a claim the ADRs make in prose. Where a
 * number appears in ADR-0032 it is reproduced here so the two cannot
 * drift apart silently.
 *
 * Since formula v10 the band prices only commitment work: life tasks
 * are weights (`taskWeights`) paid as a fraction of the day's load, and
 * all a commitment day does to them is scale the life share they are
 * paid from (`lifeShare`). That half is pinned in `commitmentGrade`.
 */
import { describe, expect, it } from "vitest";

import {
  commitmentBandMax,
  commitmentBandOn,
  rebalanceShares,
  commitmentPointValues,
  lifeShare,
  normalizeBand,
  COMMITMENT_BAND_MAX,
  COMMITMENT_BAND_MIN,
  type CommitmentDay,
} from "../bands";

const task = (id: string, unitId: string) => ({ id, unitId });

/** School (three classes) + Work, as commitment groups. */
const SCHOOL = {
  commitmentId: "school",
  share: 50,
  unitIds: ["school", "comp2521", "math1231", "phys1121"],
};
const WORK = { commitmentId: "work", share: 30, unitIds: ["work"] };

const sum = (v: Map<string, number>, ids: readonly string[]) =>
  ids.reduce((a, id) => a + (v.get(id) ?? 0), 0);

describe("normalizeBand — ADR-0032 §2", () => {
  it("clamps to 10–60 with one commitment and snaps to steps of 5", () => {
    expect(normalizeBand(40)).toBe(40);
    expect(normalizeBand(42)).toBe(40);
    expect(normalizeBand(43)).toBe(45);
    expect(normalizeBand(0)).toBe(COMMITMENT_BAND_MIN);
    expect(normalizeBand(100)).toBe(60);
    expect(normalizeBand(Number.NaN)).toBe(COMMITMENT_BAND_MIN);
  });
});

describe("the cap grows with the commitments — ADR-0032 §2, 2026-10-02", () => {
  it("is 60 with one, 70 with two, 80 with three", () => {
    expect(commitmentBandMax(1)).toBe(60);
    expect(commitmentBandMax(2)).toBe(70);
    expect(commitmentBandMax(3)).toBe(80);
    expect(COMMITMENT_BAND_MAX).toBe(80);
  });

  it("is 60 with none, so a band set early cannot run ahead of them", () => {
    expect(commitmentBandMax(0)).toBe(60);
  });

  it("clamps to the cap for the count it is given", () => {
    expect(normalizeBand(80, 1)).toBe(60);
    expect(normalizeBand(80, 2)).toBe(70);
    expect(normalizeBand(80, 3)).toBe(80);
  });

  it("applies on the day, from the commitments the day knows about", () => {
    // 80 set with three commitments; one archived since → read as 70.
    const two = [SCHOOL, WORK];
    expect(commitmentBandOn({ band: 80, commitments: two, eligibleTaskIds: ["lec"] })).toBe(70);
    const v = commitmentPointValues(
      { band: 80, commitments: two, eligibleTaskIds: ["lec", "shift"] },
      [task("lec", "comp2521"), task("shift", "work")],
    );
    expect(sum(v, ["lec", "shift"])).toBe(70);
  });
});

describe("rebalanceShares — setting one commitment as a percentage", () => {
  it("gives the first commitment the whole band", () => {
    expect(rebalanceShares([], 30)).toEqual({ self: 100, others: [] });
  });

  it("gives the second what is asked, and the first the rest", () => {
    expect(rebalanceShares([{ id: "school", share: 100 }], 30)).toEqual({
      self: 30,
      others: [{ id: "school", share: 70 }],
    });
  });

  it("keeps the others' proportions when a third arrives", () => {
    const out = rebalanceShares(
      [
        { id: "school", share: 60 },
        { id: "work", share: 40 },
      ],
      20,
    );
    expect(out.self).toBe(20);
    expect(out.others).toEqual([
      { id: "school", share: 48 },
      { id: "work", share: 32 },
    ]);
  });

  it("always sums to exactly 100", () => {
    for (const p of [1, 17, 33, 50, 99]) {
      const out = rebalanceShares(
        [
          { id: "a", share: 1 },
          { id: "b", share: 2 },
        ],
        p,
      );
      expect(out.self + out.others.reduce((x, o) => x + o.share, 0)).toBe(100);
    }
  });

  it("keeps every commitment above zero by holding the new one to 1–99", () => {
    expect(rebalanceShares([{ id: "a", share: 50 }], 100).self).toBe(99);
    expect(rebalanceShares([{ id: "a", share: 50 }], 0).self).toBe(1);
  });

  it("splits evenly between others with no share yet", () => {
    expect(
      rebalanceShares(
        [
          { id: "a", share: 0 },
          { id: "b", share: 0 },
        ],
        50,
      ).others,
    ).toEqual([
      { id: "a", share: 25 },
      { id: "b", share: 25 },
    ]);
  });
});

describe("a day with no eligible commitment work is untouched", () => {
  const tasks = [task("lec", "comp2521")];
  const empty: CommitmentDay = { band: 60, commitments: [SCHOOL], eligibleTaskIds: [] };

  it("prices nothing", () => {
    expect(commitmentPointValues(empty, tasks).get("lec")).toBe(0);
  });

  it("leaves the whole day to life — an empty Sunday cannot cap below 100", () => {
    expect(lifeShare(empty)).toBe(1);
    expect(lifeShare(null)).toBe(1);
  });
});

describe("the band is carved off the top — ADR-0032 §1", () => {
  const tasks = [
    task("lec1", "comp2521"),
    task("lec2", "comp2521"),
    task("essay", "comp2521"),
  ];
  const day: CommitmentDay = {
    band: 60,
    commitments: [SCHOOL],
    eligibleTaskIds: ["lec1", "lec2", "essay"],
  };

  it("pays the whole band to the one commitment that has work today", () => {
    expect(sum(commitmentPointValues(day, tasks), ["lec1", "lec2", "essay"])).toBe(60);
  });

  it("divides equally across eligible tasks, not by rank", () => {
    const v = commitmentPointValues(day, tasks);
    expect(v.get("lec1")).toBe(20);
    expect(v.get("lec2")).toBe(20);
    expect(v.get("essay")).toBe(20);
  });

  it("leaves the life units the rest of the day", () => {
    expect(lifeShare(day)).toBeCloseTo(0.4);
  });

  it("clamps an out-of-range band rather than honouring it", () => {
    // With one commitment the cap is 60, so a setting of 80 — kept
    // from a time with three — behaves as 60.
    expect(lifeShare({ ...day, band: 80 })).toBe(lifeShare(day));
    expect(sum(commitmentPointValues({ ...day, band: 80 }, tasks), ["lec1", "lec2", "essay"]))
      .toBe(60);
  });

  it("prices only commitment work, never a life task passed alongside", () => {
    const v = commitmentPointValues(day, [...tasks, task("teeth", "hygiene")]);
    expect(v.get("teeth")).toBe(0);
  });

  it("prices nothing that is not eligible today", () => {
    const v = commitmentPointValues(
      { ...day, eligibleTaskIds: ["lec1"] },
      tasks,
    );
    expect(v.get("lec1")).toBe(60);
    expect(v.get("lec2")).toBe(0);
  });
});

describe("the band splits only among commitments with work today — §3", () => {
  const tasks = [task("lec", "comp2521"), task("shift", "work")];

  it("gives School the whole band when only School is scheduled", () => {
    const v = commitmentPointValues(
      { band: 40, commitments: [SCHOOL, WORK], eligibleTaskIds: ["lec"] },
      tasks,
    );
    expect(v.get("lec")).toBe(40);
    expect(v.get("shift")).toBe(0);
  });

  it("splits 50/30 → 25/15 when both are scheduled", () => {
    const v = commitmentPointValues(
      { band: 40, commitments: [SCHOOL, WORK], eligibleTaskIds: ["lec", "shift"] },
      tasks,
    );
    expect(v.get("lec")).toBe(25);
    expect(v.get("shift")).toBe(15);
  });

  it("never leaves part of the band stranded, whatever the shares", () => {
    for (const band of [10, 25, 40, 55, 60]) {
      const v = commitmentPointValues(
        { band, commitments: [SCHOOL, WORK], eligibleTaskIds: ["lec", "shift"] },
        tasks,
      );
      expect(sum(v, ["lec", "shift"])).toBe(band);
    }
  });
});

describe("sub-commitments price nothing — ADR-0035 §1", () => {
  it("splits across tasks, not across the classes holding them", () => {
    const v = commitmentPointValues(
      { band: 30, commitments: [SCHOOL], eligibleTaskIds: ["a1", "a2", "b1"] },
      [task("a1", "comp2521"), task("a2", "comp2521"), task("b1", "math1231")],
    );
    // Equal per task (10/10/10), not per class (7/7/15).
    expect(v.get("a1")).toBe(10);
    expect(v.get("a2")).toBe(10);
    expect(v.get("b1")).toBe(10);
  });
});

describe("pools — ADR-0033 §3", () => {
  const tasks = [
    task("essay", "comp2521"),
    task("reading", "comp2521"),
    task("revision", "comp2521"),
    task("lec", "comp2521"),
  ];
  const pooled = (band: number, plannedCount: number): CommitmentDay => ({
    band,
    commitments: [SCHOOL],
    eligibleTaskIds: ["essay", "reading", "revision", "lec"],
    pools: [{ taskIds: ["essay", "reading", "revision"], plannedCount }],
  });

  it("counts as its planned count, and every member is worth one slot", () => {
    // 1 loose task + a pool of 3 planned 1 = 2 slots, band 40 → 20 each.
    const v = commitmentPointValues(pooled(40, 1), tasks);
    for (const id of ["lec", "essay", "reading", "revision"]) expect(v.get(id)).toBe(20);
  });

  it("raises the divisor, not the payout, when two are planned", () => {
    // 1 loose + a pool of 3 planned 2 = 3 slots, band 45 → 15 each.
    const v = commitmentPointValues(pooled(45, 2), tasks);
    for (const id of ["lec", "essay", "reading", "revision"]) expect(v.get(id)).toBe(15);
  });

  it("keeps every member equal-priced, so the choice is free", () => {
    const v = commitmentPointValues(pooled(30, 1), tasks);
    expect(v.get("essay")).toBe(v.get("reading"));
    expect(v.get("reading")).toBe(v.get("revision"));
  });

  it("prices what was planned at exactly the band", () => {
    const v = commitmentPointValues(pooled(40, 1), tasks);
    expect(sum(v, ["lec", "essay"])).toBe(40);
  });

  it("clamps a nonsense planned count rather than trusting it", () => {
    const v = commitmentPointValues(
      {
        band: 40,
        commitments: [SCHOOL],
        eligibleTaskIds: ["essay", "reading"],
        pools: [{ taskIds: ["essay", "reading"], plannedCount: 99 }],
      },
      tasks,
    );
    // Clamped to 2 slots → 20 each, not divided by 99.
    expect(v.get("essay")).toBe(20);
    expect(v.get("reading")).toBe(20);
  });
});

describe("a semester's worth of work — the ADR-0035 finding", () => {
  const school = Array.from({ length: 13 }, (_, i) => task(`s${i}`, "comp2521"));
  const valuesAt = (band: number) => {
    const v = commitmentPointValues(
      { band, commitments: [SCHOOL], eligibleTaskIds: school.map((t) => t.id) },
      school,
    );
    return school.map((t) => v.get(t.id) ?? 0);
  };

  it("prices all thirteen without a dead row at a mid band", () => {
    const values = valuesAt(40);
    expect(Math.min(...values)).toBeGreaterThan(0);
    expect(values.reduce((a, b) => a + b, 0)).toBe(40);
  });

  it("still rounds a tail to zero when the band cannot pay everyone", () => {
    // **A measured limit, not a bug.** Thirteen tasks eligible on one
    // day against a band of 10 is three more tasks than there are
    // points, so `assign` drops its one-point floor and the tail goes
    // to zero. The total is still exactly the band.
    const values = valuesAt(10);
    expect(values.filter((v) => v === 0).length).toBeGreaterThan(0);
    expect(values.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("is fixed by raising the band, which is the user's lever", () => {
    expect(valuesAt(25).filter((v) => v === 0).length).toBe(0);
  });
});

describe("commitmentBandOn", () => {
  const day = (band: number, eligibleTaskIds: string[]): CommitmentDay => ({
    band,
    commitments: [],
    eligibleTaskIds,
  });

  it("is the band on a day with commitment work", () => {
    expect(commitmentBandOn(day(40, ["essay"]))).toBe(40);
  });

  it("is zero on a day with none, however large the setting", () => {
    // The band only exists on days it can be earned — the rule that
    // stops an empty Sunday capping below 100 (ADR-0032 §1).
    expect(commitmentBandOn(day(60, []))).toBe(0);
  });

  it("is zero with no commitment day at all", () => {
    expect(commitmentBandOn(null)).toBe(0);
    expect(commitmentBandOn(undefined)).toBe(0);
  });

  it("normalises, so a caller never draws a band the pricing refuses", () => {
    expect(commitmentBandOn(day(99, ["essay"]))).toBe(60);
    expect(commitmentBandOn(day(1, ["essay"]))).toBe(COMMITMENT_BAND_MIN);
  });

  it("and lifeShare always add up to the whole day", () => {
    for (const d of [day(40, ["essay"]), day(60, []), day(99, ["essay"])]) {
      expect(commitmentBandOn(d) + 100 * lifeShare(d)).toBeCloseTo(100);
    }
  });
});
