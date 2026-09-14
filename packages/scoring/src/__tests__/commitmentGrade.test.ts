/**
 * Spending the commitment band (ADR-0032).
 *
 * `bandPointValues` *prices* a day; `computeDayScore` *spends* it. The
 * two have to agree, and the first version of this pair did not: the
 * band priced a day at 60 and the grade paid 20, because a commitment
 * task is non-daily and was being squashed into the variable cap.
 */
import { describe, expect, it } from "vitest";

import { VARIABLE_BAND } from "../bands";
import { computeDayScore } from "../grade";

const commitment = (pointValue: number, completedToday = true) => ({
  unitId: "comp2521",
  pointValue,
  timesPerWeek: 3,
  completedToday,
  extraToday: false,
  isCommitment: true,
});

const dailyHabit = (pointValue: number, completedToday = true) => ({
  unitId: "hygiene",
  pointValue,
  timesPerWeek: 7,
  completedToday,
  extraToday: false,
});

const weeklyLifeTask = (pointValue: number, completedToday = true) => ({
  unitId: "exercise-fitness",
  pointValue,
  timesPerWeek: 3,
  completedToday,
  extraToday: false,
});

describe("the regression this was written for", () => {
  it("pays the band rather than capping it at the variable band", () => {
    const tasks = [commitment(20), commitment(20), commitment(20)];

    // Without the band, all three are ordinary non-daily work and the
    // 20-point variable cap eats them: priced 60, paid 20.
    expect(
      computeDayScore({ kind: "normal", satisfactionRating: null, tasks }).earned,
    ).toBe(VARIABLE_BAND);

    // With it, they are spent from their own band.
    expect(
      computeDayScore({
        kind: "normal",
        satisfactionRating: null,
        tasks,
        commitmentBand: 60,
      }).earned,
    ).toBe(60);
  });
});

describe("an ordinary day is untouched", () => {
  const tasks = [dailyHabit(7), weeklyLifeTask(5)];

  it("scores identically with no band and with a null band", () => {
    const plain = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks,
    });
    const nulled = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks,
      commitmentBand: null,
    });
    expect(nulled).toEqual(plain);
  });

  it("treats a zero band as no band", () => {
    expect(
      computeDayScore({
        kind: "normal",
        satisfactionRating: null,
        tasks,
        commitmentBand: 0,
      }).earned,
    ).toBe(computeDayScore({ kind: "normal", satisfactionRating: null, tasks }).earned);
  });
});

describe("the life bands scale into what the band leaves", () => {
  it("shrinks the variable cap on a commitment day", () => {
    // Two weekly life tasks worth 15 each. Off a commitment day the
    // variable band pays 20 of that; at a band of 60 it holds only 8.
    const tasks = [weeklyLifeTask(15), { ...weeklyLifeTask(15), unitId: "hobbies" }];
    expect(
      computeDayScore({ kind: "normal", satisfactionRating: null, tasks }).earned,
    ).toBe(20);
    expect(
      computeDayScore({
        kind: "normal",
        satisfactionRating: null,
        tasks,
        commitmentBand: 60,
      }).earned,
    ).toBe(8);
  });

  it("shrinks the unplanned pool too, so a day cannot exceed itself", () => {
    // Activities draw on whatever the variable band has left. At a band
    // of 60 that is 8, not 20 — otherwise a commitment day could pay
    // out more than it priced.
    const activities = [[{ unitId: "friendship", pointsCredited: 20 }]];
    expect(
      computeDayScore({
        kind: "normal",
        satisfactionRating: null,
        tasks: [dailyHabit(3)],
        activities,
        commitmentBand: 60,
      }).unplanned,
    ).toBe(8);
  });
});

describe("the unplanned pool never goes negative", () => {
  it("floors at zero rather than cancelling an overspend", () => {
    // Found by mutation testing. Without the floor, a `variableEarned`
    // that exceeded its band produced a **negative** unplanned credit
    // that quietly cancelled the overspend — so a mis-scaled cap gave a
    // correct-looking total built from a 20-point overspend and a −12
    // credit. A wrong number is recoverable; a right number for the
    // wrong reason is not.
    const score = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks: [weeklyLifeTask(15), { ...weeklyLifeTask(15), unitId: "hobbies" }],
      commitmentBand: 60,
    });
    expect(score.unplanned).toBeGreaterThanOrEqual(0);
    expect(score.unplannedForgone).toBeGreaterThanOrEqual(0);
  });

  it("is never negative at any band, with or without activities", () => {
    for (const band of [null, 10, 25, 40, 60]) {
      for (const activities of [undefined, [[{ unitId: "f", pointsCredited: 30 }]]]) {
        const score = computeDayScore({
          kind: "normal",
          satisfactionRating: null,
          tasks: [dailyHabit(7), weeklyLifeTask(25)],
          commitmentBand: band,
          activities,
        });
        expect(score.unplanned).toBeGreaterThanOrEqual(0);
        expect(score.earned).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("the band's own cap", () => {
  it("never pays more than the band, even if values disagree", () => {
    // bandPointValues divides exactly `band` points across the day's
    // eligible work, so this should not arise — the cap is here so a
    // disagreement between pricing and spending fails safe rather than
    // inflating a day.
    const tasks = [commitment(50), commitment(50)];
    expect(
      computeDayScore({
        kind: "normal",
        satisfactionRating: null,
        tasks,
        commitmentBand: 40,
      }).earned,
    ).toBe(40);
  });

  it("pays only what was actually completed", () => {
    const tasks = [commitment(20), commitment(20, false), commitment(20, false)];
    expect(
      computeDayScore({
        kind: "normal",
        satisfactionRating: null,
        tasks,
        commitmentBand: 60,
      }).earned,
    ).toBe(20);
  });
});

describe("a full commitment day adds up", () => {
  it("band plus scaled routine, within 100", () => {
    const tasks = [
      commitment(20),
      commitment(20),
      commitment(20),
      dailyHabit(3),
    ];
    const score = computeDayScore({
      kind: "normal",
      satisfactionRating: null,
      tasks,
      commitmentBand: 60,
    });
    expect(score.earned).toBe(63);
    expect(score.possible).toBe(100);
    expect(score.earned).toBeLessThanOrEqual(100);
  });

  it("clamps an out-of-range band rather than honouring it", () => {
    const tasks = [commitment(80)];
    // 80 is above the permitted ceiling and is clamped to 60.
    expect(
      computeDayScore({
        kind: "normal",
        satisfactionRating: null,
        tasks,
        commitmentBand: 80,
      }).earned,
    ).toBe(60);
  });
});
