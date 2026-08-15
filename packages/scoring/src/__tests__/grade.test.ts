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

  // ── ADR-0023: planned work is what pays ──

  it("special days grade on their tasks, plus a rating bonus", () => {
    // One daily task worth 10: denominator 10, done = 10 earned.
    const tasks = [
      { unitId: "growth", pointValue: 10, timesPerWeek: 7, completedToday: true },
    ];
    const s = computeDayScore({ kind: "special", satisfactionRating: 8, tasks });
    // 10 from the plan + round(8/10 × 25) = 20 from the rating.
    expect(s.unplanned).toBe(20);
    expect(s.earned).toBe(30);
    expect(s.base).toBe(300);
  });

  it("a special day with nothing done earns only its rating bonus", () => {
    // The vacation case ADR-0023 exists to fix: a 10-rated day with the
    // checklist untouched used to score 100. It now scores the cap.
    const tasks = [
      { unitId: "growth", pointValue: 100, timesPerWeek: 7, completedToday: false },
    ];
    const s = computeDayScore({ kind: "special", satisfactionRating: 10, tasks });
    expect(s.unplanned).toBe(UNPLANNED_CAP);
    expect(s.earned).toBe(UNPLANNED_CAP);
    expect(s.base).toBe(25);
  });

  it("an unrated special day draws nothing from the pool", () => {
    const tasks = [
      { unitId: "growth", pointValue: 10, timesPerWeek: 7, completedToday: true },
    ];
    const s = computeDayScore({ kind: "special", satisfactionRating: null, tasks });
    expect(s.unplanned).toBe(0);
    expect(s.earned).toBe(10);
  });

  it("unplanned credit never exceeds the cap, and reports what it dropped", () => {
    const tasks = [
      { unitId: "growth", pointValue: 20, timesPerWeek: 7, completedToday: false },
    ];
    const s = computeDayScore({
      kind: "special",
      satisfactionRating: 10, // 25 on its own
      tasks,
      activities: [[{ unitId: "growth", pointsCredited: 18 }]],
    });
    expect(s.unplanned).toBe(UNPLANNED_CAP);
    expect(s.unplannedForgone).toBe(18); // 43 raw − 25 paid
    expect(s.earned).toBe(UNPLANNED_CAP);
  });

  it("activities alone are capped on a normal day", () => {
    const tasks = [
      { unitId: "growth", pointValue: 40, timesPerWeek: 7, completedToday: false },
    ];
    const s = computeDayScore({
      kind: "normal",
      tasks,
      activities: [
        [{ unitId: "growth", pointsCredited: 20 }],
        [{ unitId: "growth", pointsCredited: 20 }],
      ],
    });
    expect(s.unplanned).toBe(UNPLANNED_CAP);
    expect(s.earned).toBe(UNPLANNED_CAP);
  });

  it("extra runs sit outside the cap — the plan done harder is uncapped", () => {
    const tasks = [
      { unitId: "growth", pointValue: 10, timesPerWeek: 7, completedToday: true },
    ];
    const s = computeDayScore({
      kind: "normal",
      tasks,
      extraRunCredit: 40,
      activities: [[{ unitId: "growth", pointsCredited: 60 }]],
    });
    // 10 planned + 40 extra runs (uncapped) + 25 capped unplanned.
    expect(s.unplanned).toBe(UNPLANNED_CAP);
    expect(s.earned).toBe(75);
  });

  it("a day off earns nothing and stays out of the pool", () => {
    const s = computeDayScore({
      kind: "rest",
      satisfactionRating: 10,
      tasks: [
        { unitId: "growth", pointValue: 10, timesPerWeek: 7, completedToday: true },
      ],
      activities: [[{ unitId: "growth", pointsCredited: 20 }]],
    });
    expect(s).toEqual({
      possible: 0,
      earned: 0,
      base: null,
      unplanned: 0,
      unplannedForgone: 0,
    });
  });

  it("a finalized day reads its stored grade back, not a recomputation", () => {
    // The v4-era special day this exists to protect: 80 earned out of a
    // 100 denominator. Under v5 the same inputs would score far lower,
    // and re-deriving it weeks later would restate the tester's past.
    const s = storedDayScore({ earned: 80, possible: 100 });
    expect(s.base).toBe(80);
    expect(s.earned).toBe(80);
    expect(s.possible).toBe(100);
  });

  it("a stored day off stays ungraded", () => {
    expect(storedDayScore({ earned: 0, possible: 0 }).base).toBeNull();
  });

  it("a stored day above its denominator keeps its number", () => {
    // Extra runs are uncapped (ADR-0023 §2), so >100 is legitimate and
    // must survive the round trip rather than being clamped.
    expect(storedDayScore({ earned: 75, possible: 50 }).base).toBe(150);
  });

  /* The calendar-vs-header bug: `day_grade` stores earned and possible
   * as integers, so anything deriving `base` from the raw floats
   * disagrees with anything deriving it from the stored row. Pinned on
   * a deliberately fractional portfolio — sevenths never divide
   * evenly — because the two surfaces only drifted on the days where
   * rounding actually bit. */
  it("a day's grade survives the round trip through storage", () => {
    const tasks = [
      { unitId: "a", pointValue: 13, timesPerWeek: 3, completedToday: true },
      { unitId: "b", pointValue: 11, timesPerWeek: 2, completedToday: false },
      { unitId: "c", pointValue: 7, timesPerWeek: 5, completedToday: true },
      { unitId: "d", pointValue: 4, timesPerWeek: 0, completedToday: false },
    ];
    const live = computeDayScore({ kind: "normal", tasks });
    // What `cacheDayScore` writes, read back the way the calendar reads.
    const stored = storedDayScore({
      earned: Math.round(live.earned),
      possible: Math.round(live.possible),
    });
    expect(stored.base).toBe(live.base);
    // And the stored pair is already integral, so caching is lossless.
    expect(Number.isInteger(live.earned)).toBe(true);
    expect(Number.isInteger(live.possible)).toBe(true);
  });

  it("a special day round-trips too, at its real score not rating × 10", () => {
    const tasks = [
      { unitId: "a", pointValue: 13, timesPerWeek: 3, completedToday: true },
      { unitId: "b", pointValue: 9, timesPerWeek: 4, completedToday: false },
    ];
    const live = computeDayScore({
      kind: "special",
      satisfactionRating: 9,
      tasks,
    });
    const stored = storedDayScore({
      earned: live.earned,
      possible: live.possible,
    });
    expect(stored.base).toBe(live.base);
    // The retired model would have read 90 here regardless of the plan.
    expect(live.base).not.toBe(90);
  });

  it("specialDayBonus scales the rating across the cap", () => {
    expect(specialDayBonus(10)).toBe(UNPLANNED_CAP);
    expect(specialDayBonus(6)).toBe(15);
    expect(specialDayBonus(1)).toBe(3);
    expect(specialDayBonus(null)).toBe(0);
    expect(specialDayBonus(undefined)).toBe(0);
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
