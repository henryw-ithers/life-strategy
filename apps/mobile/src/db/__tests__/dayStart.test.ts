/**
 * Changing when the day starts (ADR-0049) against a real migrated
 * SQLite: stored times move onto the new day, and the hours today began
 * with are kept first.
 */
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyDayStart, dayStartHour } from "../../lib/calendar";
import { changeDayStart } from "../dayStart";
import { loadHoursVersions, saveHoursFrom, startingHours } from "../hours";
import { lifeArea, lifeUnit, task } from "../schema";
import { resetTestDb, testDb } from "./harness";

const clock = vi.hoisted(() => ({ today: "2026-10-19" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => clock.today,
}));

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

beforeEach(() => {
  resetTestDb();
  applyDayStart(3);
  const db = testDb();
  db.insert(lifeArea).values({ id: "area", name: "Area", sortOrder: 0 }).run();
  db.insert(lifeUnit).values({ id: "work", areaId: "area", name: "Work", sortOrder: 0 }).run();
  db.insert(task)
    .values({
      id: "class",
      unitId: "work",
      title: "Class",
      pointValue: 1,
      rankInUnit: 0,
      startMinute: h(9),
      endMinute: h(10),
    })
    .run();
});

describe("changing when the day starts", () => {
  it("moves a time before the new start onto the next morning, keeping its length", async () => {
    await changeDayStart(14);
    expect(dayStartHour()).toBe(14);
    const [row] = testDb().select().from(task).where(eq(task.id, "class")).all();
    expect([row?.startMinute, row?.endMinute]).toEqual([h(33), h(34)]);
  });

  it("moves working hours too, and back again", async () => {
    await saveHoursFrom("2026-10-19", [{ weekdays: [1, 2, 3, 4, 5], ranges: [{ start: h(9), end: h(17) }] }], []);
    await changeDayStart(14);
    expect((await loadHoursVersions())[0]?.schedules[0]?.ranges).toEqual([{ start: h(33), end: h(41) }]);
    await changeDayStart(3);
    expect((await loadHoursVersions())[0]?.schedules[0]?.ranges).toEqual([{ start: h(9), end: h(17) }]);
  });

  it("keeps the hours today began with, so today's commitment share doesn't move", async () => {
    const before = await startingHours("2026-10-19");
    await changeDayStart(14);
    expect(await startingHours("2026-10-19")).toEqual(before);
  });
});
