import { describe, expect, it } from "vitest";

import {
  awayDatesBetween,
  awayProblem,
  choiceProblem,
  dayEditProblem,
  hoursProblem,
  parseGaps,
  parseRanges,
  parseSchedules,
  pinProblem,
  serializeSchedules,
  skippedDatesFor,
  skipProblem,
  splitForWeekly,
  toDayEdits,
  toPinRule,
  unreadableVersion,
  type PinRow,
} from "../windowRules";

const nineToFive = { start: 9 * 60, end: 17 * 60 };

describe("stored hours", () => {
  it("round-trips a version's groups", () => {
    const schedules = [{ weekdays: [5, 1, 3] as const, ranges: [nineToFive] }];
    const parsed = parseSchedules(serializeSchedules(schedules as never));
    expect(parsed).toEqual([{ weekdays: [1, 3, 5], ranges: [nineToFive] }]);
  });

  it("drops what it can't read instead of throwing", () => {
    expect(parseSchedules("not json")).toEqual([]);
    expect(
      parseSchedules(
        JSON.stringify([
          { weekdays: [1, 9], ranges: [nineToFive, { start: 600, end: 500 }] },
          { weekdays: [], ranges: [nineToFive] },
        ]),
      ),
    ).toEqual([{ weekdays: [1], ranges: [nineToFive] }]);
    expect(parseGaps(JSON.stringify([{ weekdays: [1], range: nineToFive, name: "  " }]))).toEqual([]);
  });

  it("reads unreadable override JSON as no override, and [] as no hours", () => {
    expect(parseRanges("{")).toBeNull();
    expect(parseRanges(JSON.stringify([{ start: 600, end: 500 }]))).toBeNull();
    expect(parseRanges("[]")).toEqual([]);
  });

  it("marks a version whose groups can't be read, but not one with no hours", () => {
    expect(unreadableVersion({ schedules: JSON.stringify([{ weekdays: [9], ranges: [] }]) })).toBe(true);
    expect(unreadableVersion({ schedules: "nope" })).toBe(true);
    expect(unreadableVersion({ schedules: "[]" })).toBe(false);
  });

  it("refuses a weekday in two groups, and bad ranges", () => {
    expect(
      hoursProblem(
        "2026-10-19",
        [
          { weekdays: [1, 2], ranges: [nineToFive] },
          { weekdays: [2], ranges: [nineToFive] },
        ],
        [],
      ),
    ).toBe("A day can be in only one group.");
    expect(hoursProblem("2026-10-19", [{ weekdays: [1], ranges: [{ start: 60, end: 30 }] }], [])).not.toBeNull();
    expect(hoursProblem("2026-10-19", [{ weekdays: [1], ranges: [nineToFive] }], [])).toBeNull();
    // A range may run past midnight until the rollover (EC-01).
    expect(hoursProblem("2026-10-19", [{ weekdays: [1], ranges: [{ start: 22 * 60, end: 26 * 60 }] }], [])).toBeNull();
    expect(hoursProblem("2026-10-19", [{ weekdays: [1], ranges: [{ start: 22 * 60, end: 28 * 60 }] }], [])).not.toBeNull();
  });
});

describe("day window edits", () => {
  const row = (seq: number, madeOn: string, kind: "add" | "remove" = "add") => ({
    localDate: "2026-10-20",
    seq,
    kind,
    startMinute: 600,
    endMinute: 700 + seq,
    toStartMinute: null,
    toEndMinute: null,
    madeOn,
  });

  it("applies in the order made, and marks edits made on the day (EC-56)", () => {
    const edits = toDayEdits([row(2, "2026-10-20"), row(0, "2026-10-18"), row(1, "2026-10-19", "remove")]);
    expect(edits.map((e) => [e.kind, e.onTheDay])).toEqual([
      ["add", false],
      ["remove", false],
      ["add", true],
    ]);
  });

  it("drops a change with no new range", () => {
    expect(toDayEdits([{ ...row(0, "2026-10-19"), kind: "change" }])).toEqual([]);
  });

  it("refuses edits to past days", () => {
    expect(dayEditProblem("2026-10-16", { kind: "add", range: nineToFive }, "2026-10-17")).not.toBeNull();
    expect(dayEditProblem("2026-10-17", { kind: "add", range: nineToFive }, "2026-10-17")).toBeNull();
  });
});

const pin = (over: Partial<PinRow>): PinRow => ({
  id: "p",
  taskId: "t",
  kind: "window",
  anchorMinute: 540,
  repeat: "weekly",
  localDate: null,
  extra: false,
  weekdays: "1,3,5",
  fromDate: "2026-10-01",
  untilDate: null,
  sortOrder: 0,
  ...over,
});

describe("pins", () => {
  it("maps rows to rules, and skips rows the engine can't place", () => {
    const rule = toPinRule(pin({}), ["2026-10-21"]);
    expect(rule?.when).toMatchObject({ repeat: "weekly", from: "2026-10-01", until: null });
    expect(rule?.when.repeat === "weekly" && rule.when.exceptDates?.has("2026-10-21")).toBe(true);
    expect(toPinRule(pin({ repeat: "once", localDate: null }))).toBeNull();
    expect(toPinRule(pin({ weekdays: "" }))).toBeNull();
  });

  it("refuses past days and times outside the day", () => {
    const today = "2026-10-17";
    expect(pinProblem(540, { repeat: "once", date: "2026-10-16" }, today)).not.toBeNull();
    expect(pinProblem(-1, { repeat: "once", date: today }, today)).not.toBeNull();
    expect(pinProblem(540, { repeat: "weekly", weekdays: [], from: today }, today)).not.toBeNull();
    expect(pinProblem(540, { repeat: "weekly", weekdays: [1], from: today, until: "2026-10-01" }, today)).not.toBeNull();
    expect(pinProblem(540, { repeat: "weekly", weekdays: [1], from: today }, today)).toBeNull();
  });

  it("a new weekly pin takes over the days it names and keeps the rest (§2.7)", () => {
    // Old: Mon/Wed/Fri from Oct 1. New: Wed only, from Oct 19.
    const split = splitForWeekly([pin({})], [3], "2026-10-19", null);
    expect(split.end).toEqual([{ id: "p", until: "2026-10-18" }]);
    expect(split.remove).toEqual([]);
    expect(split.carry.map((c) => [c.weekdays, c.fromDate, c.untilDate])).toEqual([
      [[1, 5], "2026-10-19", null],
    ]);
  });

  it("removes an overlapping pin that hasn't started, and hands named days back after a bounded one", () => {
    const later = pin({ id: "q", fromDate: "2026-10-26", weekdays: "3" });
    const split = splitForWeekly([later], [3], "2026-10-19", "2026-11-01");
    expect(split.remove).toEqual(["q"]);
    expect(split.carry.map((c) => [c.weekdays, c.fromDate])).toEqual([[[3], "2026-11-02"]]);
  });

  it("leaves pins on other weekdays or other dates alone", () => {
    expect(splitForWeekly([pin({ weekdays: "2,4" })], [3], "2026-10-19", null).end).toEqual([]);
    expect(splitForWeekly([pin({ untilDate: "2026-10-10" })], [3], "2026-10-19", null).end).toEqual([]);
  });
});

describe('"Do N of these"', () => {
  const school = new Map([
    ["a", "school"],
    ["b", "school"],
    ["c", "work"],
    ["d", null],
  ]);
  const base = { plannedCount: 1, commitmentOf: school, elsewhere: new Set<string>() };

  it("takes two or three tasks from one commitment", () => {
    expect(choiceProblem({ ...base, taskIds: ["a", "b"] })).toBeNull();
    expect(choiceProblem({ ...base, taskIds: ["a"] })).not.toBeNull();
    expect(choiceProblem({ ...base, taskIds: ["a", "c"] })).not.toBeNull();
    expect(choiceProblem({ ...base, taskIds: ["a", "d"] })).not.toBeNull();
    expect(choiceProblem({ ...base, taskIds: ["a", "a"] })).not.toBeNull();
  });

  it("refuses a task already in a choice in that window", () => {
    expect(choiceProblem({ ...base, taskIds: ["a", "b"], elsewhere: new Set(["b"]) })).not.toBeNull();
  });
});

describe("skips and Away", () => {
  it("expands each kind of skip to its dates (ADR-0040 §2)", () => {
    const skips = [
      { kind: "occurrence" as const, taskId: "run", unitId: null, localDate: "2026-10-20", madeOn: "2026-10-17" },
      // Weeks run Sunday to Saturday; any day of one names it.
      { kind: "taskWeek" as const, taskId: "lecture", unitId: null, localDate: "2026-10-21", madeOn: "2026-10-17" },
      { kind: "commitmentWeek" as const, taskId: null, unitId: "school", localDate: "2026-10-25", madeOn: "2026-10-17" },
    ];
    const commitmentOf = new Map<string, string | null>([
      ["run", null],
      ["lecture", "school"],
      ["essay", "school"],
    ]);
    const out = skippedDatesFor(skips, commitmentOf);
    expect([...(out.get("run") ?? [])]).toEqual(["2026-10-20"]);
    expect(out.get("lecture")?.has("2026-10-18")).toBe(true);
    expect(out.get("lecture")?.has("2026-10-24")).toBe(true);
    expect(out.get("lecture")?.has("2026-10-31")).toBe(true);
    expect(out.get("essay")?.size).toBe(7);
    expect(out.has("other")).toBe(false);
  });

  it("skips a whole week only before it starts (ADR-0040 §2, EC-25)", () => {
    // Saturday 17 October: its week began on the 11th.
    const today = "2026-10-17";
    expect(skipProblem({ kind: "taskWeek", taskId: "t", date: "2026-10-12" }, today)).not.toBeNull();
    expect(skipProblem({ kind: "commitmentWeek", unitId: "u", date: "2026-10-17" }, today)).not.toBeNull();
    expect(skipProblem({ kind: "taskWeek", taskId: "t", date: "2026-10-20" }, today)).toBeNull();
    // On a Sunday its own week has started.
    expect(skipProblem({ kind: "taskWeek", taskId: "t", date: "2026-10-18" }, "2026-10-18")).not.toBeNull();
    // A single run can still be skipped from today on.
    expect(skipProblem({ kind: "occurrence", taskId: "t", date: today }, today)).toBeNull();
    expect(skipProblem({ kind: "occurrence", taskId: "t", date: "2026-10-16" }, today)).not.toBeNull();
  });

  it("lists Away days inside a span, and refuses backwards ranges", () => {
    const days = awayDatesBetween([{ startDate: "2026-10-16", endDate: "2026-10-19" }], "2026-10-18", "2026-10-24");
    expect([...days]).toEqual(["2026-10-18", "2026-10-19"]);
    expect(awayProblem("2026-10-20", "2026-10-19", "2026-10-17")).not.toBeNull();
    expect(awayProblem("2026-10-20", "2026-10-20", "2026-10-17")).toBeNull();
  });

  it("allows past Away days only while their grades haven't settled (ADR-0040 §5)", () => {
    // Saturday 17 October: last week began on the 4th.
    expect(awayProblem("2026-10-04", "2026-10-06", "2026-10-17")).toBeNull();
    expect(awayProblem("2026-10-03", "2026-10-06", "2026-10-17")).not.toBeNull();
  });
});
