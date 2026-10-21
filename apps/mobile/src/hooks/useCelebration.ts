/**
 * The moment an achievement is earned (ADR-0047 §6): a success haptic
 * and a short card, shown once. Ranks are awarded when the screen
 * comes into view and after a tick (`check`); a rank earned at the
 * week's end shows on the next open.
 *
 * Celebration conditions on a positive event only (ADR-0008), and
 * nothing here is ever about a rank not earned or a run that ended.
 */
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import {
  awardAchievements,
  loadUncelebrated,
  markCelebrated,
  type EarnedAchievement,
} from "../db/achievements";
import { recordProblem } from "../lib/problemLog";

export function useCelebration() {
  const [waiting, setWaiting] = useState<EarnedAchievement[]>([]);
  /** Only the latest check lands. */
  const turn = useRef(0);
  /** What has already buzzed, so a re-check doesn't buzz again. */
  const felt = useRef<ReadonlySet<string>>(new Set());

  const check = useCallback(async () => {
    const mine = ++turn.current;
    try {
      await awardAchievements();
      const list = await loadUncelebrated();
      if (mine !== turn.current) return;
      if (list.some((a) => !felt.current.has(a.id))) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        felt.current = new Set(list.map((a) => a.id));
      }
      setWaiting(list);
    } catch (e) {
      // A celebration missed is not worth interrupting the day for.
      recordProblem(e, "load");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void check();
    }, [check]),
  );

  const dismiss = useCallback(async () => {
    const ids = waiting.map((a) => a.id);
    setWaiting([]);
    try {
      await markCelebrated(ids);
    } catch (e) {
      recordProblem(e, "save");
    }
  }, [waiting]);

  return { waiting, check, dismiss };
}
