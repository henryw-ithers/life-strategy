/**
 * ADR-0042: goals are measured by the app.
 */
import { describe, expect, it } from "vitest";

import {
  clampTookAbout,
  countsToward,
  entryFor,
  goalProblem,
  goalProgress,
  goalStreak,
  streakRungs,
  streakShown,
  type GoalDefinition,
  type GoalEntry,
  type GoalTick,
} from "../goalKinds";

const exercise = new Set(["exercise"]);
/** A tick scoring `points` in one unit (Exercise by default). */
const tick = (over: Partial<GoalTick> & { unit?: string; points?: number } = {}): GoalTick => {
  const { unit = "exercise", points = 5, ...rest } = over;
  return {
    taskId: "run",
    localDate: "2026-07-13",
    pointsByUnit: new Map([[unit, points]]),
    size: "normal",
    ...rest,
  };
};
const entries = (goal: GoalDefinition, ticks: GoalTick[]): GoalEntry[] =>
  ticks.map((t) => entryFor(goal, t)).filter((e): e is GoalEntry => e !== null);

describe("times done", () => {
  const goal: GoalDefinition = {
    measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 30 },
    unitIds: exercise,
  };

  it("counts ticks of the tasks you chose, and only those", () => {
    expect(countsToward(goal, tick())).toBe(true);
    expect(countsToward(goal, tick({ taskId: "swim" }))).toBe(false);
  });

  it("is a running total toward the target: 18 / 30 runs", () => {
    const ticks = Array.from({ length: 18 }, (_, i) => tick({ localDate: `2026-07-${String(i + 1).padStart(2, "0")}` }));
    expect(goalProgress(goal, entries(goal, ticks))).toEqual({ value: 18, target: 30, reached: false });
  });

  it("invites completion when the target is reached, and never completes by itself", () => {
    const ticks = Array.from({ length: 30 }, () => tick());
    expect(goalProgress(goal, entries(goal, ticks)).reached).toBe(true);
  });
});

describe("time spent", () => {
  const chosen: GoalDefinition = {
    measure: { kind: "timeSpent", counts: { taskIds: new Set(["study"]) }, target: 40 },
    unitIds: new Set(["school"]),
  };
  const whole: GoalDefinition = {
    measure: { kind: "timeSpent", counts: "wholeUnit", target: 40 },
    unitIds: new Set(["school", "comp2521"]),
  };

  it("counts each tick's size in hours: Quick 0.5, Normal 1, Big 2, none Normal", () => {
    const ticks = [
      tick({ taskId: "study", size: "quick", unit: "school" }),
      tick({ taskId: "study", size: "big", unit: "school" }),
      tick({ taskId: "study", size: null, unit: "school" }),
    ];
    expect(goalProgress(chosen, entries(chosen, ticks)).value).toBe(3.5);
  });

  it("counts an event by its own length", () => {
    const e = entryFor(chosen, tick({ taskId: "study", unit: "school", durationMinutes: 90 }));
    expect(e?.minutes).toBe(90);
  });

  it("uses Took about… when set", () => {
    const e = entryFor(chosen, tick({ taskId: "study", tookMinutes: 90, unit: "school" }));
    expect(e?.minutes).toBe(90);
  });

  it("counts every task in the unit, its sub-commitments and tasks added later included", () => {
    expect(countsToward(whole, tick({ taskId: "anything", unit: "comp2521" }))).toBe(true);
    expect(countsToward(whole, tick({ taskId: "gym" }))).toBe(false);
  });
});

describe("points earned", () => {
  const goal: GoalDefinition = {
    measure: { kind: "pointsEarned", target: 300 },
    unitIds: exercise,
  };

  it("counts the whole unit, always, as a running total", () => {
    const ticks = [tick({ points: 12 }), tick({ taskId: "swim", points: 8 }), tick({ unit: "work", points: 50 })];
    expect(goalProgress(goal, entries(goal, ticks))).toEqual({ value: 20, target: 300, reached: false });
  });

  it("never counts a unit a task only tags as a note (ADR-0035 §3)", () => {
    // A Basketball session tagging Exercise as a note scores only in
    // Basketball: Exercise's points goal gets nothing from it.
    const noteTagged: GoalTick = {
      taskId: "practice",
      localDate: "2026-07-13",
      pointsByUnit: new Map([["basketball", 12]]),
      size: "normal",
    };
    expect(entryFor(goal, noteTagged)).toBeNull();
  });

  it("gives each unit's goal only that unit's share of a task scoring in two", () => {
    const both: GoalTick = {
      taskId: "walk-with-mum",
      localDate: "2026-07-13",
      pointsByUnit: new Map([["exercise", 4], ["family", 6]]),
      size: "normal",
    };
    expect(entryFor(goal, both)?.points).toBe(4);
  });

  it("is only a running total: days off add nothing, and nothing is a share of what was on offer (EC-37)", () => {
    // Entries are only ever points earned; a day off has none.
    expect(goalProgress(goal, []).value).toBe(0);
  });
});

describe("streak", () => {
  const goal: GoalDefinition = { measure: { kind: "streak", taskId: "meditate" }, unitIds: new Set(["mind"]) };
  const days = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => tick({ taskId: "meditate", unit: "mind", localDate: `2026-07-${String(from + i).padStart(2, "0")}` }));

  it("counts days in a row of its one task, with no target and nothing to complete", () => {
    const p = goalProgress(goal, entries(goal, days(1, 9)), { today: "2026-07-09", daysOff: [] });
    expect(p).toEqual({ value: 9, target: null, reached: false });
  });

  it("skips days off and Away days rather than ending the run", () => {
    const e = entries(goal, [...days(1, 4), ...days(6, 9)]);
    expect(goalProgress(goal, e, { today: "2026-07-09", daysOff: ["2026-07-05"] }).value).toBe(8);
  });

  it("ends the run on a cleared day, which isn't a day off (EC-51)", () => {
    const e = entries(goal, [...days(1, 4), ...days(6, 9)]);
    expect(goalProgress(goal, e, { today: "2026-07-09", daysOff: [] }).value).toBe(4);
  });

  it("doesn't count an unfinished today", () => {
    const e = entries(goal, days(1, 8));
    expect(goalProgress(goal, e, { today: "2026-07-09", daysOff: [] }).value).toBe(8);
  });

  it("counts only due days once its task is no longer every day", () => {
    // Meditate became Monday, Wednesday and Friday: done on each of those
    // across two weeks, the run is 6, and the days between don't end it.
    const mwf = ["2026-07-13", "2026-07-15", "2026-07-17", "2026-07-20", "2026-07-22", "2026-07-24"];
    const e = entries(goal, mwf.map((localDate) => tick({ taskId: "meditate", unit: "mind", localDate })));
    const isDue = (d: string) => [1, 3, 5].includes(new Date(`${d}T12:00:00Z`).getUTCDay());
    expect(goalStreak(e, { today: "2026-07-24", daysOff: [], isDue }).current).toBe(6);
    // Without the due days, the gaps end it.
    expect(goalStreak(e, { today: "2026-07-24", daysOff: [] }).current).toBe(1);
  });

  it("shows nothing under 7 days, and only the current run", () => {
    expect(streakShown({ current: 6, longest: 40 })).toBeNull();
    expect(streakShown({ current: 7, longest: 40 })).toBe(7);
  });

  it("celebrates 7, 30 and 66 days", () => {
    const run = goalStreak(entries(goal, days(1, 30)), { today: "2026-07-30", daysOff: [] });
    expect(streakRungs(run)).toEqual([7, 30]);
  });
});

describe("history isn't rewritten (EC-36)", () => {
  it("keeps what a tick counted when it was made", () => {
    const goal: GoalDefinition = {
      measure: { kind: "timesDone", taskIds: new Set(["run"]), target: 10 },
      unitIds: exercise,
    };
    const kept = entries(goal, [tick(), tick()]);
    // Later the task is unlinked or archived: the goal changes, the
    // entries don't.
    const unlinked: GoalDefinition = {
      unitIds: exercise,
      measure: { kind: "timesDone", taskIds: new Set(), target: 10 },
    };
    expect(goalProgress(unlinked, kept).value).toBe(2);
  });
});

describe("a goal on a commitment (EC-41)", () => {
  it("counts only that commitment's work", () => {
    const goal: GoalDefinition = {
      measure: { kind: "timeSpent", counts: "wholeUnit", target: 40 },
      unitIds: new Set(["school", "comp2521"]),
    };
    expect(countsToward(goal, tick({ unit: "school" }))).toBe(true);
    expect(countsToward(goal, tick({ unit: "reading" }))).toBe(false);
  });
});

describe("Took about… (EC-38)", () => {
  it("is kept between 1 minute and 12 hours", () => {
    expect(clampTookAbout(0)).toBe(1);
    expect(clampTookAbout(-5)).toBe(1);
    expect(clampTookAbout(900)).toBe(720);
    expect(clampTookAbout(45)).toBe(45);
    expect(clampTookAbout(Number.NaN)).toBe(1);
  });
});

describe("goalProblem: before saving", () => {
  const facts = new Map([
    ["meditate", { taskId: "meditate", timesPerWeek: 7, isEvent: false }],
    ["gym", { taskId: "gym", timesPerWeek: 3, isEvent: false }],
    ["lecture", { taskId: "lecture", timesPerWeek: 7, isEvent: true }],
  ]);
  const goal = (measure: GoalDefinition["measure"]): GoalDefinition => ({ measure, unitIds: exercise });

  it("needs a target above zero, except for a streak", () => {
    expect(goalProblem(goal({ kind: "pointsEarned", target: 0 }), facts)).toMatch(/target/);
    expect(goalProblem(goal({ kind: "pointsEarned", target: 300 }), facts)).toBeNull();
  });

  it("needs at least one task to count", () => {
    expect(goalProblem(goal({ kind: "timesDone", taskIds: new Set(), target: 5 }), facts)).toMatch(/task/);
    expect(goalProblem(goal({ kind: "timeSpent", counts: { taskIds: new Set() }, target: 5 }), facts)).toMatch(/task/);
    expect(goalProblem(goal({ kind: "timeSpent", counts: "wholeUnit", target: 5 }), facts)).toBeNull();
  });

  it("lets a streak follow one every-day task, never an event", () => {
    expect(goalProblem(goal({ kind: "streak", taskId: "meditate" }), facts)).toBeNull();
    expect(goalProblem(goal({ kind: "streak", taskId: "gym" }), facts)).toMatch(/every-day/);
    expect(goalProblem(goal({ kind: "streak", taskId: "lecture" }), facts)).toMatch(/not an event/);
    expect(goalProblem(goal({ kind: "streak", taskId: "missing" }), facts)).toMatch(/Choose/);
  });
});
