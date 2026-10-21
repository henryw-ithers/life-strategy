/**
 * How Life → Achievements is laid out (ADR-0047 §7): everything first,
 * then each commitment, then each area with its units, each unit
 * followed by its tasks. A subject is one row holding its series.
 * Ranks of a subject since removed sit at the end, kept.
 */
import type { Rank } from "@glide/scoring";

import type { AchievementItem } from "../../db/achievements";
import { ALL, highestRank, runShown, type UnitBadge } from "../../db/achievementRules";
import { SERIES_LABEL } from "../../lib/achievementCopy";

export interface SubjectRow {
  key: string;
  name: string;
  /** Indented under its unit. */
  nested: boolean;
  items: AchievementItem[];
  /** The highest rank earned among its series. */
  top: Rank | null;
  /** Its longest run going now, days before weeks. */
  streak: UnitBadge["streak"];
}

export interface AchievementSection {
  key: string;
  title: string;
  rows: SubjectRow[];
}

function rowOf(items: AchievementItem[], nested: boolean, name?: string): SubjectRow {
  const first = items[0]!;
  return {
    key: `${first.subjectKind}|${first.subjectId}|${first.series}`,
    name: name ?? first.subjectName,
    nested,
    items,
    top: highestRank(items),
    streak: runShown(items),
  };
}

/** Items by subject, in the order they came. */
function bySubject(items: readonly AchievementItem[]): AchievementItem[][] {
  const out = new Map<string, AchievementItem[]>();
  for (const i of items) {
    const k = `${i.subjectKind}|${i.subjectId}`;
    out.set(k, [...(out.get(k) ?? []), i]);
  }
  return [...out.values()];
}

export function achievementSections(items: readonly AchievementItem[]): AchievementSection[] {
  const live = items.filter((i) => i.groupId !== null);
  const subjects = bySubject(live);
  const sections: AchievementSection[] = [];

  const everything = live.filter((i) => i.subjectKind === "all");
  if (everything.length > 0) {
    // Each whole-app series is its own row, named for what it counts.
    sections.push({ key: ALL, title: "Everything", rows: everything.map((i) => rowOf([i], false, SERIES_LABEL[i.series])) });
  }

  const tasksIn = (groupId: string) =>
    subjects.filter((s) => s[0]!.subjectKind === "task" && s[0]!.groupId === groupId).map((s) => rowOf(s, true));

  for (const s of subjects.filter((s) => s[0]!.subjectKind === "commitment")) {
    const c = s[0]!;
    sections.push({
      key: `commitment|${c.subjectId}`,
      title: c.subjectName,
      rows: [rowOf(s, false, `All of ${c.subjectName}`), ...tasksIn(c.subjectId)],
    });
  }

  for (const s of subjects.filter((s) => s[0]!.subjectKind === "area")) {
    const a = s[0]!;
    const units = subjects.filter((u) => u[0]!.subjectKind === "unit" && u[0]!.groupId === a.subjectId);
    sections.push({
      key: `area|${a.subjectId}`,
      title: a.subjectName,
      rows: [rowOf(s, false, `All of ${a.subjectName}`), ...units.flatMap((u) => [rowOf(u, false), ...tasksIn(u[0]!.subjectId)])],
    });
  }

  const gone = bySubject(items.filter((i) => i.groupId === null));
  if (gone.length > 0) {
    sections.push({ key: "gone", title: "From before", rows: gone.map((s) => rowOf(s, false)) });
  }
  return sections;
}
