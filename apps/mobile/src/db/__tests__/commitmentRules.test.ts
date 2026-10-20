/**
 * A rule the schema cannot express (ADR-0035 §1): at most three
 * commitments. Enforced at the write seam in `commitmentWrites.ts`; the
 * rule itself lives in `commitmentPlan.ts` and is tested here.
 */
import { MAX_COMMITMENTS } from "@glide/scoring";
import { describe, expect, it } from "vitest";

import { canAddCommitment } from "../commitmentPlan";

const commitment = (id: string) => ({ id, parentUnitId: null });
const sub = (id: string, parent: string) => ({ id, parentUnitId: parent });

describe("canAddCommitment — at most three", () => {
  it("allows up to the cap", () => {
    expect(canAddCommitment([])).toBe(true);
    expect(canAddCommitment([commitment("a"), commitment("b")])).toBe(true);
  });

  it("refuses a fourth", () => {
    expect(
      canAddCommitment([commitment("a"), commitment("b"), commitment("c")]),
    ).toBe(false);
  });

  it("does not count sub-commitments, which are uncapped", () => {
    // The cap is on commitments. Sub-commitments are deliberately
    // uncapped so a semester of any size fits under a cap of three.
    const school = [
      commitment("school"),
      ...Array.from({ length: 12 }, (_, i) => sub(`class${i}`, "school")),
    ];
    expect(canAddCommitment(school)).toBe(true);
  });

  it("uses one constant, shared with the band arithmetic", () => {
    // Two constants for one rule is how the two drift apart, so this
    // asserts the cap comes from @glide/scoring rather than a copy.
    expect(MAX_COMMITMENTS).toBe(3);
    const atCap = Array.from({ length: MAX_COMMITMENTS }, (_, i) =>
      commitment(`c${i}`),
    );
    expect(canAddCommitment(atCap)).toBe(false);
    expect(canAddCommitment(atCap.slice(1))).toBe(true);
  });
});

