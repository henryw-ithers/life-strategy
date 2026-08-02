import { asc } from "drizzle-orm";

import type { GraphSnapshot } from "../components/portfolio-graph";
import { db } from "./client";
import { lifeUnit, rating, snapshot } from "./schema";

/** Uniform bubble size until the trailing-effort query ships (ADR-0005). */
const DEFAULT_EFFORT = 0.25;

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/** "Jul 16" — used when a month holds more than one snapshot. */
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * All snapshots, oldest → newest, mapped for the PortfolioGraph.
 * Archived units stay in the snapshots where they were rated —
 * history never restates (ADR-0002/0005). Labels fall back from
 * "Jul 2026" to "Jul 16" when a month holds multiple snapshots.
 */
export async function loadGraphSnapshots(): Promise<GraphSnapshot[]> {
  const snaps = await db
    .select()
    .from(snapshot)
    .orderBy(asc(snapshot.takenAt));
  if (snaps.length === 0) return [];

  const monthCounts = new Map<string, number>();
  for (const s of snaps) {
    const key = monthKey(s.takenAt);
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }

  const ratings = await db.select().from(rating);
  const units = await db.select().from(lifeUnit);
  const unitById = new Map(units.map((u) => [u.id, u]));

  return snaps.map((s) => ({
    id: s.id,
    label:
      (monthCounts.get(monthKey(s.takenAt)) ?? 1) > 1
        ? dayLabel(s.takenAt)
        : monthLabel(s.takenAt),
    // v4 rated satisfaction instead of ranking it (ADR-0022). Older
    // snapshots keep their stored numbers — history never restates —
    // but their x-axis means something different, so the graph flags a
    // span that crosses the boundary rather than tweening through it.
    satisfactionScale:
      s.formulaVersion >= 4 ? ("rated" as const) : ("ranked" as const),
    points: ratings
      .filter((r) => r.snapshotId === s.id)
      .flatMap((r) => {
        const unit = unitById.get(r.unitId);
        if (!unit) return [];
        return [
          {
            unitId: r.unitId,
            name: unit.name,
            areaId: unit.areaId,
            importance: r.importance,
            satisfaction: r.satisfaction,
            effort: r.effortPoints ?? DEFAULT_EFFORT,
            includeInScoring: unit.includeInScoring,
          },
        ];
      }),
  }));
}
