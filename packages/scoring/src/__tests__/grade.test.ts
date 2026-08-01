import { describe, expect, it } from "vitest";

import {
  aggregateGrade,
  computeDayScore,
  deriveChecklist,
  extraRunPoints,
  periodDays,
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

describe("computeDayScore (unified denominator, ADR-0004 §4 amendment)", () => {
  // Shares: daily 4×7/7 = 4; run 7×3/7 = 3; clean 14×0 → 14/14 = 1.
  // Denominator = 8, constant every day.
  const tasks = [
    { unitId: "growth", pointValue: 4, timesPerWeek: 7, completedToday: false },
    { unitId: "exercise", pointValue: 7, timesPerWeek: 3, completedToday: false },
    { unitId: "home", pointValue: 14, timesPerWeek: 0, completedToday: false },
  ];
  const withDone = (done: string[]) =>
    tasks.map((t) => ({ ...t, completedToday: done.includes(t.unitId) }));

  it("the denominator is the weekly commitment spread over the week", () => {
    const s = computeDayScore({ kind: "normal", tasks });
    expect(s.possible).toBe(8);
    expect(s.earned).toBe(0);
    expect(s.base).toBe(0);
  });

  it("every completion earns its full value — weekly runs move today", () => {
    const s = computeDayScore({ kind: "normal", tasks: withDone(["exercise"]) });
    expect(s.earned).toBe(7);
    expect(s.base).toBe(Math.round((7 / 8) * 100)); // 88
  });

  it("a heavy day can exceed 100, honestly", () => {
    const s = computeDayScore({
      kind: "normal",
      tasks: withDone(["growth", "exercise", "home"]),
    });
    expect(s.earned).toBe(25);
    expect(s.base).toBe(Math.round((25 / 8) * 100)); // 313 on this tiny portfolio
    expect(s.base).toBeGreaterThan(100);
  });

  it("extra runs add their reduced credit directly to the score", () => {
    const s = computeDayScore({
      kind: "normal",
      tasks: [
        ...tasks,
        {
          unitId: "exercise",
          pointValue: 6,
          timesPerWeek: 2,
          completedToday: true,
          extraToday: true,
        },
      ],
      extraRunCredit: 3,
    });
    expect(s.earned).toBe(3); // nothing else done; the extra run's credit
  });

  it("activity credit adds directly to the score — no cap, no separate pool", () => {
    const s = computeDayScore({
      kind: "normal",
      tasks: withDone(["exercise"]),
      activities: [
        [{ unitId: "growth", pointsCredited: 5 }],
        [{ unitId: "friendship", pointsCredited: 12 }],
      ],
    });
    expect(s.earned).toBe(7 + 5 + 12);
    expect(s.base).toBe(Math.round((24 / 8) * 100));
  });

  it("rest days grade nothing", () => {
    const s = computeDayScore({
      kind: "rest",
      tasks: withDone(["growth"]),
      activities: [[{ unitId: "exercise", pointsCredited: 12 }]],
    });
    expect(s.base).toBeNull();
    expect(s.earned).toBe(0);
  });

  it("special days grade rating × 10, unrated shows nothing", () => {
    expect(
      computeDayScore({ kind: "special", satisfactionRating: 8, tasks: [] }).base,
    ).toBe(80);
    expect(
      computeDayScore({ kind: "special", satisfactionRating: null, tasks: [] }).base,
    ).toBeNull();
  });

  it("a day with no tasks has no base grade", () => {
    const s = computeDayScore({ kind: "normal", tasks: [] });
    expect(s.base).toBeNull();
    expect(s.possible).toBe(0);
  });

  it("weekly grade is the average of daily grades: a perfect week averages 100", () => {
    // 7 days: daily task done every day (4/day); the 3×/week run done
    // Mon/Wed/Fri (7 each); fortnight task done once (14, its full
    // fortnight budget — counted here across one week for simplicity
    // of the identity check on a fortnight-aligned portfolio).
    const week = Array.from({ length: 7 }, (_, i) =>
      computeDayScore({
        kind: "normal",
        tasks: [
          { unitId: "growth", pointValue: 4, timesPerWeek: 7, completedToday: true },
          {
            unitId: "exercise",
            pointValue: 7,
            timesPerWeek: 3,
            completedToday: i === 0 || i === 2 || i === 4,
          },
        ],
      }),
    );
    const avg = week.reduce((a, s) => a + (s.base ?? 0), 0) / 7;
    // Shares: 4 + 3 = 7/day; earned across week = 4×7 + 7×3 = 49 = 7×7.
    expect(Math.round(avg)).toBe(100);
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

  it("rest days ({0,0}) drop out without needing special-casing", () => {
    const withRest = aggregateGrade([
      { earned: 10, possible: 10 },
      { earned: 0, possible: 0 }, // rest day
      { earned: 10, possible: 10 },
    ]);
    const withoutRest = aggregateGrade([
      { earned: 10, possible: 10 },
      { earned: 10, possible: 10 },
    ]);
    expect(withRest).toEqual(withoutRest);
  });

  it("a special day (rating × 10 earned / 100 possible) contributes correctly", () => {
    const s = aggregateGrade([
      { earned: 50, possible: 50 }, // a normal day at 100%
      { earned: 80, possible: 100 }, // special day, rating 8
    ]);
    expect(s.earned).toBe(130);
    expect(s.possible).toBe(150);
    expect(s.base).toBe(87); // round(130/150*100)
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

  it("counts an elapsed day with no stored row at half credit", () => {
    const days = periodDays({
      ...base,
      today: "2026-07-20", // the whole week is over
      recorded: [{ localDate: "2026-07-13", earned: 50, possible: 50 }],
    });
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ earned: 50, possible: 50 });
    expect(days.slice(1)).toEqual(
      Array.from({ length: 6 }, () => ({ earned: 25, possible: 50 })),
    );
    // One perfect day plus six half-days: round(200/350*100).
    expect(aggregateGrade(days).base).toBe(57);
  });

  it("does not let skipped days vanish from the denominator", () => {
    const recorded = [
      { localDate: "2026-07-13", earned: 50, possible: 50 },
      { localDate: "2026-07-14", earned: 50, possible: 50 },
      { localDate: "2026-07-15", earned: 50, possible: 50 },
      { localDate: "2026-07-16", earned: 50, possible: 50 },
    ];
    // The bug this guards: aggregating stored rows alone reads 100%.
    expect(aggregateGrade(recorded).base).toBe(100);
    const days = periodDays({ ...base, today: "2026-07-20", recorded });
    expect(aggregateGrade(days).base).toBe(79); // round(275/350*100)
  });

  /* The trade ADR-0004 §5 accepts explicitly: at half credit, a day
   * nobody touched out-scores a day someone touched and half-finished.
   * Pinned so the choice stays deliberate rather than drifting. */
  it("scores an untouched day above a touched-but-poor one", () => {
    const untouched = periodDays({
      ...base,
      today: "2026-07-15",
      recorded: [{ localDate: "2026-07-13", earned: 50, possible: 50 }],
    })[1];
    const poor = periodDays({
      ...base,
      today: "2026-07-15",
      recorded: [
        { localDate: "2026-07-13", earned: 50, possible: 50 },
        { localDate: "2026-07-14", earned: 10, possible: 50 },
      ],
    })[1];
    expect(untouched).toEqual({ earned: 25, possible: 50 });
    expect(poor).toEqual({ earned: 10, possible: 50 });
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
    const days = periodDays({
      ...base,
      gradingStart: "2026-07-16",
      today: "2026-07-20",
      recorded: [],
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

  it("keeps stored rest and special days as stored", () => {
    const days = periodDays({
      ...base,
      today: "2026-07-16",
      recorded: [
        { localDate: "2026-07-13", earned: 0, possible: 0 }, // rest
        { localDate: "2026-07-14", earned: 80, possible: 100 }, // special, 8/10
        // 07-15 untouched → filled
      ],
    });
    expect(days).toEqual([
      { earned: 0, possible: 0 },
      { earned: 80, possible: 100 },
      { earned: 25, possible: 50 },
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
