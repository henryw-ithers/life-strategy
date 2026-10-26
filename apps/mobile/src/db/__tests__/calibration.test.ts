/**
 * The weekly contentment check-in (ADR-0008): one per week, and a
 * second answer replaces the first rather than adding a row.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { submitCheckin } from "../calibration";
import { contentmentCheckin } from "../schema";
import { resetTestDb, testDb } from "./harness";

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));

describe("submitCheckin", () => {
  beforeEach(() => resetTestDb());

  it("keeps one answer per week, the latest", async () => {
    await submitCheckin("2026-10-18", 6);
    await submitCheckin("2026-10-18", 8);
    const rows = testDb().select().from(contentmentCheckin).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.score).toBe(8);
  });

  it("keeps two quick answers to one week as one row", async () => {
    await Promise.all([submitCheckin("2026-10-18", 5), submitCheckin("2026-10-18", 7)]);
    expect(testDb().select().from(contentmentCheckin).all()).toHaveLength(1);
  });
});
