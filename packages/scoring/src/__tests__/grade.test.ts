import { describe, expect, it } from "vitest";

import { UNPLANNED_CAP } from "../constants";
import {
  aggregateGrade,
  computeDayScore,
  deriveChecklist,
  extraRunPoints,
  periodDays,
  specialDayBonus,
  storedDayScore,
} from "../grade";

const date = "2026-07-17"; // Friday; week starts 07-13

describe("deriveChecklist", () => {
  const run = { taskId: "run", unitId: "exercise", pointValue: 10, timesPerWeek: 3 };
  const read = { taskId: "read", unitId: "growth", pointValue: 4, timesPerWeek: 7 };
  const deepClean = { taskId: "clean", unitId: "home", pointValue: 6, timesPerWeek: 0 };

  it("bands daily tasks as daily regardless of completion", () => {
    const [status] = deriveChecklist([read], [{ taskId: "read", localDate: date }], date);
    expect(status?.band).toBe("daily");
    expect(status?.completedToday).toBe(true);
  });

  it("keeps a weekly task in its band all day, even when today's run meets the goal", () => {
    const completions = [
      { taskId: "run", localDate: "2026-07-13" },
      { taskId: "run", localDate: "2026-07-15" },
      { taskId: "run", localDate: date }, // third of three, today
    ];
    const [status] = deriveChecklist([run], completions, date);
    expect(status?.band).toBe("week"); // no jump while you watch
    expect(status?.doneCount).toBe(3);
    expect(status?.extraToday).toBe(false);
    expect(status?.pointsIfCompletedNow).toBe(10);
  });

  it("moves a task done on previous days to doneThisWeek, at extra-run credit", () => {
    const completions = [
      { taskId: "run", localDate: "2026-07-13" },
      { taskId: "run", localDate: "2026-07-14" },
      { taskId: "run", localDate: "2026-07-15" },
    ];
    const [status] = deriveChecklist([run], completions, date);
    expect(status?.band).toBe("doneThisWeek");
    expect(status?.extraToday).toBe(true);
    expect(status?.pointsIfCompletedNow).toBe(extraRunPoints(10));
  });

  it("ignores last week's completions", () => {
    // `date` is Fri 2026-07-17, whose week opens Sun 2026-07-12; the
    // Saturday before that is the last day of the prior week.
    const [status] = deriveChecklist(
      [run],
      [{ taskId: "run", localDate: "2026-07-11" }], // Saturday, prior week
      date,
    );
    expect(status?.doneCount).toBe(0);
    expect(status?.band).toBe("week");
  });

  it("counts the Sunday that opens this week", () => {
    // The boundary case the Sunday-first amendment turns on: this
    // Sunday belongs to the current week, not the one before it.
    const [status] = deriveChecklist(
      [run],
      [{ taskId: "run", localDate: "2026-07-12" }],
      date,
    );
    expect(status?.doneCount).toBe(1);
  });

  it("counts fortnightly tasks over the whole fortnight", () => {
    // 2026-07-13 opens a week; whichever week the fortnight opens on,
    // a completion 0–13 days after the fortnight start is inside it.
    const [fresh] = deriveChecklist([deepClean], [], date);
    expect(fresh?.goalCount).toBe(1);
    expect(fresh?.band).toBe("week");
  });
});

describe("computeDayScore (two bands, ADR-0027 §1, formula v7)", () => {
  // A plan sized like a real one: point values are what
  // `bandPointValues` would have produced, so these are the numbers the
  // app actually stores. Routine tasks come out of 80% of their unit's
  // weight; the two non-daily tasks share the 20-point variable band.
  const tasks = [
    { unitId: "growth", pointValue: 32, timesPerWeek: 7, completedToday: false },
    { unitId: "health", pointValue: 24, timesPerWeek: 7, completedToday: false },
    { unitId: "home", pointValue: 13, timesPerWeek: 3, completedToday: false },
    { unitId: "friends", pointValue: 7, timesPerWeek: 0, completedToday: false },
  ];
  const withDone = (done: string[]) =>
    tasks.map((t) => ({ ...t, completedToday: done.includes(t.unitId) }));

  it("grades against a constant 100, not against the plan's own size", () => {
    // The whole diagnostic budget, including weight nothing can earn —
    // ADR-0027 §2. A plan is scored against your life, not against
    // itself.
    const s = computeDayScore({ kind: "normal", tasks });
    expect(s.possible).toBe(100);
    expect(s.earned).toBe(0);
    expect(s.base).toBe(0);
  });

  it("pays a daily task its stored value", () => {
    const s = computeDayScore({ kind: "normal", tasks: withDone(["growth"]) });
    expect(s.earned).toBe(32);
    expect(s.base).toBe(32);
  });

  it("cannot exceed 100 from the two bands however much is done", () => {
    // The 112 this formula was written to kill. Every task in the plan
    // completed, and the number is still a number a day can hold.
    const s = computeDayScore({
      kind: "normal",
      tasks: withDone(["growth", "health", "home", "friends"]),
    });
    expect(s.earned).toBe(76);
    expect(s.base).toBeLessThanOrEqual(100);
  });

  it("caps the variable band at 20 however many weekly tasks land at once", () => {
    const heavy = [
      { unitId: "a", pointValue: 9, timesPerWeek: 1, completedToday: true },
      { unitId: "b", pointValue: 8, timesPerWeek: 2, completedToday: true },
      { unitId: "c", pointValue: 7, timesPerWeek: 0, completedToday: true },
    ];
    expect(computeDayScore({ kind: "normal", tasks: heavy }).earned).toBe(20);
  });

  it("gives planned work first claim on the band, and the rest to activities", () => {
    // ADR-0023's ordering inside one pool: 13 of the band is spoken
    // for, so 7 is all an activity can reach however much it logged.
    const s = computeDayScore({
      kind: "normal",
      tasks: withDone(["home"]),
      activities: [[{ unitId: "growth", pointsCredited: 15 }]],
    });
    expect(s.earned).toBe(20);
    expect(s.unplanned).toBe(7);
    expect(s.unplannedForgone).toBe(8);
  });

  it("lets an activity have the whole band on a day with no planned work left", () => {
    const s = computeDayScore({
      kind: "normal",
      tasks,
      activities: [[{ unitId: "growth", pointsCredited: 25 }]],
    });
    expect(s.unplanned).toBe(20);
    expect(s.unplannedForgone).toBe(5);
  });

  it("keeps extra runs outside both bands — the plan done harder is uncapped", () => {
    // ADR-0023 §2, unchanged by this ADR: doing more of your own plan
    // is the one route above 100.
    const s = computeDayScore({
      kind: "normal",
      tasks: withDone(["growth", "health"]),
      extraRunCredit: 30,
      activities: [[{ unitId: "growth", pointsCredited: 25 }]],
    });
    expect(s.earned).toBe(56 + 30 + 20);
    expect(s.base).toBeGreaterThan(100);
  });

  it("grades a special day on its tasks plus a rating drawn from the band", () => {
    const s = computeDayScore({
      kind: "special",
      satisfactionRating: 8,
      tasks: withDone(["growth"]),
    });
    // 32 from the plan + round(8/10 × 20) = 16 from the rating.
    expect(s.earned).toBe(48);
    expect(s.unplanned).toBe(16);
  });

  it("earns a special day nothing but its rating when nothing was done", () => {
    const s = computeDayScore({ kind: "special", satisfactionRating: 10, tasks });
    expect(s.earned).toBe(20);
    expect(s.base).toBe(20);
  });

  it("scales specialDayBonus across the variable band", () => {
    expect(specialDayBonus(10)).toBe(20);
    expect(specialDayBonus(5)).toBe(10);
    expect(specialDayBonus(null)).toBe(0);
  });

  it("grades a day off as nothing to grade, not as zero", () => {
    const s = computeDayScore({ kind: "rest", tasks: withDone(["growth"]) });
    expect(s.possible).toBe(0);
    expect(s.base).toBeNull();
  });

  it("has nothing to grade when the plan is empty", () => {
    const s = computeDayScore({ kind: "normal", tasks: [] });
    expect(s.possible).toBe(0);
    expect(s.base).toBeNull();
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
