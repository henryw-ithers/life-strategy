/**
 * The Today screen's data: the selected day, the grades around it, its
 * pools, and the two things you do to it most — pick another day, and
 * tick a task off. Everything else the screen does is a write followed
 * by `refresh()`.
 */
import type { PeriodGrade } from "@glide/scoring";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { isDone } from "../components/today/daySections";
import { loadPools, type PoolOnDay } from "../db/commitments";
import { setCompletionFraction, toggleCompletion } from "../db/completions";
import { loadCalendarGrades, type MonthDay } from "../db/dayGrades";
import { loadWeekGrade } from "../db/grades";
import { loadDay, loadPlannedAhead, type DayData, type TodayTask } from "../db/today";
import { currentLocalDate, isPlannable } from "../lib/calendar";
import { syncDailyNudge } from "../notifications/dailyNudge";

export function useDayData() {
  /** Null = follow today (so an overnight rollover moves with us);
   *  a date = the user navigated to another day. */
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<DayData | null>(null);
  const [weekGrade, setWeekGrade] = useState<PeriodGrade | null>(null);
  const [monthGrades, setMonthGrades] = useState<Map<string, MonthDay>>(new Map());
  /** Null = the month containing today. Any past month is reachable
   *  now that days never lock. */
  const [viewMonth, setViewMonth] = useState<string | null>(null);
  /** This day's pools (ADR-0033 §2). */
  const [pools, setPools] = useState<PoolOnDay[]>([]);
  /** Whether every due task was done at the last look, so finishing the
   *  last one is celebrated once rather than on every tap after. */
  const allDoneBefore = useRef(false);

  const reload = useCallback(
    async (
      date: string,
      month?: string | null,
      /** The day as a write just scored it, when it is this date — saves
       *  loading it a second time (`toggleCompletion`). */
      scored?: DayData | null,
    ) => {
      const [next, grades, week, nextPools] = await Promise.all([
        scored?.date === date ? scored : loadDay(date),
        loadCalendarGrades(currentLocalDate(), month ?? currentLocalDate()),
        loadWeekGrade(date),
        loadPools(date),
      ]);
      setDay(next);
      setMonthGrades(grades);
      setWeekGrade(week);
      setPools(nextPools);
      if (next.date === next.today) void syncDailyNudge(next);
      return next;
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void reload(selected ?? currentLocalDate(), viewMonth).then((d) => {
        allDoneBefore.current = d.due.length > 0 && d.due.every((t) => t.completedToday);
      });
    }, [reload, selected, viewMonth]),
  );

  /** Reload the day on screen, after a write to it. */
  const refresh = (scored?: DayData | null) =>
    day ? reload(day.date, undefined, scored) : Promise.resolve(null);

  const select = (date: string) => {
    // A future day cannot be recorded, only arranged — so tapping one
    // leaves Home where it is and opens the planner (ADR-0024 §4).
    // Beyond the planning window there is nothing to arrange yet, so the
    // tap does nothing rather than opening a screen that would have to
    // explain itself.
    if (date > currentLocalDate()) {
      if (isPlannable(date, currentLocalDate())) router.push(`/day/${date}` as Href);
      return;
    }
    setSelected(date === currentLocalDate() ? null : date);
    // Keep the browsed month — picking the 3rd of a month two years back
    // must not snap the calendar home.
    void reload(date, viewMonth);
  };

  const changeMonth = (month: string) => {
    setViewMonth(month);
    if (day) void reload(day.date, month);
  };

  const toggle = async (task: TodayTask) => {
    if (!day) return;
    void Haptics.selectionAsync();
    // Tap always moves forward until the task is done: on a part-done row
    // it finishes rather than throwing away what was logged. Undo lives
    // on the row that is actually finished, and on the sheet.
    const scored =
      task.progress > 0 && task.progress < 1
        ? await setCompletionFraction(task.id, day.date, 1)
        : // A session done ahead belongs to the day it was done on, so
          // undoing it undoes that tick — one session, one completion.
          await toggleCompletion(task.id, task.doneAheadOn ?? day.date);
    const next = await reload(day.date, undefined, scored);
    // The visual feedback is the climbing number; give screen readers the
    // same loop.
    AccessibilityInfo.announceForAccessibility(
      `${task.title} ${isDone(task) ? "unchecked" : "done"}. Day at ${Math.round(next.score.base ?? 0)}.`,
    );
    const allDone = next.due.length > 0 && next.due.every((t) => t.completedToday);
    if (allDone && !allDoneBefore.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    allDoneBefore.current = allDone;
  };

  return { day, weekGrade, monthGrades, viewMonth, pools, refresh, select, changeMonth, toggle };
}

/**
 * One-offs planned for later days, loaded only while "Planned for other
 * days" is open: each later date has to be priced, and a term of
 * assignments is a lot of dates. Re-fetched whenever the day reloads
 * while it is open, so a tick there moves the row straight away; closing
 * it drops the list. Null when closed or not yet loaded.
 */
export function usePlannedAhead(day: DayData | null, open: boolean): TodayTask[] | null {
  const [ahead, setAhead] = useState<TodayTask[] | null>(null);
  useEffect(() => {
    if (!day || !open) {
      setAhead(null);
      return;
    }
    let live = true;
    void loadPlannedAhead(day.date).then((rows) => {
      if (live) setAhead(rows);
    });
    return () => {
      live = false;
    };
  }, [day, open]);
  return ahead;
}
