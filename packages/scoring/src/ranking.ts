/**
 * Rank-derived diagnostic scores. The diagnostic ranks units instead
 * of rating them on an absolute 1–10 scale (fixes ceiling-clustering:
 * ranking guarantees full-range spread every time, regardless of how
 * "important" everything subjectively feels). `rankToScore` converts
 * a rank position back into a continuous 1–10-equivalent number so
 * the existing weight formula, bubble chart, and history views keep
 * working unchanged.
 */

/** Rank 1 (highest attention) → 10; rank `total` (lowest) → 1. A
 *  single-item set has nothing to compare against, so it scores 10. */
export function rankToScore(rank: number, total: number): number {
  if (!Number.isInteger(total) || total < 1) {
    throw new Error(`rankToScore: total must be a positive integer, got ${total}`);
  }
  if (!Number.isInteger(rank) || rank < 1 || rank > total) {
    throw new Error(`rankToScore: rank must be an integer 1–${total}, got ${rank}`);
  }
  if (total === 1) return 10;
  return 10 - (9 * (rank - 1)) / (total - 1);
}

export interface AreaRank {
  areaId: string;
  /** 1 = needs the most attention. */
  rank: number;
}

export interface UnitRank {
  unitId: string;
  /** 1 = needs the most attention, within its area. */
  rank: number;
}

export interface OverallUnitRank {
  unitId: string;
  /** 1 = needs the most attention, across every unit. */
  overallRank: number;
  total: number;
}

/**
 * Composes an area-level ranking with each area's within-area ranking
 * into one strict total order across every unit: area rank is
 * primary, within-area rank is secondary.
 */
export function combineHierarchicalRank(
  areaRanks: readonly AreaRank[],
  unitRanksByArea: Readonly<Record<string, readonly UnitRank[]>>,
): OverallUnitRank[] {
  const orderedAreas = [...areaRanks].sort((a, b) => a.rank - b.rank);
  const flattened: string[] = [];
  for (const area of orderedAreas) {
    const units = [...(unitRanksByArea[area.areaId] ?? [])].sort(
      (a, b) => a.rank - b.rank,
    );
    for (const u of units) flattened.push(u.unitId);
  }
  const total = flattened.length;
  return flattened.map((unitId, i) => ({
    unitId,
    overallRank: i + 1,
    total,
  }));
}
