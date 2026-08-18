/**
 * ADR-0006 §1's three profiles, computed rather than assumed. These
 * decide which library suggestions surface first when a unit is opened.
 */
import { describe, expect, it } from "vitest";

import { GAP_THRESHOLD, unitProfile } from "../profile";

describe("unitProfile", () => {
  it("reads a unit whose satisfaction trails its importance as gap-closing", () => {
    expect(unitProfile({ weight: 12, importance: 9, satisfaction: 4 })).toBe(
      "gap-closing",
    );
  });

  it("reads an important unit that is going well as maintenance", () => {
    expect(unitProfile({ weight: 12, importance: 9, satisfaction: 9 })).toBe(
      "maintenance",
    );
  });

  it("ignores a gap too small to mean anything", () => {
    // One point on a ten-point scale is inside the noise of how anyone
    // rates their own life on a given day.
    expect(unitProfile({ weight: 12, importance: 7, satisfaction: 6 })).toBe(
      "maintenance",
    );
    expect(
      unitProfile({ weight: 12, importance: 7, satisfaction: 7 - GAP_THRESHOLD }),
    ).toBe("gap-closing");
  });

  it("never boosts satisfaction above importance into a gap", () => {
    // Surplus satisfaction is not a deficit; ADR-0003 ignores it in the
    // weight formula and it is ignored here too.
    expect(unitProfile({ weight: 12, importance: 4, satisfaction: 9 })).toBe(
      "maintenance",
    );
  });

  it("calls a low-weight unit light however wide its gap", () => {
    // ADR-0003's bands cap this unit at one task. Offering a
    // gap-closing plan would spend attention the diagnostic said to
    // spend elsewhere.
    expect(unitProfile({ weight: 2, importance: 9, satisfaction: 2 })).toBe(
      "light",
    );
    expect(unitProfile({ weight: 4, importance: 9, satisfaction: 2 })).toBe(
      "light",
    );
  });

  it("stops being light as soon as the band allows a second task", () => {
    expect(unitProfile({ weight: 5, importance: 9, satisfaction: 2 })).toBe(
      "gap-closing",
    );
  });
});
