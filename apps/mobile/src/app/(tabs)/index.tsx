/**
 * Today — the daily checklist, the app's home (replaces the scaffold).
 * A checklist and a number: today's derived tasks, a grade that only
 * climbs while you watch it, and the day's life-log. Day navigation
 * spans the ADR-0004 edit window; "today" is just the selected day.
 * The date header expands the current month (calendar phase, early).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  addDays,
  isEditable,
  ROLLOVER_HOUR,
  specialDayBonus,
  weekStart,
  type PeriodGrade,
  type Window as GridWindow,
} from "@glide/scoring";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Redirect, router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { LinearTransition, useReducedMotion } from "react-native-reanimated";

import { ActivitySheet, type ExistingActivity } from "../../components/today/ActivitySheet";
import { CompletionTagSheet } from "../../components/today/CompletionTagSheet";
import { DayKindSheet } from "../../components/today/DayKindSheet";
import { DayNumber } from "../../components/today/DayNumber";
import { MonthGrid } from "../../components/today/MonthGrid";
import { NoteSheet } from "../../components/today/NoteSheet";
import { MoveTaskSheet } from "../../components/today/MoveTaskSheet";
import { PartialSheet } from "../../components/today/PartialSheet";
import { DayGrid, windowKey } from "../../components/today/DayGrid";
import { WindowSheet } from "../../components/today/WindowSheet";
import { loadPools, type PoolOnDay } from "../../db/commitments";
import {
  createPool,
  deletePool,
  updatePool,
} from "../../db/commitmentWrites";
import {
  loadDayLayout,
  setDayLayout,
  type DayLayout,
} from "../../db/settings";
import { Segmented } from "../../components/plan/Segmented";
import { SectionedChecklist } from "../../components/today/SectionedChecklist";
import { TaskRow } from "../../components/today/TaskRow";
import { WeekStrip } from "../../components/today/WeekStrip";
import {
  ANYTIME_LABEL,
  compareForDay,
  carriedPart,
  emptyPeriodNote,
  isPast,
  partNow,
  PART_OF_DAY_LABEL,
  PART_OF_DAY_ORDER,
  pinnedElsewhere,
  type PartOfDay,
} from "../../components/plan/planning";
import { AppText } from "../../components/ui/AppText";
import { Chevron, Disclosure } from "../../components/ui/Chevron";
import { ActivityRow, DayRecord } from "../../components/today/DayRecord";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { Button } from "../../components/ui/Button";
import { loadWeekGrade } from "../../db/grades";
import { isOnboardingComplete } from "../../db/onboarding";
import {
  addJournalEntry,
  addPhoto,
  currentLocalDate,
  deleteActivity,
  deleteJournalEntry,
  deletePhoto,
  editWindowDays,
  loadDay,
  loadCalendarGrades,
  logActivity,
  setDayKind,
  setCompletionTags,
  clearPlacementForDay,
  isPlannable,
  placeTaskForDay,
  setCompletionFraction,
  toggleCompletion,
  updateActivity,
  updateJournalEntry,
  type DayData,
  type MonthDay,
  type TodayActivity,
  type TodayTask,
} from "../../db/today";
import { reorderDayTasks, setTaskPartOfDay } from "../../db/tasks";
import { spokenDate } from "../../lib/format";
import { syncDailyNudge } from "../../notifications/dailyNudge";
import { getTheme, SCRIM } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";

/**
 * The checklist is the shape of a day (ADR-0024 §3, as amended
 * 2026-08-17).
 *
 * **The three parts of the day always render**, in order, whether or
 * not anything sits in them; an empty one reads *Free*, or *All done*
 * once its tasks are ticked off. The earlier
 * build grouped by frequency ("Every day," "This week") until some task
 * carried a part of day, and hid empty sections once one did. Both are
 * gone: a day whose morning is missing from the page does not read as a
 * day, and "free until this afternoon" is the single most useful thing
 * the screen can say. Planning now happens when a task is created, so
 * the shape is populated from the first task rather than after a
 * separate trip through the edit sheet.
 *
 * `anytime` holds everything that was deliberately left unplaced. It
 * is not a fourth time of day, so it appears only when it has
 * something in it — an empty Anytime is nothing to report, not free
 * time. `doneWeek` and `completed` behave the same way and sit last.
 */
/** Uniform, because `ReorderableList` positions rows from their index.
 *  Fits a title plus its factual caption with the row's own padding. */
const CHECKLIST_ROW_HEIGHT = 56;

/**
 * Minutes into today. Past midnight and before the 3am rollover it is
 * still today, so the count runs on past 1440 rather than wrapping to
 * a morning that has not started.
 */
function minuteOfToday(): number {
  const now = new Date();
  const minute = now.getHours() * 60 + now.getMinutes();
  return now.getHours() < ROLLOVER_HOUR ? minute + 24 * 60 : minute;
}

/** Two words, because the difference is the whole point. */
const LAYOUTS = [
  { value: "checklist" as const, label: "List" },
  { value: "grid" as const, label: "Hours" },
];

/** The header block above each part of the day, including the air
 *  that separates it from the slot above. Fixed, because the drag
 *  layout walks these to place every row. */
const CHECKLIST_HEADER_HEIGHT = 48;

type SectionKey =
  | "morning"
  | "afternoon"
  | "evening"
  | "anytime"
  | "otherDays"
  | "doneWeek"
  | "completed";

/** Everything off the daily surface, in the order the app's own
 *  hierarchy runs: strategy (plan, goals), then the periodic ritual
 *  (diagnostic, portfolio), then settings. */
export default function TodayScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  /** Dynamic Type, so the grid's hours grow with its labels. */
  const { fontScale } = useWindowDimensions();

  /** Null = follow today (so an overnight rollover moves with us);
   *  a date = the user navigated somewhere in the edit window. */
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<DayData | null>(null);
  const [weekGrade, setWeekGrade] = useState<PeriodGrade | null>(null);
  const [monthGrades, setMonthGrades] = useState<Map<string, MonthDay>>(new Map());
  const [monthOpen, setMonthOpen] = useState(false);
  /** Null = the month containing today. Set by the calendar's arrows;
   *  any past month is reachable now that days never lock. */
  const [viewMonth, setViewMonth] = useState<string | null>(null);
  const [kindSheet, setKindSheet] = useState(false);
  const [activitySheet, setActivitySheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  /** Set while the note sheet is rewriting an existing entry rather
   *  than writing a new one. */
  const [editingNote, setEditingNote] = useState<{ id: string; body: string } | null>(
    null,
  );
  const [editingActivity, setEditingActivity] = useState<TodayActivity | null>(null);
  const [taggingTask, setTaggingTask] = useState<TodayTask | null>(null);
  /** A future day being arranged (ADR-0024 §4). Holds its own
   *  loaded day, since the screen behind it still shows today. */
  /** The row whose slot is being changed (ADR-0024 phase 3). */
  const [movingTask, setMovingTask] = useState<TodayTask | null>(null);
  /** The row whose part-credit sheet is open (ADR-0014 §4). */
  const [partialTask, setPartialTask] = useState<TodayTask | null>(null);
  /** Checklist or hours. Presentation only — both hold the same day. */
  const [dayLayout, setDayLayoutState] = useState<DayLayout>("checklist");
  /** This day's pools, and the one being edited (ADR-0033 §2). */
  const [pools, setPools] = useState<PoolOnDay[]>([]);
  const [planning, setPlanning] = useState<{
    window: GridWindow;
    chosen: string[];
    plannedCount: number;
    poolId: string | null;
    /** Unfinished options from windows that have ended (ADR-0033 §2). */
    carried: string[];
  } | null>(null);
  /** A cross-slot drop awaiting its scope answer. */
  const [dropped, setDropped] = useState<{
    task: TodayTask;
    part: PartOfDay | null;
    ordered: string[];
  } | null>(null);
  /** A drag owns the finger; the page must hold still under it. */
  const [draggingTask, setDraggingTask] = useState(false);
  const [collapsed, setCollapsed] = useState<Partial<Record<SectionKey, boolean>>>(
    {},
  );
  const allDoneBefore = useRef(false);
  /** null while unknown — the gate must not flash Today before it
   *  resolves (ADR-0011 decision 1). Reads fail open. */
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    void isOnboardingComplete().then(setOnboarded);
    void loadDayLayout().then(setDayLayoutState);
  }, []);

  const reload = useCallback(async (date: string, month?: string | null) => {
    const [next, grades, week, nextPools] = await Promise.all([
      loadDay(date),
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload(selected ?? currentLocalDate(), viewMonth).then((d) => {
        allDoneBefore.current =
          d.due.length > 0 && d.due.every((t) => t.completedToday);
      });
    }, [reload, selected, viewMonth]),
  );

  const select = (date: string) => {
    // A future day cannot be recorded, only arranged — so tapping one
    // leaves Home where it is and opens the planner (ADR-0024 §4).
    // Beyond the planning window there is nothing to arrange yet, so
    // the tap does nothing rather than opening a screen that would
    // have to explain itself.
    if (date > currentLocalDate()) {
      if (isPlannable(date, currentLocalDate())) {
        router.push(`/day/${date}` as Href);
      }
      return;
    }
    setSelected(date === currentLocalDate() ? null : date);
    // Keep the browsed month — picking the 3rd of a month two years
    // back must not snap the calendar home.
    void reload(date, viewMonth);
  };

  const onToggle = async (task: TodayTask) => {
    if (!day) return;
    void Haptics.selectionAsync();
    // Tap always moves forward until the task is done: on a part-done
    // row it finishes rather than throwing away what was logged. Undo
    // lives on the row that is actually finished, and on the sheet.
    if (task.progress > 0 && task.progress < 1) {
      await setCompletionFraction(task.id, day.date, 1);
    } else {
      // A session done ahead belongs to the day it was done on, so
      // undoing it undoes that tick — one session, one completion.
      await toggleCompletion(task.id, task.doneAheadOn ?? day.date);
    }
    const next = await reload(day.date);
    // The visual feedback is the climbing number; give screen readers
    // the same loop.
    AccessibilityInfo.announceForAccessibility(
      `${task.title} ${isDone(task) ? "unchecked" : "done"}. Day at ${Math.round(next.score.base ?? 0)}.`,
    );
    const allDone =
      next.due.length > 0 && next.due.every((t) => t.completedToday);
    if (allDone && !allDoneBefore.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    allDoneBefore.current = allDone;
  };

  const pickPhoto = async () => {
    if (!day) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      await addPhoto(day.date, res.assets[0].uri);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await reload(day.date);
    }
  };

  const isToday = day?.date === day?.today;
  /** Notes and photos stay addable past the edit window (ADR-0002:
   *  grades finalize, memories don't) — only the future is off-limits. */
  const canRecord = day !== null && day.date <= day.today;
  const dormant = day !== null && day.score.earned === 0;
  const layout = reduceMotion ? undefined : LinearTransition.duration(200);

  const hueFor = (t: TodayTask) => theme.areas[t.areaId] ?? theme.accent;

  // Presentation-level re-sort: anything done today lives in Completed.
  const allTasks = day ? [...day.due, ...day.week, ...day.doneThisWeek] : [];

  /**
   * Ordering and the other-days split both live in `planning.ts`, so
   * the checklist and the planner cannot drift into arranging the same
   * day two ways. See `compareForDay` and `pinnedElsewhere` there for
   * why the order is what it is.
   */
  const byPlan = (a: TodayTask, b: TodayTask) =>
    compareForDay(a, b, day?.date ?? "");

  /**
   * Which part of the day it is, on today only — the window unfinished
   * work carries forward into (ADR-0033 §2). Null on any other day.
   */
  const nowPart =
    day && day.date === day.today ? partNow(minuteOfToday()) : null;

  /**
   * Where a row sits on the checklist: its own part of day, or — once
   * that window has ended — the one open now. A task with a clock time
   * stays put: a 9am lecture is not afternoon work because nobody ticked
   * it, and its time is a fact about the day rather than a window to
   * fill.
   */
  const shownPart = (t: TodayTask): PartOfDay | null =>
    t.startMinute !== null ? t.partOfDay : carriedPart(t.partOfDay, nowPart);

  /** Done today, or done ahead on an earlier day (ADR-0032 §4). */
  function isDone(t: TodayTask): boolean {
    return t.completedToday || t.doneAheadOn !== null;
  }

  const openTasks = day
    ? [...day.due, ...day.week].filter((t) => !isDone(t))
    : [];

  const isElsewhere = (t: TodayTask): boolean =>
    day ? pinnedElsewhere(t, day.date) : false;
  const todayTasks = openTasks.filter((t) => !isElsewhere(t));
  const otherDayTasks = openTasks.filter(isElsewhere).sort(byPlan);

  /** `emptyNote` null means the section hides when it empties — the
   *  rule for everything that is not one of the three periods. */
  const partSection = (part: PartOfDay | null) => {
    const tasks = todayTasks.filter((t) => shownPart(t) === part).sort(byPlan);
    return {
      key: (part ?? "anytime") as SectionKey,
      label: part ? PART_OF_DAY_LABEL[part] : ANYTIME_LABEL,
      tasks,
      pts: tasks.reduce((a, t) => a + t.pointValue, 0),
      // A window that has ended is shown only while it still holds
      // something — a timed task, which does not carry. Empty, it would
      // be a drop target in the past and a "Free" that is not.
      emptyNote:
        part === null || isPast(part, nowPart)
          ? null
          : emptyPeriodNote(
              allTasks.some((t) => t.partOfDay === part && t.completedToday),
            ),
    };
  };

  const sections: {
    key: SectionKey;
    label: string;
    tasks: TodayTask[];
    pts: number;
    emptyNote: string | null;
  }[] = day
    ? [
        // Explicit arrow rather than a bare reference: `map` passes an
        // index as the second argument, and a one-arg callback used
        // point-free is how that bites.
        ...PART_OF_DAY_ORDER.map((p) => partSection(p)),
        partSection(null),
        {
          // Named for what it is, not for what it isn't: these are
          // planned, just not for today. Hidden when empty, like
          // everything that is not one of the three periods.
          key: "otherDays" as const,
          label: "Planned for other days",
          tasks: otherDayTasks,
          pts: otherDayTasks.reduce((a, t) => a + t.pointValue, 0),
          emptyNote: null,
        },
        {
          key: "doneWeek" as const,
          label: "Done this week",
          tasks: day.doneThisWeek.filter((t) => !t.completedToday),
          pts: day.doneThisWeek
            .filter((t) => !t.completedToday)
            .reduce((a, t) => a + t.pointsIfCompletedNow, 0),
          emptyNote: null,
        },
        {
          key: "completed" as const,
          label: "Completed",
          tasks: allTasks.filter(isDone),
          pts: allTasks
            .filter(isDone)
            .reduce(
              (a, t) => a + (t.extraToday ? t.pointsIfCompletedNow : t.pointValue),
              0,
            ),
          emptyNote: null,
        },
      ].filter((s) => s.tasks.length > 0 || s.emptyNote !== null)
    : [];

  /** The four parts of the day are one drag surface; the rest of
   *  the page is not. Empty periods stay in — they are drop
   *  targets, so a section with nothing in it still has to be
   *  somewhere the finger can land. */
  /**
   * The day's rows as the grid draws them: everything for today,
   * finished or not.
   *
   * Completed work stays in, dimmed. The grid's job is the *shape* of
   * the day, and a 9am lecture you attended leaving a hole in the
   * morning would misreport that shape — which is the one thing this
   * view exists to get right.
   */
  const gridTasks = day
    ? [...todayTasks, ...allTasks.filter(isDone)]
    : [];

  /**
   * Whether the hours are worth offering.
   *
   * Nothing timed means the grid is an empty ruler with the whole day
   * in chips underneath — strictly less than the checklist. The
   * exception is being in it already: a toggle you can enter and not
   * leave is a trap.
   */
  const showsGrid =
    dayLayout === "grid" ||
    gridTasks.some((t) => t.startMinute !== null && t.endMinute !== null);

  /** What each window already holds, keyed the way the grid keys them. */
  const pooledByWindow = new Map<string, string[]>(
    pools.map((p) => [windowKey(p), p.taskIds]),
  );

  const ARRANGEABLE: SectionKey[] = ["morning", "afternoon", "evening", "anytime"];
  const arrangeable = sections.filter((s) =>
    ARRANGEABLE.includes(s.key),
  );
  const tailSections = sections
    .filter((s) => !ARRANGEABLE.includes(s.key))
    // The grid already shows today's completed work in place, so the
    // Completed section would be the same rows a second time.
    .filter((s) => !(dayLayout === "grid" && s.key === "completed"));

  /**
   * A row was dropped. Two different things can have happened, and
   * they get different answers.
   *
   * **Reordered inside its slot** — persist the new order and say
   * nothing. Arrangement is a preference, not a plan.
   *
   * **Dragged into another slot** — that is a scheduling decision,
   * so it asks the question a drag has nowhere to put: is this how
   * the task goes from now on, or just how today goes? The row is
   * already visually where it was dropped, so the prompt confirms
   * scope rather than the move itself.
   */
  const onDropTask = (rowId: string, toSectionKey: string, toIndex: number) => {
    if (!day) return;
    const moved = openTasks.find((t) => t.id === rowId);
    if (!moved) return;
    const toPart: PartOfDay | null =
      toSectionKey === "anytime" ? null : (toSectionKey as PartOfDay);

    // The order of that slot after the drop, for persistence.
    // Against where rows are *shown*, not where they were planned: a
    // morning task carried into the afternoon and reordered there is a
    // reorder, not a move that needs its scope asked.
    const others = openTasks
      .filter((t) => t.id !== rowId && (shownPart(t) ?? "anytime") === toSectionKey)
      .sort(byPlan)
      .map((t) => t.id);
    const ordered = [...others];
    ordered.splice(Math.min(toIndex, ordered.length), 0, rowId);

    if (shownPart(moved) === toPart) {
      void reorderDayTasks(ordered).then(() => reload(day.date));
      return;
    }
    setDropped({ task: moved, part: toPart, ordered });
  };

  const closeActivitySheet = () => {
    setActivitySheet(false);
    setEditingActivity(null);
  };

  /** Adding to the day's record. Sits with the record itself rather
   *  than up beside the grade — these add notes and photos, and having
   *  them a screen away from what they add to cost the checklist the
   *  most valuable rows on the page. Rendered even when the record is
   *  empty, since that's when you most need the way in. */
  const recordActions = (
    <View style={styles.recordButtons}>
      <Pressable
        onPress={() => setNoteSheet(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Add a note to this day"
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <View style={styles.recordAction}>
          <Ionicons name="add" size={15} color={theme.accent} />
          <AppText variant="label" color={theme.accent}>
            Note
          </AppText>
        </View>
      </Pressable>
      <Pressable
        onPress={() => void pickPhoto()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Add a photo to this day"
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <View style={styles.recordAction}>
          <Ionicons name="add" size={15} color={theme.accent} />
          <AppText variant="label" color={theme.accent}>
            Photo
          </AppText>
        </View>
      </Pressable>
    </View>
  );

  const existingForSheet: ExistingActivity | null = editingActivity
    ? {
        id: editingActivity.id,
        title: editingActivity.title,
        note: editingActivity.note,
        size: editingActivity.size,
        tagUnitIds: editingActivity.tags.map((t) => t.unitId),
      }
    : null;

  // The onboarding gate (ADR-0011). Hooks above run unconditionally;
  // only the render is withheld. Splash covers the null case.
  if (onboarded === null) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      {day === null ? (
        <ActivityIndicator color={theme.muted} style={styles.loading} />
      ) : (
        <>
          {/* ── Fixed header ──
              The day's identity (date, grade) and its navigation. This
              is the one part of Home you always need in view, so it
              stays put and the checklist scrolls beneath it. */}
          <View
            style={[
              styles.header,
              { paddingTop: insets.top + space.sm, borderBottomColor: theme.hairline },
            ]}
          >
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => setMonthOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={`${spokenDate(day.date)}. ${monthOpen ? "Hide" : "Show"} the month`}
                style={styles.headerText}
              >
                <AppText variant="display" color={theme.ink}>
                  {isToday ? "Today" : spokenDate(day.date).split(",")[0]}
                </AppText>
                <View style={styles.sectionLabel}>
                  <AppText variant="caption" color={theme.muted}>
                    {spokenDate(day.date)}
                    {day.finalized ? " · settled" : ""}
                  </AppText>
                  <Disclosure open={monthOpen} theme={theme} size={13} />
                </View>
              </Pressable>
              <View style={styles.headerRight}>
                {day.kind === "rest" ? (
                  <AppText variant="title" color={theme.muted}>
                    Day off
                  </AppText>
                ) : (
                  <DayNumber
                    key={day.date}
                    base={day.score.base}
                    dormant={dormant && day.kind === "normal"}
                    theme={theme}
                    reduceMotion={reduceMotion}
                  />
                )}
                {day.editable ? (
                  <Pressable
                    onPress={() => setKindSheet(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Change what kind of day this is"
                    style={({ pressed }) => [styles.kindButton, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <AppText variant="headline" color={theme.muted}>
                      ⋯
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Days count once they're over (ADR-0004 §5 / periodDays),
                so today is not in this number yet — say so rather than
                let a completed task appear to do nothing.

                The day count is not decoration: an unrecorded day is no
                longer graded at all, so this average can stand on two
                days as easily as seven. Stating what it rests on is
                what keeps it honest. */}
            {weekGrade?.base !== null && weekGrade?.base !== undefined ? (
              <AppText variant="caption" color={theme.muted} style={styles.weekStat}>
                {weekStart(day.date) === weekStart(day.today)
                  ? `This week, through yesterday · ${weekGrade.base}%`
                  : `That week · ${weekGrade.base}%`}
                {weekGrade.gradedDays > 0
                  ? ` · ${weekGrade.gradedDays} ${
                      weekGrade.gradedDays === 1 ? "day" : "days"
                    }`
                  : ""}
              </AppText>
            ) : null}

            {/* ── Month / week navigation ── */}
            {monthOpen ? (
              <Animated.View layout={layout} style={styles.strip}>
                <MonthGrid
                  month={viewMonth ?? day.today}
                  onChangeMonth={(m) => {
                    setViewMonth(m);
                    void reload(day.date, m);
                  }}
                  grades={monthGrades}
                  selected={day.date}
                  today={day.today}
                  onSelect={select}
                  theme={theme}
                />
              </Animated.View>
            ) : (
              <Animated.View layout={layout} style={styles.strip}>
                <WeekStrip
                  days={editWindowDays(day.today)}
                  grades={monthGrades}
                  selected={day.date}
                  today={day.today}
                  onSelect={select}
                  theme={theme}
                />
              </Animated.View>
            )}

            {/* The planner's discoverable way in. Tapping a future day
                in the strip above opens the same screen, but that is a
                gesture you have to already know about, and ADR-0024 §4
                wants planning to be a thing you do rather than a thing
                you find.

                It sits here, under the dates, rather than at the foot
                of the scroll where it used to: an affordance about
                *which day* belongs beside the days, and the bottom of a
                scroll is where you put something you hope nobody
                needs. Right-aligned and quiet, so it reads as an exit
                from the strip and never competes with the grade. */}
            {day.hasTasks ? (
              <View style={styles.headerActions}>
                {/* Only once the day has an hour to show, or once you
                    are already in the grid and need the way back. A
                    toggle whose other side is an empty ruler is a
                    control offering nothing, and the checklist is the
                    app for anyone who never times anything. */}
                {showsGrid ? (
                  <View style={styles.layoutToggle}>
                    <Segmented
                      segments={LAYOUTS}
                      value={dayLayout}
                      onChange={(next) => {
                        setDayLayoutState(next);
                        void setDayLayout(next);
                      }}
                      accent={theme.accent}
                      theme={theme}
                      label="How to show the day"
                    />
                  </View>
                ) : null}
                <Pressable
                  onPress={() => router.push(`/day/${addDays(day.today, 1)}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel="Plan ahead"
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.planAhead,
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                >
                  <AppText variant="footnote" color={theme.accent}>
                    Plan ahead
                  </AppText>
                  <Chevron color={theme.accent} theme={theme} size={13} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <ScrollView
            style={styles.body}
            scrollEnabled={!draggingTask}
            contentContainerStyle={styles.container}
          >
            {day.finalized ? (
              <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
                This day has settled. You can still change it — editing it
                now will move the week and month it belongs to.
              </AppText>
            ) : null}

            {day.kind === "rest" ? (
              <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
                Nothing counts today; anything you do still logs.
              </AppText>
            ) : null}

            {/* ── The day's record: ahead of tasks on past days, where
                the log leads; below them on today, where doing leads. ── */}
            {!isToday ? (
              <>
                <DayRecord
                  day={day}
                  theme={theme}
                  onEditNote={(note) => {
                    setEditingNote(note);
                    setNoteSheet(true);
                  }}
                  onDeleteNote={(id) => {
                    void deleteJournalEntry(id).then(() => reload(day.date));
                  }}
                  onDeletePhoto={(id) => {
                    void deletePhoto(id).then(() => reload(day.date));
                  }}
                />
                {canRecord ? recordActions : null}
              </>
            ) : null}

            {/* ── Body ── */}
            {!day.hasSnapshot ? (
              <View style={styles.empty}>
                <AppText color={theme.ink} style={styles.centerText}>
                  Your day starts with a plan. Rate what matters first, and
                  the checklist builds itself.
                </AppText>
                <Button
                  label="Run the diagnostic"
                  onPress={() => router.push("/diagnostic" as Href)}
                  theme={theme}
                />
              </View>
            ) : !day.hasTasks ? (
              <View style={styles.empty}>
                <AppText color={theme.ink} style={styles.centerText}>
                  Your daily budget is set. Now give it something to do.
                </AppText>
                <Button
                  label="Plan your tasks"
                  onPress={() => router.push("/plan" as Href)}
                  theme={theme}
                />
              </View>
            ) : (
              <>
                {/* A special day keeps its checklist (ADR-0023 §3). The
                    story sits above the tasks rather than replacing
                    them: the rating tops the day up, it doesn't stand
                    in for the work. */}
                {day.kind === "special" ? (
                  <View style={styles.special}>
                    <AppText variant="title" color={theme.ink}>
                      {day.title ?? "A special day"}
                    </AppText>
                    <AppText variant="caption" color={theme.muted}>
                      {day.satisfactionRating !== null
                        ? `Rated ${day.satisfactionRating} of 10 · worth ${specialDayBonus(
                            day.satisfactionRating,
                          )} points`
                        : "When it's over, rate how it was."}
                    </AppText>
                    {day.editable ? (
                      <Button
                        label={
                          day.satisfactionRating === null ? "Rate the day" : "Edit the day"
                        }
                        variant="secondary"
                        onPress={() => setKindSheet(true)}
                        theme={theme}
                      />
                    ) : null}
                  </View>
                ) : null}

                {/* The four arrangeable parts of the day are one drag
                    surface: reorder inside a slot, or drag a task into
                    another slot entirely. Empty periods are drop
                    targets too, which is the point — "do this in the
                    afternoon" matters most when the afternoon is
                    empty. */}
                {dayLayout === "grid" ? (
                  <DayGrid
                    tasks={gridTasks}
                    hueFor={hueFor}
                    theme={theme}
                    fontScale={fontScale}
                    // A line for where you are, and only on the day you
                    // are actually in. On any other day it would point
                    // at an hour that has nothing to do with it.
                    nowMinute={day.date === day.today ? minuteOfToday() : null}
                    onPress={(t) => void onToggle(t)}
                    pooledByWindow={pooledByWindow}
                    onPlanWindow={
                      day.editable
                        ? (w, _own, carried) => {
                            const existing = pools.find(
                              (p) => windowKey(p) === windowKey(w),
                            );
                            setPlanning({
                              window: w,
                              chosen: existing?.taskIds ?? [],
                              plannedCount: existing?.plannedCount ?? 1,
                              poolId: existing?.id ?? null,
                              carried,
                            });
                          }
                        : undefined
                    }
                  />
                ) : arrangeable.length > 0 ? (
                  <SectionedChecklist
                    sections={arrangeable.map((s) => ({
                      key: s.key,
                      rowIds: s.tasks.map((t) => t.id),
                    }))}
                    rowHeight={CHECKLIST_ROW_HEIGHT}
                    headerHeights={arrangeable.map(() => CHECKLIST_HEADER_HEIGHT)}
                    onDragStateChange={setDraggingTask}
                    onMove={onDropTask}
                    theme={theme}
                    renderHeader={(key) => {
                      const s = arrangeable.find((x) => x.key === key);
                      if (!s) return null;
                      return (
                        <View style={styles.dragHeader}>
                          {s.tasks.length === 0 ? (
                            <View
                              style={styles.sectionHeader}
                              accessible
                              accessibilityLabel={`${s.label}, ${s.emptyNote}`}
                            >
                              <AppText variant="caption" color={theme.muted}>
                                {s.label}
                              </AppText>
                              <AppText variant="caption" color={theme.muted}>
                                {s.emptyNote}
                              </AppText>
                            </View>
                          ) : (
                            <View style={styles.sectionHeader}>
                              <AppText variant="caption" color={theme.muted}>
                                {s.label}
                              </AppText>
                              <AppText variant="caption" color={theme.muted} tabular>
                                {s.pts} pts
                              </AppText>
                            </View>
                          )}
                        </View>
                      );
                    }}
                    renderRow={(rowId) => {
                      const t = openTasks.find((x) => x.id === rowId);
                      if (!t) return null;
                      return (
                        <TaskRow
                          task={t}
                          hue={hueFor(t)}
                          disabled={!day.editable}
                          onToggle={() => void onToggle(t)}
                          onTag={
                            t.completedToday && day.editable && day.communalUnits.length > 0
                              ? () => setTaggingTask(t)
                              : undefined
                          }
                          onPartial={
                            t.allowsPartial && day.editable && t.progress < 1
                              ? () => setPartialTask(t)
                              : undefined
                          }
                          onMove={
                            day.editable && !t.completedToday
                              ? () => setMovingTask(t)
                              : undefined
                          }
                          tagHues={theme.areas}
                          theme={theme}
                          reduceMotion={reduceMotion}
                        />
                      );
                    }}
                  />
                ) : null}

                {/* The day's tail — planned elsewhere, done this week,
                    completed. Not arrangeable: these are history or
                    another day's business, and dragging them here would
                    imply they belong to this one. */}
                {tailSections.map((s) => (
                <Animated.View
                  key={s.key}
                  layout={layout}
                  style={
                    s.key === "doneWeek" || s.key === "completed"
                      ? [styles.tail, { borderTopColor: theme.hairline }]
                      : styles.period
                  }
                >
                  <Pressable
                    onPress={() =>
                      setCollapsed((prev) => ({ ...prev, [s.key]: !prev[s.key] }))
                    }
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !collapsed[s.key] }}
                    accessibilityLabel={`${s.label}, ${s.pts} points`}
                    hitSlop={{ top: 6, bottom: 6 }}
                    style={styles.sectionHeader}
                  >
                    <View style={styles.sectionLabel}>
                      <AppText variant="caption" color={theme.muted}>
                        {s.label}
                      </AppText>
                      <Disclosure
                        open={collapsed[s.key] !== true}
                        theme={theme}
                        size={13}
                      />
                    </View>
                    <AppText variant="caption" color={theme.muted} tabular>
                      {s.pts} pts
                    </AppText>
                  </Pressable>
                  {collapsed[s.key]
                    ? null
                    : s.tasks.map((t) => (
                        <Animated.View key={t.id} layout={layout}>
                          <TaskRow
                            task={t}
                            hue={hueFor(t)}
                            disabled={
                              !day.editable ||
                              (t.doneAheadOn !== null &&
                                !isEditable(t.doneAheadOn, day.today))
                            }
                            onToggle={() => void onToggle(t)}
                            onTag={
                              t.completedToday && day.editable && day.communalUnits.length > 0
                                ? () => setTaggingTask(t)
                                : undefined
                            }
                            onPartial={
                              t.allowsPartial &&
                              day.editable &&
                              t.progress < 1 &&
                              t.doneAheadOn === null
                                ? () => setPartialTask(t)
                                : undefined
                            }
                            onMove={
                              day.editable && !isDone(t)
                                ? () => setMovingTask(t)
                                : undefined
                            }
                            tagHues={theme.areas}
                            theme={theme}
                            reduceMotion={reduceMotion}
                          />
                        </Animated.View>
                      ))}
                </Animated.View>
                ))}
              </>
            )}

            {/* ── Activities ── */}
            {day.hasSnapshot && day.hasTasks ? (
              <Animated.View
                layout={layout}
                style={[styles.band, { borderTopColor: theme.hairline }]}
              >
                {day.activities.length > 0 ? (
                  <AppText variant="caption" color={theme.muted}>
                    Logged
                  </AppText>
                ) : null}
                {day.activities.map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    dayKind={day.kind}
                    disabled={!day.editable}
                    onPress={() => {
                      setEditingActivity(a);
                      setActivitySheet(true);
                    }}
                    theme={theme}
                  />
                ))}
                {day.editable ? (
                  <Pressable
                    onPress={() => {
                      setEditingActivity(null);
                      setActivitySheet(true);
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.logButton, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <View style={styles.recordAction}>
                      <Ionicons name="add" size={15} color={theme.accent} />
                      <AppText variant="label" color={theme.accent}>
                        Log an activity
                      </AppText>
                    </View>
                  </Pressable>
                ) : null}
              </Animated.View>
            ) : null}

            {/* ── Today's record sits below the checklist (feedback,
                without pushing today's tasks down). ── */}
            {isToday ? (
              <>
                <DayRecord
                  day={day}
                  theme={theme}
                  onEditNote={(note) => {
                    setEditingNote(note);
                    setNoteSheet(true);
                  }}
                  onDeleteNote={(id) => {
                    void deleteJournalEntry(id).then(() => reload(day.date));
                  }}
                  onDeletePhoto={(id) => {
                    void deletePhoto(id).then(() => reload(day.date));
                  }}
                />
                {canRecord ? recordActions : null}
              </>
            ) : null}

            {/* Takes up whatever's left so the footer sits at the
                bottom on a short day (an empty state, a rest day)
                instead of floating mid-screen above blank canvas. */}
            <View style={styles.spacer} />

            {/* ── Footer ──
                The destination chips that used to live here are now
                the tab bar; what remains is the line that has to stay
                next to the number, not next to the navigation. */}
            <View style={[styles.footer, { borderTopColor: theme.hairline }]}>
              <AppText variant="footnote" color={theme.muted}>
                Grades are guidelines, not judgments.
              </AppText>
            </View>
          </ScrollView>
        </>
      )}


      {day ? (
        <>
          {/* One sheet, both jobs: blank to add, seeded to rewrite.
              `editingNote` is what tells them apart. */}
          <NoteSheet
            visible={noteSheet}
            dayLabel={isToday ? "today" : spokenDate(day.date).split(",")[0] ?? day.date}
            initialBody={editingNote?.body}
            theme={theme}
            onClose={() => {
              setNoteSheet(false);
              setEditingNote(null);
            }}
            onCommit={(body) => {
              const write = editingNote
                ? updateJournalEntry(editingNote.id, body)
                : addJournalEntry(day.date, body);
              void write.then(() => reload(day.date));
            }}
          />
          {/* A drag has nowhere to ask whether a move is permanent, so
              the drop does. Confirms scope only — the row is already
              where it was put, and Cancel returns it. */}
          <Modal
            visible={dropped !== null}
            transparent
            statusBarTranslucent
            animationType="fade"
            onRequestClose={() => {
              setDropped(null);
              void reload(day.date);
            }}
          >
            <View style={styles.menuBackdrop}>
              <View
                style={[
                  styles.confirmCard,
                  { backgroundColor: theme.canvas, borderColor: theme.hairline },
                ]}
              >
                <AppText variant="title" color={theme.ink} numberOfLines={2}>
                  {dropped?.task.title}
                </AppText>
                <AppText color={theme.muted}>
                  Moved to{" "}
                  {dropped?.part
                    ? PART_OF_DAY_LABEL[dropped.part]
                    : ANYTIME_LABEL.toLowerCase()}
                  . Is that where it goes from now on?
                </AppText>
                <Button
                  label="Just today"
                  color={theme.accent}
                  onPress={() => {
                    const d = dropped;
                    setDropped(null);
                    if (!d) return;
                    void (async () => {
                      await placeTaskForDay(d.task.id, day.date, d.part);
                      await reorderDayTasks(d.ordered);
                      await reload(day.date);
                    })();
                  }}
                  theme={theme}
                />
                <Button
                  label="From now on"
                  variant="secondary"
                  onPress={() => {
                    const d = dropped;
                    setDropped(null);
                    if (!d) return;
                    void (async () => {
                      await setTaskPartOfDay(d.task.id, d.part);
                      // Any placement for this day would keep
                      // overriding the task we just changed.
                      await clearPlacementForDay(d.task.id, day.date);
                      await reorderDayTasks(d.ordered);
                      await reload(day.date);
                    })();
                  }}
                  theme={theme}
                />
                <Button
                  label="Cancel"
                  variant="quiet"
                  onPress={() => {
                    setDropped(null);
                    void reload(day.date);
                  }}
                  theme={theme}
                />
              </View>
            </View>
          </Modal>

          {planning ? (
            <WindowSheet
              visible
              window={planning.window}
              // Only open work: a window is a plan for what you have
              // not done yet, and offering something already ticked
              // would be offering to plan the past.
              candidates={todayTasks.filter(
                (t) => !planning.carried.includes(t.id),
              )}
              carried={allTasks.filter((t) => planning.carried.includes(t.id))}
              chosen={planning.chosen}
              plannedCount={planning.plannedCount}
              hueFor={hueFor}
              accent={theme.accent}
              theme={theme}
              onToggle={(taskId) =>
                setPlanning((prev) =>
                  prev === null
                    ? prev
                    : {
                        ...prev,
                        chosen: prev.chosen.includes(taskId)
                          ? prev.chosen.filter((id) => id !== taskId)
                          : [...prev.chosen, taskId],
                      },
                )
              }
              onPlannedCountChange={(plannedCount) =>
                setPlanning((prev) => (prev === null ? prev : { ...prev, plannedCount }))
              }
              onClose={() => setPlanning(null)}
              onSave={() => {
                const p = planning;
                setPlanning(null);
                void (async () => {
                  if (p.poolId !== null) {
                    await updatePool(p.poolId, {
                      taskIds: p.chosen,
                      plannedCount: p.plannedCount,
                    });
                  } else {
                    await createPool({
                      localDate: day.date,
                      taskIds: p.chosen,
                      plannedCount: p.plannedCount,
                      afterTaskId: p.window.afterTaskId,
                      partOfDay: p.window.partOfDay,
                    });
                  }
                  await reload(day.date);
                })();
              }}
              onClear={
                planning.poolId === null
                  ? undefined
                  : () => {
                      const id = planning.poolId;
                      setPlanning(null);
                      if (id !== null) {
                        void deletePool(id).then(() => reload(day.date));
                      }
                    }
              }
            />
          ) : null}

          {partialTask ? (
            <PartialSheet
              visible
              task={partialTask}
              accent={hueFor(partialTask)}
              theme={theme}
              onClose={() => setPartialTask(null)}
              onPick={(fraction) => {
                const t = partialTask;
                setPartialTask(null);
                void Haptics.selectionAsync();
                void setCompletionFraction(t.id, day.date, fraction).then(() =>
                  reload(day.date),
                );
              }}
              onClear={() => {
                const t = partialTask;
                setPartialTask(null);
                void toggleCompletion(t.id, day.date).then(() =>
                  reload(day.date),
                );
              }}
              // The gesture's older job, kept reachable rather than
              // taken over (ADR-0024 §3).
              onMove={
                partialTask.completedToday
                  ? undefined
                  : () => {
                      const t = partialTask;
                      setPartialTask(null);
                      setMovingTask(t);
                    }
              }
            />
          ) : null}

          {movingTask ? (
            <MoveTaskSheet
              visible
              taskTitle={movingTask.title}
              current={movingTask.partOfDay}
              placedToday={movingTask.placedToday}
              dayLabel={isToday ? "today" : spokenDate(day.date).split(",")[0] ?? "that day"}
              accent={hueFor(movingTask)}
              theme={theme}
              onClose={() => setMovingTask(null)}
              onPick={(part, scope) => {
                const t = movingTask;
                setMovingTask(null);
                void (async () => {
                  if (scope === "always") {
                    // Changing the task itself; any placement for this
                    // day would otherwise keep overriding it.
                    await setTaskPartOfDay(t.id, part);
                    await clearPlacementForDay(t.id, day.date);
                  } else {
                    await placeTaskForDay(t.id, day.date, part);
                  }
                  await reload(day.date);
                })();
              }}
              onClearPlacement={
                movingTask.placedToday
                  ? () => {
                      const t = movingTask;
                      setMovingTask(null);
                      void clearPlacementForDay(t.id, day.date).then(() =>
                        reload(day.date),
                      );
                    }
                  : undefined
              }
            />
          ) : null}
          {taggingTask ? (
            <CompletionTagSheet
              visible
              taskTitle={taggingTask.title}
              units={day.communalUnits}
              selected={taggingTask.tagUnitIds}
              areaColors={theme.areas}
              accent={theme.accent}
              theme={theme}
              onClose={() => setTaggingTask(null)}
              onSave={(unitIds) => {
                void setCompletionTags(taggingTask.id, day.date, unitIds).then(() =>
                  reload(day.date),
                );
              }}
            />
          ) : null}
          <DayKindSheet
            visible={kindSheet}
            dayLabel={isToday ? "today" : spokenDate(day.date).split(",")[0] ?? day.date}
            kind={day.kind}
            title={day.title}
            satisfactionRating={day.satisfactionRating}
            theme={theme}
            reduceMotion={reduceMotion}
            onClose={() => setKindSheet(false)}
            onCommit={(kind, opts) => {
              void setDayKind(day.date, kind, opts).then(() => reload(day.date));
            }}
          />
          <ActivitySheet
            visible={activitySheet}
            dayKind={day.kind}
            units={day.units}
            existing={existingForSheet}
            theme={theme}
            onClose={closeActivitySheet}
            onCommit={(title, note, size, unitIds) => {
              const write = existingForSheet
                ? updateActivity(existingForSheet.id, day.date, title, note, size, unitIds)
                : logActivity(day.date, title, note, size, unitIds);
              void write.then(() => reload(day.date));
            }}
            onDelete={
              existingForSheet
                ? () => {
                    void deleteActivity(existingForSheet.id, day.date).then(() =>
                      reload(day.date),
                    );
                  }
                : undefined
            }
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  /** Label and its disclosure travel together as one target. */
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 4 },
  loading: { marginTop: space.xxxl },
  /** Fixed above the scroll region; the strip's own top margin gives
   *  it room, so the header only pays for its bottom edge. */
  header: {
    paddingHorizontal: space.screen,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  /** Takes the space between the fixed header and the tab bar. */
  body: { flex: 1 },
  container: {
    paddingHorizontal: space.screen,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    flexGrow: 1,
  },
  spacer: { flexGrow: 1, minHeight: space.xl },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  headerRight: { alignItems: "flex-end", gap: space.xs },
  weekStat: { marginTop: space.xs },
  kindButton: { minWidth: 44, minHeight: 32, alignItems: "flex-end" },
  /** A trailing row in the fixed header. Right-aligned under the
   *  strip's last day, so it reads as "and beyond this". */
  planAhead: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 2,
    minHeight: 32,
  },
  /** The toggle and the planner share the row under the dates rather
   *  than taking one each — the space was already there. */
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  /** Bounded so two words do not stretch to half the screen. */
  layoutToggle: { flex: 1, maxWidth: 180 },
  /** Icon and label as one unit, so the pair never wraps apart. */
  recordAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  recordButtons: {
    flexDirection: "row",
    gap: space.xl,
    marginTop: space.md,
    minHeight: 44,
    alignItems: "center",
  },
  photoRow: { flexDirection: "row", gap: space.sm },
  photoThumb: { width: 110, height: 110, borderRadius: radius.lg },
  photoMissing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xs,
  },
  /** Centred card, and the backdrop is the dismiss target. */
  menuBackdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.screen,
  },
  /** Wider than the press-and-hold menu: this one carries a sentence
   *  of copy, not a list of verbs. */
  confirmCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xl,
    gap: space.md,
  },
  menuCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.xs,
  },
  menuRow: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoFull: { width: "100%", height: "100%" },
  strip: { marginTop: space.lg },
  stateNote: { marginTop: space.md },
  empty: { gap: space.lg, marginTop: space.xxl },
  centerText: { textAlign: "center" },
  special: { gap: space.sm, marginTop: space.xl },
  /** A run of the day: label, then its rows. Spacing separates it from
   *  the run above; see the note at the call site. */
  period: { marginTop: space.lg, gap: space.xs },
  /** The header sits at the bottom of its block, so the air above it
   *  separates it from the slot before rather than from its own
   *  rows. */
  dragHeader: { height: 48, justifyContent: "flex-end" },
  /** Done this week / Completed: the same block with the one rule that
   *  survived, and more air above it so the break reads before the
   *  line does. */
  tail: {
    marginTop: space.xl,
    paddingTop: space.md,
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  /** The day's record and its log — different content, so they keep the
   *  rule that says so. */
  band: {
    marginTop: space.xl,
    paddingTop: space.md,
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 32,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
  },
  tagDots: { flexDirection: "row", gap: 3 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  activityText: { flex: 1, gap: 1 },
  logButton: { minHeight: 44, justifyContent: "center" },
  footer: {
    paddingTop: space.lg,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
