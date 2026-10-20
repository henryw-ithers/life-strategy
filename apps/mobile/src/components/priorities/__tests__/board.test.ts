/**
 * The Priorities board as one list (ADR-0041 §1): the four tier headers
 * are fixed rows, and a unit's tier is the header above it.
 */
import { describe, expect, it } from "vitest";

import { boardRows, headerTier, moveToTier, placementFromRows } from "../board";

const placement = [
  { unitId: "a", tier: "top" as const },
  { unitId: "b", tier: "important" as const },
  { unitId: "c", tier: "important" as const },
  { unitId: "d", tier: "notNow" as const },
];

describe("boardRows", () => {
  it("lists every tier's header, even an empty one, then its units", () => {
    expect(boardRows(placement)).toEqual([
      "tier:top",
      "a",
      "tier:important",
      "b",
      "c",
      "tier:background",
      "tier:notNow",
      "d",
    ]);
  });

  it("round-trips through placementFromRows", () => {
    expect(placementFromRows(boardRows(placement))).toEqual(placement);
  });
});

describe("placementFromRows", () => {
  it("gives a unit dropped past a header that header's tier", () => {
    // `c` dragged up above Important's header joins Top, last.
    const rows = ["tier:top", "a", "c", "tier:important", "b", "tier:background", "tier:notNow", "d"];
    expect(placementFromRows(rows)).toEqual([
      { unitId: "a", tier: "top" },
      { unitId: "c", tier: "top" },
      { unitId: "b", tier: "important" },
      { unitId: "d", tier: "notNow" },
    ]);
  });

  it("puts a unit dragged above every header in Top", () => {
    expect(placementFromRows(["a", "tier:top", "tier:important", "b"])[0]).toEqual({
      unitId: "a",
      tier: "top",
    });
  });
});

describe("headerTier", () => {
  it("reads a header row's tier, and nothing else as one", () => {
    expect(headerTier("tier:background")).toBe("background");
    expect(headerTier("tier:nope")).toBeNull();
    expect(headerTier("a")).toBeNull();
  });
});

describe("moveToTier", () => {
  it("moves a unit to the end of another tier, for VoiceOver's Move to tier", () => {
    expect(moveToTier(placement, "a", "important")).toEqual([
      { unitId: "b", tier: "important" },
      { unitId: "c", tier: "important" },
      { unitId: "a", tier: "important" },
      { unitId: "d", tier: "notNow" },
    ]);
  });

  it("leaves the board alone for a unit already in that tier", () => {
    expect(moveToTier(placement, "b", "important")).toEqual(placement);
  });
});
