import { effortToRadius, ratingToX, ratingToY, type PlotRect } from "./geometry";
import type { GraphPoint, GraphSnapshot } from "./types";

/** Per-unit position/radius/presence arrays, one entry per snapshot. */
export interface UnitSeries {
  unitId: string;
  name: string;
  areaId: string;
  excluded: boolean;
  xs: number[];
  ys: number[];
  rs: number[];
  /** 1 where the unit was rated in that snapshot, 0 where absent. */
  present: number[];
  /** Raw point per snapshot (null where absent) for callouts/a11y. */
  points: (GraphPoint | null)[];
}

export interface SeriesResult {
  series: UnitSeries[];
  /** Interpolation input range; always ≥ 2 entries (Reanimated requires it). */
  inputRange: number[];
}

/**
 * Build per-unit series across snapshots. Units are the union across
 * all snapshots in first-seen order; absent entries carry the nearest
 * known position with presence 0, so a unit fades rather than jumps.
 */
export function buildSeries(
  snapshots: GraphSnapshot[],
  plot: PlotRect,
): SeriesResult {
  const unitIds: string[] = [];
  const byUnit = new Map<string, (GraphPoint | null)[]>();

  snapshots.forEach((snap, snapIndex) => {
    for (const point of snap.points) {
      if (!byUnit.has(point.unitId)) {
        unitIds.push(point.unitId);
        byUnit.set(point.unitId, Array(snapshots.length).fill(null));
      }
      byUnit.get(point.unitId)![snapIndex] = point;
    }
  });

  const series = unitIds.map((unitId): UnitSeries => {
    const slots = byUnit.get(unitId)!;
    const firstKnown = slots.find((p) => p !== null)!;

    const xs: number[] = [];
    const ys: number[] = [];
    const rs: number[] = [];
    const present: number[] = [];
    let carry: GraphPoint = firstKnown;
    for (const slot of slots) {
      if (slot) carry = slot;
      xs.push(ratingToX(carry.satisfaction, plot));
      ys.push(ratingToY(carry.importance, plot));
      rs.push(effortToRadius(carry.effort));
      present.push(slot ? 1 : 0);
    }

    const latest = [...slots].reverse().find((p) => p !== null) ?? firstKnown;

    // Reanimated's interpolate needs ≥2 stops.
    if (snapshots.length === 1) {
      xs.push(xs[0]!);
      ys.push(ys[0]!);
      rs.push(rs[0]!);
      present.push(present[0]!);
    }

    return {
      unitId,
      name: latest.name,
      areaId: latest.areaId,
      excluded: !latest.includeInScoring,
      xs,
      ys,
      rs,
      present,
      points: slots,
    };
  });

  const stops = snapshots.length === 1 ? 2 : snapshots.length;
  const inputRange = Array.from({ length: stops }, (_, i) => i);
  return { series, inputRange };
}
