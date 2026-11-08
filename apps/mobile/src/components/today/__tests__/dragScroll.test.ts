/** The drag's scroll ramp (Henry, 2026-11-07). */
import { describe, expect, it } from "vitest";

import { MAX_STEP, rampStep } from "../dragScroll";

const H = 800;

describe("the scroll ramp", () => {
  it("holds still in the middle of the screen", () => {
    expect(rampStep(H / 2, H)).toBe(0);
  });

  it("scrolls up near the top and down near the bottom", () => {
    expect(rampStep(100, H)).toBeLessThan(0);
    expect(rampStep(H - 100, H)).toBeGreaterThan(0);
  });

  it("speeds up the closer to the edge, peaking there", () => {
    const steps = [250, 150, 50, 0].map((y) => -rampStep(y, H));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]!);
    expect(rampStep(0, H)).toBe(-MAX_STEP);
    expect(rampStep(H + 40, H)).toBe(MAX_STEP);
  });

  it("is the same both ways", () => {
    expect(rampStep(120, H)).toBe(-rampStep(H - 120, H));
  });
});
