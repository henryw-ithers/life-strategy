/**
 * Put units in tiers for a test, in Priorities order, and reprice the
 * plan: what saving Priorities does to the plan, without the snapshot.
 * Units listed as Not now leave the plan.
 */
import type { Tier } from "@glide/scoring";
import { eq } from "drizzle-orm";

import { db } from "../client";
import { lifeUnit } from "../schema";
import { recomputeAllUnitPoints } from "../tasks";
import { tierOrderOf } from "../tierRules";

export function placeTiers(placement: readonly [unitId: string, tier: Tier][]): void {
  const order = tierOrderOf(placement.map(([unitId, tier]) => ({ unitId, tier })));
  db.transaction((tx) => {
    for (const [unitId, tier] of placement) {
      tx.update(lifeUnit)
        .set({ tier, tierOrder: order.get(unitId) ?? 0, includeInScoring: tier !== "notNow" })
        .where(eq(lifeUnit.id, unitId))
        .run();
    }
    recomputeAllUnitPoints(tx);
  });
}
