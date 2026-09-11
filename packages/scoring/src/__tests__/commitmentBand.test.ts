/**
 * The commitment band (ADR-0032) and pools (ADR-0033 §3).
 *
 * Every assertion here is a claim the ADRs make in prose. Where a
 * number appears in ADR-0032 it is reproduced here so the two cannot
 * drift apart silently.
 */
import { describe, expect, it } from "vitest";

import {
  bandPointValues,
  dayCeiling,
  normalizeBand,
  COMMITMENT_BAND_MAX,
  COMMITMENT_BAND_MIN,
  type BandTask,
  type BandUnit,
  type CommitmentDay,
} from "../bands";

/** 18 life units summing to 100, `exercise-fitness` at weight 9. */
const LIFE: BandUnit[] = [
  ["education-learning", 12],
  ["job-career", 10],
  ["exercise-fitness", 9],
  ["sleep-recovery", 8],
  ["mental-health", 8],
  ["nutrition", 7],
  ["finances", 6],
  ["significant-other", 6],
  ["family", 5],
  ["friendship", 5],
  ["hobbies-interests", 4],
  ["hygiene", 4],
  ["living-space", 4],
  ["spirituality", 3],
  ["giving-service", 3],
  ["art-media", 2],
  ["adventure-experiences", 2],
  ["nature-surroundings", 2],
].map(([unitId, weight]) => ({ unitId: unitId as string, weight: weight as number }));

const daily = (id: string, unitId: string, rank = 1): BandTask => ({
  id,
  unitId,
  timesPerWeek: 7,
  rankInUnit: rank,
});
const weekly = (id: string, unitId: string, rank = 1): BandTask => ({
  id,
  unitId,
  timesPerWeek: 3,
  rankInUnit: rank,
});

/** School (5 classes) + Work, as commitment groups. */
const SCHOOL = {
  commitmentId: "school",
  share: 50,
  unitIds: ["school", "comp2521", "math1231", "phys1121"],
};
const WORK = { commitmentId: "work", share: 30, unitIds: ["work"] };

describe("normalizeBand — ADR-0032 §2", () => {
  it("clamps to 10–60 and snaps to steps of 5", () => {
    expect(normalizeBand(40)).toBe(40);
    expect(normalizeBand(42)).toBe(40);
    expect(normalizeBand(43)).toBe(45);
    expect(normalizeBand(0)).toBe(COMMITMENT_BAND_MIN);
    expect(normalizeBand(100)).toBe(COMMITMENT_BAND_MAX);
    expect(normalizeBand(Number.NaN)).toBe(COMMITMENT_BAND_MIN);
  });
});

describe("a day with no eligible commitment work is untouched", () => {
  const tasks = [daily("teeth", "hygiene"), weekly("walk", "exercise-fitness")];

  it("matches the two-band result exactly when `day` is omitted", () => {
    const plain = bandPointValues(LIFE, tasks);
    const empty = bandPointValues(LIFE, tasks, {
      band: 60,
      commitments: [SCHOOL],
      eligibleTaskIds: [],
    });
    expect([...empty]).toEqual([...plain]);
  });

  it("keeps the full ceiling — an empty Sunday cannot cap below 100", () => {
    const day: CommitmentDay = {
      band: 60,
      commitments: [SCHOOL],
      eligibleTaskIds: [],
    };
    expect(dayCeiling(LIFE, tasks, day)).toBe(dayCeiling(LIFE, tasks));
  });
});

describe("the band is carved off the top — ADR-0032 §1", () => {
  const tasks = [
    daily("exercise", "exercise-fitness"),
    weekly("lec1", "comp2521"),
    weekly("lec2", "comp2521"),
    weekly("essay", "comp2521", 2),
  ];
  const day: CommitmentDay = {
    band: 60,
    commitments: [SCHOOL],
    eligibleTaskIds: ["lec1", "lec2", "essay"],
  };

  it("pays the whole band to the one commitment that has work today", () => {
    const v = bandPointValues(LIFE, tasks, day);
    const school = ["lec1", "lec2", "essay"].reduce(
      (a, id) => a + (v.get(id) ?? 0),
      0,
    );
    expect(school).toBe(60);
  });

  it("divides equally across eligible tasks, not by rank", () => {
    const v = bandPointValues(LIFE, tasks, day);
    expect(v.get("lec1")).toBe(20);
    expect(v.get("lec2")).toBe(20);
    // `essay` is ranked 2 and still gets the same share.
    expect(v.get("essay")).toBe(20);
  });

  it("reproduces ADR-0032 §2's table: a weight-9 daily habit", () => {
    // ~7 points on an ordinary day, ~3 at a band of 60.
    expect(bandPointValues(LIFE, tasks).get("exercise")).toBe(7);
    expect(bandPointValues(LIFE, tasks, day).get("exercise")).toBe(3);
  });

  it("clamps an out-of-range band rather than honouring it", () => {
    // A band of 80 was proposed (the scaling 60/70/80 caps) and
    // withdrawn because it left the 18 life units sharing 20 points,
    // putting daily habits on the 1-point floor. The clamp in
    // `normalizeBand` is what makes that unreachable, so 80 behaves as
    // 60 and the habit keeps its 3 points.
    expect(bandPointValues(LIFE, tasks, { ...day, band: 80 }).get("exercise"))
      .toBe(bandPointValues(LIFE, tasks, { ...day, band: 60 }).get("exercise"));
  });
});

describe("the band splits only among commitments with work today — §3", () => {
  const tasks = [
    weekly("lec", "comp2521"),
    weekly("shift", "work"),
    daily("teeth", "hygiene"),
  ];

  it("gives School the whole band when only School is scheduled", () => {
    const v = bandPointValues(LIFE, tasks, {
      band: 40,
      commitments: [SCHOOL, WORK],
      eligibleTaskIds: ["lec"],
    });
    expect(v.get("lec")).toBe(40);
    expect(v.get("shift")).toBe(0);
  });

  it("splits 50/30 → 25/15 when both are scheduled", () => {
    const v = bandPointValues(LIFE, tasks, {
      band: 40,
      commitments: [SCHOOL, WORK],
      eligibleTaskIds: ["lec", "shift"],
    });
    expect(v.get("lec")).toBe(25);
    expect(v.get("shift")).toBe(15);
    expect((v.get("lec") ?? 0) + (v.get("shift") ?? 0)).toBe(40);
  });

  it("never leaves part of the band stranded, whatever the shares", () => {
    for (const band of [10, 25, 40, 55, 60]) {
      const v = bandPointValues(LIFE, tasks, {
        band,
        commitments: [SCHOOL, WORK],
        eligibleTaskIds: ["lec", "shift"],
      });
      expect((v.get("lec") ?? 0) + (v.get("shift") ?? 0)).toBe(band);
    }
  });
});

describe("sub-commitments price nothing — ADR-0029 §1", () => {
  it("splits across tasks, not across the classes holding them", () => {
    const tasks = [
      weekly("a1", "comp2521"),
      weekly("a2", "comp2521"),
      weekly("b1", "math1231"),
    ];
    const v = bandPointValues(LIFE, tasks, {
      band: 30,
      commitments: [SCHOOL],
      eligibleTaskIds: ["a1", "a2", "b1"],
    });
    // Equal per task (10/10/10), not per class (7/7/15).
    expect(v.get("a1")).toBe(10);
    expect(v.get("a2")).toBe(10);
    expect(v.get("b1")).toBe(10);
  });
});

describe("pools — ADR-0033 §3", () => {
  const tasks = [
    weekly("essay", "comp2521"),
    weekly("reading", "comp2521", 2),
    weekly("revision", "comp2521", 3),
    weekly("lec", "comp2521", 4),
  ];

  it("counts as its planned count, and every member is worth one slot", () => {
    // 1 loose task + a pool of 3 planned 1 = 2 slots, band 40 → 20 each.
    const v = bandPointValues(LIFE, tasks, {
      band: 40,
      commitments: [SCHOOL],
      eligibleTaskIds: ["essay", "reading", "revision", "lec"],
      pools: [
        { taskIds: ["essay", "reading", "revision"], plannedCount: 1 },
      ],
    });
    expect(v.get("lec")).toBe(20);
    expect(v.get("essay")).toBe(20);
    expect(v.get("reading")).toBe(20);
    expect(v.get("revision")).toBe(20);
  });

  it("raises the divisor, not the payout, when two are planned", () => {
    // 1 loose + a pool of 3 planned 2 = 3 slots, band 45 → 15 each.
    const v = bandPointValues(LIFE, tasks, {
      band: 45,
      commitments: [SCHOOL],
      eligibleTaskIds: ["essay", "reading", "revision", "lec"],
      pools: [
        { taskIds: ["essay", "reading", "revision"], plannedCount: 2 },
      ],
    });
    expect(v.get("lec")).toBe(15);
    expect(v.get("essay")).toBe(15);
    expect(v.get("reading")).toBe(15);
    expect(v.get("revision")).toBe(15);
  });

  it("keeps every member equal-priced, so the choice is free", () => {
    // The point of equal pricing: the scoreboard must not pick for you.
    const v = bandPointValues(LIFE, tasks, {
      band: 30,
      commitments: [SCHOOL],
      eligibleTaskIds: ["essay", "reading", "revision"],
      pools: [
        { taskIds: ["essay", "reading", "revision"], plannedCount: 1 },
      ],
    });
    expect(v.get("essay")).toBe(v.get("reading"));
    expect(v.get("reading")).toBe(v.get("revision"));
  });

  it("lets doing more than planned exceed the planned share", () => {
    const v = bandPointValues(LIFE, tasks, {
      band: 40,
      commitments: [SCHOOL],
      eligibleTaskIds: ["essay", "reading", "revision", "lec"],
      pools: [
        { taskIds: ["essay", "reading", "revision"], plannedCount: 1 },
      ],
    });
    const planned = (v.get("lec") ?? 0) + (v.get("essay") ?? 0);
    const allThree =
      (v.get("lec") ?? 0) +
      (v.get("essay") ?? 0) +
      (v.get("reading") ?? 0) +
      (v.get("revision") ?? 0);
    expect(planned).toBe(40);
    expect(allThree).toBeGreaterThan(planned);
  });

  it("clamps a nonsense planned count rather than trusting it", () => {
    const v = bandPointValues(LIFE, tasks, {
      band: 40,
      commitments: [SCHOOL],
      eligibleTaskIds: ["essay", "reading"],
      pools: [{ taskIds: ["essay", "reading"], plannedCount: 99 }],
    });
    // Clamped to 2 slots → 20 each, not divided by 99.
    expect(v.get("essay")).toBe(20);
    expect(v.get("reading")).toBe(20);
  });
});

describe("the ceiling — ADR-0032", () => {
  const tasks = [
    daily("exercise", "exercise-fitness"),
    daily("teeth", "hygiene"),
    weekly("lec", "comp2521"),
  ];

  it("counts the band in full, since none of it is stranded", () => {
    const day: CommitmentDay = {
      band: 40,
      commitments: [SCHOOL],
      eligibleTaskIds: ["lec"],
    };
    // 40 + 0.8 × (9 + 4) × 0.6 + 20 × 0.6 = 40 + 6 + 12 = 58.
    expect(dayCeiling(LIFE, tasks, day)).toBe(58);
  });

  it("never exceeds 100 at any permitted band", () => {
    const covering = LIFE.map((u) => daily(`d-${u.unitId}`, u.unitId));
    for (let band = COMMITMENT_BAND_MIN; band <= COMMITMENT_BAND_MAX; band += 5) {
      const ceiling = dayCeiling(LIFE, [...covering, weekly("lec", "comp2521")], {
        band,
        commitments: [SCHOOL],
        eligibleTaskIds: ["lec"],
      });
      expect(ceiling).toBeLessThanOrEqual(100);
    }
  });
});

describe("a semester's worth of work — the ADR-0029 finding", () => {
  const school = Array.from({ length: 13 }, (_, i) =>
    weekly(`s${i}`, "comp2521", i + 1),
  );
  const tasks = [daily("teeth", "hygiene"), ...school];
  const eligibleTaskIds = school.map((t) => t.id);
  const valuesAt = (band: number) => {
    const v = bandPointValues(LIFE, tasks, {
      band,
      commitments: [SCHOOL],
      eligibleTaskIds,
    });
    return school.map((t) => v.get(t.id) ?? 0);
  };

  it("prices all thirteen without a dead row at a mid band", () => {
    const values = valuesAt(40);
    expect(Math.min(...values)).toBeGreaterThan(0);
    expect(values.reduce((a, b) => a + b, 0)).toBe(40);
  });

  it("still rounds a tail to zero when the band cannot pay everyone", () => {
    // **A measured limit, not a bug.** Thirteen tasks eligible on one
    // day, against a band of 10, is three more tasks than there are
    // points — so `assign` drops its one-point floor and the tail goes
    // to zero. This is exactly the property ADR-0027 records for the
    // variable band — *"20 points cannot finely price 20+ non-daily
    // tasks"* — reappearing at the bottom of the band's range rather
    // than being cured by it.
    //
    // The band does not remove that limit, it *raises* it: the failure
    // needs 13 tasks on one day at the lowest setting, where the old
    // model hit it with 13 tasks at any setting.
    const values = valuesAt(10);
    expect(values.filter((v) => v === 0).length).toBeGreaterThan(0);
    expect(values.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("is fixed by raising the band, which is the user's lever", () => {
    expect(valuesAt(10).filter((v) => v === 0).length).toBeGreaterThan(0);
    expect(valuesAt(25).filter((v) => v === 0).length).toBe(0);
  });
});
