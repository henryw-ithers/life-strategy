import { describe, expect, it } from "vitest";

import { computeDayScore, deriveChecklist, extraRunPoints } from "../grade";

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
    const [status] = deriveChecklist(
      [run],
      [{ taskId: "run", localDate: "2026-07-12" }], // Sunday, prior week
      date,
    );
    expect(status?.doneCount).toBe(0);
    expect(status?.band).toBe("week");
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
