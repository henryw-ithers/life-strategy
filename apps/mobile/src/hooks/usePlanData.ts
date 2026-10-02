/**
 * The Tasks screen's data: the plan, today's commitment day (so the
 * coverage bar can lead with the band), active goals per unit (for the
 * edit sheet's goal row), and the latest ratings (for the unit profile
 * that orders library ideas).
 */
import type { CommitmentDay } from "@glide/scoring";
import { useCallback, useState } from "react";

import { useScreenLoad } from "../components/ui/ScreenLoad";
import { loadCommitmentDay } from "../db/commitments";
import { loadGoals } from "../db/goals";
import { latestRatings, loadPlan, type PlanData } from "../db/tasks";
import { currentLocalDate } from "../lib/calendar";

export type GoalsByUnit = Record<string, { id: string; title: string }[]>;

export function usePlanData() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [commitmentDay, setCommitmentDay] = useState<CommitmentDay | null>(null);
  const [goalsByUnit, setGoalsByUnit] = useState<GoalsByUnit>({});
  /** Empty before the first diagnostic. */
  const [ratings, setRatings] = useState<
    Map<string, { importance: number; satisfaction: number }>
  >(new Map());

  const reload = useCallback(async () => {
    const [next, goals, rated, today] = await Promise.all([
      loadPlan(),
      loadGoals(),
      latestRatings(),
      // Without today's commitment day a scheduled day is drawn as an
      // ordinary one and overstates the life units' share.
      loadCommitmentDay(currentLocalDate()),
    ]);
    setPlan(next);
    setCommitmentDay(today);
    setRatings(rated);
    const byUnit: GoalsByUnit = {};
    for (const area of goals.areas) {
      for (const u of area.units) {
        const active = u.goals.filter((g) => g.status === "active");
        if (active.length > 0) {
          byUnit[u.id] = active.map((g) => ({ id: g.id, title: g.title }));
        }
      }
    }
    setGoalsByUnit(byUnit);
  }, []);

  const { error, retry, save } = useScreenLoad(reload);

  return { plan, commitmentDay, goalsByUnit, ratings, reload, save, error, retry };
}
