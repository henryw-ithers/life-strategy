/**
 * The plan for a unit's screen: units, tiers, weights and tasks. A
 * unit's profile, which orders library ideas, comes from its tier on
 * the plan (ADR-0041 §4).
 */
import { useCallback, useState } from "react";

import { useScreenLoad } from "../components/ui/ScreenLoad";
import { loadPlan, type PlanData } from "../db/tasks";

export function usePlanData() {
  const [plan, setPlan] = useState<PlanData | null>(null);

  const reload = useCallback(async () => {
    setPlan(await loadPlan());
  }, []);

  const { error, retry, save } = useScreenLoad(reload);

  return { plan, reload, save, error, retry };
}
