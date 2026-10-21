/**
 * Life → Achievements' layout (ADR-0047 §7): everything, commitments,
 * then areas with their units and tasks, and kept ranks at the end.
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
    item({ series: "taskCompletions", subjectKind: "task", subjectId: "run", subjectName: "Run", groupId: "fit" }),
    item({
      series: "everyDayStreak",
      subjectKind: "task",
      subjectId: "run",
      subjectName: "Run",
      groupId: "fit",
      run: true,
      streak: 9,
      earned: [{ rank: "bronze", threshold: 7, earnedOn: "2026-10-20" }],
    }),
    item({ series: "taskCompletions", subjectKind: "task", subjectId: "essay", subjectName: "Essay", groupId: "school" }),
    item({ series: "unitCompletions", subjectKind: "unit", subjectId: "fit", subjectName: "Fitness", groupId: "health" }),
    item({ series: "areaCompletions", subjectKind: "area", subjectId: "health", subjectName: "Health", groupId: "health" }),
    item({ series: "attended", subjectKind: "commitment", subjectId: "school", subjectName: "School", groupId: "school" }),
    item({
      series: "taskCompletions",
      subjectKind: "task",
      subjectId: "old",
      subjectName: "Old habit",
      groupId: null,
      earned: [{ rank: "silver", threshold: 50, earnedOn: "2026-01-01" }],
    }),
  ];

  it("orders everything, commitments, areas, then what's kept", () => {
    expect(achievementSections(items).map((s) => s.title)).toEqual(["Everything", "School", "Health", "From before"]);
  });

  it("names the whole-app rows for what they count", () => {
    expect(achievementSections(items)[0]!.rows.map((r) => r.name)).toEqual(["Days at 80 or above"]);
  });

  it("puts a unit's tasks under it, one row per task with each series", () => {
    const health = achievementSections(items)[2]!;
    expect(health.rows.map((r) => [r.name, r.nested])).toEqual([
      ["All of Health", false],
      ["Fitness", false],
      ["Run", true],
    ]);
    expect(health.rows[2]).toMatchObject({ top: "bronze", streak: { length: 9, per: "day" } });
    expect(health.rows[2]!.items).toHaveLength(2);
  });

  it("lists a commitment's own row, then its tasks", () => {
    expect(achievementSections(items)[1]!.rows.map((r) => r.name)).toEqual(["All of School", "Essay"]);
  });
});
