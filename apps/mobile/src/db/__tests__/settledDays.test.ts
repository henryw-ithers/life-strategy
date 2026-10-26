/**
 * A settled day keeps its number (ADR-0002): once a grade has settled,
 * the day screen reads it back rather than recomputing it, and a full
 * recache leaves it exactly as it was, whatever has changed since.
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recacheAllDayScores } from "../dayGrades";
import { dayGrade } from "../schema";
import { syncTaxonomy } from "../seed";
import { loadDay } from "../today";
import { appDb, resetTestDb, testDb } from "./harness";

const clock = vi.hoisted(() => ({ today: "2026-10-26" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());

vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => clock.today,
}));

/** Long settled: a month before today. */
const SETTLED = "2026-09-21";

describe("a settled day", () => {
  beforeEach(async () => {
    resetTestDb();
    await syncTaxonomy(appDb());
    testDb()
      .insert(dayGrade)
      .values({
        localDate: SETTLED,
        pointsEarned: 42,
        pointsPossible: 100,
        formulaVersion: 9,
        finalizedAt: "2026-09-30T00:00:00.000Z",
      })
      .run();
  });

  it("reads back its stored number, even with nothing in the plan now", async () => {
    const day = await loadDay(SETTLED);
    expect(day.finalized).toBe(true);
    expect(day.score.base).toBe(42);
  });

  it("isn't restated by a full recache", async () => {
    const before = testDb().select().from(dayGrade).where(eq(dayGrade.localDate, SETTLED)).all();
    await recacheAllDayScores();
    const after = testDb().select().from(dayGrade).where(eq(dayGrade.localDate, SETTLED)).all();
    expect(after).toEqual(before);
  });
});
