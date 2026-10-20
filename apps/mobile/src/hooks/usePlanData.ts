/**
 * The Tasks screen's data: the plan, and today's commitment day (so the
 * coverage bar can lead with the band). A unit's profile, which orders
 * library ideas, comes from its tier on the plan (ADR-0041 §4).
 */
import type { CommitmentDay } from "@glide/scoring";
import { useCallback, useState } from "react";

import { useScreenLoad } from "../components/ui/ScreenLoad";
import { loadCommitmentDay } from "../db/commitments";
import { loadPlan, type PlanData } from "../db/tasks";
import { currentLocalDate } from "../lib/calendar";

export function usePlanData() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [commitmentDay, setCommitmentDay] = useState<CommitmentDay | null>(null);

  const reload = useCallback(async () => {
    const [next, today] = await Promise.all([
      loadPlan(),
      // Without today's commitment day a scheduled day is drawn as an
      // ordinary one and overstates the life units' share.
      loadCommitmentDay(currentLocalDate()),
    ]);
    setPlan(next);
    setCommitmentDay(today);
  }, []);

  const { error, retry, save } = useScreenLoad(reload);

  return { plan, commitmentDay, reload, save, error, retry };
}
