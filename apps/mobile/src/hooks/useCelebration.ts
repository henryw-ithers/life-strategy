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

import {
  awardAchievements,
  loadUncelebrated,
  markCelebrated,
  type EarnedAchievement,
} from "../db/achievements";
import { achievementTitle } from "../lib/achievementCopy";
import { recordProblem } from "../lib/problemLog";

/** Series that count weeks a plan was met. */
const PLAN_WEEKS: ReadonlySet<SeriesId> = new Set<SeriesId>([
  "weeklyTargetTotal",
  "weeklyTargetRun",
  "wholeUnitTotal",
  "wholeUnitRun",
]);

export function useCelebration() {
  const [waiting, setWaiting] = useState<EarnedAchievement[]>([]);
  /** Only the latest check lands. */
  const turn = useRef(0);
  /** What has already buzzed, so a re-check doesn't buzz again. */
  const felt = useRef<ReadonlySet<string>>(new Set());
  /** Put away this session, so a check that was already running can't
   *  bring them back before `markCelebrated` lands. */
  const dismissed = useRef<Set<string>>(new Set());
  const shown = useRef<readonly EarnedAchievement[]>([]);

  const check = useCallback(async () => {
    const mine = ++turn.current;
    try {
      await awardAchievements();
      const list = (await loadUncelebrated()).filter(
        (a) => !dismissed.current.has(a.id) && !PLAN_WEEKS.has(a.series),
      );
      if (mine !== turn.current) return;
      const fresh = list.filter((a) => !felt.current.has(a.id));
      if (fresh.length > 0) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AccessibilityInfo.announceForAccessibility(
          `You earned ${fresh.map((a) => achievementTitle(a)).join(", ")}`,
        );
        felt.current = new Set(list.map((a) => a.id));
      }
      shown.current = list;
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
    // A check already running is discarded, and can't re-show these.
    turn.current += 1;
    const ids = shown.current.map((a) => a.id);
    for (const id of ids) dismissed.current.add(id);
    shown.current = [];
    setWaiting([]);
    try {
      await markCelebrated(ids);
    } catch (e) {
      recordProblem(e, "save");
    }
  }, []);

  return { waiting, check, dismiss };
}
