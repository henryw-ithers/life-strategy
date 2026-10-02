/**
 * One goal's screen data: the goal, every unit a new task could be filed
 * under, and every task in the plan that could join it.
 */
import { useCallback, useState } from "react";

import type { AttachableTask } from "../components/goals/AddExistingTaskSheet";
import type { PickableUnit } from "../components/plan/UnitPicker";
import { useScreenLoad } from "../components/ui/ScreenLoad";
import { loadGoalDetail, loadGoals, type GoalDetail } from "../db/goals";
import { loadPlan } from "../db/tasks";

export function useGoalDetail(goalId: string) {
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  /**
   * Whether a load has finished, as distinct from what it found.
   *
   * `goal === null` covers two states that need different screens: still
   * loading, and loaded but there is no such goal. Without this flag a
   * goal deleted elsewhere — or a stale deep link — leaves a spinner
   * turning forever. `useScreenLoad` only sees thrown errors; a query
   * returning no row is a perfectly successful query.
   */
  const [loaded, setLoaded] = useState(false);
  /** Every scoreable unit, for the add sheet's unit row. A goal's task
   *  defaults to the goal's own unit but may serve others (ADR-0019). */
  const [units, setUnits] = useState<PickableUnit[]>([]);
  /** Everything in the plan that could join this goal (ADR-0030 §2: any
   *  unit, not just the goal's own). */
  const [attachable, setAttachable] = useState<AttachableTask[]>([]);

  const reload = useCallback(async () => {
    const [detail, plan, goalTree] = await Promise.all([
      loadGoalDetail(goalId),
      loadPlan(),
      loadGoals(),
    ]);
    setGoal(detail);
    setLoaded(true);
    setUnits(
      plan.areas.flatMap((a) =>
        a.units
          .filter((u) => u.includeInScoring)
          .map((u) => ({
            id: u.id,
            name: u.name,
            areaId: u.areaId,
            motivationKind: u.motivationKind,
          })),
      ),
    );

    // Every task not already on this goal, from any unit. A task serving
    // a *different* goal is offered and labelled: moving work between
    // goals is legitimate, and hiding it would leave someone hunting for
    // a task the app can see perfectly well.
    const goalTitles = new Map(
      goalTree.areas.flatMap((a) =>
        a.units.flatMap((u) => u.goals.map((g) => [g.id, g.title] as const)),
      ),
    );
    setAttachable(
      plan.areas.flatMap((a) =>
        a.units.flatMap((u) =>
          u.tasks
            .filter((t) => t.goalId !== goalId)
            .map((t) => ({
              id: t.id,
              title: t.title,
              timesPerWeek: t.timesPerWeek,
              unitId: u.id,
              unitName: u.name,
              areaId: u.areaId,
              servingGoalTitle: t.goalId === null ? null : (goalTitles.get(t.goalId) ?? null),
            })),
        ),
      ),
    );
  }, [goalId]);

  const { error, retry } = useScreenLoad(reload);

  return { goal, loaded, units, attachable, reload, error, retry };
}
