/** Spontaneous activities (ADR-0009): logged, tagged to at most three
 *  units, and credited from the day's unplanned pool. */
import { eq } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { assertEditable } from "../lib/calendar";
import { SIZE_RATE, unitVariableShares, type ActivitySize } from "./activityCredit";
import { db } from "./client";
import { cacheDayScore } from "./dayGrades";
import { activity, activityTag } from "./schema";

/** Each tag's credit, at today's shares: read before the transaction,
 *  since that read is async and a transaction callback mustn't be. */
async function tagCredits(
  size: ActivitySize | null,
  unitIds: readonly string[],
): Promise<{ unitId: string; pointsCredited: number }[]> {
  const tags = unitIds.slice(0, 3);
  if (tags.length === 0) return [];
  const shares = await unitVariableShares();
  const rate = size ? SIZE_RATE[size] : 0;
  return tags.map((unitId) => ({
    unitId,
    pointsCredited: Math.round(rate * (shares.get(unitId) ?? 0)),
  }));
}

/** Log an activity with its tags, in one transaction: a failure can't
 *  leave an activity with no tags and no credit. */
export async function logActivity(
  date: string,
  title: string,
  note: string | null,
  size: ActivitySize | null,
  unitIds: string[],
): Promise<void> {
  assertEditable(date);
  const id = Crypto.randomUUID();
  const credits = await tagCredits(size, unitIds);
  db.transaction((tx) => {
    tx.insert(activity).values({ id, localDate: date, title, note, size }).run();
    for (const c of credits) tx.insert(activityTag).values({ activityId: id, ...c }).run();
  });
  await cacheDayScore(date);
}

export async function deleteActivity(activityId: string, date: string): Promise<void> {
  assertEditable(date);
  db.transaction((tx) => {
    tx.delete(activityTag).where(eq(activityTag.activityId, activityId)).run();
    tx.delete(activity).where(eq(activity.id, activityId)).run();
  });
  await cacheDayScore(date);
}

/** Edit a logged activity: tags are replaced and credit re-denormalized
 *  at current daily shares (the edit window is live; sealed days can't
 *  get here). One transaction, so a failed tag can't strip the rest. */
export async function updateActivity(
  activityId: string,
  date: string,
  title: string,
  note: string | null,
  size: ActivitySize | null,
  unitIds: string[],
): Promise<void> {
  assertEditable(date);
  const credits = await tagCredits(size, unitIds);
  db.transaction((tx) => {
    tx.update(activity).set({ title, note, size }).where(eq(activity.id, activityId)).run();
    tx.delete(activityTag).where(eq(activityTag.activityId, activityId)).run();
    for (const c of credits) tx.insert(activityTag).values({ activityId, ...c }).run();
  });
  await cacheDayScore(date);
}
