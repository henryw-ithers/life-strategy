/**
 * The schedule templates must each be hours the editor would accept,
 * and only shift work makes events one-time (ADR-0045 §1).
 */
import { describe, expect, it } from "vitest";

import { hoursProblem } from "../../db/windowRules";
import { SCHEDULE_TEMPLATES, templateFor } from "../onboardingTemplates";

describe("SCHEDULE_TEMPLATES", () => {
  it("offers the four answers in the spec's order", () => {
    expect(SCHEDULE_TEMPLATES.map((t) => t.label)).toEqual([
      "Student",
      "9–5 job",
      "Shift work",
      "Nothing fixed",
    ]);
  });

  it.each(SCHEDULE_TEMPLATES)("$label is valid hours covering every day", (t) => {
    expect(hoursProblem("2026-10-21", t.schedules, [])).toBeNull();
    expect(t.schedules.flatMap((s) => s.weekdays).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("makes events one-time only for shift work", () => {
    expect(SCHEDULE_TEMPLATES.filter((t) => t.eventsOnce).map((t) => t.id)).toEqual(["shifts"]);
  });
});

describe("templateFor", () => {
  it("finds a template by id, and nothing for anything else", () => {
    expect(templateFor("student")?.label).toBe("Student");
    expect(templateFor(null)).toBeNull();
    expect(templateFor("pirate")).toBeNull();
  });
});
