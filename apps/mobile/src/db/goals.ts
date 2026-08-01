/**
 * Goal lifecycle & milestones (ADR-0007). Goals sit between a life
 * unit and its tasks: optional, temporary, and never scored directly
 * — all points still derive from active tasks' rank shares (ADR-0003)
 * via `recomputeAllUnitPoints`, which this module reuses rather than
 * re-deriving.
 */
import type { GoalStatus, MilestoneStatus } from "@glide/scoring";
import { advanceMilestone, nextGoalStatus } from "@glide/scoring";
import { and, asc, eq, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { recomputeAllUnitPoints, type Tx } from "./tasks";
import { achievement, goal, lifeArea, lifeUnit, milestone, task } from "./schema";

export type { GoalStatus, MilestoneStatus };

export interface GoalListItem {
  id: string;
  title: string;
  status: GoalStatus;
  milestoneCount: number;
  completedMilestoneCount: number;
}

export interface GoalsUnit {
  id: string;
  name: string;
  areaId: string;
  activeGoalCount: number;
  goals: GoalListItem[];
}

export interface GoalsArea {
  id: string;
  name: string;
  units: GoalsUnit[];
}

export interface GoalMilestone {
  id: string;
  title: string;
  sortOrder: number;
  status: MilestoneStatus;
}

export interface GoalTask {
  id: string;
  title: string;
  timesPerWeek: number;
  pointValue: number;
}

export interface GoalDetail {
  id: string;
  unitId: string;
  unitName: string;
  areaId: string;
  title: string;
  description: string | null;
  targetValue: number | null;
  status: GoalStatus;
  linkedFromGoalId: string | null;
  linkKind: "revision" | "follow_up" | null;
  successorGoalId: string | null;
  milestones: GoalMilestone[];
  tasks: GoalTask[];
}

function now(): string {
  return new Date().toISOString();
}

export async function loadGoals(): Promise<{ areas: GoalsArea[] }> {
  const areas = await db
    .select()
    .from(lifeArea)
    .where(isNull(lifeArea.archivedAt))
    .orderBy(asc(lifeArea.sortOrder));
  const units = await db
    .select()
    .from(lifeUnit)
    .where(isNull(lifeUnit.archivedAt))
    .orderBy(asc(lifeUnit.sortOrder));
  const goals = await db.select().from(goal);
  const milestones = await db.select().from(milestone);

  const milestonesByGoal = new Map<string, typeof milestones>();
  for (const m of milestones) {
    const list = milestonesByGoal.get(m.goalId) ?? [];
    list.push(m);
    milestonesByGoal.set(m.goalId, list);
  }

  return {
    areas: areas.map((area) => ({
      id: area.id,
      name: area.name,
      units: units
        .filter((u) => u.areaId === area.id)
        .map((u) => {
          const unitGoals = goals.filter((g) => g.unitId === u.id);
          return {
            id: u.id,
            name: u.name,
            areaId: u.areaId,
            activeGoalCount: unitGoals.filter((g) => g.status === "active")
              .length,
            goals: unitGoals.map((g) => {
              const ms = milestonesByGoal.get(g.id) ?? [];
              return {
                id: g.id,
                title: g.title,
                status: g.status as GoalStatus,
                milestoneCount: ms.length,
                completedMilestoneCount: ms.filter(
                  (m) => m.status === "completed",
                ).length,
              };
            }),
          };
        }),
    })),
  };
}

export async function loadGoalDetail(
  goalId: string,
): Promise<GoalDetail | null> {
  const [row] = await db.select().from(goal).where(eq(goal.id, goalId));
  if (!row) return null;

  const milestones = await db
    .select()
    .from(milestone)
    .where(eq(milestone.goalId, goalId))
    .orderBy(asc(milestone.sortOrder));
  const tasks = await db
    .select()
    .from(task)
    .where(and(eq(task.goalId, goalId), eq(task.active, true)))
    .orderBy(asc(task.rankInUnit));
  const [successor] = await db
    .select()
    .from(goal)
    .where(eq(goal.linkedFromGoalId, goalId));
  const [unit] = await db
    .select()
    .from(lifeUnit)
    .where(eq(lifeUnit.id, row.unitId));

  return {
    id: row.id,
    unitId: row.unitId,
    unitName: unit?.name ?? "",
    areaId: unit?.areaId ?? "",
    title: row.title,
    description: row.description,
    targetValue: row.targetValue,
    status: row.status as GoalStatus,
    linkedFromGoalId: row.linkedFromGoalId,
    linkKind: row.linkKind as "revision" | "follow_up" | null,
    successorGoalId: successor?.id ?? null,
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      sortOrder: m.sortOrder,
      status: m.status as MilestoneStatus,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      timesPerWeek: t.timesPerWeek,
      pointValue: t.pointValue,
    })),
  };
}

export async function createGoal(
  unitId: string,
  title: string,
  description?: string,
  targetValue?: number,
): Promise<string> {
  const id = Crypto.randomUUID();
  await db.insert(goal).values({
    id,
    unitId,
    title,
    description: description ?? null,
    targetValue: targetValue ?? null,
    status: "active",
    statusChangedAt: now(),
  });
  return id;
}

async function setGoalStatus(
  tx: Tx,
  goalId: string,
  status: GoalStatus,
): Promise<void> {
  await tx
    .update(goal)
    .set({ status, statusChangedAt: now() })
    .where(eq(goal.id, goalId));
}

/** Tasks currently attached to a goal, excluding permanently archived
 *  ones — resuming a paused goal must never resurrect a task the user
 *  archived independently. */
async function goalTasks(tx: Tx, goalId: string) {
  return tx
    .select()
    .from(task)
    .where(and(eq(task.goalId, goalId), isNull(task.archivedAt)));
}

export async function pauseGoal(goalId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(goal).where(eq(goal.id, goalId));
    if (!row) return;
    const next = nextGoalStatus(row.status as GoalStatus, "pause");
    await setGoalStatus(tx, goalId, next);
    const tasks = await goalTasks(tx, goalId);
    for (const t of tasks) {
      await tx.update(task).set({ active: false }).where(eq(task.id, t.id));
    }
    await recomputeAllUnitPoints(tx);
  });
}

export async function resumeGoal(goalId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(goal).where(eq(goal.id, goalId));
    if (!row) return;
    const next = nextGoalStatus(row.status as GoalStatus, "resume");
    await setGoalStatus(tx, goalId, next);
    const tasks = await goalTasks(tx, goalId);
    for (const t of tasks) {
      await tx.update(task).set({ active: true }).where(eq(task.id, t.id));
    }
    await recomputeAllUnitPoints(tx);
  });
}

export async function abandonGoal(
  goalId: string,
  taskDecisions: { taskId: string; action: "detach" | "archive" }[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(goal).where(eq(goal.id, goalId));
    if (!row) return;
    const next = nextGoalStatus(row.status as GoalStatus, "abandon");
    await setGoalStatus(tx, goalId, next);
    for (const { taskId, action } of taskDecisions) {
      if (action === "detach") {
        await tx.update(task).set({ goalId: null }).where(eq(task.id, taskId));
      } else {
        await tx
          .update(task)
          .set({ active: false, archivedAt: now() })
          .where(eq(task.id, taskId));
      }
    }
    await recomputeAllUnitPoints(tx);
  });
}

export async function reviveGoal(goalId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(goal).where(eq(goal.id, goalId));
    if (!row) return;
    const next = nextGoalStatus(row.status as GoalStatus, "revive");
    await setGoalStatus(tx, goalId, next);
  });
}

export async function reviseGoal(
  goalId: string,
  newTitle: string,
  newDescription: string | undefined,
  taskCarry: { taskId: string; carry: boolean }[],
): Promise<string> {
  const newId = Crypto.randomUUID();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(goal).where(eq(goal.id, goalId));
    if (!row) throw new Error(`reviseGoal: goal ${goalId} not found`);
    if (row.status !== "active") {
      throw new Error(`reviseGoal: cannot revise a ${row.status} goal`);
    }
    await tx
      .update(goal)
      .set({ status: "revised", statusChangedAt: now() })
      .where(eq(goal.id, goalId));
    await tx.insert(goal).values({
      id: newId,
      unitId: row.unitId,
      title: newTitle,
      description: newDescription ?? null,
      targetValue: row.targetValue,
      status: "active",
      statusChangedAt: now(),
      linkedFromGoalId: goalId,
      linkKind: "revision",
    });
    for (const { taskId, carry } of taskCarry) {
      await tx
        .update(task)
        .set({ goalId: carry ? newId : null, active: true })
        .where(eq(task.id, taskId));
    }
    await recomputeAllUnitPoints(tx);
  });
  return newId;
}

export type CompleteGoalPath = "archive" | "follow_up" | "maintenance";

export interface CompleteGoalOptions {
  /** Required for path "follow_up". */
  newTitle?: string;
  newDescription?: string;
  /** Required for path "follow_up": which of the goal's tasks carry over. */
  taskCarry?: { taskId: string; carry: boolean }[];
}

export async function completeGoal(
  goalId: string,
  path: CompleteGoalPath,
  opts: CompleteGoalOptions = {},
): Promise<{ successorGoalId: string | null }> {
  let successorGoalId: string | null = null;
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(goal).where(eq(goal.id, goalId));
    if (!row) throw new Error(`completeGoal: goal ${goalId} not found`);
    const next = nextGoalStatus(row.status as GoalStatus, "complete");
    await setGoalStatus(tx, goalId, next);

    const tasks = await goalTasks(tx, goalId);
    if (path === "archive") {
      for (const t of tasks) {
        await tx
          .update(task)
          .set({ active: false, archivedAt: now() })
          .where(eq(task.id, t.id));
      }
    } else if (path === "maintenance") {
      for (const t of tasks) {
        await tx.update(task).set({ goalId: null }).where(eq(task.id, t.id));
      }
    } else {
      if (!opts.newTitle) {
        throw new Error("completeGoal: follow_up requires opts.newTitle");
      }
      const newId = Crypto.randomUUID();
      await tx.insert(goal).values({
        id: newId,
        unitId: row.unitId,
        title: opts.newTitle,
        description: opts.newDescription ?? null,
        targetValue: row.targetValue,
        status: "active",
        statusChangedAt: now(),
        linkedFromGoalId: goalId,
        linkKind: "follow_up",
      });
      const carrySet = new Set(
        (opts.taskCarry ?? []).filter((c) => c.carry).map((c) => c.taskId),
      );
      for (const t of tasks) {
        await tx
          .update(task)
          .set({ goalId: carrySet.has(t.id) ? newId : null })
          .where(eq(task.id, t.id));
      }
      successorGoalId = newId;
    }

    await recomputeAllUnitPoints(tx);
    await tx.insert(achievement).values({
      id: Crypto.randomUUID(),
      goalId,
      milestoneId: null,
      titleSnapshot: row.title,
      achievedAt: now(),
    });
  });
  return { successorGoalId };
}

export async function addMilestone(
  goalId: string,
  title: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(milestone)
      .where(eq(milestone.goalId, goalId));
    const maxSortOrder = existing.reduce(
      (max, m) => Math.max(max, m.sortOrder),
      0,
    );
    const hasCurrent = existing.some((m) => m.status === "current");
    await tx.insert(milestone).values({
      id: Crypto.randomUUID(),
      goalId,
      title,
      sortOrder: maxSortOrder + 1,
      status: hasCurrent ? "pending" : "current",
    });
  });
}

/**
 * Marks a milestone completed, records the minor achievement, and
 * either promotes the next milestone to `current` or — if it was the
 * last one — signals that the goal itself should now complete. The
 * caller is responsible for presenting the three-path completion flow
 * (this function never auto-picks a path).
 */
export async function completeMilestone(
  milestoneId: string,
): Promise<{ goalShouldComplete: boolean; goalId: string }> {
  let goalShouldComplete = false;
  let goalId = "";
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(milestone)
      .where(eq(milestone.id, milestoneId));
    if (!row) throw new Error(`completeMilestone: ${milestoneId} not found`);
    goalId = row.goalId;
    const [goalRow] = await tx.select().from(goal).where(eq(goal.id, goalId));

    await tx
      .update(milestone)
      .set({ status: "completed" })
      .where(eq(milestone.id, milestoneId));

    const siblings = await tx
      .select()
      .from(milestone)
      .where(eq(milestone.goalId, goalId));
    const { nextCurrentId } = advanceMilestone(
      siblings.map((m) => ({
        id: m.id,
        sortOrder: m.sortOrder,
        status: (m.id === milestoneId
          ? "completed"
          : m.status) as MilestoneStatus,
      })),
      milestoneId,
    );

    if (nextCurrentId) {
      await tx
        .update(milestone)
        .set({ status: "current" })
        .where(eq(milestone.id, nextCurrentId));
    } else {
      goalShouldComplete = goalRow?.status === "active";
    }

    await tx.insert(achievement).values({
      id: Crypto.randomUUID(),
      goalId,
      milestoneId,
      titleSnapshot: row.title,
      achievedAt: now(),
    });
  });
  return { goalShouldComplete, goalId };
}
