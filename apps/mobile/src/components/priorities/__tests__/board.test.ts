/**
 * Your priorities as a board (ADR-0041 §1, on Life since ADR-0048):
 * dropping a unit into a tier, and a first run sorted before it saves.
 */
import { describe, expect, it } from "vitest";

import { inTiers, moveTo, sortedPlacement, type BoardUnit } from "../board";

describe("moveTo", () => {
  const start: BoardUnit[] = [
    { unitId: "a", tier: "top" },
    { unitId: "b", tier: "top" },
    { unitId: "c", tier: "important" },
  ];

  it("drops a unit into another tier at the place it was let go", () => {
    expect(moveTo(start, "a", "important", 1)).toEqual([
      { unitId: "b", tier: "top" },
      { unitId: "c", tier: "important" },
      { unitId: "a", tier: "important" },
    ]);
    expect(moveTo(start, "a", "important", 0).map((p) => p.unitId)).toEqual(["b", "a", "c"]);
  });

  it("reorders within a tier, and fills an empty one", () => {
    expect(moveTo(start, "b", "top", 0).map((p) => p.unitId)).toEqual(["b", "a", "c"]);
    expect(moveTo(start, "c", "notNow", 0)).toEqual([...start.slice(0, 2), { unitId: "c", tier: "notNow" }]);
  });
});

describe("a first run", () => {
  const fresh: BoardUnit[] = [
    { unitId: "a", tier: "unsorted" },
    { unitId: "b", tier: "unsorted" },
  ];

  it("can't be saved until every unit is in a tier", () => {
    const half = moveTo(fresh, "a", "important", 0);
    expect(sortedPlacement(half)).toBeNull();
    expect(inTiers(half)).toEqual([{ unitId: "a", tier: "important" }]);
    expect(sortedPlacement(moveTo(half, "b", "top", 0))).toEqual([
      { unitId: "b", tier: "top" },
      { unitId: "a", tier: "important" },
    ]);
  });
});
