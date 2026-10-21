/**
 * The unit picker's rules, commitments included (ADR-0035 §3).
 */
import { describe, expect, it } from "vitest";

import {
  canPick,
  guessUnit,
  needsDays,
  pickableUnits,
  selectUnit,
  type PickableUnit,
} from "../unitSelection";

const units: PickableUnit[] = [
  { id: "school", name: "School", areaId: "work-money", commitment: true },
  { id: "comp2521", name: "COMP2521", areaId: "work-money", commitment: true },
  { id: "work", name: "Work", areaId: "work-money", commitment: true },
  { id: "learning", name: "Learning", areaId: "growth" },
  { id: "fitness", name: "Fitness", areaId: "health" },
  { id: "sleep", name: "Sleep", areaId: "health" },
];

describe("selectUnit", () => {
  it("adds and removes life units as it always has", () => {
    expect(selectUnit([], "fitness", units, 3)).toEqual(["fitness"]);
    expect(selectUnit(["fitness"], "sleep", units, 3)).toEqual(["fitness", "sleep"]);
    expect(selectUnit(["fitness", "sleep"], "fitness", units, 3)).toEqual(["sleep"]);
  });

  it("puts a commitment first, so it is where the task is listed", () => {
    // Learning becomes a note behind it rather than the home.
    expect(selectUnit(["learning"], "comp2521", units, 3)).toEqual([
      "comp2521",
      "learning",
    ]);
  });

  it("swaps one commitment for another instead of stacking two", () => {
    expect(selectUnit(["school", "learning"], "work", units, 3)).toEqual([
      "work",
      "learning",
    ]);
    // A part is a commitment unit too: School → COMP2521 is a swap.
    expect(selectUnit(["school"], "comp2521", units, 3)).toEqual(["comp2521"]);
  });

  it("can swap a commitment even when the task is at its cap", () => {
    expect(
      selectUnit(["school", "learning", "fitness"], "work", units, 3),
    ).toEqual(["work", "learning", "fitness"]);
  });

  it("will not add a new commitment past the cap", () => {
    expect(selectUnit(["learning", "fitness", "sleep"], "school", units, 3)).toEqual([
      "learning",
      "fitness",
      "sleep",
    ]);
  });

  it("never lets a commitment land anywhere but first", () => {
    // Whatever order they are tapped in — the write seam refuses any
    // other shape, so the picker must never produce one.
    let v: string[] = [];
    for (const id of ["fitness", "learning", "school"]) v = selectUnit(v, id, units, 3);
    expect(v[0]).toBe("school");
    expect(v.slice(1).every((id) => !units.find((u) => u.id === id)?.commitment)).toBe(true);
  });
});

describe("canPick", () => {
  it("blocks a new life unit at the cap, and lets a commitment swap", () => {
    const full = ["school", "learning", "fitness"];
    expect(canPick(full, "sleep", units, 3)).toBe(false);
    expect(canPick(full, "work", units, 3)).toBe(true);
    expect(canPick(full, "learning", units, 3)).toBe(true);
  });

  it("blocks a commitment at the cap when there is none to swap", () => {
    expect(canPick(["learning", "fitness", "sleep"], "school", units, 3)).toBe(false);
  });
});

describe("needsDays", () => {
  it("asks recurring commitment work for its days", () => {
    expect(needsDays({ homeIsCommitment: true, once: false, weekdays: [] })).toBe(true);
    expect(needsDays({ homeIsCommitment: true, once: false, weekdays: [1, 3] })).toBe(false);
  });

  it("lets a commitment one-off go without a date", () => {
    expect(needsDays({ homeIsCommitment: true, once: true, weekdays: [] })).toBe(false);
  });

  it("never asks a life task for days — flexible is the default there", () => {
    expect(needsDays({ homeIsCommitment: false, once: false, weekdays: [] })).toBe(false);
  });
});

describe("pickableUnits", () => {
  it("offers a split commitment's sub-commitments, never the commitment itself", () => {
    // ADR-0035 §1, amended 2026-10-02: a split commitment holds no work.
    const picked = pickableUnits({
      hasSnapshot: true,
      commitments: [
        {
          id: "school",
          name: "School",
          parts: [{ id: "comp2521", name: "COMP2521" }],
          split: true,
          tasks: [],
        },
      ],
      areas: [],
    });
    expect(picked.map((u) => u.id)).toEqual(["comp2521"]);
  });

  it("leads with commitments and their parts, then scored life units", () => {
    const picked = pickableUnits({
      hasSnapshot: true,
      commitments: [
        {
          id: "school",
          name: "School",
          parts: [{ id: "comp2521", name: "COMP2521" }],
          split: false,
          tasks: [],
        },
      ],
      areas: [
        {
          id: "health",
          name: "Health",
          units: [
            {
              id: "fitness",
              name: "Fitness",
              areaId: "health",
              includeInScoring: true,
              motivationKind: "instrumental",
              tier: "top",
              tierOrder: 0,
              weight: 10,
              recommendedWeight: null,
              tasks: [],
            },
            {
              id: "skipped",
              name: "Skipped",
              areaId: "health",
              includeInScoring: false,
              motivationKind: "instrumental",
              tier: "notNow",
              tierOrder: 0,
              weight: null,
              recommendedWeight: null,
              tasks: [],
            },
          ],
        },
      ],
    });
    // A Not now unit is listed last, greyed (spec §5.4.1).
    expect(picked.map((u) => u.id)).toEqual(["school", "comp2521", "fitness", "skipped"]);
    expect(picked.find((u) => u.id === "skipped")?.notNow).toBe(true);
    expect(picked.filter((u) => u.commitment).map((u) => u.id)).toEqual([
      "school",
      "comp2521",
    ]);
  });

  it("is empty before the plan has loaded", () => {
    expect(pickableUnits(null)).toEqual([]);
  });
});

describe("Not now units (spec §5.4.1)", () => {
  const withNotNow: PickableUnit[] = [...units, { id: "travel", name: "Travel", areaId: "fun", notNow: true }];

  it("can't be picked, though a chosen one can be cleared", () => {
    expect(canPick([], "travel", withNotNow, 3)).toBe(false);
    expect(selectUnit([], "travel", withNotNow, 3)).toEqual([]);
    expect(selectUnit(["travel"], "travel", withNotNow, 3)).toEqual([]);
  });
});

describe("guessUnit (spec §5.7)", () => {
  const all: PickableUnit[] = [
    ...units,
    { id: "exercise-fitness", name: "Exercise & fitness", areaId: "health" },
    { id: "family", name: "Family", areaId: "relationships" },
    { id: "adventure-experiences", name: "Adventure", areaId: "fun", notNow: true },
  ];

  it("finds the unit a title's words point to", () => {
    expect(guessUnit("Go for a run", all)).toBe("exercise-fitness");
    expect(guessUnit("Dinner with mum", all)).toBe("family");
  });

  it("prefers a commitment named in the title, the most specific first", () => {
    expect(guessUnit("COMP2521 lab report", all)).toBe("comp2521");
    expect(guessUnit("School run", all)).toBe("school");
  });

  it("matches a commitment's name as a whole word only", () => {
    // "Work" is a commitment; a workout isn't work.
    expect(guessUnit("Morning workout", all)).toBe("exercise-fitness");
    expect(guessUnit("Work: rota emails", all)).toBe("work");
  });

  it("never guesses a Not now unit, or from almost nothing", () => {
    expect(guessUnit("Plan a road trip", all)).toBeNull();
    expect(guessUnit("ru", all)).toBeNull();
    expect(guessUnit("Sort the drawer", all)).toBeNull();
  });
});
