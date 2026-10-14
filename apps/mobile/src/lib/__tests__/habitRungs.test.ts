import { describe, expect, it } from "vitest";

import { habitRungTitle, rungDaysOf } from "../habitRungs";

describe("habit rung titles", () => {
  it("reads back the day count it wrote", () => {
    for (const days of [7, 30, 66, 100]) {
      expect(rungDaysOf(habitRungTitle(days, "Running"))).toBe(days);
    }
  });

  it("matches a rung recorded before the goal was renamed", () => {
    const recorded = habitRungTitle(30, "Running");
    // The goal is now "Run before work"; the rung is still the 30-day one.
    expect(rungDaysOf(recorded)).toBe(30);
    expect(habitRungTitle(30, "Run before work")).not.toBe(recorded);
  });

  it("ignores titles that aren't rungs", () => {
    expect(rungDaysOf("Read 24 books")).toBeNull();
    expect(rungDaysOf("")).toBeNull();
  });
});
