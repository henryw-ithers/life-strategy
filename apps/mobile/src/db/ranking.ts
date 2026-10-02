/**
 * Re-ranking priorities without re-running the diagnostic.
 *
 * AGENTS.md has always held that "every derived value is
 * user-overridable, and every override still displays the recommended
 * value beside it," and `unit_weight.override` has existed since
 * ADR-0002 — read everywhere via `override ?? derived`. Nothing ever
 * wrote to it (ADR-0005 action item 4: "no override-editing UI
 * exists"). This module is the writer.
 *
 * **It does not mint a snapshot.** Snapshots are immutable and they
 * *are* the portfolio graph's history; a re-rank is not a new
 * diagnostic, because you have not re-assessed how satisfied you are.
 * Minting one would put points on the graph you never gave and feed
 * ADR-0008's calibration series invented data. So the snapshot keeps
 * recording what you actually said, and the adjustment is recorded
 * separately as an override.
 *
 * Only **priority** is re-orderable. Satisfaction is an assessment,
 * not a preference, and stays with the diagnostic that captured it.
 */
import { and, desc, eq } from "drizzle-orm";

import { weightsForPriorityOrder } from "@glide/scoring";

import { db } from "./client";
import { lifeArea, lifeUnit, rating, snapshot, unitWeight } from "./schema";
import { getSetting, setSetting } from "./settings";
import { recomputeAllUnitPoints } from "./tasks";
import { recacheAllDayScores } from "./dayGrades";

/** Manual order, scoped to the snapshot it was made against. A fresh
 *  diagnostic supersedes it — which is the right behaviour: you just
 *  restated the order in full. */
const ORDER_KEY = "priority.order";

export interface RankedUnit {
  unitId: string;
  name: string;
  areaId: string;
  areaName: string;
  includeInScoring: boolean;
  /** From the snapshot; carried unchanged through a re-rank. */
  satisfaction: number;
  /** Effective points now (`override ?? derived`), null when excluded. */
  weight: number | null;
  /** What the diagnostic derived — shown beside an overridden value. */
  derived: number | null;
  overridden: boolean;
}

export interface RankingBoard {
  snapshotId: string;
  /** Overall priority order, most attention first. Includes excluded
   *  units: the diagnostic ranks everything and filters afterwards, so
   *  the rank denominator has to match. */
  order: string[];
  byId: Map<string, RankedUnit>;
  /** True when the live weights came from a manual re-rank. */
  reordered: boolean;
}

export async function loadRankingBoard(): Promise<RankingBoard | null> {
  const [latest] = await db
    .select()
    .from(snapshot)
    .orderBy(desc(snapshot.takenAt))
    .limit(1);
  if (!latest) return null;

  const [ratings, weights, units, areas, savedRaw] = await Promise.all([
    db.select().from(rating).where(eq(rating.snapshotId, latest.id)),
    db.select().from(unitWeight).where(eq(unitWeight.snapshotId, latest.id)),
    db.select().from(lifeUnit),
    db.select().from(lifeArea),
    getSetting(ORDER_KEY),
  ]);

  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const unitRow = new Map(units.map((u) => [u.id, u]));
  const weightRow = new Map(weights.map((w) => [w.unitId, w]));

  const byId = new Map<string, RankedUnit>();
  for (const r of ratings) {
    const u = unitRow.get(r.unitId);
    if (!u) continue;
    const w = weightRow.get(r.unitId);
    byId.set(r.unitId, {
      unitId: r.unitId,
      name: u.name,
      areaId: u.areaId,
      areaName: areaName.get(u.areaId) ?? "",
      includeInScoring: w != null,
      satisfaction: r.satisfaction,
      weight: w ? Math.round(w.override ?? w.derived) : null,
      derived: w ? Math.round(w.derived) : null,
      overridden: w?.override != null,
    });
  }

  /* Default order is the snapshot's own: importance descending, which
   * is exactly the rank the diagnostic produced. A saved manual order
   * wins, but only for the snapshot it was made against. */
  let order = [...ratings]
    .sort((a, b) => b.importance - a.importance)
    .map((r) => r.unitId);
  let reordered = false;

  const saved = parseSavedOrder(savedRaw);
  if (saved && saved.snapshotId === latest.id) {
    // Reconcile rather than trust: the taxonomy sync can archive or add
    // units between the save and now, and a stale id would corrupt the
    // rank denominator.
    const known = new Set(order);
    const kept = saved.order.filter((id) => known.has(id));
    const missing = order.filter((id) => !kept.includes(id));
    order = [...kept, ...missing];
    reordered = true;
  }

  return {
    snapshotId: latest.id,
    order,
    byId,
    reordered,
  };
}

function parseSavedOrder(
  raw: string | null,
): { snapshotId: string; order: string[] } | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "snapshotId" in parsed &&
      "order" in parsed &&
      Array.isArray((parsed as { order: unknown }).order)
    ) {
      return parsed as { snapshotId: string; order: string[] };
    }
  } catch {
    // A corrupt setting falls back to the snapshot's own order.
  }
  return null;
}

/*
 * There was an `orderFromAreaOrder` here, backing an "Areas" tab that
 * moved whole areas as blocks. **It destroyed data and has been
 * removed.**
 *
 * The unit list is a flat order and deliberately allows interleaving —
 * Health, Work, Health, Friends — which is what the diagnostic's own
 * final review produces and what `finalOrder` treats as the source of
 * truth. Regrouping that into contiguous area blocks, which any
 * area-level move must do, silently discarded every cross-area
 * decision the user had made.
 *
 * The two representations cannot both be authoritative, and the flat
 * one is the one that determines weights. If area-level moves come
 * back, they need a genuinely hierarchical model — area order and
 * within-area order stored separately, composed by
 * `combineHierarchicalRank` — which also means giving up interleaving.
 * That is a product decision, not a UI convenience.
 */

/**
 * The weights a given order would produce. The maths lives in
 * `@glide/scoring` (`weightsForPriorityOrder`) so the rank-denominator
 * rule it depends on is covered by tests; this only adapts the board.
 */
export function weightsForOrder(
  board: RankingBoard,
  order: readonly string[],
): Map<string, number> {
  const scored = new Set<string>();
  for (const [unitId, u] of board.byId) {
    if (u.includeInScoring) scored.add(unitId);
  }

  return new Map(
    weightsForPriorityOrder({ order, scored }).map((w) => [w.unitId, w.weight]),
  );
}

/**
 * Commits a new priority order: writes the resulting weights to
 * `unit_weight.override`, remembers the order, and refreshes every
 * task's denormalized points.
 *
 * That last step is not optional — `loadPlan` and `loadDay` read the
 * stored `task.point_value`, so weights that change without a
 * recompute leave the checklist scoring against the old plan.
 */
export async function applyPriorityOrder(
  board: RankingBoard,
  order: readonly string[],
): Promise<void> {
  const weights = weightsForOrder(board, order);

  await db.transaction(async (tx) => {
    for (const [unitId, weight] of weights) {
      await tx
        .update(unitWeight)
        .set({ override: weight })
        .where(
          and(
            eq(unitWeight.snapshotId, board.snapshotId),
            eq(unitWeight.unitId, unitId),
          ),
        );
    }
    await recomputeAllUnitPoints(tx);
  });

  // Outside the transaction: `cacheDayScore` re-enters through `loadDay`
  // on the live connection, so it cannot run on `tx`.
  await recacheAllDayScores();

  await setSetting(
    ORDER_KEY,
    JSON.stringify({ snapshotId: board.snapshotId, order: [...order] }),
  );
}

/** Drops every override, returning to what the diagnostic derived. */
export async function resetToDiagnostic(board: RankingBoard): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(unitWeight)
      .set({ override: null })
      .where(eq(unitWeight.snapshotId, board.snapshotId));
    await recomputeAllUnitPoints(tx);
  });
  await recacheAllDayScores();
  await setSetting(ORDER_KEY, "");
}
