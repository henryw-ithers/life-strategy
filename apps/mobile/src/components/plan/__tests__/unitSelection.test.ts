/**
 * The unit picker's rules, commitments included (ADR-0035 §3).
 */
import { describe, expect, it } from "vitest";

import {
  canPick,
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
  it("leads with commitments and their parts, then scored life units", () => {
    const picked = pickableUnits({
      hasSnapshot: true,
      commitments: [
        { id: "school", name: "School", parts: [{ id: "comp2521", name: "COMP2521" }], tasks: [] },
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
              weight: 10,
              tasks: [],
            },
            {
              id: "skipped",
              name: "Skipped",
              areaId: "health",
              includeInScoring: false,
              motivationKind: "instrumental",
              weight: null,
              tasks: [],
            },
          ],
        },
      ],
    });
    expect(picked.map((u) => u.id)).toEqual(["school", "comp2521", "fitness"]);
    expect(picked.filter((u) => u.commitment).map((u) => u.id)).toEqual([
      "school",
      "comp2521",
    ]);
  });

  it("is empty before the plan has loaded", () => {
    expect(pickableUnits(null)).toEqual([]);
  });
});
