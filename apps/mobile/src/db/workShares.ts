/**
 * Effort share (ADR-0041 §5): each unit's share of the time spent on
 * completed work, read by Life. It was the weekly pass's "where last
 * week went" until the pass was removed (ADR-0052).
 *
 * **Shares of what you did, and nothing else**: no missed counts, no
 * percentage of the plan, no comparison with the week before (P15).
 */
import { workShares, type DoneWork } from "@glide/scoring";
import { and, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "./client";
import { activity, activityTag, lifeUnit, task, taskCompletion } from "./schema";
import { commitmentRoots } from "./windowRules";
import { activityMinutes, doneMinutes } from "./workShareRules";

/**
 * Each unit's share of the time spent on completed work from `start` to
 * `end` (ADR-0041 §5): ticks by size and fraction, events by length,
 * sized activities split across their tags. A commitment is one row,
 * its sub-commitments in it. Largest first; empty when nothing was
 * done. Life reads the last 4 weeks.
 */
export async function loadWorkShares(
  start: string,
  end: string,
): Promise<{ unitId: string; name: string; areaId: string; share: number }[]> {
  const [units, ticks, acts] = await Promise.all([
    db
      .select({
        id: lifeUnit.id,
        name: lifeUnit.name,
        areaId: lifeUnit.areaId,
        parentUnitId: lifeUnit.parentUnitId,
        isCustom: lifeUnit.isCustom,
        commitmentShare: lifeUnit.commitmentShare,
      })
      .from(lifeUnit),
    db
      .select({
        unitId: task.unitId,
        kind: task.kind,
        size: task.size,
        oneOffSize: task.oneOffSize,
        startMinute: task.startMinute,
        endMinute: task.endMinute,
        fraction: taskCompletion.fraction,
      })
      .from(taskCompletion)
      .innerJoin(task, eq(task.id, taskCompletion.taskId))
      .where(and(gte(taskCompletion.localDate, start), lte(taskCompletion.localDate, end))),
    db
      .select({ id: activity.id, size: activity.size })
      .from(activity)
      .where(and(gte(activity.localDate, start), lte(activity.localDate, end))),
  ]);
  const tags = acts.length
    ? await db
        .select({ activityId: activityTag.activityId, unitId: activityTag.unitId })
        .from(activityTag)
        .where(inArray(activityTag.activityId, acts.map((a) => a.id)))
    : [];

  // A commitment's parts are filed under it: one row per commitment.
  const roots = commitmentRoots(units);
  const home = (unitId: string) => roots.get(unitId) ?? unitId;
  const done: DoneWork[] = [
    ...ticks.map((t) => ({
      unitId: home(t.unitId),
      minutes: doneMinutes({ ...t, size: t.size ?? t.oneOffSize }),
    })),
    ...acts.flatMap((a) =>
      activityMinutes(
        a.size,
        tags.filter((t) => t.activityId === a.id).map((t) => home(t.unitId)),
      ),
    ),
  ];
  const byId = new Map(units.map((u) => [u.id, u]));
  return workShares(done).map((s) => ({
    ...s,
    name: byId.get(s.unitId)?.name ?? s.unitId,
    areaId: byId.get(s.unitId)?.areaId ?? "",
  }));
}
