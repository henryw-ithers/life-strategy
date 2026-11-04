/**
 * How Life → Achievements is laid out (ADR-0047 §7, by achievement
 * since ADR-0050): see `achievementSections`.
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
  /** One achievement across subjects: each badge is named for its
   *  subject rather than its series. */
  bySubject?: boolean;
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

/**
 * Life → Achievements, by achievement (Henry, 2026-11-04): each one
 * named once, with every subject's badge for it in a row beneath, units
 * in your priority order. Everything comes first, then your units,
 * areas and commitments, and ranks of a subject since removed at the
 * end, kept.
 *
 * `order` is each unit's place in your priorities (Top first). Areas
 * follow their highest unit; anything unplaced goes last, by name.
 */
export function achievementSections(
  items: readonly AchievementItem[],
  order: ReadonlyMap<string, number> = new Map(),
): AchievementSection[] {
  const live = items.filter((i) => i.groupId !== null);
  const sections: AchievementSection[] = [];

  const everything = live.filter((i) => i.subjectKind === "all");
  if (everything.length > 0) {
    // Each whole-app series is its own row, named for what it counts.
    sections.push({ key: ALL, title: "Everything", rows: everything.map((i) => rowOf([i], false, SERIES_LABEL[i.series])) });
  }

  // An area sits where its highest unit does.
  const areaOrder = new Map<string, number>();
  for (const i of live) {
    if (i.subjectKind !== "unit" || i.groupId === null) continue;
    const at = order.get(i.subjectId) ?? Infinity;
    areaOrder.set(i.groupId, Math.min(areaOrder.get(i.groupId) ?? Infinity, at));
  }
  const rank = (i: AchievementItem) =>
    i.subjectKind === "unit"
      ? (order.get(i.subjectId) ?? Infinity)
      : i.subjectKind === "area"
        ? (areaOrder.get(i.subjectId) ?? Infinity)
        : Infinity;
  const ordered = (list: AchievementItem[]) =>
    [...list].sort((a, b) => rank(a) - rank(b) || a.subjectName.localeCompare(b.subjectName));

  /** One row per series of a kind of subject, in the catalogue's order. */
  const bySeries = (kind: AchievementItem["subjectKind"], key: string, title: string) => {
    const mine = live.filter((i) => i.subjectKind === kind);
    const series = [...new Set(mine.map((i) => i.series))];
    if (series.length === 0) return;
    sections.push({
      key,
      title,
      rows: series.map((id) => ({
        ...rowOf(ordered(mine.filter((i) => i.series === id)), false, SERIES_LABEL[id]),
        key: `${key}|${id}`,
        bySubject: true,
      })),
    });
  };
  bySeries("unit", "units", "Your units");
  bySeries("area", "areas", "Areas");
  bySeries("commitment", "commitments", "Commitments");

  const gone = bySubject(items.filter((i) => i.groupId === null));
  if (gone.length > 0) {
    sections.push({ key: "gone", title: "From before", rows: gone.map((s) => rowOf(s, false)) });
  }
  return sections;
}
