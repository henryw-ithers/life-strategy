/**
 * Goal templates (ADR-0042 §7): every unit has some, one per kind at
 * most, each a goal the rules accept.
 */
import { describe, expect, it } from "vitest";

import { UNIT_INFO } from "../units";
import { goalTemplatesFor, TEMPLATE_UNITS, titleWith } from "../goalTemplates";

describe("goal templates", () => {
  it("cover all 18 units, one per kind at most", () => {
    expect([...TEMPLATE_UNITS].sort()).toEqual(Object.keys(UNIT_INFO).sort());
    for (const id of TEMPLATE_UNITS) {
      const kinds = goalTemplatesFor({ id, name: id, commitment: false }).map((t) => t.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
      expect(kinds.length).toBeGreaterThan(0);
    }
  });

  it("give every counted kind a target and a streak none", () => {
    for (const id of [...TEMPLATE_UNITS, "custom"]) {
      for (const t of goalTemplatesFor({ id, name: "X", commitment: false })) {
        if (t.kind === "streak") {
          expect(t.target).toBeNull();
          expect(t.title).not.toContain("{n}");
        } else {
          expect(t.target).toBeGreaterThan(0);
          expect(t.title).toContain("{n}");
        }
      }
    }
  });

  it("fill in a commitment's name and offer no streak there", () => {
    const school = goalTemplatesFor({ id: "school", name: "School", commitment: true });
    expect(school.map((t) => titleWith(t.title, t.target))).toContain("40 hours on School");
    expect(school.some((t) => t.kind === "streak")).toBe(false);
  });
});
