/**
 * Life → Achievements' layout (ADR-0047 §7, by achievement since
 * ADR-0050): everything, then each achievement once with every unit's
 * badge beneath in priority order, areas, commitments, and kept ranks.
 */
import { describe, expect, it } from "vitest";

import type { AchievementItem } from "../../../db/achievements";
import { achievementSections } from "../achievementGroups";

function item(over: Partial<AchievementItem> & Pick<AchievementItem, "series" | "subjectKind" | "subjectId">): AchievementItem {
  return {
    subjectName: over.subjectId,
    groupId: "x",
    run: false,
    earned: [],
    next: { rank: "bronze", threshold: 20 },
    progress: 0,
    streak: null,
    ...over,
  };
}

describe("achievementSections", () => {
  const items: AchievementItem[] = [
    item({ series: "goodDays", subjectKind: "all", subjectId: "all", subjectName: "", groupId: "all" }),
    item({ series: "unitCompletions", subjectKind: "unit", subjectId: "fit", subjectName: "Fitness", groupId: "health" }),
    item({ series: "unitCompletions", subjectKind: "unit", subjectId: "sleep", subjectName: "Sleep", groupId: "health" }),
    item({
      series: "unitDayRun",
      subjectKind: "unit",
      subjectId: "fit",
      subjectName: "Fitness",
      groupId: "health",
      run: true,
      streak: 9,
      earned: [{ rank: "bronze", threshold: 7, earnedOn: "2026-10-20" }],
    }),
    item({ series: "areaCompletions", subjectKind: "area", subjectId: "health", subjectName: "Health", groupId: "health" }),
    item({ series: "attended", subjectKind: "commitment", subjectId: "school", subjectName: "School", groupId: "school" }),
    item({
      series: "unitHours",
      subjectKind: "unit",
      subjectId: "old",
      subjectName: "Old unit",
      groupId: null,
      earned: [{ rank: "silver", threshold: 50, earnedOn: "2026-01-01" }],
    }),
  ];
  // Sleep is your top priority, then Fitness.
  const order = new Map([
    ["sleep", 0],
    ["fit", 1],
  ]);

  it("orders everything, units, areas, commitments, then what's kept", () => {
    expect(achievementSections(items, order).map((s) => s.title)).toEqual([
      "Everything",
      "Your units",
      "Areas",
      "Commitments",
      "From before",
    ]);
  });

  it("names each unit achievement once, with every unit's badge beneath in priority order", () => {
    const units = achievementSections(items, order)[1]!;
    expect(units.rows.map((r) => r.name)).toEqual(["Completions", "Days in a row"]);
    expect(units.rows[0]!.items.map((i) => i.subjectName)).toEqual(["Sleep", "Fitness"]);
    expect(units.rows[0]!.bySubject).toBe(true);
    expect(units.rows[1]).toMatchObject({ top: "bronze", streak: { length: 9, per: "day" } });
  });
});
