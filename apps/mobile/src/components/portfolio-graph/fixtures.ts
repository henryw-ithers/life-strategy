/**
 * Deterministic fake snapshot history for the dev spike route. Six
 * monthly diagnostics with random-walking ratings and effort, so
 * compare trails and playback have something honest to show.
 */
import { DEFAULT_TAXONOMY } from "../../db/taxonomy";
import type { GraphPoint, GraphSnapshot } from "./types";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const MONTH_LABELS = [
  "Feb 2026",
  "Mar 2026",
  "Apr 2026",
  "May 2026",
  "Jun 2026",
  "Jul 2026",
];

const clampRating = (v: number) => Math.min(10, Math.max(1, v));
const clamp01 = (v: number) => Math.min(1, Math.max(0.05, v));

export function makeFixtureSnapshots(seed = 7): GraphSnapshot[] {
  const rand = lcg(seed);

  const units = DEFAULT_TAXONOMY.flatMap((area) =>
    area.units.map((unit) => ({
      unitId: unit.id,
      name: unit.name,
      areaId: area.id,
      importance: 3 + Math.floor(rand() * 7),
      satisfaction: 2 + Math.floor(rand() * 7),
      effort: 0.25, // first snapshot: uniform bubbles (ADR-0005 §3)
      includeInScoring: unit.id !== "online-entertainment",
    })),
  );

  const snapshots: GraphSnapshot[] = [];
  for (let month = 0; month < MONTH_LABELS.length; month++) {
    if (month > 0) {
      for (const u of units) {
        u.importance = clampRating(u.importance + Math.round(rand() * 2 - 1));
        // Gap units drift toward satisfaction: the demo shows migration.
        const bias = u.importance - u.satisfaction >= 3 ? 0.35 : 0;
        u.satisfaction = clampRating(
          u.satisfaction + Math.round(rand() * 2 - 1 + bias),
        );
        u.effort = clamp01(u.effort + (rand() * 0.3 - 0.08));
      }
    }
    snapshots.push({
      id: `snapshot-${month}`,
      label: MONTH_LABELS[month] ?? `Month ${month + 1}`,
      points: units.map((u): GraphPoint => ({ ...u })),
    });
  }
  return snapshots;
}
