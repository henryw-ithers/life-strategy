/**
 * Spending the commitment band (ADR-0032, formula v10).
 *
 * `commitmentPointValues` *prices* a commitment day; `computeDayScore`
 * *spends* it, beside ADR-0029's planned fraction and the unplanned
 * band. On a commitment day the band is that share of the whole day and
 * everything else is scaled into what it leaves, so the two halves have
 * to agree on one total of 100.
 */
import { describe, expect, it } from "vitest";

import { PLANNED_BAND, UNPLANNED_BAND } from "../bands";
import { computeDayLoad, type LoadTask } from "../dayLoad";
import { computeDayScore, deriveChecklist, type DayScoreInput } from "../grade";

const date = "2026-07-17"; // Friday; the week opens Sunday 07-12

const habit = (taskId: string, weight = 10): LoadTask => ({
  taskId,
  weight,
  timesPerWeek: 7,
  pinnedWeekdays: [],
});

const loadOf = (tasks: LoadTask[], doneIds: string[]) =>
  computeDayLoad(
    tasks,
    doneIds.map((taskId) => ({ taskId, localDate: date })),
    date,
  );

const score = (over: Partial<DayScoreInput> & Pick<DayScoreInput, "load">) =>
  computeDayScore({ kind: "normal", ...over });

const NOTHING = loadOf([], []);

describe("an ordinary day is untouched", () => {
  const load = loadOf([habit("a"), habit("b")], ["a"]);

  it("scores identically with no band and with a zero band", () => {
    const plain = score({ load });
    expect(score({ load, commitment: { band: 0, earned: 0 } })).toEqual(plain);
  });

  it("is still main's v9 day: 90 × the fraction done", () => {
    expect(score({ load }).earned).toBe(PLANNED_BAND / 2);
  });

  it("stays ungraded when nothing of either kind is due", () => {
    expect(score({ load: NOTHING }).base).toBeNull();
    expect(score({ load: NOTHING, commitment: { band: 0, earned: 0 } }).base).toBeNull();
  });
});

describe("the band is that share of the whole day — ADR-0032 §1", () => {
  const tasks = [habit("a"), habit("b")];

  it("pays the band in full when today's commitment work is done", () => {
    expect(score({ load: loadOf(tasks, []), commitment: { band: 40, earned: 40 } }).earned)
      .toBe(40);
  });

  it("pays only what was actually completed", () => {
    expect(score({ load: loadOf(tasks, []), commitment: { band: 60, earned: 20 } }).earned)
      .toBe(20);
  });

  it("scales the planned band into what the band leaves", () => {
    // All life work done at a band of 40: 90 × 0.6 = 54.
    expect(score({ load: loadOf(tasks, ["a", "b"]), commitment: { band: 40, earned: 0 } }).earned)
      .toBe(54);
  });

  it("adds up to 100 when everything planned is done, at every band", () => {
    for (const band of [10, 25, 40, 55, 60]) {
      const s = score({
        load: loadOf(tasks, ["a", "b"]),
        commitment: { band, earned: band },
        activities: [[{ unitId: "friendship", pointsCredited: 50 }]],
      });
      expect(s.earned).toBe(100);
      expect(s.possible).toBe(100);
    }
  });

  it("finishes a planned day at the band plus 90 of what it leaves", () => {
    // 40 + 90 × 0.6 = 94; the unplanned band holds the last 6. Only the
    // unplanned share shrinks, never the band (Henry: the 10–60 is how
    // much of the total comes from commitments).
    const s = score({ load: loadOf(tasks, ["a", "b"]), commitment: { band: 40, earned: 40 } });
    expect(s.earned).toBe(40 + PLANNED_BAND * 0.6);
  });

  it("never pays more than the band, even if values disagree", () => {
    // Pool members are each worth a slot, so doing more of a pool than
    // planned can price above the band. The cap is the ceiling the
    // planned count promised (ADR-0033 §3).
    expect(score({ load: loadOf(tasks, []), commitment: { band: 40, earned: 100 } }).earned)
      .toBe(40);
  });
});

describe("a commitment day with nothing of your own life due", () => {
  it("is graded rather than ungraded", () => {
    expect(score({ load: NOTHING, commitment: { band: 40, earned: 0 } }).base).toBe(0);
  });

  it("gives the band the planned share, so a finished day lands at 94", () => {
    // A share exists only where it can be earned (ADR-0032 §1): with no
    // life work due, the 90 × 0.6 the planned band would hold would be
    // stranded, capping the day at 40 plus the unplanned scraps.
    expect(score({ load: NOTHING, commitment: { band: 40, earned: 40 } }).earned).toBe(94);
    expect(score({ load: NOTHING, commitment: { band: 40, earned: 20 } }).earned).toBe(47);
  });
});

describe("the unplanned band scales too", () => {
  it("holds 10 × the life share on a commitment day", () => {
    const activities = [[{ unitId: "friendship", pointsCredited: 20 }]];
    const load = loadOf([habit("a")], []);
    expect(score({ load, activities }).unplanned).toBe(UNPLANNED_BAND);
    expect(score({ load, activities, commitment: { band: 60, earned: 0 } }).unplanned)
      .toBeCloseTo(4);
  });

  it("scales a special day's rating bonus with it", () => {
    const load = loadOf([habit("a")], []);
    const s = computeDayScore({
      kind: "special",
      satisfactionRating: 10,
      load,
      commitment: { band: 50, earned: 0 },
    });
    expect(s.unplanned).toBeCloseTo(5);
  });

  it("scales a bonus that sits under the cap, not only the cap", () => {
    // Rating 4 claims 4 of the 10; at a band of 50 that is 2, under the
    // scaled cap of 5 — so only scaling the bonus itself gets here.
    const s = computeDayScore({
      kind: "special",
      satisfactionRating: 4,
      load: loadOf([habit("a")], []),
      commitment: { band: 50, earned: 0 },
    });
    expect(s.unplanned).toBeCloseTo(2);
  });

  it("is never negative at any band, with or without activities", () => {
    for (const band of [0, 10, 25, 40, 60]) {
      for (const activities of [undefined, [[{ unitId: "f", pointsCredited: 30 }]]]) {
        const s = score({
          load: loadOf([habit("a"), habit("b")], ["a"]),
          commitment: { band, earned: band },
          activities,
        });
        expect(s.unplanned).toBeGreaterThanOrEqual(0);
        expect(s.unplannedForgone).toBeGreaterThanOrEqual(0);
        expect(s.earned).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("extra runs scale with the life share", () => {
  it("pays an extra run less on a commitment day than an ordinary one", () => {
    const tasks: LoadTask[] = [{ taskId: "x", weight: 10, timesPerWeek: 1, pinnedWeekdays: [] }, habit("a")];
    const rows = [
      { taskId: "x", localDate: "2026-07-13" },
      { taskId: "x", localDate: date },
      { taskId: "a", localDate: date },
    ];
    const load = computeDayLoad(tasks, rows, date);
    const plain = score({ load }).earned;
    const banded = score({ load, commitment: { band: 50, earned: 50 } }).earned;
    // Plain: 90 + extra. Banded: 50 + 45 + extra / 2.
    expect(plain - PLANNED_BAND).toBeGreaterThan(banded - 95);
    expect(banded - 95).toBeGreaterThan(0);
  });
});

describe("the checklist prices life work in the life share", () => {
  it("shows each run's points scaled by the share", () => {
    const tasks = [habit("a"), habit("b")];
    const [plain] = deriveChecklist(tasks, [], date);
    const [scaled] = deriveChecklist(tasks, [], date, 0.6);
    expect(plain!.pointsIfCompletedNow).toBe(45);
    expect(scaled!.pointsIfCompletedNow).toBe(27);
  });
});

describe("commitment work done off its schedule (ADR-0032 §4)", () => {
  const load = loadOf([habit("a")], ["a"]);

  it("pays its scheduled-day worth in full", () => {
    expect(score({ load: loadOf([habit("a")], []), offScheduleCredit: 12 }).earned).toBe(12);
  });

  it("is not unplanned credit — it never touches the pool", () => {
    // Henry, 2026-09-30: "remove the cap."
    const s = score({
      load: loadOf([habit("a")], []),
      offScheduleCredit: 12,
      activities: [[{ unitId: "friendship", pointsCredited: 8 }]],
    });
    expect(s.unplanned).toBe(8);
    expect(s.unplannedForgone).toBe(0);
    expect(s.earned).toBe(20);
  });

  it("can take a day past 100, as extra runs can", () => {
    const s = score({
      load,
      offScheduleCredit: 12,
      activities: [[{ unitId: "friendship", pointsCredited: 10 }]],
    });
    expect(s.earned).toBe(112);
  });

  it("is not scaled by a commitment band — it is paid at its own worth", () => {
    expect(
      score({ load: loadOf([habit("a")], []), commitment: { band: 40, earned: 0 }, offScheduleCredit: 10 })
        .earned,
    ).toBe(10);
  });

  it("is never negative", () => {
    expect(score({ load: loadOf([habit("a")], []), offScheduleCredit: -5 }).earned).toBe(0);
  });
});
