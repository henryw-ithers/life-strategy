/**
 * The moment an achievement is earned (ADR-0047 §6): a success haptic
 * and a short card, shown once. Ranks are awarded when the screen
 * comes into view and after a tick (`check`); a rank earned at the
 * week's end shows on the next open.
 *
 * Celebration conditions on a positive event only (ADR-0008), and
 * nothing here is ever about a rank not earned or a run that ended.
 *
 * **Plan-week ranks never come here.** They count weeks a plan was
 * met, and that exception lives off Home, Plan and the grade (AGENTS.md,
 * ADR-0047 §4); they show on Achievements and in the month review.
 */
import type { SeriesId } from "@glide/scoring";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { awardAchievements, takeUncelebrated, type EarnedAchievement } from "../db/achievements";
import { achievementTitle } from "../lib/achievementCopy";
import { recordProblem } from "../lib/problemLog";

/** Series that count weeks a plan was met. */
const PLAN_WEEKS: ReadonlySet<SeriesId> = new Set<SeriesId>([
  "weeklyTargetTotal",
  "weeklyTargetRun",
  "wholeUnitTotal",
  "wholeUnitRun",
]);

/**
 * Ranks are marked celebrated the moment they're taken, so the card
 * shows once whether or not Done is tapped: a later open, or a check
 * after the app was closed, finds nothing new and shows nothing. What
 * was taken stays on the card for the rest of this session until Done.
 */
export function useCelebration() {
  const [waiting, setWaiting] = useState<readonly EarnedAchievement[]>([]);
  /** Only the latest check lands. */
  const turn = useRef(0);
  /** Taken this session and not yet put away. */
  const shown = useRef<readonly EarnedAchievement[]>([]);

  const check = useCallback(async () => {
    const mine = ++turn.current;
    try {
      await awardAchievements();
      const fresh = await takeUncelebrated(PLAN_WEEKS);
      if (fresh.length > 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AccessibilityInfo.announceForAccessibility(
          `You earned ${fresh.map((a) => achievementTitle(a)).join(", ")}`,
        );
        shown.current = [...shown.current, ...fresh];
      }
      if (mine !== turn.current) return;
      setWaiting(shown.current);
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

  const dismiss = useCallback(() => {
    shown.current = [];
    setWaiting([]);
  }, []);

  return { waiting, check, dismiss };
}
