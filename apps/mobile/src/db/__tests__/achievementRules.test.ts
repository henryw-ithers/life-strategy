/**
 * What each achievement series stands at (ADR-0047 §3), from plain
 * facts: counts, hours, every-day runs, plan weeks and score days.
 */
import { addDays } from "@glide/scoring";
import { describe, expect, it } from "vitest";

import { ALL, seriesValues, type AchievementFacts } from "../achievementRules";

/** Wednesday 21 October 2026; its week began Sunday the 18th. */
const TODAY = "2026-10-21";

type TaskFact = AchievementFacts["tasks"][number];

function task(id: string, over: Partial<TaskFact> = {}): TaskFact {
  return {
    id,
    unitId: "fit",
    title: id,
    kind: "task",
    timesPerWeek: 3,
    plannedWeekdays: null,
    fortnightOffset: 0,
    oneOffSize: null,
    size: null,
    startMinute: null,
    endMinute: null,
    repeatFrom: null,
    repeatUntil: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function facts(over: Partial<AchievementFacts> = {}): AchievementFacts {
  return {
    today: TODAY,
    areas: [{ id: "health", name: "Health" }],
    units: [
      { id: "fit", name: "Fitness", areaId: "health", parentUnitId: null, isCustom: false, commitmentShare: null, archivedAt: null },
      { id: "school", name: "School", areaId: "health", parentUnitId: null, isCustom: true, commitmentShare: 30, archivedAt: null },
    ],
    tasks: [],
    completions: [],
    grades: [],
    activities: [],
    away: [],
    skipped: new Map(),
    ...over,
  };
}

const tick = (taskId: string, localDate: string, over: { fraction?: number; actualMinutes?: number | null } = {}) => ({
  taskId,
  localDate,
  fraction: over.fraction ?? 1,
  actualMinutes: over.actualMinutes ?? null,
});

const valueOf = (f: AchievementFacts, series: string, subjectId: string) =>
  seriesValues(f).find((v) => v.series === series && v.subjectId === subjectId);

describe("counts", () => {
  it("counts a task's ticks, its unit's and its area's", () => {
    const f = facts({
      tasks: [task("run"), task("lift")],
      completions: [tick("run", "2026-10-01"), tick("run", "2026-10-02"), tick("lift", "2026-10-02")],
    });
    expect(valueOf(f, "taskCompletions", "run")).toMatchObject({ earned: 2, current: 2 });
    expect(valueOf(f, "unitCompletions", "fit")?.earned).toBe(3);
    expect(valueOf(f, "areaCompletions", "health")?.earned).toBe(3);
  });

  it("lists a subject with nothing yet, at zero", () => {
    expect(valueOf(facts({ tasks: [task("run")] }), "taskCompletions", "run")?.earned).toBe(0);
  });

  it("counts hours from Took about, else the size, scaled by part-done", () => {
    const f = facts({
      tasks: [task("run", { size: "big" })],
      completions: [
        tick("run", "2026-10-01", { actualMinutes: 45 }),
        tick("run", "2026-10-02"),
        tick("run", "2026-10-03", { fraction: 0.5 }),
      ],
    });
    // 45 + 120 + 60 minutes.
    expect(valueOf(f, "unitHours", "fit")?.earned).toBe(3);
  });

  it("counts a commitment's ticked events as attended and in its hours, never a weekly target", () => {
    const lecture = task("lec", { unitId: "school", kind: "event", timesPerWeek: 1, startMinute: 600, endMinute: 720 });
    const f = facts({ tasks: [lecture], completions: [tick("lec", "2026-10-06"), tick("lec", "2026-10-13")] });
    expect(valueOf(f, "attended", "school")?.earned).toBe(2);
    expect(valueOf(f, "commitmentHours", "school")?.earned).toBe(4);
    expect(valueOf(f, "weeklyTargetTotal", "lec")).toBeUndefined();
    expect(valueOf(f, "taskCompletions", "lec")).toBeUndefined();
  });

  it("keeps commitment ticks out of the life units' counts", () => {
    const f = facts({ tasks: [task("essay", { unitId: "school" })], completions: [tick("essay", "2026-10-01")] });
    expect(valueOf(f, "unitCompletions", "fit")?.earned).toBe(0);
    expect(valueOf(f, "areaCompletions", "health")?.earned).toBe(0);
  });
});

describe("every-day streaks", () => {
  const daily = task("med", { timesPerWeek: 7 });
  const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

  it("awards from the run up to yesterday, and shows the run going now", () => {
    const f = facts({ tasks: [daily], completions: days("2026-10-14", 8).map((d) => tick("med", d)) });
    // The 14th to today: 8 days going, 7 of them finished.
    expect(valueOf(f, "everyDayStreak", "med")).toMatchObject({ earned: 7, current: 8 });
  });

  it("is bridged by Away days, and starts again after a missed one", () => {
    const done = [...days("2026-10-10", 3), ...days("2026-10-15", 6)];
    const away = facts({ tasks: [daily], completions: done.map((d) => tick("med", d)), away: [{ startDate: "2026-10-13", endDate: "2026-10-14" }] });
    expect(valueOf(away, "everyDayStreak", "med")?.current).toBe(9);
    const missed = facts({ tasks: [daily], completions: done.map((d) => tick("med", d)) });
    expect(valueOf(missed, "everyDayStreak", "med")).toMatchObject({ earned: 6, current: 6 });
  });
});

describe("plan weeks", () => {
  it("counts weeks ended with the target met, and the run", () => {
    // Weeks of 4, 11 and 18 October: met, met, and this week (not ended).
    const done = ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-18", "2026-10-19", "2026-10-20"];
    const f = facts({ tasks: [task("run", { createdAt: "2026-10-04T00:00:00.000Z" })], completions: done.map((d) => tick("run", d)) });
    expect(valueOf(f, "weeklyTargetTotal", "run")?.earned).toBe(2);
    expect(valueOf(f, "weeklyTargetRun", "run")).toMatchObject({ earned: 2, current: 2 });
  });

  it("asks less of a week partly Away, and passes over one wholly Away", () => {
    const f = facts({
      tasks: [task("run", { createdAt: "2026-10-04T00:00:00.000Z" })],
      // Away the whole first week, and all but Saturday of the second.
      away: [{ startDate: "2026-10-04", endDate: "2026-10-16" }],
      completions: [tick("run", "2026-10-17")],
    });
    expect(valueOf(f, "weeklyTargetRun", "run")).toMatchObject({ earned: 1, current: 1 });
  });

  it("counts a whole unit's week only when every task met its target", () => {
    const run = task("run", { createdAt: "2026-10-11T00:00:00.000Z", timesPerWeek: 1 });
    const lift = task("lift", { createdAt: "2026-10-11T00:00:00.000Z", timesPerWeek: 1 });
    const one = facts({ tasks: [run, lift], completions: [tick("run", "2026-10-12")] });
    expect(valueOf(one, "wholeUnitTotal", "fit")?.earned).toBe(0);
    const both = facts({ tasks: [run, lift], completions: [tick("run", "2026-10-12"), tick("lift", "2026-10-14")] });
    expect(valueOf(both, "wholeUnitRun", "fit")).toMatchObject({ earned: 1, current: 1 });
  });
});

describe("score days", () => {
  const grade = (localDate: string, pointsEarned: number, over: Partial<AchievementFacts["grades"][number]> = {}) => ({
    localDate,
    kind: "normal" as const,
    pointsEarned,
    pointsPossible: 100,
    flagged: false,
    ...over,
  });

  it("reads days that have ended, skips a day off, and counts a missing day as nothing", () => {
    const f = facts({
      grades: [
        grade("2026-10-15", 95),
        grade("2026-10-16", 0, { pointsPossible: 0 }), // a day off
        grade("2026-10-17", 92),
        // the 18th has no row
        grade("2026-10-19", 91),
        grade("2026-10-20", 85),
        grade(TODAY, 100),
      ],
    });
    expect(valueOf(f, "greatDays", ALL)?.earned).toBe(3);
    expect(valueOf(f, "goodDays", ALL)?.earned).toBe(4);
    expect(valueOf(f, "greatDayRun", ALL)).toMatchObject({ earned: 2, current: 0 });
  });

  it("counts days worth remembering once each, from the day or an activity", () => {
    const f = facts({
      grades: [grade("2026-10-01", 50, { flagged: true })],
      activities: [
        { localDate: "2026-10-01", flagged: true },
        { localDate: "2026-10-02", flagged: true },
        { localDate: "2026-10-03", flagged: false },
      ],
    });
    expect(valueOf(f, "flaggedDays", ALL)?.earned).toBe(2);
    expect(valueOf(f, "activities", ALL)?.earned).toBe(3);
  });
});
