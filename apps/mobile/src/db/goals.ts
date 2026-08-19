/**
 * Goal lifecycle & milestones (ADR-0007). Goals sit between a life
 * unit and its tasks: optional, temporary, and never scored directly
 * — all points still derive from active tasks' rank shares (ADR-0003)
 * via `recomputeAllUnitPoints`, which this module reuses rather than
 * re-deriving.
 */
import type {
  GoalStatus,
  MetricKind,
  MilestoneStatus,
  Streak,
} from "@glide/scoring";
import {
  advanceMilestone,
  computeStreak,
  HABIT_LADDER,
  nextGoalStatus,
} from "@glide/scoring";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { recomputeAllUnitPoints, type Tx } from "./tasks";
import {
  achievement,
  dayGrade,
  goal,
  goalProgress,
  lifeArea,
  lifeUnit,
  milestone,
  task,
  taskCompletion,
} from "./schema";

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
  /** This rung's own threshold (ADR-0015 §5). Null = a plain rung; the
   *  bench example is 135 → 185 → 225 and without this they are only
   *  labels. Passing it *prompts*; nothing auto-completes. */
  targetValue: number | null;
  /** When it actually happened, `'YYYY-MM-DD'` — milestones are often
   *  noticed late, and filing one in the wrong month would put a false
   *  entry in the log of a life. */
  completedOn: string | null;
}

export interface GoalTask {
  id: string;
  title: string;
  timesPerWeek: number;
  pointValue: number;
}

export interface GoalProgressEntry {
  id: string;
  localDate: string;
  value: number;
  note: string | null;
  /** `task` rows came from the auto-count link (ADR-0015 §2). Shown and
   *  individually deletable, so nothing accrues invisibly. */
  source: "manual" | "task";
}

export interface GoalDetail {
  id: string;
  unitId: string;
  unitName: string;
  areaId: string;
  title: string;
  description: string | null;
  targetValue: number | null;
  /** Null = a plain goal, exactly as goals worked before ADR-0015. */
  metricKind: MetricKind | null;
  /** Free-text label: "books", "lb", "kg". */
  metricUnit: string | null;
  /** Rough deadline, `'YYYY-MM'` (ADR-0015 §4). Context, never a
   *  status: a passed date changes nothing anywhere. */
  targetDate: string | null;
  autocountTaskId: string | null;
  status: GoalStatus;
  linkedFromGoalId: string | null;
  linkKind: "revision" | "follow_up" | null;
  successorGoalId: string | null;
  milestones: GoalMilestone[];
  tasks: GoalTask[];
  /** Earliest first. */
  progress: GoalProgressEntry[];
  /**
   * Habit goals only; null for every other kind. A run of consecutive
   * days, shown and never enforced (ADR-0004 §5) — nothing here
   * reaches `computeDayScore`.
   */
  streak: Streak | null;
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

/**
 * A habit goal's run of days.
 *
 * **A day counts two ways**, and either is enough: any task belonging
 * to the goal was completed that day, or a progress entry was logged
 * against it. Reusing `task.goal_id` means the content library's habit
 * goals already work without a second nomination step — "Phone out of
 * the bedroom" is fed by its own "Screens off" task — while the manual
 * route covers a habit that has no task at all.
 *
 * Archived tasks are included deliberately: their completions are real
 * history, and retiring a task should not rewrite the run it was part
 * of.
 */
async function habitStreak(
  goalId: string,
  progress: readonly { localDate: string }[],
): Promise<Streak> {
  const goalTasks = await db
    .select({ id: task.id })
    .from(task)
    .where(eq(task.goalId, goalId));

  const completions = goalTasks.length
    ? await db
        .select({ localDate: taskCompletion.localDate })
        .from(taskCompletion)
        .where(
          inArray(
            taskCompletion.taskId,
            goalTasks.map((t) => t.id),
          ),
        )
    : [];

  // Declared days off bridge a run rather than breaking it
  // (ADR-0004 §3). Nothing else about a day is consulted: a streak is
  // a statistic beside the grade, never a function of it.
  const off = await db
    .select({ localDate: dayGrade.localDate })
    .from(dayGrade)
    .where(eq(dayGrade.kind, "rest"));

  return computeStreak({
    done: [
      ...completions.map((c) => c.localDate),
      ...progress.map((p) => p.localDate),
    ],
    daysOff: off.map((d) => d.localDate),
    today: new Date().toISOString().slice(0, 10),
  });
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
  const progress = await db
    .select()
    .from(goalProgress)
    .where(eq(goalProgress.goalId, goalId))
    .orderBy(asc(goalProgress.localDate), asc(goalProgress.createdAt));

  const streak =
    row.metricKind === "habit" ? await habitStreak(goalId, progress) : null;
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
    metricKind: row.metricKind as MetricKind | null,
    metricUnit: row.metricUnit,
    targetDate: row.targetDate,
    autocountTaskId: row.autocountTaskId,
    status: row.status as GoalStatus,
    linkedFromGoalId: row.linkedFromGoalId,
    linkKind: row.linkKind as "revision" | "follow_up" | null,
    successorGoalId: successor?.id ?? null,
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      sortOrder: m.sortOrder,
      status: m.status as MilestoneStatus,
      targetValue: m.targetValue,
      completedOn: m.completedOn,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      timesPerWeek: t.timesPerWeek,
      pointValue: t.pointValue,
    })),
    progress: progress.map((p) => ({
      id: p.id,
      localDate: p.localDate,
      value: p.value,
      note: p.note,
      source: p.source as "manual" | "task",
    })),
    streak,
  };
}

export async function createGoal(
  unitId: string,
  title: string,
  description?: string,
  targetValue?: number,
  metricUnit?: string,
): Promise<string> {
  const id = Crypto.randomUUID();
  await db.insert(goal).values({
    id,
    unitId,
    title,
    description: description ?? null,
    targetValue: targetValue ?? null,
    metricUnit: metricUnit ?? null,
    // A goal given a number at creation is a `target` metric: reach the
    // figure and it is done. `cumulative` and `habit` are deliberate
    // choices made later on the goal's own screen, where their
    // difference can be explained; guessing between them from a bare
    // number would get it wrong more often than not.
    metricKind: targetValue === undefined ? null : "target",
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

/**
 * Attach or clear a goal's metric (ADR-0015 §1).
 *
 * Passing `kind: null` returns it to a plain goal. The progress entries
 * are deliberately left alone — they are history, and history does not
 * restate (ADR-0002). Re-attaching a metric picks them back up.
 */
export async function setGoalMetric(
  goalId: string,
  metric: { kind: MetricKind; unit: string; targetValue: number } | null,
): Promise<void> {
  const habit = metric?.kind === "habit";
  await db
    .update(goal)
    .set(
      metric
        ? {
            metricKind: metric.kind,
            metricUnit: metric.unit,
            // A habit has no finish line, so it stores no target. Any
            // number here would eventually be rendered as one.
            targetValue: habit ? null : metric.targetValue,
          }
        : { metricKind: null, metricUnit: null, targetValue: null },
    )
    .where(eq(goal.id, goalId));

  // Seed the ladder so a new habit has rungs to pass. Only when it has
  // none: re-saving the metric must not overwrite the user's own.
  if (habit) {
    const existing = await db
      .select()
      .from(milestone)
      .where(eq(milestone.goalId, goalId));
    if (existing.length === 0) {
      for (const days of HABIT_LADDER) {
        await addMilestone(goalId, String(days), days);
      }
    }
  }
}

/**
 * The rough deadline, `'YYYY-MM'` (ADR-0015 §4).
 *
 * Month granularity is the whole point: this app plans roughly and owns
 * no clocks, and a goal deadline is the longest-horizon commitment in
 * the product — the last place precision earns its keep. A passed date
 * changes nothing anywhere; there is no "overdue" state to set.
 */
export async function setGoalTargetDate(
  goalId: string,
  targetDate: string | null,
): Promise<void> {
  if (targetDate !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(targetDate)) {
    throw new Error(`Target date must be YYYY-MM, got "${targetDate}"`);
  }
  await db.update(goal).set({ targetDate }).where(eq(goal.id, goalId));
}

/** One reading toward a metric goal. Never a scoring event
 *  (ADR-0015 §7) — no points, no denominator, no day touched. */
export async function addGoalProgress(
  goalId: string,
  localDate: string,
  value: number,
  note: string | null,
  source: "manual" | "task" = "manual",
): Promise<void> {
  await db.insert(goalProgress).values({
    id: Crypto.randomUUID(),
    goalId,
    localDate,
    value,
    note,
    source,
  });
}

/** Deletable like journal entries — including auto-counted rows, so
 *  nothing the app added on your behalf is stuck there. */
export async function deleteGoalProgress(entryId: string): Promise<void> {
  await db.delete(goalProgress).where(eq(goalProgress.id, entryId));
}

/**
 * Nominate the one task whose completion increments a cumulative goal
 * (ADR-0015 §2), or clear it with null.
 *
 * One task, explicitly chosen — never "all tasks under this goal",
 * which would make progress a silent function of the task list, so
 * editing tasks would rewrite goal history.
 */
export async function setGoalAutocountTask(
  goalId: string,
  taskId: string | null,
): Promise<void> {
  await db.update(goal).set({ autocountTaskId: taskId }).where(eq(goal.id, goalId));
}

/**
 * Increment every cumulative goal that nominated this task
 * (ADR-0015 §2). Called after a completion is written.
 *
 * Writes an ordinary, visible, individually-deletable progress row —
 * `source: "task"` — so the user can always see where a number came
 * from and take it back out.
 */
export async function autocountForTask(
  taskId: string,
  localDate: string,
): Promise<void> {
  const goals = await db
    .select()
    .from(goal)
    .where(and(eq(goal.autocountTaskId, taskId), eq(goal.status, "active")));
  for (const g of goals) {
    // Readings carry no value on a task completion, so only a
    // cumulative goal can be fed this way.
    if (g.metricKind !== "cumulative") continue;
    await addGoalProgress(g.id, localDate, 1, null, "task");
  }
}

/** Undo this task's auto-counted rows for a day, when a completion is
 *  unchecked. Manual entries on the same day are never touched. */
export async function removeAutocountForTask(
  taskId: string,
  localDate: string,
): Promise<void> {
  const goals = await db
    .select()
    .from(goal)
    .where(eq(goal.autocountTaskId, taskId));
  for (const g of goals) {
    await db
      .delete(goalProgress)
      .where(
        and(
          eq(goalProgress.goalId, g.id),
          eq(goalProgress.localDate, localDate),
          eq(goalProgress.source, "task"),
        ),
      );
  }
}

/** @param targetValue This rung's own threshold on a metric goal
 *   (ADR-0015 §5). Null for a plain rung. */
export async function addMilestone(
  goalId: string,
  title: string,
  targetValue: number | null = null,
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
      targetValue,
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
/**
 * @param completedOn `'YYYY-MM-DD'` for when it *actually* happened,
 *   defaulting to today (ADR-0015 §5). Milestones are frequently
 *   noticed late — "I passed 185 a few weeks ago" — and recording one
 *   in the wrong month would put a false entry in the log of a life,
 *   which is the one thing that log is for. The date reaches both
 *   `milestone.completed_on` and the achievement's `achieved_at`, so
 *   look-back views place it in the month it belongs to.
 */
export async function completeMilestone(
  milestoneId: string,
  completedOn?: string,
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

    const day = completedOn ?? new Date().toISOString().slice(0, 10);
    await tx
      .update(milestone)
      .set({ status: "completed", completedOn: day })
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
      // The chosen day, not the moment it was recorded — so a
      // look-back view files it in the month it happened. Midday
      // avoids a timezone read pulling it onto the wrong date.
      achievedAt: completedOn ? `${day}T12:00:00.000Z` : now(),
    });
  });
  return { goalShouldComplete, goalId };
}

/**
 * Delete a goal outright (Henry, 2026-08-18: "everything should be
 * editable, deletable").
 *
 * ADR-0007 gave goals a lifecycle with no delete in it, on the
 * principle that the log stays true — revise spawns a successor rather
 * than mutating, abandonment is revivable and neutrally worded. That
 * principle is about **outcomes**, and it still holds: this is for the
 * goal you mistyped, duplicated, or never really meant, which has no
 * outcome to protect. "Set aside" remains the honest end for a goal you
 * genuinely tried.
 *
 * What goes: the goal, its milestones, its progress entries — all
 * authored scaffolding.
 *
 * What survives:
 * - **Achievements**, detached rather than deleted. They carry
 *   `title_snapshot` precisely so history outlives goal edits, and
 *   PRODUCT.md principle 5 files them in the life log beside journals
 *   and photos. Deleting the goal must not quietly rewrite a month's
 *   summary.
 * - **Tasks**, detached to their unit (`goal_id → null`), which is
 *   exactly the "transition to maintenance" exit ADR-0007 §2 already
 *   defines. Deleting a goal is not a reason to stop doing the things
 *   it started, and archiving them would silently cut the plan.
 * - **Completions and grades**, untouched — a task keeps its history
 *   whether or not it still points at a goal.
 */
export async function deleteGoal(goalId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Detach first: the achievement's own row is the record, and a
    // dangling id would point at nothing after the delete. Both ends
    // matter — the rungs go too, so an achievement earned on one would
    // otherwise keep a `milestone_id` for a row that no longer exists.
    const rungs = await tx
      .select({ id: milestone.id })
      .from(milestone)
      .where(eq(milestone.goalId, goalId));
    if (rungs.length > 0) {
      await tx
        .update(achievement)
        .set({ milestoneId: null })
        .where(
          inArray(
            achievement.milestoneId,
            rungs.map((m) => m.id),
          ),
        );
    }
    await tx
      .update(achievement)
      .set({ goalId: null })
      .where(eq(achievement.goalId, goalId));
    // Anything nominated to auto-count for this goal stops doing so.
    await tx
      .update(goal)
      .set({ autocountTaskId: null })
      .where(eq(goal.id, goalId));
    await tx.update(task).set({ goalId: null }).where(eq(task.goalId, goalId));
    await tx.delete(goalProgress).where(eq(goalProgress.goalId, goalId));
    await tx.delete(milestone).where(eq(milestone.goalId, goalId));
    await tx.delete(goal).where(eq(goal.id, goalId));
    // Tasks changed hands but not rank or count, so points are
    // unchanged — this only guards against a goal delete racing a plan
    // edit that did move them.
    await recomputeAllUnitPoints(tx);
  });
}

/** Rename a milestone, or change the reading it is reached at
 *  (ADR-0015 §5). Milestones were add-and-complete only until
 *  2026-08-18; a rung you cannot correct is a typo you live with. */
export async function updateMilestone(
  milestoneId: string,
  title: string,
  targetValue: number | null,
): Promise<void> {
  const trimmed = title.trim();
  if (trimmed.length === 0) return;
  await db
    .update(milestone)
    .set({ title: trimmed, targetValue })
    .where(eq(milestone.id, milestoneId));
}

/**
 * Remove a milestone.
 *
 * If it was the current rung, the next pending one takes over, so a
 * goal is never left with a ladder and nothing lit. A completed
 * milestone's **achievement is detached, not deleted** — same reasoning
 * as `deleteGoal`: the rung is scaffolding, the achievement is history.
 */
export async function deleteMilestone(milestoneId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(milestone)
      .where(eq(milestone.id, milestoneId));
    if (!row) return;

    await tx
      .update(achievement)
      .set({ milestoneId: null })
      .where(eq(achievement.milestoneId, milestoneId));
    await tx.delete(milestone).where(eq(milestone.id, milestoneId));

    if (row.status !== "current") return;
    const rest = await tx
      .select()
      .from(milestone)
      .where(eq(milestone.goalId, row.goalId))
      .orderBy(asc(milestone.sortOrder));
    const nextUp = rest.find((m) => m.status === "pending");
    if (nextUp) {
      await tx
        .update(milestone)
        .set({ status: "current" })
        .where(eq(milestone.id, nextUp.id));
    }
  });
}
