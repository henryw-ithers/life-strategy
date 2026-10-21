/**
 * Formula v11 from stored rows (Phase 5b), on a real migrated SQLite:
 * tier weights, bounds, skips, Away, Clear today, the commitment share
 * from the day, and EC-20 (pins never change a score).
 */
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DAILY_BUDGET } from "@glide/scoring";

import { loadCommitmentDay, loadShareWeek } from "../commitments";
import { createSubCommitment, deleteCommitment, setCommitmentShare } from "../commitmentWrites";
import { recordUntouchedDays } from "../dayGrades";
import { addDayEdit, freezeStartingHours, saveHoursFrom, startingHours } from "../hours";
import { createChoice, pinForDay, pinWeekly } from "../pins";
import {
  dayClear,
  dayGrade,
  lifeArea,
  lifeUnit,
  scheduleSkip,
  task,
  taskCompletion,
  taskUnit,
} from "../schema";
import { addAway, setRepeatBounds } from "../skips";
import { latestWeights } from "../tasks";
import { loadDay } from "../today";
import { placeTiers } from "./tierFixtures";
import { resetTestDb, testDb } from "./harness";

// Hoisted above the imports by vitest.
const clock = vi.hoisted(() => ({ today: "2026-10-19" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/problemLog", () => ({ recordProblem: vi.fn() }));
vi.mock("../../lib/calendar", async (original) => ({
  ...(await original<typeof import("../../lib/calendar")>()),
  currentLocalDate: () => clock.today,
}));

/** Monday 19 October 2026. */
const MON = "2026-10-19";
const TUE = "2026-10-20";

type TaskRow = typeof task.$inferInsert;

function addTask(row: Partial<TaskRow> & { id: string; unitId: string }) {
  testDb()
    .insert(task)
    .values({ title: row.id, pointValue: 0, rankInUnit: 1, timesPerWeek: 1, ...row })
    .run();
  testDb()
    .insert(taskUnit)
    .values({ taskId: row.id, unitId: row.unitId, rankInUnit: 1, pointValue: 0 })
    .run();
}

/** Two life units in the plan, one out of it, and School. */
function seed() {
  const db = testDb();
  db.insert(lifeArea).values({ id: "area", name: "Area", sortOrder: 0 }).run();
  db.insert(lifeUnit)
    .values([
      { id: "fitness", areaId: "area", name: "Fitness", sortOrder: 0 },
      { id: "friends", areaId: "area", name: "Friends", sortOrder: 1 },
      { id: "rest", areaId: "area", name: "Rest", sortOrder: 2, includeInScoring: false },
      {
        id: "school",
        areaId: "area",
        name: "School",
        sortOrder: 3,
        isCustom: true,
        includeInScoring: false,
        commitmentShare: 100,
      },
    ])
    .run();
  addTask({ id: "gym", unitId: "fitness", plannedWeekdays: "1" });
  addTask({ id: "call", unitId: "friends", timesPerWeek: 3 });
  placeTiers([
    ["fitness", "top"],
    ["friends", "important"],
    ["rest", "notNow"],
  ]);
}

function addSchool() {
  addTask({
    id: "lecture",
    unitId: "school",
    kind: "event",
    plannedWeekdays: "1",
    startMinute: 600,
    endMinute: 690,
  });
  addTask({ id: "reading", unitId: "school", plannedWeekdays: "1", size: "normal" });
}

const tick = (taskId: string, localDate: string) =>
  testDb()
    .insert(taskCompletion)
    .values({ id: `${taskId}-${localDate}`, taskId, localDate, completedAt: localDate, pointsEarned: 0 })
    .run();

const nineToFive = [{ weekdays: [1, 2, 3, 4, 5] as const, ranges: [{ start: 540, end: 1020 }] }];

/** Nine to five on weekdays, set on Sunday 18 October. */
async function hoursFromSunday() {
  clock.today = "2026-10-18";
  await saveHoursFrom("2026-10-18", nineToFive as never);
  clock.today = MON;
}

beforeEach(() => {
  resetTestDb();
  clock.today = MON;
  seed();
});

describe("tier weights (ADR-0041)", () => {
  it("sum to 100 over the plan, Not now and commitments taking none", () => {
    const weights = latestWeights(testDb() as never);
    expect([...weights.values()].reduce((a, b) => a + b, 0)).toBe(DAILY_BUDGET);
    expect(weights.has("rest")).toBe(false);
    expect(weights.has("school")).toBe(false);
    // With two in the plan: fitness Top, friends Important.
    expect(weights.get("fitness")! > weights.get("friends")!).toBe(true);
  });
});

describe("pins never change a score (EC-20, ADR-0039 §12)", () => {
  it("scores the same stored day the same with two different sets of pins", async () => {
    addSchool();
    await hoursFromSunday();
    tick("gym", MON);
    tick("lecture", MON);

    const before = (await loadDay(MON)).score;
    await pinForDay("call", MON, 540, "window");
    await pinForDay("reading", MON, 780, "untilDone");
    const first = (await loadDay(MON)).score;
    await pinWeekly("call", [1, 3], MON, 1020, "untilDone");
    await pinForDay("gym", MON, 900, "window", { extra: true });
    const second = (await loadDay(MON)).score;

    expect(before.base).not.toBeNull();
    expect(first).toEqual(before);
    expect(second).toEqual(before);
  });
});

describe("what's due (ADR-0040)", () => {
  it("a run outside its repeat bounds isn't due", async () => {
    await setRepeatBounds("gym", "2026-10-26", null);
    const day = await loadDay(MON);
    expect(day.due.some((t) => t.id === "gym")).toBe(false);
  });

  it("a day skipped ahead can be a rest day; one emptied on the day is ungraded", async () => {
    // Gym is Monday's only work; call was done for the week on Sunday.
    testDb().update(task).set({ timesPerWeek: 1 }).where(sql`id = 'call'`).run();
    tick("call", "2026-10-18");
    const skip = (madeOn: string) =>
      testDb()
        .insert(scheduleSkip)
        .values({ id: `s-${madeOn}`, kind: "occurrence", taskId: "gym", localDate: MON, madeOn })
        .run();

    skip("2026-10-18");
    expect((await loadDay(MON)).restDay).toBe(true);

    testDb().delete(scheduleSkip).run();
    skip(MON);
    const onTheDay = await loadDay(MON);
    expect(onTheDay.restDay).toBe(false);
    expect(onTheDay.score.base).toBeNull();
  });

  it("Clear today skips unticked events and keeps life work due (§4)", async () => {
    addSchool();
    await hoursFromSunday();
    testDb().insert(dayClear).values({ localDate: MON }).run();
    expect(await loadCommitmentDay(MON)).toBeNull();
    const day = await loadDay(MON);
    expect(day.due.some((t) => t.id === "gym")).toBe(true);
    expect(day.score.base).not.toBeNull();
    // Commitment work that was ticked keeps its share.
    tick("reading", MON);
    expect((await loadCommitmentDay(MON))?.eligibleTaskIds).toEqual(["reading"]);
  });

  it("an Away day is ungraded, and no events are due on it (§5)", async () => {
    addSchool();
    await addAway(MON, MON);
    const day = await loadDay(MON);
    expect(day.kind).toBe("rest");
    expect(day.score.base).toBeNull();
    expect(await loadCommitmentDay(MON)).toBeNull();
  });
});

describe("the commitment share from the day (ADR-0044)", () => {
  beforeEach(async () => {
    addSchool();
    // Set on Sunday: hours changed on a day don't reach that day's share.
    await hoursFromSunday();
  });

  it("is the commitment's time over the working hours", async () => {
    // A 1.5-hour lecture and a Normal task over 8 hours: about 31%.
    const day = await loadCommitmentDay(MON);
    expect(day?.band).toBe(31);
    expect(day?.fromDay).toBe(true);
  });

  it("counts edits made ahead, not those made on the day (EC-56)", async () => {
    testDb().update(task).set({ plannedWeekdays: "2" }).where(sql`unit_id = 'school'`).run();
    clock.today = "2026-10-18";
    await addDayEdit(TUE, { kind: "remove", range: { start: 780, end: 1020 } });
    clock.today = TUE;
    const ahead = (await loadCommitmentDay(TUE))?.band;
    // 2.5 hours of School over the 4 left after the edit made ahead.
    expect(ahead).toBe(Math.round((100 * 150) / 240));
    await addDayEdit(TUE, { kind: "remove", range: { start: 540, end: 660 } });
    expect((await loadCommitmentDay(TUE))?.band).toBe(ahead);
  });

  it("keeps the hours the day began with when the template changes on the day", async () => {
    await freezeStartingHours(MON);
    await saveHoursFrom(MON, [{ weekdays: [1], ranges: [{ start: 540, end: 660 }] }]);
    expect(await startingHours(MON)).toEqual([{ start: 540, end: 1020 }]);
    expect((await loadCommitmentDay(MON))?.band).toBe(31);
  });

  it("uses a share set on the commitment instead", async () => {
    testDb().update(lifeUnit).set({ setShare: 60 }).where(sql`id = 'school'`).run();
    expect((await loadCommitmentDay(MON))?.band).toBe(60);
  });

  it("never adds a carried one-off to a later day's band (ADR-0039 §8)", async () => {
    addTask({ id: "essay", unitId: "school", oneOffSize: "big", oneOffDate: "2026-10-16" });
    const day = await loadCommitmentDay(MON);
    expect(day?.eligibleTaskIds).not.toContain("essay");
    expect(day?.band).toBe(31);
  });

  it("counts an undated one-off only on the day it's ticked", async () => {
    addTask({ id: "form", unitId: "school", oneOffSize: "quick" });
    expect((await loadCommitmentDay(MON))?.band).toBe(31);
    tick("form", MON);
    // Half an hour more: 3 of 8 hours.
    expect((await loadCommitmentDay(MON))?.band).toBe(38);
  });
});

describe('"Do N of these" (ADR-0039 §6)', () => {
  it("passes a choice's planned count to the band, not its members", async () => {
    addSchool();
    addTask({ id: "essay", unitId: "school", plannedWeekdays: "1", size: "normal" });
    addTask({ id: "quiz", unitId: "school", plannedWeekdays: "1", size: "normal" });
    await hoursFromSunday();
    await createChoice({
      localDate: MON,
      anchorMinute: 13 * 60,
      taskIds: ["reading", "essay"],
      plannedCount: 1,
    });

    const day = await loadCommitmentDay(MON);
    expect(day?.pools).toEqual([{ taskIds: ["reading", "essay"], plannedCount: 1 }]);
    // Lecture, quiz and one of the two: three slots, so each of the
    // pair is worth what the quiz is (to the point, after rounding).
    const values = (await loadDay(MON)).due;
    const worth = (id: string) => values.find((t) => t.id === id)?.pointValue ?? 0;
    // Three slots, not four: a third of the band each.
    const band = day!.band;
    expect(Math.abs(worth("quiz") - band / 3)).toBeLessThanOrEqual(1);
    expect(Math.abs(worth("reading") - worth("quiz"))).toBeLessThanOrEqual(1);
    expect(Math.abs(worth("essay") - worth("quiz"))).toBeLessThanOrEqual(1);
  });

  it("leaves out a member that isn't due that day", async () => {
    addSchool();
    addTask({ id: "essay", unitId: "school", plannedWeekdays: "2", size: "normal" });
    await hoursFromSunday();
    await createChoice({
      localDate: MON,
      anchorMinute: 13 * 60,
      taskIds: ["reading", "essay"],
      plannedCount: 2,
    });
    expect((await loadCommitmentDay(MON))?.pools).toEqual([
      { taskIds: ["reading"], plannedCount: 2 },
    ]);
  });
});

describe("a commitment's own share (ADR-0044 §3, spec §5.5)", () => {
  it("is kept within its limits, and the automatic one stays readable beside it", async () => {
    addSchool();
    await hoursFromSunday();
    const auto = (await loadShareWeek("school", MON)).find((d) => d.date === MON)?.automatic;
    expect(auto).toBeGreaterThan(0);

    await setCommitmentShare("school", 95);
    const row = () => testDb().select().from(lifeUnit).all().find((u) => u.id === "school");
    // One commitment: 70 at most.
    expect(row()?.setShare).toBe(70);
    expect((await loadCommitmentDay(MON))?.band).toBe(70);
    // The automatic share is still there to show beside yours.
    expect((await loadShareWeek("school", MON)).find((d) => d.date === MON)?.automatic).toBe(auto);

    await setCommitmentShare("school", null);
    expect(row()?.setShare).toBeNull();
  });

  it("splits on the first sub-commitment, moving its work into General (ADR-0044 §7)", async () => {
    addSchool();
    const id = await createSubCommitment("school", "COMP2521");
    const units = testDb().select().from(lifeUnit).all();
    const general = units.find((u) => u.parentUnitId === "school" && u.name === "General");
    expect(general).toBeDefined();
    expect(units.find((u) => u.id === id)?.parentUnitId).toBe("school");
    const tasks = testDb().select().from(task).all();
    expect(tasks.filter((t) => t.unitId === "school")).toEqual([]);
    expect(tasks.find((t) => t.id === "reading")?.unitId).toBe(general!.id);
  });
});

describe("Away and kept hours, after review", () => {
  it("an Away day bridges a daily task's run instead of breaking it", async () => {
    addTask({ id: "stretch", unitId: "fitness", timesPerWeek: 7 });
    tick("stretch", "2026-10-16");
    tick("stretch", "2026-10-17");
    tick("stretch", MON);
    const before = await loadDay(MON);
    const withoutAway = [...before.due, ...before.week, ...before.doneThisWeek].find(
      (t) => t.id === "stretch",
    )?.streak;
    expect(withoutAway).toBe(1);
    await addAway("2026-10-18", "2026-10-18");
    const day = await loadDay(MON);
    const withAway = [...day.due, ...day.week, ...day.doneThisWeek].find((t) => t.id === "stretch")?.streak;
    expect(withAway).toBe(3);
  });

  it("a row holding only starting hours is still scored as an untouched day", async () => {
    clock.today = "2026-10-18";
    await freezeStartingHours("2026-10-18");
    clock.today = MON;
    await recordUntouchedDays("2026-10-18", MON);
    const row = testDb().select().from(dayGrade).all().find((r) => r.localDate === "2026-10-18");
    expect(row?.formulaVersion).toBe(11);
    expect(row?.startingHours).not.toBeNull();
  });
});

describe("sub-commitments (ADR-0044 §7)", () => {
  it("removing the last one moves its work back onto the commitment", async () => {
    testDb()
      .insert(lifeUnit)
      .values({
        id: "comp",
        areaId: "area",
        name: "COMP2521",
        sortOrder: 4,
        isCustom: true,
        includeInScoring: false,
        parentUnitId: "school",
      })
      .run();
    testDb().update(lifeUnit).set({ usesSubCommitments: true }).where(sql`id = 'school'`).run();
    addTask({ id: "lab", unitId: "comp", plannedWeekdays: "1" });

    await deleteCommitment("comp");
    const rows = testDb().select().from(task).all();
    expect(rows.find((t) => t.id === "lab")?.unitId).toBe("school");
    const units = testDb().select().from(lifeUnit).all();
    expect(units.find((u) => u.id === "school")?.usesSubCommitments).toBe(false);
    expect(units.some((u) => u.id === "comp")).toBe(false);
  });
});
