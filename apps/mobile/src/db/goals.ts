/**
 * Goal lifecycle and conditions (ADR-0007, ADR-0030). Goals sit between
 * a life unit and its tasks: optional, temporary, and never scored
 * directly
 * — all points still derive from active tasks' rank shares (ADR-0003)
 * via `recomputeAllUnitPoints`, which this module reuses rather than
 * re-deriving.
 */
import {
  computeStreak,
  habitRungsReached,
  nextGoalStatus,
  rungReachedOn,
  type GoalStatus,
  type MetricKind,
  type Streak,
  type StreakInput,
} from "@glide/scoring";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { db } from "./client";
import { recomputeAllUnitPoints, type Tx } from "./tasks";
import {
  achievement,
  dayGrade,
  goal,
  goalCondition,
  goalProgress,
  lifeArea,
  lifeUnit,
  milestone,
  task,
  taskCompletion,
} from "./schema";

export type { GoalStatus };

export interface GoalListItem {
  id: string;
  title: string;
  status: GoalStatus;
  /** How much work is actually behind it. A goal with none is a
   *  statement of intent — worth seeing at a glance in the list. */
  taskCount: number;
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


export interface GoalTask {
  id: string;
  title: string;
  timesPerWeek: number;
  pointValue: number;
  /**
   * The task's home unit — **not necessarily the goal's** (ADR-0030 §2).
   * A condition may recruit a task from anywhere in the portfolio, and
   * that task is paid out of its own unit's weight, so every surface
   * showing a goal's tasks has to be able to say where each one counts.
   */
  unitId: string;
  unitName: string;
  /** The unit's area, for the hue pip that marks a task counting
   *  somewhere other than the goal's own unit. */
  areaId: string;
  /** Which condition it sits under; null = straight off the goal. */
  conditionId: string | null;
}

/**
 * A condition on a goal (ADR-0030 §1): something that has to be true
 * for the goal to happen, with the tasks that make it true.
 *
 * Parallel, not sequential — every condition on a goal is live for the
 * goal's whole life. There is no status here and nothing to complete;
 * see the `goal_condition` table for why.
 */
export interface GoalCondition {
  id: string;
  title: string;
  sortOrder: number;
  /** Any number, including none — a condition with no tasks yet is a
   *  statement of intent, not an error (ADR-0030 §3). */
  tasks: GoalTask[];
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
  /** Ordered as the user arranged them. */
  conditions: GoalCondition[];
  /** Tasks hanging straight off the goal, outside any condition. Every
   *  task worked this way before ADR-0030 and most still will. */
  tasks: GoalTask[];
  /**
   * Every task serving this goal, grouped or not, in rank order.
   *
   * The lifecycle sheets — complete, revise, set aside — ask what
   * happens to *the goal's work*, and a condition is only where that
   * work was filed. Handing them `tasks` alone would silently drop
   * everything inside a condition from the decision.
   */
  allTasks: GoalTask[];
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
  const activeTasks = await db
    .select({ goalId: task.goalId })
    .from(task)
    .where(eq(task.active, true));

  const taskCountByGoal = new Map<string, number>();
  for (const t of activeTasks) {
    if (t.goalId === null) continue;
    taskCountByGoal.set(t.goalId, (taskCountByGoal.get(t.goalId) ?? 0) + 1);
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
            goals: unitGoals.map((g) => ({
              id: g.id,
              title: g.title,
              status: g.status as GoalStatus,
              taskCount: taskCountByGoal.get(g.id) ?? 0,
            })),
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
): Promise<{ streak: Streak; input: StreakInput }> {
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

  const input: StreakInput = {
    done: [
      ...completions.map((c) => c.localDate),
      ...progress.map((p) => p.localDate),
    ],
    daysOff: off.map((d) => d.localDate),
    today: new Date().toISOString().slice(0, 10),
  };
  // The input travels with the result so a rung can be *dated*, not
  // just detected — see `recordHabitRungs`.
  return { streak: computeStreak(input), input };
}

/**
 * Write an achievement for every habit rung the streak has passed and
 * the log does not already hold (ADR-0030 §5).
 *
 * **Automatic, where advancing a milestone never was.** ADR-0015 §3's
 * rule is that reaching a target *invites* completion rather than
 * performing it — and it still holds, because nothing here completes
 * anything: a habit goal never completes by design. This only records
 * that a run happened, and the completion dates are the evidence. There
 * is nothing for the user to confirm and nothing to get wrong.
 *
 * Idempotent on `(goalId, titleSnapshot)`, because it runs on every
 * visit to the goal. Dated by `rungReachedOn`, so a rung noticed in
 * September but passed in July files in July — the thing the old
 * two-step date picker existed to protect.
 */
async function recordHabitRungs(
  goalId: string,
  goalTitle: string,
  streak: Streak,
  input: StreakInput,
): Promise<void> {
  const reached = habitRungsReached(streak);
  if (reached.length === 0) return;

  const existing = await db
    .select({ titleSnapshot: achievement.titleSnapshot })
    .from(achievement)
    .where(eq(achievement.goalId, goalId));
  const held = new Set(existing.map((a) => a.titleSnapshot));

  for (const days of reached) {
    const title = `${days} days of ${goalTitle}`;
    if (held.has(title)) continue;
    await db.insert(achievement).values({
      id: Crypto.randomUUID(),
      goalId,
      milestoneId: null,
      titleSnapshot: title,
      achievedAt: rungReachedOn(input, days) ?? input.today,
    });
  }
}

export async function loadGoalDetail(
  goalId: string,
): Promise<GoalDetail | null> {
  const [row] = await db.select().from(goal).where(eq(goal.id, goalId));
  if (!row) return null;

  const conditions = await db
    .select()
    .from(goalCondition)
    .where(eq(goalCondition.goalId, goalId))
    .orderBy(asc(goalCondition.sortOrder));
  // Left join so a task whose unit was archived still lists, unnamed,
  // rather than vanishing from the goal that owns it.
  const taskRows = await db
    .select({ t: task, unitName: lifeUnit.name, areaId: lifeUnit.areaId })
    .from(task)
    .leftJoin(lifeUnit, eq(lifeUnit.id, task.unitId))
    .where(and(eq(task.goalId, goalId), eq(task.active, true)))
    .orderBy(asc(task.rankInUnit));
  const tasks = taskRows.map((r) => ({
    id: r.t.id,
    title: r.t.title,
    timesPerWeek: r.t.timesPerWeek,
    pointValue: r.t.pointValue,
    unitId: r.t.unitId,
    unitName: r.unitName ?? "",
    areaId: r.areaId ?? "",
    conditionId: r.t.conditionId,
  }));
  const [successor] = await db
    .select()
    .from(goal)
    .where(eq(goal.linkedFromGoalId, goalId));
  const progress = await db
    .select()
    .from(goalProgress)
    .where(eq(goalProgress.goalId, goalId))
    .orderBy(asc(goalProgress.localDate), asc(goalProgress.createdAt));

  let streak: Streak | null = null;
  if (row.metricKind === "habit") {
    const habit = await habitStreak(goalId, progress);
    streak = habit.streak;
    await recordHabitRungs(goalId, row.title, habit.streak, habit.input);
  }
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
    conditions: conditions.map((c) => ({
      id: c.id,
      title: c.title,
      sortOrder: c.sortOrder,
      tasks: tasks.filter((t) => t.conditionId === c.id),
    })),
    tasks: tasks.filter((t) => t.conditionId === null),
    allTasks: tasks,
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

  // Nothing to seed. A habit's rungs are `HABIT_LADDER` computed
  // against its streak (ADR-0030 §5) — three rows recording a constant
  // the app already had was the thing that retirement removed.
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

// ── Conditions (ADR-0030) ───────────────────────────────────────────

/**
 * Add a condition to a goal. Any number are allowed (ADR-0030 §3): the
 * Harada chart's fixed eight is a completeness surface, and this app
 * does not have those.
 */
export async function addCondition(
  goalId: string,
  title: string,
): Promise<string> {
  const id = Crypto.randomUUID();
  const existing = await db
    .select()
    .from(goalCondition)
    .where(eq(goalCondition.goalId, goalId));
  const maxSortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), 0);
  await db.insert(goalCondition).values({
    id,
    goalId,
    title,
    sortOrder: maxSortOrder + 1,
  });
  return id;
}

export async function renameCondition(
  conditionId: string,
  title: string,
): Promise<void> {
  await db
    .update(goalCondition)
    .set({ title })
    .where(eq(goalCondition.id, conditionId));
}

/**
 * Remove a condition, **keeping its tasks**.
 *
 * The tasks fall back to the goal (`condition_id` → null), exactly
 * where they would have lived before ADR-0030. A condition is a
 * grouping, and deleting a grouping must never delete the work inside
 * it — the user wrote those tasks, and they are still earning points
 * from their units either way.
 */
export async function deleteCondition(conditionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(task)
      .set({ conditionId: null })
      .where(eq(task.conditionId, conditionId));
    await tx.delete(goalCondition).where(eq(goalCondition.id, conditionId));
  });
}

/** Persist a drag-reorder. `orderedIds` is the full set for the goal,
 *  in the order it should read; anything missing is left alone. */
export async function reorderConditions(orderedIds: readonly string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      await tx
        .update(goalCondition)
        .set({ sortOrder: i + 1 })
        .where(eq(goalCondition.id, id));
    }
  });
}

/**
 * Move a task into a condition, out of one, or between two.
 *
 * Never touches the task's units or its rank, so nothing about what it
 * is worth changes: a condition is where a task was *written*, not
 * where it is *paid* (ADR-0030 §2). No `recomputeAllUnitPoints` call
 * for exactly that reason.
 */
export async function setTaskCondition(
  taskId: string,
  conditionId: string | null,
): Promise<void> {
  await db.update(task).set({ conditionId }).where(eq(task.id, taskId));
}

/**
 * Attach an **existing** task to this goal, and optionally to one of its
 * conditions (ADR-0030 §1).
 *
 * Both columns move together, in one transaction, because
 * `condition_id` is only meaningful alongside `goal_id` and a task
 * carrying a condition belonging to a different goal is a row that
 * should never exist. `setTaskCondition` is the within-goal move; this
 * is the way in from anywhere else in the plan.
 *
 * **Points do not move.** A goal is a grouping and a condition is a
 * grouping inside it (ADR-0030 §4); the task still earns from its own
 * unit's weight, so there is nothing to recompute.
 */
export async function attachTaskToGoal(
  taskId: string,
  goalId: string,
  conditionId: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(task).set({ goalId, conditionId }).where(eq(task.id, taskId));
  });
}

/**
 * Take a task off this goal entirely — the inverse of the above, and
 * the reason it exists: anything the UI can add, it has to be able to
 * undo without sending the user to another screen.
 *
 * **The task survives.** It goes back to standing on its own under its
 * unit, which is where most tasks live and how every task worked before
 * goals could hold them. Deleting the work because it stopped serving a
 * goal would be the same mistake `deleteCondition` avoids one level
 * down.
 */
export async function detachTaskFromGoal(taskId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(task)
      .set({ goalId: null, conditionId: null })
      .where(eq(task.id, taskId));
  });
}

/**
 * `addMilestone` and `completeMilestone` **retired 2026-08-26**
 * (ADR-0030 §5).
 *
 * A goal's authored child is a **condition** now — parallel, with no
 * order to advance through and nothing to complete. The `milestone`
 * table stays in the schema and stops being written (ADR-0002 is
 * forward-only, and rows a user already earned are theirs), but no
 * path in the app creates, completes, edits or deletes one.
 *
 * The one ladder worth keeping went the other way: a habit goal's
 * 7 · 30 · 66 rungs were the app writing three rows to record a
 * constant it already had. They are `HABIT_LADDER` measured against
 * the streak now — see `recordHabitRungs` below.
 */
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
 * What goes: the goal, its conditions, any legacy milestone rows, its
 * progress entries — all
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

/**
 * `updateMilestone` and `deleteMilestone` **retired 2026-08-26**
 * (ADR-0030 §5), with `addMilestone` and `completeMilestone` above.
 * Nothing authors a rung any more, so nothing edits or removes one.
 */