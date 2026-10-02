/**
 * Events (ADR-0038) and the sub-commitment switch (ADR-0035 §1,
 * amended 2026-10-02).
 */
import { describe, expect, it } from "vitest";

import { eventProblem, eventTimesPerWeek, optionalText } from "../events";
import { generalSubName, homeOnSplit, subCommitmentsOn } from "../commitmentPlan";

const lecture = {
  title: "COMP2521 lecture",
  weekdays: [1, 3],
  date: null,
  startMinute: 9 * 60,
  endMinute: 11 * 60,
};

describe("eventProblem", () => {
  it("accepts a repeating event with a time", () => {
    expect(eventProblem(lecture)).toBeNull();
  });

  it("accepts a one-time event with a date instead of days", () => {
    expect(eventProblem({ ...lecture, weekdays: [], date: "2026-11-02" })).toBeNull();
  });

  it("needs a name", () => {
    expect(eventProblem({ ...lecture, title: "  " })).toMatch(/name/);
  });

  it("needs days or a date", () => {
    expect(eventProblem({ ...lecture, weekdays: [], date: null })).toMatch(/days/);
  });

  it("needs a start and an end — its time is the point of it", () => {
    expect(eventProblem({ ...lecture, startMinute: null })).toMatch(/start and an end/);
    expect(eventProblem({ ...lecture, endMinute: null })).toMatch(/start and an end/);
  });

  it("must end at least 15 minutes after it starts", () => {
    expect(eventProblem({ ...lecture, endMinute: 9 * 60 + 10 })).toMatch(/15 minutes/);
    expect(eventProblem({ ...lecture, endMinute: 9 * 60 + 15 })).toBeNull();
  });
});

describe("eventTimesPerWeek", () => {
  it("is one run per day picked", () => {
    expect(eventTimesPerWeek([1, 3, 5])).toBe(3);
    expect(eventTimesPerWeek([1, 1])).toBe(1);
  });
});

describe("subCommitmentsOn", () => {
  it("follows the switch", () => {
    expect(subCommitmentsOn({ usesSubCommitments: true }, 0)).toBe(true);
    expect(subCommitmentsOn({ usesSubCommitments: false }, 0)).toBe(false);
  });

  it("reads a commitment with live sub-commitments as split, whatever the switch says", () => {
    // Rows from before the switch existed.
    expect(subCommitmentsOn({ usesSubCommitments: false }, 2)).toBe(true);
  });

  it("names the sub-commitment that collects a commitment's own work", () => {
    expect(generalSubName(" School ")).toBe("School general");
  });
});

describe("optionalText", () => {
  it("keeps what was written, trimmed, and reads blank as nothing", () => {
    expect(optionalText("  Room 101 ")).toBe("Room 101");
    expect(optionalText("   ")).toBeNull();
    expect(optionalText(undefined)).toBeNull();
  });
});

describe("homeOnSplit — turning sub-commitments back on", () => {
  const live = new Set(["comp2521", "math1231"]);

  it("sends a task back to the sub-commitment it came from", () => {
    expect(homeOnSplit("comp2521", live)).toBe("comp2521");
  });

  it("sends work added while unsplit to the general one", () => {
    expect(homeOnSplit(null, live)).toBeNull();
  });

  it("sends a task whose old home is gone to the general one", () => {
    expect(homeOnSplit("deleted-class", live)).toBeNull();
  });
});
