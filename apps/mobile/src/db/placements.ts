/**
 * Day placements (ADR-0024 §1, phase 3): putting a task in a part of
 * **one day** without changing the task — the "just for today" half of
 * the move prompt; the permanent half is `setTaskPartOfDay` in
 * `db/tasks.ts`.
 *
 * **A placement is an intention, not an obligation** (ADR-0024 §2).
 * Nothing here reaches the grade, no adherence statistic is derived
 * from it, and an unfulfilled placement simply lapses — it is not
 * surfaced, not counted, and never mentioned again.
 *
 * One row per task per day: placing twice replaces rather than
 * accumulates, so a day cannot end up with a task in two slots.
 */
import { and, eq, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { plannedOccurrence } from "./schema";
import type { Tx } from "./tasks";

/**
 * Put a task in a part of `date`, for that day only.
 *
 * **A null `partOfDay` is a placement, not the absence of one.** It
 * means "today, this one is Anytime" — a destination the checklist
 * offers like any other, and the reason a row is written rather than
 * skipped. Writing nothing used to look identical to having no
 * override at all, so dragging a morning task into Anytime and
 * choosing "just today" deleted the row, fell back to the task's own
 * `part_of_day`, and put it straight back under Morning while the
 * confirmation said it had moved.
 *
 * To remove an override, call `clearPlacementForDay` — the two are
 * different intentions and now have different functions.
 */
export async function placeTaskForDay(
  taskId: string,
  date: string,
  partOfDay: "morning" | "afternoon" | "evening" | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await deletePlacement(tx, taskId, date);
    await tx.insert(plannedOccurrence).values({
      id: Crypto.randomUUID(),
      taskId,
      localDate: date,
      partOfDay,
    });
  });
}

/** Drop the day's override so the task returns to its own schedule. */
export async function clearPlacementForDay(
  taskId: string,
  date: string,
): Promise<void> {
  await deletePlacement(db, taskId, date);
}

/** Scoped to live rows, matching what `loadPlacements` reads back: an
 *  archived row belongs to an archived task and is a record, not an
 *  override in play. */
async function deletePlacement(
  tx: Tx | typeof db,
  taskId: string,
  date: string,
): Promise<void> {
  await tx
    .delete(plannedOccurrence)
    .where(
      and(
        eq(plannedOccurrence.taskId, taskId),
        eq(plannedOccurrence.localDate, date),
        isNull(plannedOccurrence.archivedAt),
      ),
    );
}

/**
 * The day's overrides, keyed by task.
 *
 * **Presence is the override; the value is where it went.** A key
 * mapped to null means the task was explicitly placed in Anytime for
 * this day, which is why callers must ask `has()` before `get()` —
 * reading `get() ?? task.partOfDay` treats a deliberate Anytime as no
 * placement at all and sends the row back to its usual slot.
 */
export async function loadPlacements(
  date: string,
): Promise<Map<string, "morning" | "afternoon" | "evening" | null>> {
  const rows = await db
    .select()
    .from(plannedOccurrence)
    .where(
      and(
        eq(plannedOccurrence.localDate, date),
        isNull(plannedOccurrence.archivedAt),
      ),
    );
  return new Map(rows.map((r) => [r.taskId, r.partOfDay]));
}
