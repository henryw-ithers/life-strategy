/**
 * Creating, editing, archiving and deleting commitments and pools
 * (ADR-0035, ADR-0033).
 *
 * Everything here is reversible and nothing here is silent. The two
 * rules the schema cannot express — **two levels only**, and **at most
 * three commitments** — are enforced at this seam, which is why every
 * write goes through it rather than touching the tables directly.
 */
import { rebalanceShares } from "@glide/scoring";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import type { PaletteKey } from "../theme/palette";
import { db } from "./client";
import {
  assertPoolSize,
  canAddCommitment,
  MAX_POOL_MEMBERS,
  type PoolValidationInput,
  findGeneral,
  GENERAL_SUB_NAME,
  homeOnSplit,
} from "./commitmentPlan";
import { lifeUnit, pool, poolMember, task, taskUnit } from "./schema";
import { forgetPinsOf } from "./pins";
import { markGradesStaleIn, writeAndMarkStale } from "./settings";
import { forgetSkipsOf } from "./skips";
import { recomputeAllUnitPoints, setTaskUnitsIn, type Tx } from "./tasks";

const newId = () => Crypto.randomUUID();

/**
 * The area a commitment is filed under, for colour and grouping only.
 *
 * ADR-0021's rule applies unchanged: an area may decide colour,
 * grouping and sort order, and never a weight, rank or stored score.
 */
const COMMITMENT_AREA = "work-money";

// ── Commitments ─────────────────────────────────────────────────────

export interface CreateCommitmentInput {
  name: string;
  /**
   * What percent of the commitment band this one takes. The others are
   * scaled into the rest, keeping their proportions (`rebalanceShares`).
   * Ignored for a first commitment, which takes all of it.
   */
  percent?: number;
  /** Split into sub-commitments from the start (ADR-0035 §1). */
  usesSubCommitments?: boolean;
}

/**
 * Create a commitment.
 *
 * Refuses a fourth (ADR-0035 §1). The cap is the app having an opinion,
 * and a narrow one: sub-commitments are uncapped, so a semester of any
 * size still fits.
 */
export async function createCommitment(
  input: CreateCommitmentInput,
): Promise<string> {
  const id = newId();
  // The cap is read inside the transaction, so two quick taps can't both
  // pass it: the second one's transaction sees the first's commitment.
  writeAndMarkStale((tx) => {
    const existing = tx
      .select({ id: lifeUnit.id, parentUnitId: lifeUnit.parentUnitId })
      .from(lifeUnit)
      .where(and(eq(lifeUnit.isCustom, true), isNull(lifeUnit.archivedAt)))
      .all();
    if (!canAddCommitment(existing)) {
      throw new Error(
        `At most three commitments (ADR-0035 §1); archive one to add another.`,
      );
    }

    const [{ next } = { next: 0 }] = tx
      .select({ next: sql<number>`coalesce(max(${lifeUnit.sortOrder}), 0) + 1` })
      .from(lifeUnit)
      .all();
    const others = liveCommitmentShares(tx);
    const shares = rebalanceShares(
      others,
      input.percent ?? Math.round(100 / (others.length + 1)),
    );
    tx.insert(lifeUnit)
      .values({
        id,
        areaId: COMMITMENT_AREA,
        name: input.name.trim(),
        sortOrder: next,
        isCustom: true,
        // A commitment is scored from its own band, never from the 18's
        // pool, so it takes no share of the diagnostic's 100.
        includeInScoring: false,
        commitmentShare: shares.self,
        usesSubCommitments: input.usesSubCommitments ?? false,
      })
      .run();
    for (const o of shares.others) {
      tx.update(lifeUnit).set({ commitmentShare: o.share }).where(eq(lifeUnit.id, o.id)).run();
    }
    // Made split, it starts with its General sub-commitment.
    if (input.usesSubCommitments) createSubCommitmentIn(tx, id, GENERAL_SUB_NAME);
  });
  return id;
}

/**
 * Create a sub-commitment inside a commitment.
 *
 * Refuses a third level: a sub-commitment may not itself be a parent
 * (ADR-0035 §1). The schema cannot express that, so it is checked here.
 */
export async function createSubCommitment(
  parentId: string,
  name: string,
): Promise<string> {
  return db.transaction((tx) => createSubCommitmentIn(tx, parentId, name));
}

/** `createSubCommitment` inside a caller's transaction. */
function createSubCommitmentIn(tx: Tx, parentId: string, name: string): string {
  const [parent] = tx
    .select()
    .from(lifeUnit)
    .where(eq(lifeUnit.id, parentId))
    .all();
  if (!parent) throw new Error(`No such commitment: ${parentId}`);
  if (parent.parentUnitId !== null) {
    throw new Error(
      `Commitments are two levels only (ADR-0035 §1): ` +
        `"${parent.name}" is already a sub-commitment.`,
    );
  }

  // Adding a sub-commitment is splitting the commitment, whatever the
  // switch said before.
  if (!parent.usesSubCommitments) {
    tx.update(lifeUnit)
      .set({ usesSubCommitments: true })
      .where(eq(lifeUnit.id, parentId))
      .run();
  }

  const id = newId();
  const [{ next } = { next: 0 }] = tx
    .select({ next: sql<number>`coalesce(max(${lifeUnit.sortOrder}), 0) + 1` })
    .from(lifeUnit)
    .all();
  tx.insert(lifeUnit)
    .values({
      id,
      areaId: parent.areaId,
      name: name.trim(),
      sortOrder: next,
      isCustom: true,
      includeInScoring: false,
      // Sub-commitments price nothing — the band divides across tasks.
      commitmentShare: null,
      parentUnitId: parentId,
    })
    .run();
  return id;
}

export interface UpdateCommitmentInput {
  name?: string;
  /**
   * Percent of the band this commitment takes; the others are scaled
   * into the rest. Only meaningful on a commitment; ignored on a
   * sub-commitment.
   */
  percent?: number;
}

/** Live commitments' shares — what a new or changed percentage is
 *  balanced against. */
function liveCommitmentShares(tx: Tx, exceptId?: string): { id: string; share: number }[] {
  const rows = tx
    .select({ id: lifeUnit.id, share: lifeUnit.commitmentShare })
    .from(lifeUnit)
    .where(
      and(
        eq(lifeUnit.isCustom, true),
        isNull(lifeUnit.archivedAt),
        isNull(lifeUnit.parentUnitId),
      ),
    )
    .all();
  return rows
    .filter((r) => r.share !== null && r.id !== exceptId)
    .map((r) => ({ id: r.id, share: r.share ?? 0 }));
}

/** Rename a commitment or sub-commitment, or change its band share. */
export async function updateCommitment(
  id: string,
  input: UpdateCommitmentInput,
): Promise<void> {
  db.transaction((tx) => {
    const [row] = tx.select().from(lifeUnit).where(eq(lifeUnit.id, id)).all();
    if (!row) throw new Error(`No such unit: ${id}`);

    const patch: { name?: string; commitmentShare?: number } = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    // A share on a sub-commitment would be a stored number that does
    // nothing, which is worse than ignoring the argument: sub-commitments
    // price nothing (ADR-0035 §1).
    const others =
      input.percent !== undefined && row.parentUnitId === null && row.archivedAt === null
        ? rebalanceShares(liveCommitmentShares(tx, id), input.percent)
        : null;
    if (others) patch.commitmentShare = others.self;
    // Nothing to change, so nothing to mark.
    if (Object.keys(patch).length === 0) return;
    tx.update(lifeUnit).set(patch).where(eq(lifeUnit.id, id)).run();
    for (const o of others?.others ?? []) {
      tx.update(lifeUnit).set({ commitmentShare: o.share }).where(eq(lifeUnit.id, o.id)).run();
    }
    markGradesStaleIn(tx);
  });
}

/**
 * Split a commitment into sub-commitments, or fold them back in
 * (ADR-0035 §1 as amended 2026-10-02). The work always survives:
 *
 * - **On:** the commitment holds no work of its own while split, so any
 *   it has moves into its sub-commitment called General, made if it is
 *   not there, which can be renamed or deleted like any other.
 * - **Off:** every live sub-commitment's work moves up onto the
 *   commitment, remembering where it came from, and the sub-commitments
 *   are **archived**, not deleted.
 * - **On again** restores them and sends each task back to the one it
 *   came from.
 *
 * A task keeps every tag it had; only its home changes.
 */
export async function setUsesSubCommitments(id: string, on: boolean): Promise<void> {
  // One transaction, so a failure part way never leaves the work split
  // between the commitment and its sub-commitments.
  db.transaction((tx) => {
    const [row] = tx.select().from(lifeUnit).where(eq(lifeUnit.id, id)).all();
    if (!row) throw new Error(`No such commitment: ${id}`);
    if (row.parentUnitId !== null) {
      throw new Error("A sub-commitment cannot be split again (ADR-0035 §1).");
    }
    if (on) splitCommitment(tx, id, row.archivedAt === null);
    else unsplitCommitment(tx, id);
  });
}

function splitCommitment(tx: Tx, id: string, live: boolean): void {
  // Bring back the sub-commitments the switch put away (Henry,
  // 2026-10-02: "turning the switch on should auto restore archived
  // sub commitments"). A live commitment's archived sub-commitments
  // can only have been archived by the switch — finishing archives
  // the commitment with them, and starting it again restores both.
  if (live) {
    tx.update(lifeUnit)
      .set({ archivedAt: null })
      .where(and(eq(lifeUnit.parentUnitId, id), isNotNull(lifeUnit.archivedAt)))
      .run();
  }
  const subs = tx
    .select({ id: lifeUnit.id, name: lifeUnit.name })
    .from(lifeUnit)
    .where(and(eq(lifeUnit.parentUnitId, id), isNull(lifeUnit.archivedAt)))
    .all();
  const liveIds = new Set(subs.map((s) => s.id));
  // A split commitment always has its General (reused if it is still
  // there), which is where work with no other home goes.
  const general = findGeneral(subs) ?? createSubCommitmentIn(tx, id, GENERAL_SUB_NAME);

  // Each task goes back where it came from; anything added while the
  // commitment was unsplit goes to General.
  const own = tx
    .select({ id: task.id, movedFrom: task.movedFromUnitId })
    .from(task)
    .where(and(eq(task.unitId, id), eq(task.active, true)))
    .all();
  for (const t of own) {
    const to = homeOnSplit(t.movedFrom, liveIds) ?? general;
    rehomeTask(tx, t.id, id, to);
    tx.update(task).set({ movedFromUnitId: null }).where(eq(task.id, t.id)).run();
  }
  tx.update(lifeUnit).set({ usesSubCommitments: true }).where(eq(lifeUnit.id, id)).run();
}

function unsplitCommitment(tx: Tx, id: string): void {
  const subs = tx
    .select({ id: lifeUnit.id })
    .from(lifeUnit)
    .where(and(eq(lifeUnit.parentUnitId, id), isNull(lifeUnit.archivedAt)))
    .all();
  for (const sub of subs) {
    for (const taskId of activeTaskIdsIn(tx, sub.id)) {
      rehomeTask(tx, taskId, sub.id, id);
      // Remembered, so turning sub-commitments back on returns it.
      tx.update(task).set({ movedFromUnitId: sub.id }).where(eq(task.id, taskId)).run();
    }
  }
  const now = new Date().toISOString();
  if (subs.length > 0) {
    tx.update(lifeUnit)
      .set({ archivedAt: now })
      .where(inArray(lifeUnit.id, subs.map((s) => s.id)))
      .run();
  }
  tx.update(lifeUnit).set({ usesSubCommitments: false }).where(eq(lifeUnit.id, id)).run();
}

/** Active tasks homed in a unit. */
function activeTaskIdsIn(tx: Tx, unitId: string): string[] {
  return tx
    .select({ id: task.id })
    .from(task)
    .where(and(eq(task.unitId, unitId), eq(task.active, true)))
    .all()
    .map((r) => r.id);
}

/** Move a task's home from one unit to another, keeping its tags. */
function rehomeTask(tx: Tx, taskId: string, from: string, to: string): void {
  const memberships = tx
    .select({ unitId: taskUnit.unitId })
    .from(taskUnit)
    .where(eq(taskUnit.taskId, taskId))
    .all();
  const tags = memberships.map((m) => m.unitId).filter((u) => u !== from && u !== to);
  setTaskUnitsIn(tx, taskId, [to, ...tags]);
}

/**
 * Archive a commitment — the ordinary end (ADR-0035 §1).
 *
 * The weight returns to the pool, past snapshots keep the unit, and the
 * log still shows the semester happened. Sub-commitments go with it,
 * and their tasks are deactivated rather than deleted: **the work
 * outlives the scaffolding**, the same principle ADR-0007's deletion
 * amendment applies to goals.
 *
 * Reversible by `unarchiveCommitment`.
 */
export async function archiveCommitment(id: string): Promise<void> {
  const now = new Date().toISOString();
  const ids = subtreeIds(db, id);
  const taskRows = await db.select({ id: task.id }).from(task).where(inArray(task.unitId, ids));
  db.transaction((tx) => {
    // Its tasks are archived, so their pins go (windows-and-pins §2.11).
    forgetPinsOf(tx, taskRows.map((t) => t.id));
    tx.update(lifeUnit)
      .set({ archivedAt: now })
      .where(inArray(lifeUnit.id, ids))
      .run();
    tx.update(task)
      .set({ active: false, archivedAt: now })
      .where(inArray(task.unitId, ids))
      .run();
    recomputeAllUnitPoints(tx);
  });
}

/**
 * Put an archived commitment back, with its sub-commitments **and the
 * tasks finishing it paused**.
 *
 * It used to restore the units and leave every task inactive, while the
 * screen told you "its tasks come back". Only the tasks archived *by
 * finishing* return — found by the timestamp that pass stamped on the
 * commitment and its tasks alike — so a task you had archived on its
 * own before finishing the commitment stays archived, as you left it.
 */
export async function unarchiveCommitment(id: string): Promise<void> {
  const ids = subtreeIds(db, id);
  const [row] = await db
    .select({ archivedAt: lifeUnit.archivedAt })
    .from(lifeUnit)
    .where(eq(lifeUnit.id, id));
  const finishedAt = row?.archivedAt ?? null;
  db.transaction((tx) => {
    tx.update(lifeUnit)
      .set({ archivedAt: null })
      .where(inArray(lifeUnit.id, ids))
      .run();
    if (finishedAt !== null) {
      tx.update(task)
        .set({ active: true, archivedAt: null })
        .where(and(inArray(task.unitId, ids), eq(task.archivedAt, finishedAt)))
        .run();
    }
    recomputeAllUnitPoints(tx);
  });
}

/**
 * Delete a commitment outright, with its sub-commitments and their
 * tasks.
 *
 * **Archiving is the honest end for a commitment you actually held**,
 * and it is what the UI should lead with. This exists for the other
 * case — the mistyped one, the duplicate, the one made while working
 * out how the app works — which ADR-0007's amendment made the argument
 * for on goals, in the same words: refusing to remove those does not
 * protect a record, it accumulates clutter.
 *
 * What survives, deliberately:
 *
 * - **Completions and grades.** A day that scored 63 still scored 63;
 *   `points_earned` is denormalized at completion (ADR-0002) and
 *   deleting a commitment must not quietly rewrite a month.
 * - **Achievements**, detached, exactly as `deleteGoal` leaves them.
 *
 * Returns what it removed so the caller can say so plainly rather than
 * claiming more or less than happened.
 */
export async function deleteCommitment(
  id: string,
): Promise<{ units: number; tasks: number; pools: number }> {
  // What it reads to decide what to delete — whether this is the last
  // sub-commitment, the subtree, its tasks — is read in the same
  // transaction as the delete, so a change made meanwhile can't be
  // missed. Its days lose their work, so grades are marked stale here
  // too, as `removeLastSub` always has, rather than relying on the
  // pricing pass to do it.
  return writeAndMarkStale((tx) => {
    if (isLastSub(tx, id)) return removeLastSub(tx, id);
    const ids = subtreeIds(tx, id);
    const taskIds = tx
      .select({ id: task.id })
      .from(task)
      .where(inArray(task.unitId, ids))
      .all()
      .map((t) => t.id);

    let pools = 0;
    if (taskIds.length > 0) {
      // Pools first: they reference tasks, and a pool left holding a
      // deleted task is a window that cannot render.
      const poolRows = tx
        .select({ poolId: poolMember.poolId })
        .from(poolMember)
        .where(inArray(poolMember.taskId, taskIds))
        .all();
      const poolIds = [...new Set(poolRows.map((p) => p.poolId))];
      if (poolIds.length > 0) {
        tx.delete(poolMember).where(inArray(poolMember.poolId, poolIds)).run();
        tx.delete(pool).where(inArray(pool.id, poolIds)).run();
        pools = poolIds.length;
      }
      // A pool cued to one of these tasks loses its anchor, not its
      // existence: it falls back to a part-of-day window.
      tx.update(pool)
        .set({ afterTaskId: null })
        .where(inArray(pool.afterTaskId, taskIds))
        .run();

      // Pins, choices and skips reference these tasks too.
      forgetPinsOf(tx, taskIds);
      forgetSkipsOf(tx, taskIds);
      tx.delete(taskUnit).where(inArray(taskUnit.taskId, taskIds)).run();
      tx.delete(task).where(inArray(task.id, taskIds)).run();
    }
    // A skipped commitment week names the unit itself.
    forgetSkipsOf(tx, [], ids);
    // Children before parents, inside the table as well as between.
    tx.delete(lifeUnit)
      .where(
        and(inArray(lifeUnit.id, ids), eq(lifeUnit.isCustom, true), sql`${lifeUnit.parentUnitId} is not null`),
      )
      .run();
    tx.delete(lifeUnit).where(inArray(lifeUnit.id, ids)).run();
    recomputeAllUnitPoints(tx);
    return { units: ids.length, tasks: taskIds.length, pools };
  });
}

/** Whether `id` is a sub-commitment with no live sibling. */
function isLastSub(tx: Tx, id: string): boolean {
  const [row] = tx.select().from(lifeUnit).where(eq(lifeUnit.id, id)).all();
  if (!row?.parentUnitId) return false;
  const siblings = tx
    .select({ id: lifeUnit.id })
    .from(lifeUnit)
    .where(and(eq(lifeUnit.parentUnitId, row.parentUnitId), isNull(lifeUnit.archivedAt)))
    .all();
  return siblings.every((s) => s.id === id);
}

/**
 * Remove a commitment's last sub-commitment: its work moves back onto
 * the commitment, which holds its own work again (ADR-0044 §7, the
 * restore rule of ADR-0035 §1). Nothing is deleted but the
 * sub-commitment itself. Archived tasks move too, so restoring one
 * later finds it a home.
 */
function removeLastSub(tx: Tx, id: string): { units: number; tasks: number; pools: number } {
  const [row] = tx.select().from(lifeUnit).where(eq(lifeUnit.id, id)).all();
  const parent = row?.parentUnitId;
  if (!parent) throw new Error(`Not a sub-commitment: ${id}`);
  const tasks = tx.select({ id: task.id }).from(task).where(eq(task.unitId, id)).all();
  for (const t of tasks) {
    rehomeTask(tx, t.id, id, parent);
    tx.update(task).set({ movedFromUnitId: null }).where(eq(task.id, t.id)).run();
  }
  // Anything still pointing at it: remembered homes and tagged notes.
  tx.update(task).set({ movedFromUnitId: null }).where(eq(task.movedFromUnitId, id)).run();
  tx.delete(taskUnit).where(eq(taskUnit.unitId, id)).run();
  forgetSkipsOf(tx, [], [id]);
  tx.update(lifeUnit).set({ usesSubCommitments: false }).where(eq(lifeUnit.id, parent)).run();
  tx.delete(lifeUnit).where(eq(lifeUnit.id, id)).run();
  recomputeAllUnitPoints(tx);
  return { units: 1, tasks: 0, pools: 0 };
}

/** A commitment and its sub-commitments, as ids. */
function subtreeIds(executor: Tx | typeof db, id: string): string[] {
  const children = executor
    .select({ id: lifeUnit.id })
    .from(lifeUnit)
    .where(eq(lifeUnit.parentUnitId, id))
    .all();
  return [id, ...children.map((c) => c.id)];
}

// ── Pools ───────────────────────────────────────────────────────────

export interface CreatePoolInput {
  localDate: string;
  taskIds: string[];
  plannedCount?: number;
  /** The block this window follows — the cue (ADR-0036 §3). */
  afterTaskId?: string | null;
  partOfDay?: "morning" | "afternoon" | "evening" | null;
}

/**
 * Create a pool in a window.
 *
 * Refuses more than three members, and refuses a task already pooled in
 * the same window: without that, *"every completion pays in full"*
 * could be read as ticking one task twice (ADR-0033 §3).
 */
export async function createPool(input: CreatePoolInput): Promise<string> {
  const id = newId();
  writeAndMarkStale((tx) => {
    const existing = poolsInWindow(
      tx,
      input.localDate,
      input.afterTaskId ?? null,
      input.partOfDay ?? null,
    );
    assertPoolSize(validationInput(input, existing));
    tx.insert(pool)
      .values({
        id,
        localDate: input.localDate,
        afterTaskId: input.afterTaskId ?? null,
        partOfDay: input.partOfDay ?? null,
        plannedCount: Math.max(
          1,
          Math.min(input.plannedCount ?? 1, input.taskIds.length),
        ),
      })
      .run();
    tx.insert(poolMember)
      .values(input.taskIds.map((taskId, i) => ({ poolId: id, taskId, sortOrder: i })))
      .run();
  });
  return id;
}

/** Change a pool's membership or planned count. */
export async function updatePool(
  id: string,
  input: { taskIds?: string[]; plannedCount?: number },
): Promise<void> {
  const [row] = await db.select().from(pool).where(eq(pool.id, id));
  if (!row) throw new Error(`No such pool: ${id}`);

  writeAndMarkStale((tx) => {
    let members = input.taskIds;
    if (members) {
      const others = poolsInWindow(tx, row.localDate, row.afterTaskId, row.partOfDay).filter(
        (p) => p.poolId !== id,
      );
      assertPoolSize({ taskIds: members, existing: others });
      tx.delete(poolMember).where(eq(poolMember.poolId, id)).run();
      tx.insert(poolMember)
        .values(members.map((taskId, i) => ({ poolId: id, taskId, sortOrder: i })))
        .run();
    } else {
      const rows = tx
        .select({ taskId: poolMember.taskId })
        .from(poolMember)
        .where(eq(poolMember.poolId, id))
        .all();
      members = rows.map((r) => r.taskId);
    }
    if (input.plannedCount !== undefined) {
      tx.update(pool)
        .set({
          plannedCount: Math.max(
            1,
            Math.min(input.plannedCount, members.length || 1),
          ),
        })
        .where(eq(pool.id, id))
        .run();
    }
  });
}

/**
 * Delete a pool. Its members are **not** deleted — a pool is a grouping
 * on a window, and dissolving it leaves three ordinary tasks rather
 * than destroying them.
 */
export async function deletePool(id: string): Promise<void> {
  writeAndMarkStale((tx) => {
    tx.delete(poolMember).where(eq(poolMember.poolId, id)).run();
    tx.delete(pool).where(eq(pool.id, id)).run();
  });
}

/** Remove one task from a pool, dissolving the pool if it empties. */
export async function removeFromPool(
  poolId: string,
  taskId: string,
): Promise<void> {
  writeAndMarkStale((tx) => {
    tx.delete(poolMember)
      .where(and(eq(poolMember.poolId, poolId), eq(poolMember.taskId, taskId)))
      .run();
    const left = tx
      .select({ taskId: poolMember.taskId })
      .from(poolMember)
      .where(eq(poolMember.poolId, poolId))
      .all();
    if (left.length === 0) {
      tx.delete(pool).where(eq(pool.id, poolId)).run();
      return;
    }
    // A planned count above what is left would divide the band by more
    // slots than the pool can fill.
    tx.update(pool)
      .set({ plannedCount: sql`min(${pool.plannedCount}, ${left.length})` })
      .where(eq(pool.id, poolId))
      .run();
  });
}

/** Every pool in one window, with its members. */
function poolsInWindow(
  tx: Tx,
  localDate: string,
  afterTaskId: string | null,
  partOfDay: string | null,
): { poolId: string; taskIds: string[] }[] {
  const rows = tx
    .select()
    .from(pool)
    .where(eq(pool.localDate, localDate))
    .all();
  const here = rows.filter(
    (p) => p.afterTaskId === afterTaskId && p.partOfDay === partOfDay,
  );
  if (here.length === 0) return [];
  const members = tx
    .select()
    .from(poolMember)
    .where(inArray(poolMember.poolId, here.map((p) => p.id)))
    .all();
  return here.map((p) => ({
    poolId: p.id,
    taskIds: members.filter((m) => m.poolId === p.id).map((m) => m.taskId),
  }));
}

function validationInput(
  input: CreatePoolInput,
  existing: { poolId: string; taskIds: string[] }[],
): PoolValidationInput {
  return { taskIds: input.taskIds, existing };
}

export { MAX_POOL_MEMBERS };

// ── Colour ──────────────────────────────────────────────────────────

/**
 * Give a unit or commitment its own colour from the palette, or null to
 * go back to its area's (ADR-0043 §4).
 *
 * Unlike every other write here, this does **not** mark grades stale:
 * colour is presentation only and can never change a score (ADR-0021).
 */
export async function setUnitColour(id: string, colour: PaletteKey | null): Promise<void> {
  await db.update(lifeUnit).set({ colour }).where(eq(lifeUnit.id, id));
}
