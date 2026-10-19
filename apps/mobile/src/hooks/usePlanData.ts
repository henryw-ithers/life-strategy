/**
 * The Tasks screen's data: the plan, today's commitment day (so the
 * coverage bar can lead with the band), and the latest ratings (for the
 * unit profile that orders library ideas).
 */
import type { CommitmentDay } from "@glide/scoring";
import { useCallback, useState } from "react";

import { useScreenLoad } from "../components/ui/ScreenLoad";
import { loadCommitmentDay } from "../db/commitments";
import { latestRatings, loadPlan, type PlanData } from "../db/tasks";
import { currentLocalDate } from "../lib/calendar";

export function usePlanData() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [commitmentDay, setCommitmentDay] = useState<CommitmentDay | null>(null);
  /** Empty before the first diagnostic. */
  const [ratings, setRatings] = useState<
    Map<string, { importance: number; satisfaction: number }>
  >(new Map());

  const reload = useCallback(async () => {
    const [next, rated, today] = await Promise.all([
      loadPlan(),
      latestRatings(),
      // Without today's commitment day a scheduled day is drawn as an
      // ordinary one and overstates the life units' share.
      loadCommitmentDay(currentLocalDate()),
    ]);
    setPlan(next);
    setCommitmentDay(today);
    setRatings(rated);
  }, []);

  const { error, retry, save } = useScreenLoad(reload);

  return { plan, commitmentDay, ratings, reload, save, error, retry };
}
