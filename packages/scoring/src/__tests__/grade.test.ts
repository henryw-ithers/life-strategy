import { describe, expect, it } from "vitest";

import { PLANNED_BAND, UNPLANNED_BAND } from "../bands";
import { UNPLANNED_CAP } from "../constants";
import { computeDayLoad, type LoadTask } from "../dayLoad";
import { isoWeekday } from "../schedule";
import {
  aggregateGrade,
  computeDayScore,
  deriveChecklist,
  extraRunPoints,
  periodDays,
  specialDayBonus,
  storedDayScore,
} from "../grade";

const date = "2026-07-17"; // Friday; the week opens Sunday 07-12

const t = (
  taskId: string,
  timesPerWeek: number,
  weight = 10,
  pinnedWeekdays: number[] = [],
): LoadTask => ({ taskId, weight, timesPerWeek, pinnedWeekdays });

const done = (taskId: string, localDate: string) => ({ taskId, localDate });

const scoreOf = (
  tasks: LoadTask[],
  completions: { taskId: string; localDate: string }[],
) =>
  computeDayScore({
    kind: "normal",
    load: computeDayLoad(tasks, completions, date),
  });

describe("deriveChecklist", () => {
  it("bands an every-day task as due, whatever its pins", () => {
    const [status] = deriveChecklist([t("a", 7)], [], date);
    expect(status!.band).toBe("due");
    expect(status!.goalCount).toBe(7);
  });

  it("bands a task pinned to today as due, one pinned elsewhere as week", () => {
    // 2026-07-17 is a Friday: ISO weekday 5.
    const [here, elsewhere] = deriveChecklist(
      [t("here", 1, 10, [5]), t("elsewhere", 1, 10, [1])],
      [],
      date,
    );
    expect(here!.band).toBe("due");
    expect(elsewhere!.band).toBe("week");
  });

  it("bands flexible work as week — due some day, not this one", () => {
    const [status] = deriveChecklist([t("flex", 2)], [], date);
    expect(status!.band).toBe("week");
  });

  it("moves a task to doneThisWeek once earlier days met its goal", () => {
    const [status] = deriveChecklist(
      [t("a", 2)],
      [done("a", "2026-07-13"), done("a", "2026-07-14")],
      date,
    );
    expect(status!.band).toBe("doneThisWeek");
    expect(status!.extraToday).toBe(true);
  });

  it("does not reband on today's own completion", () => {
    // The denominator and the rows both have to hold still while the
    // user works through the list.
    const [status] = deriveChecklist([t("a", 7)], [done("a", date)], date);
    expect(status!.band).toBe("due");
    expect(status!.completedToday).toBe(true);
    expect(status!.extraToday).toBe(false);
  });

  it("prices a run against the day's own expected load", () => {
    // One every-day task carrying the whole day is worth the whole band.
    const [alone] = deriveChecklist([t("a", 7)], [], date);
    expect(alone!.pointsIfCompletedNow).toBe(PLANNED_BAND);

    // A second every-day task of equal weight, and each is worth half.
    const [first, second] = deriveChecklist([t("a", 7), t("b", 7)], [], date);
    expect(first!.pointsIfCompletedNow).toBe(PLANNED_BAND / 2);
    expect(second!.pointsIfCompletedNow).toBe(PLANNED_BAND / 2);
  });

  it("prices an extra run at half the ordinary rate", () => {
    expect(extraRunPoints(10, 10)).toBe(Math.round(PLANNED_BAND / 2));
  });
});

describe("computeDayScore (ADR-0029 §2, formula v9)", () => {
  it("pays the planned band in full for a day fully done", () => {
    const tasks = [t("a", 7), t("b", 7), t("c", 7)];
    const score = scoreOf(
      tasks,
      tasks.map((x) => done(x.taskId, date)),
    );
    expect(score.earned).toBe(PLANNED_BAND);
    expect(score.possible).toBe(100);
    expect(score.base).toBe(PLANNED_BAND);
  });

  it("pays the fraction of the day that got done", () => {
    const tasks = [t("a", 7), t("b", 7), t("c", 7), t("d", 7)];
    const score = scoreOf(tasks, [done("a", date), done("b", date)]);
    expect(score.earned).toBe(Math.round(PLANNED_BAND / 2));
  });

  it("weights the fraction, so missing a heavy task costs more", () => {
    const tasks = [t("heavy", 7, 30), t("light", 7, 10)];
    const heavyOnly = scoreOf(tasks, [done("heavy", date)]);
    const lightOnly = scoreOf(tasks, [done("light", date)]);
    expect(heavyOnly.earned).toBeGreaterThan(lightOnly.earned);
    expect(heavyOnly.earned).toBe(Math.round(PLANNED_BAND * 0.75));
  });

  it("does not care how many tasks a unit's work is split across", () => {
    // Henry, 2026-08-26. One task carrying 30, or three carrying 10
    // each: doing all of it is doing all of it.
    const one = scoreOf([t("a", 7, 30)], [done("a", date)]);
    const three = scoreOf(
      [t("a", 7, 10), t("b", 7, 10), t("c", 7, 10)],
      [done("a", date), done("b", date), done("c", date)],
    );
    expect(three.earned).toBe(one.earned);
  });

  it("is not graded at all when nothing is due", () => {
    const score = scoreOf([t("a", 1)], [done("a", "2026-07-13")]);
    expect(score.base).toBeNull();
    expect(score.possible).toBe(0);
  });

  it("a day off is never graded", () => {
    const score = computeDayScore({
      kind: "rest",
      load: computeDayLoad([t("a", 7)], [], date),
    });
    expect(score.base).toBeNull();
    expect(score.possible).toBe(0);
  });

  it("caps the unplanned band and reports what it forwent", () => {
    const score = computeDayScore({
      kind: "normal",
      load: computeDayLoad([t("a", 7)], [done("a", date)], date),
      activities: [[{ unitId: "u", pointsCredited: 40 }]],
    });
    expect(score.unplanned).toBe(UNPLANNED_BAND);
    expect(score.unplannedForgone).toBe(30);
    expect(score.earned).toBe(PLANNED_BAND + UNPLANNED_BAND);
    expect(score.base).toBe(100);
  });

  it("keeps UNPLANNED_CAP and the unplanned band the same number", () => {
    expect(UNPLANNED_CAP).toBe(UNPLANNED_BAND);
  });

  it("lets extra runs, and only extra runs, pass the planned band", () => {
    const tasks = [t("a", 7, 10), t("b", 1, 10)];
    const score = scoreOf(tasks, [
      done("a", date),
      // "b" already met its weekly goal, so today's run is an extra.
      done("b", "2026-07-13"),
      done("b", date),
    ]);
    expect(score.earned).toBeGreaterThan(PLANNED_BAND);
  });

  it("pays a special day's rating from the unplanned band", () => {
    expect(specialDayBonus(10)).toBe(UNPLANNED_BAND);
    expect(specialDayBonus(5)).toBe(UNPLANNED_BAND / 2);
    expect(specialDayBonus(null)).toBe(0);
  });

  it("reads a finalized day back rather than recomputing it", () => {
    expect(storedDayScore({ earned: 64, possible: 100 }).base).toBe(64);
    expect(storedDayScore({ earned: 0, possible: 0 }).base).toBeNull();
  });
});

/**
 * The target this formula was built to hit. Henry, 2026-08-26: *"if you
 * did every task you planned for the week you should have around a 90
 * average."*
 */
describe("a full week of your own plan averages 90", () => {
  const week = [
    "2026-07-12",
    "2026-07-13",
    "2026-07-14",
    "2026-07-15",
    "2026-07-16",
    "2026-07-17",
    "2026-07-18",
  ];

  const runWeek = (tasks: LoadTask[], plan: (day: string) => string[]) => {
    const completions: { taskId: string; localDate: string }[] = [];
    const scores: number[] = [];
    for (const day of week) {
      for (const id of plan(day)) completions.push(done(id, day));
      const score = computeDayScore({
        kind: "normal",
        load: computeDayLoad(tasks, completions, day),
      });
      if (score.base !== null) scores.push(score.base);
    }
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  it("three every-day tasks, done every day", () => {
    const tasks = [t("a", 7), t("b", 7), t("c", 7)];
    expect(runWeek(tasks, () => ["a", "b", "c"])).toBe(90);
  });

  it("three every-day tasks plus a 3x/week pinned to Mon/Wed/Fri", () => {
    // The shape an amortized denominator read as 74: on the four days
    // the gym is not due, it is not expected either.
    const tasks = [t("a", 7), t("b", 7), t("c", 7), t("gym", 3, 10, [1, 3, 5])];
    const average = runWeek(tasks, (day) =>
      [1, 3, 5].includes(isoWeekday(day))
        ? ["a", "b", "c", "gym"]
        : ["a", "b", "c"],
    );
    expect(average).toBe(90);
  });

  it("seven flexible weekly tasks, one a day", () => {
    // Henry's own example: "if you have seven one-time anytime-during-
    // the-week tasks you're expected to do one of those a day."
    const ids = ["1", "2", "3", "4", "5", "6", "7"];
    const tasks = ids.map((id) => t(id, 1));
    let next = 0;
    expect(runWeek(tasks, () => [ids[next++]!])).toBe(90);
  });
});

describe("aggregateGrade — ADR-0004 §5 (weekly/monthly: earned ÷ possible over the period)", () => {
  it("sums earned and possible across the period", () => {
    const s = aggregateGrade([
      { earned: 10, possible: 20 },
      { earned: 5, possible: 20 },
    ]);
    expect(s.earned).toBe(15);
    expect(s.possible).toBe(40);
    expect(s.base).toBe(38); // round(15/40*100)
  });

  it("an all-rest period (every day {0,0}) grades nothing", () => {
    const s = aggregateGrade([
      { earned: 0, possible: 0 },
      { earned: 0, possible: 0 },
    ]);
    expect(s.base).toBeNull();
  });

  it("an empty period grades nothing", () => {
    expect(aggregateGrade([]).base).toBeNull();
  });

  it("days off ({0,0}) drop out of the grade without special-casing", () => {
    const withOff = aggregateGrade([
      { earned: 10, possible: 10 },
      { earned: 0, possible: 0 }, // day off
      { earned: 10, possible: 10 },
    ]);
    const withoutOff = aggregateGrade([
      { earned: 10, possible: 10 },
      { earned: 10, possible: 10 },
    ]);
    expect(withOff.base).toBe(withoutOff.base);
    expect(withOff.earned).toBe(withoutOff.earned);
    expect(withOff.possible).toBe(withoutOff.possible);
    // But a declared day off is still a day the user showed up for,
    // so it counts toward what the grade stands on.
    expect(withOff.gradedDays).toBe(3);
    expect(withoutOff.gradedDays).toBe(2);
  });

  it("a special day carries its own denominator into the period", () => {
    // Post-ADR-0023 a special day is an ordinary {earned, possible}
    // pair like any other — it grades on its tasks and adds its capped
    // bonus, so aggregation needs no special case at all.
    const s = aggregateGrade([
      { earned: 50, possible: 50 }, // a normal day at 100%
      { earned: 70, possible: 50 }, // special day: 50 planned + 20 bonus
    ]);
    expect(s.earned).toBe(120);
    expect(s.possible).toBe(100);
    expect(s.base).toBe(120);
  });

  it("matches the ADR's own worked identity: a perfect balanced week totals 100", () => {
    const week = Array.from({ length: 7 }, () => ({ earned: 7, possible: 7 }));
    expect(aggregateGrade(week).base).toBe(100);
  });
});

describe("periodDays", () => {
  // Week of Mon 2026-07-13 .. Sun 2026-07-19.
  const week = { start: "2026-07-13", end: "2026-07-20" };
  const base = { ...week, dailyPossible: 50, gradingStart: "2026-01-01" };

  // ── A missed day is a zero (amended 2026-08-13) ──

  it("scores an elapsed day with no stored row as zero over a full day", () => {
    const days = periodDays({
      ...base,
      today: "2026-07-20", // the whole week is over
      recorded: [{ localDate: "2026-07-13", earned: 50, possible: 50 }],
    });
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ earned: 50, possible: 50 });
    expect(days.slice(1)).toEqual(
      Array.from({ length: 6 }, () => ({ earned: 0, possible: 50 })),
    );
    // One perfect day, six silent ones: round(50/350*100).
    expect(aggregateGrade(days).base).toBe(14);
  });

  it("never pays for an untouched day", () => {
    // The incentive the whole change exists for: showing up and doing
    // very little must beat not showing up.
    const poor = periodDays({
      ...base,
      today: "2026-07-15",
      recorded: [
        { localDate: "2026-07-13", earned: 50, possible: 50 },
        { localDate: "2026-07-14", earned: 10, possible: 50 },
      ],
    })[1];
    const untouched = periodDays({
      ...base,
      today: "2026-07-15",
      recorded: [{ localDate: "2026-07-13", earned: 50, possible: 50 }],
    })[1];
    expect(poor).toEqual({ earned: 10, possible: 50 });
    expect(untouched).toEqual({ earned: 0, possible: 50 });
    expect(poor!.earned).toBeGreaterThan(untouched!.earned);
  });

  it("a declared day off is the opt-out, and costs nothing", () => {
    // Same week, same effort — the only difference is that the user
    // said so. Marked off: 100%. Silent: dragged to 25%.
    const marked = aggregateGrade(
      periodDays({
        ...base,
        today: "2026-07-17",
        recorded: [
          { localDate: "2026-07-13", earned: 50, possible: 50 },
          { localDate: "2026-07-14", earned: 0, possible: 0 }, // day off
          { localDate: "2026-07-15", earned: 0, possible: 0 }, // day off
          { localDate: "2026-07-16", earned: 50, possible: 50 },
        ],
      }),
    );
    const silent = aggregateGrade(
      periodDays({
        ...base,
        today: "2026-07-17",
        recorded: [
          { localDate: "2026-07-13", earned: 50, possible: 50 },
          { localDate: "2026-07-16", earned: 50, possible: 50 },
        ],
      }),
    );
    expect(marked.base).toBe(100);
    expect(silent.base).toBe(50); // round(100/200*100)
  });

  it("a period with nothing recorded scores zero, not nothing", () => {
    const empty = aggregateGrade(
      periodDays({ ...base, today: "2026-07-20", recorded: [] }),
    );
    expect(empty.base).toBe(0);
    expect(empty.gradedDays).toBe(7);
  });

  it("excludes the current day from both sides, so a rollover never drops the grade", () => {
    const recorded = [
      { localDate: "2026-07-13", earned: 50, possible: 50 },
      { localDate: "2026-07-14", earned: 50, possible: 50 },
    ];
    // Wednesday morning, nothing done yet.
    const morning = periodDays({ ...base, today: "2026-07-15", recorded });
    expect(morning).toHaveLength(2);
    expect(aggregateGrade(morning).base).toBe(100);

    // Same day, halfway through — today still does not count either way.
    const evening = periodDays({
      ...base,
      today: "2026-07-15",
      recorded: [...recorded, { localDate: "2026-07-15", earned: 20, possible: 50 }],
    });
    expect(evening).toHaveLength(2);
    expect(aggregateGrade(evening).base).toBe(100);
  });

  it("ignores days before the first diagnostic", () => {
    // Every day of the week is recorded; only those on or after the
    // grading start may count.
    const recorded = [13, 14, 15, 16, 17, 18, 19].map((d) => ({
      localDate: `2026-07-${d}`,
      earned: 25,
      possible: 50,
    }));
    const days = periodDays({
      ...base,
      gradingStart: "2026-07-16",
      today: "2026-07-20",
      recorded,
    });
    expect(days).toHaveLength(4); // 16th through 19th
  });

  it("grades nothing when no diagnostic has been taken", () => {
    const days = periodDays({
      ...base,
      gradingStart: null,
      today: "2026-07-20",
      recorded: [{ localDate: "2026-07-13", earned: 50, possible: 50 }],
    });
    expect(days).toEqual([]);
    expect(aggregateGrade(days).base).toBeNull();
  });

  it("keeps stored days off and special days as stored", () => {
    const days = periodDays({
      ...base,
      today: "2026-07-16",
      recorded: [
        { localDate: "2026-07-13", earned: 0, possible: 0 }, // day off
        { localDate: "2026-07-14", earned: 70, possible: 50 }, // special
        // 07-15 untouched → zero over a full day
      ],
    });
    expect(days).toEqual([
      { earned: 0, possible: 0 },
      { earned: 70, possible: 50 },
      { earned: 0, possible: 50 },
    ]);
  });

  it("a fully rested elapsed week still grades nothing", () => {
    const days = periodDays({
      ...base,
      today: "2026-07-20",
      recorded: Array.from({ length: 7 }, (_, i) => ({
        localDate: `2026-07-${13 + i}`,
        earned: 0,
        possible: 0,
      })),
    });
    expect(aggregateGrade(days).base).toBeNull();
  });

  it("counts nothing for a week that has not started", () => {
    const days = periodDays({ ...base, today: "2026-07-13", recorded: [] });
    expect(days).toEqual([]);
  });
});
