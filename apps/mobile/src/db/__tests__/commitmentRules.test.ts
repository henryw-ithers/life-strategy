/**
 * The two rules the schema cannot express (ADR-0035 §1, ADR-0033 §3).
 *
 * Both are enforced at the write seam in `commitmentWrites.ts`, which
 * imports `./client` and so cannot be tested directly. The rules
 * themselves live in `commitmentPlan.ts` and are tested here.
 */
import { MAX_COMMITMENTS } from "@glide/scoring";
import { describe, expect, it } from "vitest";

import {
  canAddCommitment,
  poolProblem,
  MAX_POOL_MEMBERS,
} from "../commitmentPlan";

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

describe("poolProblem — ADR-0033 §3", () => {
  const empty: { poolId: string; taskIds: string[] }[] = [];

  it("accepts one to three options", () => {
    expect(poolProblem({ taskIds: ["a"], existing: empty })).toBeNull();
    expect(poolProblem({ taskIds: ["a", "b", "c"], existing: empty })).toBeNull();
  });

  it("refuses an empty pool", () => {
    expect(poolProblem({ taskIds: [], existing: empty })).toMatch(/at least one/);
  });

  it("refuses a fourth option", () => {
    expect(
      poolProblem({ taskIds: ["a", "b", "c", "d"], existing: empty }),
    ).toMatch(new RegExp(`${MAX_POOL_MEMBERS} options`));
  });

  it("refuses the same task twice in one pool", () => {
    expect(poolProblem({ taskIds: ["a", "a"], existing: empty })).toMatch(
      /once in a pool/,
    );
  });

  it("refuses a task already pooled in the same window", () => {
    // Without this, "every completion pays in full" could be read as
    // ticking one task twice in one window.
    const existing = [{ poolId: "p1", taskIds: ["essay"] }];
    expect(poolProblem({ taskIds: ["essay", "reading"], existing })).toMatch(
      /already an option in this window/,
    );
  });

  it("allows the same task in a different window's pool", () => {
    // Uniqueness is scoped to the window. A task legitimately appears
    // in Monday's pool and again in Tuesday's.
    expect(poolProblem({ taskIds: ["essay"], existing: [] })).toBeNull();
  });
});
