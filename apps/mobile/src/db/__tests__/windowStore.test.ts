/**
 * The Phase 5a writers against a real, migrated SQLite (`harness.ts`):
 * hours, day edits, pins, choices, skips and Away.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addDays, pinsOn } from "@glide/scoring";

import { addDayEdit, deleteDayEdit, loadDayEdits, loadHoursVersions, saveHoursFrom } from "../hours";
import {
  createChoice,
  deleteChoice,
  endPinFrom,
  loadChoices,
  loadPinRules,
  pinForDay,
  pinWeekly,
  pruneEndedPins,
  removePinsForTasks,
  setPinKind,
  unpinForDay,
  updateChoice,
} from "../pins";
import { addAway, addSkip, loadAwayRanges, loadSkipsBetween, removeSkip, setRepeatBounds } from "../skips";
import { appSetting, lifeArea, lifeUnit, task, taskCompletion, windowPlacement } from "../schema";
import { resetTestDb, testDb } from "./harness";

// Hoisted above the imports by vitest.
const clock = vi.hoisted(() => ({ today: "2026-10-19" }));

vi.mock("../client", async () => (await import("./harness")).mockClient());
vi.mock("expo-crypto", () => ({ randomUUID: () => crypto.randomUUID() }));
vi.mock("../../lib/calendar", () => ({ currentLocalDate: () => clock.today }));

const MON = "2026-10-19";

function seed() {
  const db = testDb();
  db.insert(lifeArea).values({ id: "area", name: "Area", sortOrder: 0 }).run();
  db.insert(lifeUnit)
    .values([
      { id: "life", areaId: "area", name: "Exercise", sortOrder: 0 },
      { id: "school", areaId: "area", name: "School", sortOrder: 1, isCustom: true, commitmentShare: 100 },
      { id: "comp", areaId: "area", name: "COMP2521", sortOrder: 2, isCustom: true, parentUnitId: "school" },
      { id: "work", areaId: "area", name: "Work", sortOrder: 3, isCustom: true, commitmentShare: 50 },
    ])
    .run();
  const t = (id: string, unitId: string, oneOff = false) => ({
    id,
    unitId,
    title: id,
    pointValue: 1,
    rankInUnit: 0,
    oneOffSize: oneOff ? ("normal" as const) : null,
  });
  db.insert(task)
    .values([
      t("gym", "life"),
      t("errand", "life", true),
      t("essay", "comp", true),
      t("reading", "school", true),
      t("shift", "work", true),
    ])
    .run();
}

const stale = () =>
  testDb().select().from(appSetting).all().find((r) => r.key === "grades.stale")?.value;

beforeEach(() => {
  resetTestDb();
  clock.today = MON;
  seed();
});

const pinsFor = async (taskId: string, date: string) =>
  pinsOn(
    (await loadPinRules()).filter((r) => r.taskId === taskId),
    date,
    { open: new Set([taskId]), lastDone: new Map(), oneOffs: new Set() },
  );

describe("working hours", () => {
  it("a new version replaces later ones and keeps earlier days' hours (EC-15)", async () => {
    const hours = (start: number) => [{ weekdays: [1, 2, 3, 4, 5] as const, ranges: [{ start, end: start + 60 }] }];
    await saveHoursFrom("2026-10-05", hours(540) as never);
    await saveHoursFrom("2026-11-02", hours(600) as never);
    await saveHoursFrom("2026-10-19", hours(480) as never);
    const versions = await loadHoursVersions();
    expect(versions.map((v) => [v.from, v.schedules[0]?.ranges[0]?.start])).toEqual([
      ["2026-10-05", 540],
      ["2026-10-19", 480],
    ]);
    expect(stale()).toBe("1");
  });

  it("refuses a weekday in two groups", async () => {
    await expect(
      saveHoursFrom(MON, [
        { weekdays: [1], ranges: [{ start: 540, end: 600 }] },
        { weekdays: [1], ranges: [{ start: 700, end: 800 }] },
      ]),
    ).rejects.toThrow("only one group");
    expect(await loadHoursVersions()).toEqual([]);
  });
});

describe("day window edits", () => {
  it("keeps edits in order and marks the ones made on the day (EC-56)", async () => {
    clock.today = "2026-10-18";
    await addDayEdit(MON, { kind: "add", range: { start: 1200, end: 1260 } });
    clock.today = MON;
    const second = await addDayEdit(MON, { kind: "remove", range: { start: 540, end: 600 } });
    await addDayEdit(MON, { kind: "change", from: { start: 700, end: 800 }, to: { start: 720, end: 800 } });
    expect((await loadDayEdits(MON)).map((e) => [e.kind, e.onTheDay])).toEqual([
      ["add", false],
      ["remove", true],
      ["change", true],
    ]);
    await deleteDayEdit(second);
    expect((await loadDayEdits(MON)).map((e) => e.kind)).toEqual(["add", "change"]);
  });

  it("refuses a past day", async () => {
    await expect(addDayEdit("2026-10-18", { kind: "add", range: { start: 540, end: 600 } })).rejects.toThrow();
  });
});

describe("pins: one live pin per task per day (§2.7)", () => {
  it("pinning again on the same day moves the pin", async () => {
    await pinForDay("gym", MON, 540, "window");
    await pinForDay("gym", MON, 1080, "untilDone");
    const rules = (await loadPinRules()).filter((r) => r.taskId === "gym");
    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ anchor: 1080, kind: "untilDone" });
  });

  it("'Just this day' on a repeating pin saves an exception and a pin for that date", async () => {
    await pinWeekly("gym", [1, 3, 5], MON, 540, "window");
    await pinForDay("gym", "2026-10-21", 1080, "window");
    const rules = await loadPinRules();
    const weekly = rules.find((r) => r.when.repeat === "weekly");
    expect(weekly?.when.repeat === "weekly" && [...(weekly.when.exceptDates ?? [])]).toEqual(["2026-10-21"]);
    expect((await pinsFor("gym", "2026-10-21")).map((p) => p.carried === false && p.anchor)).toEqual([1080]);
    expect((await pinsFor("gym", "2026-10-23")).map((p) => p.carried === false && p.anchor)).toEqual([540]);
  });

  it("unpinning one day leaves the pattern for the others", async () => {
    await pinWeekly("gym", [1, 3], MON, 540, "window");
    await unpinForDay("gym", MON);
    expect(await pinsFor("gym", MON)).toEqual([]);
    expect(await pinsFor("gym", "2026-10-21")).toHaveLength(1);
  });

  it("a new repeating pin takes over the days it names", async () => {
    await pinWeekly("gym", [1, 3, 5], MON, 540, "window");
    await pinForDay("gym", "2026-10-28", 600, "window");
    clock.today = "2026-10-26";
    await pinWeekly("gym", [3], "2026-10-26", 1080, "window");
    const anchorOn = async (d: string) =>
      (await pinsFor("gym", d)).map((p) => (p.carried ? null : p.anchor));
    expect(await anchorOn("2026-10-21")).toEqual([540]);
    expect(await anchorOn("2026-10-28")).toEqual([1080]);
    expect(await anchorOn("2026-10-26")).toEqual([540]);
    expect(await anchorOn("2026-10-30")).toEqual([540]);
  });

  it("'This and following' ends a repeating pin", async () => {
    const id = await pinWeekly("gym", [1], MON, 540, "window");
    await endPinFrom(id, "2026-10-26");
    expect(await pinsFor("gym", MON)).toHaveLength(1);
    expect(await pinsFor("gym", "2026-10-26")).toEqual([]);
  });

  it("refuses a past day, and a pin that doesn't exist", async () => {
    await expect(pinForDay("gym", "2026-10-18", 540, "window")).rejects.toThrow();
    await expect(setPinKind("missing", "window")).rejects.toThrow();
    await expect(endPinFrom("missing", MON)).rejects.toThrow();
  });

  it("moving a carried pin until done stops it carrying (§2.7)", async () => {
    // Pinned until done on Monday and not done; on Tuesday it's moved.
    await pinForDay("errand", MON, 540, "untilDone");
    const repeating = await pinWeekly("gym", [1], MON, 540, "untilDone");
    clock.today = "2026-10-20";
    await pinForDay("errand", "2026-10-20", 1080, "window");
    await pinForDay("gym", "2026-10-20", 1080, "window");
    const rules = await loadPinRules();
    const carry = { open: new Set(["errand", "gym"]), lastDone: new Map(), oneOffs: new Set(["errand"]) };
    // Wednesday: neither carries any more, and the repeating pin still
    // comes round next Monday.
    expect(pinsOn(rules, "2026-10-21", carry)).toEqual([]);
    expect(pinsOn(rules, "2026-10-26", carry).map((p) => p.ruleId)).toEqual([repeating]);
  });
});

describe("old pins aren't kept (§7)", () => {
  it("deletes ended pins, keeping a pin until done that still carries an open task", async () => {
    await pinForDay("gym", MON, 540, "window");
    await pinForDay("errand", MON, 540, "untilDone");
    await pinForDay("essay", MON, 540, "untilDone");
    // The essay was finished on Monday, so its pin carries nothing.
    testDb()
      .insert(taskCompletion)
      .values({ id: "c", taskId: "essay", localDate: MON, completedAt: MON, pointsEarned: 1 })
      .run();
    const repeating = await pinWeekly("gym", [2], MON, 600, "window", { until: "2026-10-20" });

    clock.today = "2026-10-21";
    expect(await pruneEndedPins()).toBe(3);
    const left = testDb().select().from(windowPlacement).all();
    expect(left.map((r) => r.taskId)).toEqual(["errand"]);
    expect(left.some((r) => r.id === repeating)).toBe(false);
  });

  it("keeps a choice while its day can still be scored again", async () => {
    await createChoice({ localDate: MON, anchorMinute: 540, taskIds: ["essay", "reading"], plannedCount: 1 });
    clock.today = "2026-10-27";
    await pruneEndedPins();
    expect(await loadChoices(MON)).toHaveLength(1);
    clock.today = "2026-11-01";
    await pruneEndedPins();
    expect(await loadChoices(MON)).toEqual([]);
  });

  it("stops carrying a repeating task's pin at the end of its week (EC-48)", async () => {
    clock.today = "2026-10-24";
    await pinForDay("gym", "2026-10-24", 540, "untilDone");
    clock.today = "2026-10-25";
    expect(await pruneEndedPins()).toBe(1);
  });
});

describe('"Do N of these"', () => {
  it("takes tasks from one commitment, sub-commitments included", async () => {
    const id = await createChoice({ localDate: MON, anchorMinute: 540, taskIds: ["essay", "reading"], plannedCount: 5 });
    expect((await loadChoices(MON))[0]).toMatchObject({ id, plannedCount: 2, taskIds: ["essay", "reading"] });
    await expect(
      createChoice({ localDate: MON, anchorMinute: 600, taskIds: ["essay", "shift"], plannedCount: 1 }),
    ).rejects.toThrow("one commitment");
    await expect(
      createChoice({ localDate: MON, anchorMinute: 540, taskIds: ["essay", "reading"], plannedCount: 1 }),
    ).rejects.toThrow("already in a choice");
    await updateChoice(id, { plannedCount: 1 });
    expect((await loadChoices(MON))[0]?.plannedCount).toBe(1);
    await deleteChoice(id);
    expect(await loadChoices(MON)).toEqual([]);
  });

  it("a choice left with one task goes when another is forgotten", async () => {
    await createChoice({ localDate: MON, anchorMinute: 540, taskIds: ["essay", "reading"], plannedCount: 1 });
    await pinForDay("essay", MON, 540, "window");
    await removePinsForTasks(["essay"]);
    expect(await loadChoices(MON)).toEqual([]);
    expect(await loadPinRules()).toEqual([]);
  });
});

describe("skips, bounds and Away", () => {
  it("stores a week by its first day and doesn't skip the same week twice", async () => {
    const a = await addSkip({ kind: "taskWeek", taskId: "gym", date: "2026-10-29" });
    const b = await addSkip({ kind: "taskWeek", taskId: "gym", date: "2026-10-31" });
    expect(a).toBe(b);
    const skips = await loadSkipsBetween("2026-10-26", "2026-10-26");
    expect(skips).toEqual([
      { kind: "taskWeek", taskId: "gym", unitId: null, localDate: "2026-10-25", madeOn: MON },
    ]);
    await removeSkip(a);
    expect(await loadSkipsBetween(MON, addDays(MON, 14))).toEqual([]);
  });

  it("refuses to skip a week that has started (EC-25)", async () => {
    await expect(addSkip({ kind: "commitmentWeek", unitId: "school", date: MON })).rejects.toThrow();
    expect(await loadSkipsBetween(MON, MON)).toEqual([]);
  });

  it("checks bounds and Away ranges on write", async () => {
    await expect(setRepeatBounds("gym", "2026-11-01", "2026-10-01")).rejects.toThrow();
    await setRepeatBounds("gym", MON, "2026-11-30");
    expect(testDb().select().from(task).all().find((t) => t.id === "gym")).toMatchObject({
      repeatFrom: MON,
      repeatUntil: "2026-11-30",
    });
    await expect(addAway("2026-10-25", "2026-10-20")).rejects.toThrow();
    await addAway("2026-10-20", "2026-10-25", "  Camping ");
    expect(await loadAwayRanges()).toMatchObject([{ startDate: "2026-10-20", label: "Camping" }]);
  });
});
