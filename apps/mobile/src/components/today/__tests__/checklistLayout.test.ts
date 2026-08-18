/**
 * The layout walk behind cross-section dragging (ADR-0024 §3).
 *
 * Tested here rather than through the gesture because a
 * long-press-armed pan is not reproducible with synthetic events, and
 * the failure mode is silent: a row lands in the wrong part of the day
 * and is written there.
 */
import { describe, expect, it } from "vitest";

import {
  locate,
  moveRow,
  topOfHeader,
  topOfRow,
  type ChecklistMetrics,
} from "../checklistLayout";

const M: ChecklistMetrics = {
  headerHeights: [48, 48, 48, 48],
  rowHeight: 56,
  gap: 4,
};
/** Morning holds two, Afternoon is empty, Evening holds one, Anytime none. */
const SECTIONS = [["a", "b"], [], ["c"], []];

/** Where a given landing slot begins — the test's own walk, so a bug in
 *  the implementation cannot define its own expectations. */
const slotTop = (section: number, index: number) => {
  let y = 0;
  for (let s = 0; s < section; s++) {
    y += M.headerHeights[s]! + M.gap + SECTIONS[s]!.length * (M.rowHeight + M.gap);
  }
  return y + M.headerHeights[section]! + M.gap + index * (M.rowHeight + M.gap);
};

describe("topOfRow", () => {
  it("places the first row below its own header", () => {
    expect(topOfRow(SECTIONS, M, "a")).toBe(M.headerHeights[0]! + M.gap);
  });

  it("stacks rows by row height plus the gap", () => {
    expect(topOfRow(SECTIONS, M, "b")).toBe(
      topOfRow(SECTIONS, M, "a") + M.rowHeight + M.gap,
    );
  });

  it("counts every header above it, empty sections included", () => {
    expect(topOfRow(SECTIONS, M, "c")).toBe(slotTop(2, 0));
  });
});

describe("topOfHeader", () => {
  it("starts the first section at the top", () => {
    expect(topOfHeader(SECTIONS, M, 0)).toBe(0);
  });

  it("puts an empty section's header directly after the one above", () => {
    // Afternoon follows Morning's two rows; Evening follows Afternoon's
    // header alone, which is what makes an empty slot cost one header.
    const afternoon = topOfHeader(SECTIONS, M, 1);
    expect(topOfHeader(SECTIONS, M, 2)).toBe(
      afternoon + M.headerHeights[1]! + M.gap,
    );
  });
});

describe("locate", () => {
  it("resolves a row's resting place to where it already is", () => {
    expect(locate(SECTIONS, M, slotTop(0, 0))).toEqual({ section: 0, index: 0 });
    expect(locate(SECTIONS, M, slotTop(0, 1))).toEqual({ section: 0, index: 1 });
  });

  it("finds an empty section, which is the whole point", () => {
    // No row to drop beside — the case a row-relative drag cannot hit.
    expect(locate(SECTIONS, M, slotTop(1, 0))).toEqual({ section: 1, index: 0 });
    expect(locate(SECTIONS, M, slotTop(3, 0))).toEqual({ section: 3, index: 0 });
  });

  it("offers the slot past the last row, so a row can go to the end", () => {
    expect(locate(SECTIONS, M, slotTop(0, 2))).toEqual({ section: 0, index: 2 });
  });

  it("commits only past the halfway point between two slots", () => {
    const a = slotTop(0, 0);
    const b = slotTop(0, 1);
    expect(locate(SECTIONS, M, a + (b - a) / 2 - 1).index).toBe(0);
    expect(locate(SECTIONS, M, a + (b - a) / 2 + 1).index).toBe(1);
  });

  it("clamps past either end rather than returning nothing", () => {
    expect(locate(SECTIONS, M, -500)).toEqual({ section: 0, index: 0 });
    expect(locate(SECTIONS, M, 5000)).toEqual({ section: 3, index: 0 });
  });
});

describe("moveRow", () => {
  it("moves a row into another section at the given index", () => {
    expect(moveRow(SECTIONS, "a", { section: 2, index: 0 })).toEqual([
      ["b"],
      [],
      ["a", "c"],
      [],
    ]);
  });

  it("moves a row into an empty section", () => {
    expect(moveRow(SECTIONS, "c", { section: 1, index: 0 })).toEqual([
      ["a", "b"],
      ["c"],
      [],
      [],
    ]);
  });

  it("reorders within a section", () => {
    expect(moveRow(SECTIONS, "b", { section: 0, index: 0 })).toEqual([
      ["b", "a"],
      [],
      ["c"],
      [],
    ]);
  });

  it("returns null for a move that changes nothing", () => {
    // Its own slot, and the index one past itself — the same gap seen
    // from the other side. Rewriting here would tick a haptic a frame.
    expect(moveRow(SECTIONS, "a", { section: 0, index: 0 })).toBeNull();
    expect(moveRow(SECTIONS, "a", { section: 0, index: 1 })).toBeNull();
  });

  it("returns null for a row it does not hold", () => {
    expect(moveRow(SECTIONS, "nope", { section: 0, index: 0 })).toBeNull();
  });

  it("never loses or duplicates a row", () => {
    const next = moveRow(SECTIONS, "a", { section: 3, index: 0 })!;
    expect(next.flat().sort()).toEqual(["a", "b", "c"]);
  });
});
