/**
 * The Today screen's data: the selected day, the grades around it, and
 * the two things you do to it most — pick another day, and
 * tick a task off. Everything else the screen does is a write followed
 * by `refresh()`.
 */
import { addDays, type PeriodGrade } from "@glide/scoring";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { isDone } from "../components/today/daySections";
import { setCompletionFraction, toggleCompletion } from "../db/completions";
import { loadCalendarGrades, type MonthDay } from "../db/dayGrades";
import { loadWeekGrade } from "../db/grades";
import { loadDayPlan, type DayPlan } from "../db/dayPlan";
import { loadDay, loadPlannedAhead, type DayData, type TodayTask } from "../db/today";
import { currentLocalDate, isPlannable } from "../lib/calendar";
import { syncDailyNudge } from "../notifications/dailyNudge";

export function useDayData() {
  /** Null = follow today (so an overnight rollover moves with us);
   *  a date = the user navigated to another day. */
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<DayData | null>(null);
  /** Today's windows and what fills them (`loadDayPlan`); null on any
   *  other day, which shows its record instead. */
  const [plan, setPlan] = useState<DayPlan | null>(null);
  /** Only the latest load lands: a tick's reload can't be overwritten
   *  by an older one still in flight. */
  const loadTurn = useRef(0);
  const [weekGrade, setWeekGrade] = useState<PeriodGrade | null>(null);
  const [monthGrades, setMonthGrades] = useState<Map<string, MonthDay>>(new Map());
  /** Null = the month containing today. Any past month is reachable
   *  now that days never lock. */
  const [viewMonth, setViewMonth] = useState<string | null>(null);
  /** Whether every due task was done at the last look, so finishing the
   *  last one is celebrated once rather than on every tap after. */
  const allDoneBefore = useRef(false);

  const reload = useCallback(
    async (
      date: string,
      month?: string | null,
      /** The day as a write just scored it, when it is this date — saves
       *  loading it a second time (`toggleCompletion`). Not on today,
       *  whose windows have to be filled again anyway. */
      scored?: DayData | null,
    ) => {
      const turn = ++loadTurn.current;
      // Today and later days are planned (windows); a past day is its
      // record, so its day alone.
      const planned = date >= currentLocalDate();
      const [loaded, grades, week] = await Promise.all([
        planned ? loadDayPlan(date) : scored?.date === date ? scored : loadDay(date),
        loadCalendarGrades(currentLocalDate(), month ?? currentLocalDate()),
        loadWeekGrade(date),
      ]);
      const nextPlan = "planned" in loaded ? loaded : null;
      const next = nextPlan ? nextPlan.day : (loaded as DayData);
      // A superseded load lands nothing and says so: its caller mustn't
      // announce a score from it.
      if (turn !== loadTurn.current) return null;
      setDay(next);
      setPlan(nextPlan);
      setMonthGrades(grades);
      setWeekGrade(week);
      if (next.date === next.today) void syncDailyNudge(next);
      return next;
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void reload(selected ?? currentLocalDate(), viewMonth).then((d) => {
        if (d === null) return;
        allDoneBefore.current = d.due.length > 0 && d.due.every((t) => t.completedToday);
      });
    }, [reload, selected, viewMonth]),
  );

  /** Reload the day on screen, after a write to it. */
  const refresh = (scored?: DayData | null) =>
    day ? reload(day.date, undefined, scored) : Promise.resolve(null);

  const select = (date: string) => {
    // A future day opens in place, as Plan's day view (spec §5.2), as
    // far ahead as a day can be planned; past that, nothing to arrange.
    if (date > currentLocalDate() && !isPlannable(date, currentLocalDate())) return;
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
    // A newer load overtook this one: it says nothing.
    if (next === null) return;
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

  /** Swipe: the day before or after the one shown. */
  const step = (days: number) => {
    // From the day chosen, not the day loaded: two quick swipes move two.
    select(addDays(selected ?? currentLocalDate(), days));
  };

  /** Whether a swipe can go there: past the last plannable day it can't. */
  const canStep = (days: number) => {
    const date = addDays(selected ?? currentLocalDate(), days);
    return date <= currentLocalDate() || isPlannable(date, currentLocalDate());
  };

  return { day, plan, weekGrade, monthGrades, viewMonth, refresh, select, step, canStep, changeMonth, toggle };
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
  // Closing drops the list, as it closes (during render, not in the
  // effect), so reopening starts from "loading" rather than old rows.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setAhead(null);
  }
  useEffect(() => {
    if (!day || !open) return;
    let live = true;
    void loadPlannedAhead(day.date).then((rows) => {
      if (live) setAhead(rows);
    });
    return () => {
      live = false;
    };
  }, [day, open]);
  return day && open ? ahead : null;
}
