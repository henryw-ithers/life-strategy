/**
 * ADR-0044: a commitment's share comes from your day.
 */
import { describe, expect, it } from "vitest";

import {
  commitmentBandOn,
  commitmentDayFromShare,
  commitmentPointValues,
  commitmentShare,
  type CommitmentWorkToday,
} from "../bands";
import { dayHours, DEFAULT_RANGES, type TimeRange } from "../hours";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const r = (start: number, end: number): TimeRange => ({ start, end });

/** An 8-hour working day, 9 to 5. */
const EIGHT_HOURS = [r(h(9), h(17))];
const lecture = r(h(10), h(11, 30));

const school = (over: Partial<CommitmentWorkToday> = {}): CommitmentWorkToday => ({
  commitmentId: "school",
  events: [lecture],
  taskSizes: ["normal", "normal"],
  ...over,
});

describe("commitmentShare (ADR-0044 §1)", () => {
  it("matches the worked example: (1.5 + 2) ÷ 8, about 44%", () => {
    const share = commitmentShare({ working: EIGHT_HOURS, commitments: [school()], commitmentCount: 1 });
    expect(share.band).toBe(44);
    expect(share.shares.get("school")).toBe(44);
    expect(share.automatic.get("school")).toBe(44);
  });

  it("is about 19% with only the lecture", () => {
    const share = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ taskSizes: [] })],
      commitmentCount: 1,
    });
    expect(share.band).toBe(19);
  });

  it("grows with more scheduled work: two Big tasks on top reach about 69%, even as your only commitment", () => {
    const busy = school({ taskSizes: ["big", "big"] });
    expect(commitmentShare({ working: EIGHT_HOURS, commitments: [busy], commitmentCount: 1 }).band).toBe(69);
  });

  it("counts a task with no size as Normal", () => {
    const share = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ taskSizes: [null, null] })],
      commitmentCount: 1,
    });
    expect(share.band).toBe(44);
  });

  it("adds event time outside working hours to your day", () => {
    // A 2-hour evening shift outside 9–5: the day is 10 hours.
    const share = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [{ commitmentId: "work", events: [r(h(18), h(20))], taskSizes: [] }],
      commitmentCount: 1,
    });
    expect(share.band).toBe(20);
  });

  it("is nothing on a day with no commitment work (ADR-0032 §1)", () => {
    const share = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ events: [], taskSizes: [] })],
      commitmentCount: 1,
    });
    expect(share.band).toBe(0);
    expect(share.shares.size).toBe(0);
  });
});

describe("limits (ADR-0044 §2)", () => {
  it("keeps the total at least 10%", () => {
    const share = commitmentShare({
      working: [r(h(8), h(22))],
      commitments: [school({ events: [], taskSizes: ["quick"] })],
      commitmentCount: 1,
    });
    expect(share.band).toBe(10);
  });

  it("keeps the total at the limit for how many commitments there are", () => {
    const huge = school({ events: [r(h(9), h(17))], taskSizes: [] });
    expect(commitmentShare({ working: EIGHT_HOURS, commitments: [huge], commitmentCount: 1 }).band).toBe(70);
    expect(commitmentShare({ working: EIGHT_HOURS, commitments: [huge], commitmentCount: 2 }).band).toBe(70);
    expect(commitmentShare({ working: EIGHT_HOURS, commitments: [huge], commitmentCount: 3 }).band).toBe(80);
  });

  it("gives a day with commitment work and no working time the limit", () => {
    const share = commitmentShare({ working: [], commitments: [school({ events: [], taskSizes: ["normal"] })], commitmentCount: 1 });
    expect(share.band).toBe(70);
  });

  it("keeps each commitment's proportion on a day with no working time", () => {
    const share = commitmentShare({
      working: [],
      commitments: [
        { commitmentId: "school", events: [], taskSizes: ["big", "big", "big"] },
        { commitmentId: "work", events: [], taskSizes: ["quick"] },
      ],
      commitmentCount: 2,
    });
    expect(share.band).toBe(70);
    // 6 h against 0.5 h: about 65 and 5, not an even split.
    expect(share.shares.get("school")).toBe(65);
    expect(share.shares.get("work")).toBe(5);
  });

  it("prices the day at the share shown, even given only today's commitments", () => {
    const share = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ events: [r(h(9), h(15))], taskSizes: [] })],
      commitmentCount: 2,
    });
    expect(share.band).toBe(70);
    const day = commitmentDayFromShare(share, [{ commitmentId: "school", share: 0, unitIds: ["school"] }], ["lec"]);
    expect(commitmentBandOn(day)).toBe(70);
  });

  it("uses the default windows as working hours before any are set", () => {
    // 9–12, 1–5, 6–9 is 10 hours.
    const share = commitmentShare({
      working: DEFAULT_RANGES,
      commitments: [school({ events: [], taskSizes: ["normal", "normal", "normal"] })],
      commitmentCount: 1,
    });
    expect(share.band).toBe(30);
  });
});

describe("several commitments, and overrides (ADR-0044 §3)", () => {
  const work: CommitmentWorkToday = { commitmentId: "work", events: [r(h(13), h(15))], taskSizes: [] };

  it("gives each its own time, and they add up to the band", () => {
    const share = commitmentShare({ working: EIGHT_HOURS, commitments: [school(), work], commitmentCount: 2 });
    // School 3.5 h and Work 2 h of 8: about 44 and 25.
    expect(share.band).toBe(69);
    expect(share.shares.get("school")).toBe(44);
    expect(share.shares.get("work")).toBe(25);
  });

  it("keeps each one's proportion when the total is held at the limit", () => {
    const bigWork = { ...work, events: [r(h(12), h(17))] };
    const share = commitmentShare({ working: EIGHT_HOURS, commitments: [school(), bigWork], commitmentCount: 2 });
    expect(share.band).toBe(70);
    const s = share.shares.get("school") ?? 0;
    const w = share.shares.get("work") ?? 0;
    expect(s + w).toBe(70);
    expect(s / w).toBeCloseTo(3.5 / 5, 1);
  });

  it("uses a share you set in place of the automatic one, and shows both", () => {
    const share = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ fixedShare: 60 })],
      commitmentCount: 1,
    });
    expect(share.band).toBe(60);
    expect(share.automatic.get("school")).toBe(44);
  });

  it("applies a set share only on days the commitment has work", () => {
    const share = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ events: [], taskSizes: [], fixedShare: 60 })],
      commitmentCount: 1,
    });
    expect(share.band).toBe(0);
  });

  it("keeps a set share within the same limits", () => {
    const share = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ fixedShare: 75 })],
      commitmentCount: 1,
    });
    expect(share.band).toBe(70);
  });
});

describe("when the share is fixed (ADR-0044 §5)", () => {
  it("doesn't move when a window is added on the day itself (EC-56)", () => {
    const base = { date: "2026-07-15", versions: [], override: EIGHT_HOURS, events: [lecture] };
    const morning = dayHours(base).working;
    const afterLunch = dayHours({
      ...base,
      edits: [{ kind: "add", range: r(h(19), h(22)), onTheDay: true }],
    }).working;
    const share = (working: readonly TimeRange[]) =>
      commitmentShare({ working, commitments: [school()], commitmentCount: 1 }).band;
    expect(share(afterLunch)).toBe(share(morning));
  });

  it("does count a window added for the day ahead of time", () => {
    const base = { date: "2026-07-15", versions: [], override: EIGHT_HOURS, events: [lecture] };
    const planned = dayHours({ ...base, edits: [{ kind: "add", range: r(h(18), h(20)) }] }).working;
    const band = commitmentShare({ working: planned, commitments: [school()], commitmentCount: 1 }).band;
    // 3.5 h of a 10-hour day.
    expect(band).toBe(35);
  });

  it("changes when what's due changes: skipping the lecture leaves the tasks", () => {
    const skipped = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ events: [] })],
      commitmentCount: 1,
    });
    expect(skipped.band).toBe(25);
  });

  it("counts an undated one-off on the day it's ticked, and not before", () => {
    // "Email tutor", undated: the data layer adds its size only on the
    // day it's done.
    const ticked = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ events: [], taskSizes: ["quick"] })],
      commitmentCount: 1,
    });
    expect(ticked.band).toBe(10);
  });

  it("after Clear today, counts only what was already ticked, and none means no share (EC-29)", () => {
    const tickedLecture = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ taskSizes: [] })],
      commitmentCount: 1,
    });
    expect(tickedLecture.band).toBe(19);
    const nothingTicked = commitmentShare({
      working: EIGHT_HOURS,
      commitments: [school({ events: [], taskSizes: [] })],
      commitmentCount: 1,
    });
    expect(nothingTicked.band).toBe(0);
  });
});

describe("into the day's pricing", () => {
  const groups = [
    { commitmentId: "school", share: 0, unitIds: ["school"] },
    { commitmentId: "work", share: 0, unitIds: ["work"] },
  ];

  it("uses the worked-out band as it is, never snapped to a step of 5", () => {
    const share = commitmentShare({ working: EIGHT_HOURS, commitments: [school()], commitmentCount: 2 });
    const day = commitmentDayFromShare(share, groups, ["lec", "t1", "t2"]);
    expect(commitmentBandOn(day)).toBe(44);
  });

  it("pays each commitment its own part, divided across its work today", () => {
    const work: CommitmentWorkToday = { commitmentId: "work", events: [r(h(13), h(15))], taskSizes: [] };
    const share = commitmentShare({ working: EIGHT_HOURS, commitments: [school(), work], commitmentCount: 2 });
    const tasks = [
      { id: "lec", unitId: "school" },
      { id: "t1", unitId: "school" },
      { id: "t2", unitId: "school" },
      { id: "shift", unitId: "work" },
    ];
    const day = commitmentDayFromShare(share, groups, tasks.map((t) => t.id));
    const values = commitmentPointValues(day!, tasks);
    const schoolTotal = (values.get("lec") ?? 0) + (values.get("t1") ?? 0) + (values.get("t2") ?? 0);
    expect(schoolTotal).toBe(share.shares.get("school"));
    expect(values.get("shift")).toBe(share.shares.get("work"));
  });

  it("is an ordinary day with no commitment work", () => {
    const share = commitmentShare({ working: EIGHT_HOURS, commitments: [], commitmentCount: 1 });
    expect(commitmentDayFromShare(share, groups, [])).toBeNull();
  });
});
