/**
 * ADR-0006 §1's three profiles, computed rather than assumed. These
 * decide which library suggestions surface first when a unit is opened;
 * they never hide one.
 *
 * Since ADR-0041 §4 satisfaction isn't asked, so the profile reads the
 * tier you chose (Henry, 2026-10-19): Top is where you want more,
 * the rest is keeping things going.
 */
import { describe, expect, it } from "vitest";

import { unitProfile } from "../profile";

describe("unitProfile", () => {
  it("reads a Top unit as gap-closing", () => {
    expect(unitProfile({ tier: "top", weight: 10 })).toBe("gap-closing");
  });

  it("reads Important and Background units as maintenance", () => {
    expect(unitProfile({ tier: "important", weight: 7 })).toBe("maintenance");
    expect(unitProfile({ tier: "background", weight: 4 })).toBe("maintenance");
  });

  it("reads a unit too small for more than one task as light, whatever its tier", () => {
    expect(unitProfile({ tier: "top", weight: 3 })).toBe("light");
    expect(unitProfile({ tier: "background", weight: 1 })).toBe("light");
  });

  it("starts maintenance at the first weight that holds two tasks", () => {
    expect(unitProfile({ tier: "important", weight: 4 })).toBe("maintenance");
  });
});
