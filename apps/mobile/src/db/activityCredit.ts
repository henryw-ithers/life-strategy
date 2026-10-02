/**
 * What a logged activity is worth (ADR-0009, as resized by ADR-0023 and
 * ADR-0029): a share of each tagged unit's weight, drawn from the
 * unplanned pool — or, on a rest day, from its wider one (ADR-0037).
 * Kept apart from the activity writes so the day-grade cache can
 * re-price credit without depending on them.
 */
import { REST_DAY_UNPLANNED, UNPLANNED_BAND } from "@glide/scoring";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "./client";
import { activity, activityTag, lifeUnit } from "./schema";
import { latestWeights } from "./tasks";

export type ActivitySize = "quick" | "normal" | "big";

export const SIZE_RATE: Record<ActivitySize, number> = {
  quick: 0.25,
  normal: 0.5,
  big: 1,
};

/**
 * A unit's notional day-rate for a logged activity (ADR-0023 §1, as
 * resized by ADR-0029 §2): `UNPLANNED_BAND`'s own 10% of the unit's
 * weight. A "big" activity (rate 1) draws a tenth of that unit's
 * standing; a "quick" one a quarter of that. The band it draws from is
 * 10 rather than 20 now, because planned work stopped sharing it.
 *
 * Before formula v7 this was derived from a unit's actual tasks, so an
 * activity in a unit with no weekly commitment credited nothing.
 * Nothing amortizes against task frequency any more, so this needs only
 * a unit's weight — not its tasks — and an excluded unit (weight 0)
 * still credits nothing, unchanged.
 */
export async function unitVariableShares(
  /** The pool activities draw from: `UNPLANNED_BAND`, or
   *  `REST_DAY_UNPLANNED` on a rest day (ADR-0037 §2). */
  pool: number = UNPLANNED_BAND,
): Promise<Map<string, number>> {
  const units = await db.select().from(lifeUnit).where(isNull(lifeUnit.archivedAt));
  const weights = await latestWeights(db);
  const shares = new Map<string, number>();
  for (const u of units) {
    if (!u.includeInScoring) continue;
    shares.set(u.id, (pool / 100) * (weights.get(u.id) ?? 0));
  }
  return shares;
}

/**
 * Re-price a day's activities for the pool they now draw from.
 *
 * **A rest day's activities draw from 30, not 10, at three times the
 * rate** (ADR-0037 §2). At the ordinary rate a big activity in a
 * weight-8 unit earns one point, so a 30-point allowance would take
 * thirty activities to fill and the number would be decorative. The
 * rate follows the pool, so the same afternoon is worth the same share
 * of whichever pool it lands in.
 *
 * Whether a day is a rest day can change after something is logged —
 * a task added that is due today ends it — so credit is re-priced here,
 * on every edit to the day, rather than fixed at log time. Returns
 * whether anything moved.
 */
export async function recreditActivities(date: string, restDay: boolean): Promise<boolean> {
  const rows = await db.select().from(activity).where(eq(activity.localDate, date));
  if (rows.length === 0) return false;
  const tags = await db
    .select()
    .from(activityTag)
    .where(inArray(activityTag.activityId, rows.map((a) => a.id)));
  const shares = await unitVariableShares(restDay ? REST_DAY_UNPLANNED : UNPLANNED_BAND);
  let moved = false;
  for (const tag of tags) {
    const size = rows.find((a) => a.id === tag.activityId)?.size;
    const credit = Math.round((size ? SIZE_RATE[size] : 0) * (shares.get(tag.unitId) ?? 0));
    if (credit === tag.pointsCredited) continue;
    moved = true;
    await db
      .update(activityTag)
      .set({ pointsCredited: credit })
      .where(
        and(eq(activityTag.activityId, tag.activityId), eq(activityTag.unitId, tag.unitId)),
      );
  }
  return moved;
}
