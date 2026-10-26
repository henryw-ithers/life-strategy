/**
 * Starter tasks (ADR-0045 §1 step 5): only Top units, in your order,
 * at most three each, best first, with one you already have ticked.
 */
import { describe, expect, it } from "vitest";

import type { TaskTemplate, UnitLibrary } from "../../content/library";
import { starterUnits, type StarterUnitInput } from "../starterTasks";

const template = (id: string, title: string, defaultRank: number): TaskTemplate => ({
  id,
  title,
  description: null,
  profiles: ["maintenance"],
  timesPerWeek: 3,
  defaultRank,
});

const library: Record<string, UnitLibrary> = {
  exercise: {
    tasks: [
      template("walk", "Walk", 3),
      template("gym", "Gym", 1),
      template("run", "Run", 2),
      template("swim", "Swim", 4),
    ],
  },
  sleep: { tasks: [template("lights", "Lights out", 1)] },
};

const unit = (over: Partial<StarterUnitInput> & { id: string }): StarterUnitInput => ({
  name: over.id,
  areaId: "physical-health",
  tier: "top",
  tierOrder: 0,
  taskTitles: [],
  ...over,
});

describe("starterUnits", () => {
  it("offers the three best-ranked tasks for a Top unit", () => {
    const [u] = starterUnits([unit({ id: "exercise" })], library);
    expect(u?.starters.map((s) => s.task.title)).toEqual(["Gym", "Run", "Walk"]);
    expect(u?.starters.every((s) => !s.added)).toBe(true);
  });

  it("leaves out units that aren't Top, Not now among them", () => {
    const out = starterUnits(
      [
        unit({ id: "exercise", tier: "important" }),
        unit({ id: "sleep", tier: "notNow" }),
        unit({ id: "other", tier: null }),
      ],
      library,
    );
    expect(out).toEqual([]);
  });

  it("keeps Top units in your order", () => {
    const out = starterUnits(
      [unit({ id: "exercise", tierOrder: 1 }), unit({ id: "sleep", tierOrder: 0 })],
      library,
    );
    expect(out.map((u) => u.id)).toEqual(["sleep", "exercise"]);
  });

  it("ticks a task you already have, whatever its case", () => {
    const [u] = starterUnits([unit({ id: "exercise", taskTitles: ["gym "] })], library);
    expect(u?.starters.map((s) => [s.task.title, s.added])).toEqual([
      ["Gym", true],
      ["Run", false],
      ["Walk", false],
    ]);
  });

  it("keeps a Top unit with nothing in the library, for Add your own", () => {
    const [u] = starterUnits([unit({ id: "friendship" })], library);
    expect(u?.starters).toEqual([]);
  });
});
