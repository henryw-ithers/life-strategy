/**
 * Creating, editing, archiving and deleting commitments and pools
 * (ADR-0029, ADR-0033).
 *
 * Everything here is reversible and nothing here is silent. The two
 * rules the schema cannot express — **two levels only**, and **at most
 * three commitments** — are enforced at this seam, which is why every
 * write goes through it rather than touching the tables directly.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import {
  assertPoolSize,
  canAddCommitment,
  MAX_POOL_MEMBERS,
  type PoolValidationInput,
} from "./commitmentPlan";
import { lifeUnit, pool, poolMember, task, taskUnit } from "./schema";
import { recomputeAllUnitPoints } from "./tasks";

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
  /** Relative share of the band. Defaults to an equal-ish 1. */
  share?: number;
}

/**
 * Create a commitment.
 *
 * Refuses a fourth (ADR-0029 §1). The cap is the app having an opinion,
 * and a narrow one: sub-commitments are uncapped, so a semester of any
 * size still fits.
 */
export async function createCommitment(
  input: CreateCommitmentInput,
): Promise<string> {
  const existing = await db
    .select({ id: lifeUnit.id, parentUnitId: lifeUnit.parentUnitId })
    .from(lifeUnit)
    .where(and(eq(lifeUnit.isCustom, true), isNull(lifeUnit.archivedAt)));
  if (!canAddCommitment(existing)) {
    throw new Error(
      `At most three commitments (ADR-0029 §1); archive one to add another.`,
    );
  }

  const id = newId();
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${lifeUnit.sortOrder}), 0) + 1` })
    .from(lifeUnit);
  await db.insert(lifeUnit).values({
    id,
    areaId: COMMITMENT_AREA,
    name: input.name.trim(),
    sortOrder: next,
    isCustom: true,
    // A commitment is scored from its own band, never from the 18's
    // pool, so it takes no share of the diagnostic's 100.
    includeInScoring: false,
    commitmentShare: input.share ?? 1,
  });
  return id;
}

/**
 * Create a sub-commitment inside a commitment.
 *
 * Refuses a third level: a sub-commitment may not itself be a parent
 * (ADR-0029 §1). The schema cannot express that, so it is checked here.
 */
export async function createSubCommitment(
  parentId: string,
  name: string,
): Promise<string> {
  const [parent] = await db
    .select()
    .from(lifeUnit)
    .where(eq(lifeUnit.id, parentId));
  if (!parent) throw new Error(`No such commitment: ${parentId}`);
  if (parent.parentUnitId !== null) {
    throw new Error(
      `Commitments are two levels only (ADR-0029 §1): ` +
        `"${parent.name}" is already a sub-commitment.`,
    );
  }

  const id = newId();
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${lifeUnit.sortOrder}), 0) + 1` })
    .from(lifeUnit);
  await db.insert(lifeUnit).values({
    id,
    areaId: parent.areaId,
    name: name.trim(),
    sortOrder: next,
    isCustom: true,
    includeInScoring: false,
    // Sub-commitments price nothing — the band divides across tasks.
    commitmentShare: null,
    parentUnitId: parentId,
  });
  return id;
}

export interface UpdateCommitmentInput {
  name?: string;
  /** Only meaningful on a commitment; ignored on a sub-commitment. */
  share?: number;
}

/** Rename a commitment or sub-commitment, or change its band share. */
export async function updateCommitment(
  id: string,
  input: UpdateCommitmentInput,
): Promise<void> {
  const [row] = await db.select().from(lifeUnit).where(eq(lifeUnit.id, id));
  if (!row) throw new Error(`No such unit: ${id}`);

  const patch: { name?: string; commitmentShare?: number } = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  // A share on a sub-commitment would be a stored number that does
  // nothing, which is worse than ignoring the argument: sub-commitments
  // price nothing (ADR-0029 §1).
  if (input.share !== undefined && row.parentUnitId === null) {
    patch.commitmentShare = input.share;
  }
  if (Object.keys(patch).length === 0) return;
  await db.update(lifeUnit).set(patch).where(eq(lifeUnit.id, id));
}

/**
 * Archive a commitment — the ordinary end (ADR-0029 §1).
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
  const ids = await subtreeIds(id);
  await db.transaction(async (tx) => {
    await tx
      .update(lifeUnit)
      .set({ archivedAt: now })
      .where(inArray(lifeUnit.id, ids));
    await tx
      .update(task)
      .set({ active: false, archivedAt: now })
      .where(inArray(task.unitId, ids));
    await recomputeAllUnitPoints(tx);
  });
}

/** Put an archived commitment back, with its sub-commitments. */
export async function unarchiveCommitment(id: string): Promise<void> {
  const ids = await subtreeIds(id);
  await db.transaction(async (tx) => {
    await tx
      .update(lifeUnit)
      .set({ archivedAt: null })
      .where(inArray(lifeUnit.id, ids));
    await recomputeAllUnitPoints(tx);
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
  const ids = await subtreeIds(id);
  const taskRows = await db
    .select({ id: task.id })
    .from(task)
    .where(inArray(task.unitId, ids));
  const taskIds = taskRows.map((t) => t.id);

  let pools = 0;
  await db.transaction(async (tx) => {
    if (taskIds.length > 0) {
      // Pools first: they reference tasks, and a pool left holding a
      // deleted task is a window that cannot render.
      const poolRows = await tx
        .select({ poolId: poolMember.poolId })
        .from(poolMember)
        .where(inArray(poolMember.taskId, taskIds));
      const poolIds = [...new Set(poolRows.map((p) => p.poolId))];
      if (poolIds.length > 0) {
        await tx.delete(poolMember).where(inArray(poolMember.poolId, poolIds));
        await tx.delete(pool).where(inArray(pool.id, poolIds));
        pools = poolIds.length;
      }
      // A pool cued to one of these tasks loses its anchor, not its
      // existence: it falls back to a part-of-day window.
      await tx
        .update(pool)
        .set({ afterTaskId: null })
        .where(inArray(pool.afterTaskId, taskIds));

      await tx.delete(taskUnit).where(inArray(taskUnit.taskId, taskIds));
      await tx.delete(task).where(inArray(task.id, taskIds));
    }
    // Children before parents, inside the table as well as between.
    await tx.delete(lifeUnit).where(
      and(inArray(lifeUnit.id, ids), eq(lifeUnit.isCustom, true), sql`${lifeUnit.parentUnitId} is not null`),
    );
    await tx.delete(lifeUnit).where(inArray(lifeUnit.id, ids));
    await recomputeAllUnitPoints(tx);
  });

  return { units: ids.length, tasks: taskIds.length, pools };
}

/** A commitment and its sub-commitments, as ids. */
async function subtreeIds(id: string): Promise<string[]> {
  const children = await db
    .select({ id: lifeUnit.id })
    .from(lifeUnit)
    .where(eq(lifeUnit.parentUnitId, id));
  return [id, ...children.map((c) => c.id)];
}

// ── Pools ───────────────────────────────────────────────────────────

export interface CreatePoolInput {
  localDate: string;
  taskIds: string[];
  plannedCount?: number;
  /** The block this window follows — the cue (ADR-0030 §3). */
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
  const existing = await poolsInWindow(
    input.localDate,
    input.afterTaskId ?? null,
    input.partOfDay ?? null,
  );
  assertPoolSize(validationInput(input, existing));

  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(pool).values({
      id,
      localDate: input.localDate,
      afterTaskId: input.afterTaskId ?? null,
      partOfDay: input.partOfDay ?? null,
      plannedCount: Math.max(
        1,
        Math.min(input.plannedCount ?? 1, input.taskIds.length),
      ),
    });
    await tx.insert(poolMember).values(
      input.taskIds.map((taskId, i) => ({ poolId: id, taskId, sortOrder: i })),
    );
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

  await db.transaction(async (tx) => {
    let members = input.taskIds;
    if (members) {
      const others = (
        await poolsInWindow(row.localDate, row.afterTaskId, row.partOfDay)
      ).filter((p) => p.poolId !== id);
      assertPoolSize({ taskIds: members, existing: others });
      await tx.delete(poolMember).where(eq(poolMember.poolId, id));
      await tx.insert(poolMember).values(
        members.map((taskId, i) => ({ poolId: id, taskId, sortOrder: i })),
      );
    } else {
      const rows = await tx
        .select({ taskId: poolMember.taskId })
        .from(poolMember)
        .where(eq(poolMember.poolId, id));
      members = rows.map((r) => r.taskId);
    }
    if (input.plannedCount !== undefined) {
      await tx
        .update(pool)
        .set({
          plannedCount: Math.max(
            1,
            Math.min(input.plannedCount, members.length || 1),
          ),
        })
        .where(eq(pool.id, id));
    }
  });
}

/**
 * Delete a pool. Its members are **not** deleted — a pool is a grouping
 * on a window, and dissolving it leaves three ordinary tasks rather
 * than destroying them.
 */
export async function deletePool(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(poolMember).where(eq(poolMember.poolId, id));
    await tx.delete(pool).where(eq(pool.id, id));
  });
}

/** Remove one task from a pool, dissolving the pool if it empties. */
export async function removeFromPool(
  poolId: string,
  taskId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(poolMember)
      .where(and(eq(poolMember.poolId, poolId), eq(poolMember.taskId, taskId)));
    const left = await tx
      .select({ taskId: poolMember.taskId })
      .from(poolMember)
      .where(eq(poolMember.poolId, poolId));
    if (left.length === 0) {
      await tx.delete(pool).where(eq(pool.id, poolId));
      return;
    }
    // A planned count above what is left would divide the band by more
    // slots than the pool can fill.
    await tx
      .update(pool)
      .set({ plannedCount: sql`min(${pool.plannedCount}, ${left.length})` })
      .where(eq(pool.id, poolId));
  });
}

/** Every pool in one window, with its members. */
async function poolsInWindow(
  localDate: string,
  afterTaskId: string | null,
  partOfDay: string | null,
): Promise<{ poolId: string; taskIds: string[] }[]> {
  const rows = await db
    .select()
    .from(pool)
    .where(eq(pool.localDate, localDate));
  const here = rows.filter(
    (p) => p.afterTaskId === afterTaskId && p.partOfDay === partOfDay,
  );
  if (here.length === 0) return [];
  const members = await db
    .select()
    .from(poolMember)
    .where(inArray(poolMember.poolId, here.map((p) => p.id)));
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
