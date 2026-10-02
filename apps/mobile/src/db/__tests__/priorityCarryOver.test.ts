/**
 * Carry-over prefill for the priority ranking (ADR-0021 action item 2).
 */
import { describe, expect, it } from "vitest";

import { carryOverOrder } from "../priorityCarryOver";

describe("carryOverOrder", () => {
  it("opens on last time's order", () => {
    expect(carryOverOrder(["c", "a", "b"], ["a", "b", "c"])).toEqual(["c", "a", "b"]);
  });

  it("drops a unit that no longer exists", () => {
    expect(carryOverOrder(["c", "gone", "a", "b"], ["a", "b", "c"])).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("puts a new unit at the end, in the suggested order", () => {
    expect(carryOverOrder(["b", "a"], ["new2", "a", "new1", "b"])).toEqual([
      "b",
      "a",
      "new2",
      "new1",
    ]);
  });

  it("lists every current unit exactly once", () => {
    const out = carryOverOrder(["a", "a", "x"], ["a", "b"]);
    expect(out).toEqual(["a", "b"]);
  });

  it("is the suggested order when there was no last time", () => {
    expect(carryOverOrder([], ["a", "b"])).toEqual(["a", "b"]);
  });
});
