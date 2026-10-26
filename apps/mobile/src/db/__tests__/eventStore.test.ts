/**
 * Adding an event on a real migrated SQLite. A new weekly event's run
 * is written with it: in two steps, the second refused to "change the
 * past" of an event it read as having always run, so it said "It wasn't
 * saved" while the event stayed, without its run, and each try added
 * another (Henry, 2026-10-26).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { untilForWeeks } from "@glide/scoring";

import { scheduleSkip, task } from "../schema";
import { loadLiveEvents, replaceEvents } from "../seriesWrites";
import { syncTaxonomy } from "../seed";
import { addEvent } from "../tasks";
import { appDb, resetTestDb, testDb } from "./harness";

const clock = vi.hoisted(() => ({ today: "2026-10-26" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => clock.today,
}));


const shift = {
  title: "Shift",
  weekdays: [1, 3],
  date: null,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
};

describe("addEvent", () => {
  beforeEach(async () => {
    resetTestDb();
    await syncTaxonomy(appDb());
  });

  it("saves a weekly event starting today with its 12 weeks, once", async () => {
    const bounds = { repeatFrom: clock.today, repeatUntil: untilForWeeks(clock.today, 12) };
    await addEvent(["job-career"], shift, bounds);
    const rows = testDb().select().from(task).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "event", repeatFrom: bounds.repeatFrom, repeatUntil: bounds.repeatUntil });
  });

  it("saves a one-time event with no run", async () => {
    await addEvent(["job-career"], { ...shift, weekdays: [], date: "2026-10-28" }, null);
    const [row] = testDb().select().from(task).all();
    expect(row).toMatchObject({ oneOffDate: "2026-10-28", repeatFrom: null, repeatUntil: null });
  });

  it("writes nothing when the run is wrong", async () => {
    await expect(
      addEvent(["job-career"], shift, { repeatFrom: "2026-11-10", repeatUntil: "2026-11-01" }),
    ).rejects.toThrow();
    expect(testDb().select().from(task).all()).toHaveLength(0);
  });
});

describe("replaceEvents", () => {
  beforeEach(async () => {
    resetTestDb();
    await syncTaxonomy(appDb());
  });

  it("ends a running series yesterday, keeping its past", async () => {
    const id = (await addEvent(["job-career"], shift, { repeatFrom: "2026-09-07", repeatUntil: null }))!;
    await replaceEvents([{ id, title: "Shift", action: "end" }]);
    const [row] = testDb().select().from(task).all();
    expect(row).toMatchObject({ repeatFrom: "2026-09-07", repeatUntil: "2026-10-25", active: true });
  });

  it("skips one day of a series, and archives a one-time event", async () => {
    const series = (await addEvent(["job-career"], shift, { repeatFrom: "2026-09-07", repeatUntil: null }))!;
    const once = (await addEvent(["job-career"], { ...shift, weekdays: [], date: "2026-10-29" }, null))!;
    await replaceEvents([
      { id: series, title: "Shift", action: "skip", date: "2026-10-28" },
      { id: once, title: "Shift", action: "archive" },
    ]);
    expect(testDb().select().from(scheduleSkip).all()).toMatchObject([
      { taskId: series, kind: "occurrence", localDate: "2026-10-28" },
    ]);
    expect((await loadLiveEvents()).map((e) => e.id)).toEqual([series]);
  });
});
