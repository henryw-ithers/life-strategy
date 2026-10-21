/**
 * Home: what should I do now? (spec §5.1). Today is a vertical scroll
 * of its windows, with the events, named gaps and timed tasks between
 * them, the window you're in open, and Other open tasks after. A past
 * day shows its record: what was done, its notes and photos, and a way
 * to add something you forgot.
 *
 * Suggestions are worked out each time and never saved
 * (`loadDayPlan`); a swap or "Pull in another" only changes what's
 * shown. Ticking is the one thing Home does to a task's day. **Nothing
 * here ranks by points**, and nothing counts what wasn't done.
 *
 * Composition only. Data and the tap-to-tick loop are `useDayData`; the
 * day's arrangement is `HomeToday`; the words are `homeDay.ts`. What
 * stays here is which sheet is open and the writes each one commits.
 */
import {
  addDays,
  dayMinute,
  planDay,
  specialDayBonus,
  weekStart,
  type OpenSort,
  type TimeRange,
} from "@glide/scoring";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Redirect, router, useLocalSearchParams, type Href } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { LinearTransition, useReducedMotion } from "react-native-reanimated";

import { openAdd, TabToolbar } from "../../../components/nav/TabToolbar";
import { AddFromOpenSheet } from "../../../components/plan/AddFromOpenSheet";
import { addableTo, spanLabel } from "../../../components/plan/dayView";
import { WindowTimesSheet } from "../../../components/plan/WindowTimesSheet";
import { ActivitiesBand } from "../../../components/today/ActivitiesBand";
import { ActivitySheet, type ExistingActivity } from "../../../components/today/ActivitySheet";
import { askClearToday, undoClear } from "../../../components/today/clearToday";
import { CompletionTagSheet } from "../../../components/today/CompletionTagSheet";
import { DayKindSheet } from "../../../components/today/DayKindSheet";
import { DayRecord } from "../../../components/today/DayRecord";
import { eveningFrom, passCardDue } from "../../../components/today/homeDay";
import { HomeToday, windowId } from "../../../components/today/HomeToday";
import { MoveToWindowSheet } from "../../../components/today/MoveToWindowSheet";
import { NoteSheet } from "../../../components/today/NoteSheet";
import { PartialSheet } from "../../../components/today/PartialSheet";
import { RecordActions } from "../../../components/today/RecordActions";
import { TaskRow } from "../../../components/today/TaskRow";
import { TodayHeader } from "../../../components/today/TodayHeader";
import { AppText } from "../../../components/ui/AppText";
import { Backdrop, constellation } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import { Group } from "../../../components/ui/Group";
import { NativeSheet } from "../../../components/ui/NativeSheet";
import { saveThen } from "../../../components/ui/ScreenLoad";
import { UndoBar } from "../../../components/ui/UndoBar";
import { deleteActivity, logActivity, updateActivity } from "../../../db/activities";
import { setCompletionFraction, setCompletionTags, toggleCompletion } from "../../../db/completions";
import { setDayKind } from "../../../db/dayGrades";
import { addDayEdit } from "../../../db/hours";
import { addJournalEntry, deleteJournalEntry, updateJournalEntry } from "../../../db/journal";
import { isOnboardingComplete } from "../../../db/onboarding";
import { addPhoto, deletePhoto } from "../../../db/photos";
import { pinForDay } from "../../../db/pins";
import { getSetting, setSetting } from "../../../db/settings";
import { addSkip } from "../../../db/skips";
import type { DayData, TodayActivity, TodayTask } from "../../../db/today";
import { hidePassCard, passCardHiddenWeek } from "../../../db/weeklyPass";
import { skipProblem, type SkipInput } from "../../../db/windowRules";
import { usePlannedAhead, useDayData } from "../../../hooks/useDayData";
import { useRetained } from "../../../hooks/useRetained";
import { useUndoDelete } from "../../../hooks/useUndoDelete";
import { spokenDate } from "../../../lib/format";
import { getTheme } from "../../../theme/colors";
import { space } from "../../../theme/tokens";

const SORT_KEY = "open_tasks_sort";
const SORTS: readonly OpenSort[] = ["suggested", "dueDate", "size", "priority", "points"];

/** The minute of the planning day, now, ticking once a minute. */
function useNowMinute(): number {
  const read = () => {
    const d = new Date();
    return dayMinute(d.getHours(), d.getMinutes());
  };
  const [now, setNow] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setNow(read()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TodayScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const reduceMotion = useReducedMotion();
  const nowMinute = useNowMinute();

  const {
    day: storedDay,
    plan,
    weekGrade,
    monthGrades,
    viewMonth,
    refresh,
    select,
    changeMonth,
    toggle,
  } = useDayData();
  const undo = useUndoDelete((write) => saveThen(write, refresh));
  /** The day as shown: a note, photo or activity waiting on Undo is
   *  already gone from it. */
  const day = withoutRecord(storedDay, undo.hidden);

  const [monthOpen, setMonthOpen] = useState(false);
  const [kindSheet, setKindSheet] = useState(false);
  const [activitySheet, setActivitySheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  /** Set while the note sheet is rewriting an existing entry. */
  const [editingNote, setEditingNote] = useState<{ id: string; body: string } | null>(null);
  const [editingActivity, setEditingActivity] = useState<TodayActivity | null>(null);
  const [taggingTask, setTaggingTask] = useState<TodayTask | null>(null);
  const [partialTask, setPartialTask] = useState<TodayTask | null>(null);
  const [movingTask, setMovingTask] = useState<TodayTask | null>(null);
  /** A task to move once the partial sheet has closed (its "Move it"). */
  const moveNext = useRef<TodayTask | null>(null);
  const [taggingTaskShown, taggingTaskGone] = useRetained(taggingTask);
  const [movingTaskShown, movingTaskGone] = useRetained(movingTask);
  const [partialTaskShown, partialTaskGone] = useRetained(partialTask);
  /** A window being added to (Add from open) or timed (Edit times, or a
   *  new window from the + menu), named by its times. */
  const [windowSheet, setWindowSheet] = useState<
    | {
        kind: "add";
        start: number;
        /** Taken as it opens, so a reload can't change it under you. */
        label: string;
        tasks: readonly TodayTask[];
      }
    | { kind: "times"; range?: TimeRange }
    | null
  >(null);
  const [windowSheetShown, windowSheetGone] = useRetained(windowSheet);
  const [opened, setOpened] = useState(0);
  /** "Add something you did that day", on a past day. */
  const [recording, setRecording] = useState(false);

  // What's shown, not stored: swaps and pulls reset with the day.
  const [declined, setDeclined] = useState<ReadonlyMap<number, ReadonlySet<string>>>(new Map());
  const [pulledIn, setPulledIn] = useState<ReadonlyMap<number, number>>(new Map());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [othersOpen, setOthersOpen] = useState(false);
  const [sort, setSort] = useState<OpenSort>("suggested");
  const [passHidden, setPassHidden] = useState<string | null>(null);
  const [shownDate, setShownDate] = useState<string | null>(null);
  if (day && day.date !== shownDate) {
    setShownDate(day.date);
    setDeclined(new Map());
    setPulledIn(new Map());
    setExpanded({});
    setOthersOpen(false);
  }
  const ahead = usePlannedAhead(day, othersOpen);

  const headerHeight = useHeaderHeight();
  const headerInset = Platform.OS === "ios" ? headerHeight : 0;

  /** Another tab's + menu asked to log something (`openAdd`). */
  const { add: addParam } = useLocalSearchParams<{ add?: string }>();
  const [seenAddParam, setSeenAddParam] = useState(addParam);
  if (addParam !== seenAddParam) {
    setSeenAddParam(addParam);
    if (addParam === "activity") {
      setEditingActivity(null);
      setActivitySheet(true);
    }
  }
  useEffect(() => {
    if (addParam) router.setParams({ add: undefined });
  }, [addParam]);

  /** null while unknown, so the gate never flashes Today (ADR-0011). */
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    void isOnboardingComplete().then(setOnboarded);
    void getSetting(SORT_KEY).then((s) => {
      if (s && (SORTS as readonly string[]).includes(s)) setSort(s as OpenSort);
    });
    void passCardHiddenWeek().then(setPassHidden);
  }, []);

  /** Today, shown with its windows. A load that landed across midnight
   *  has no plan for the new today; the effect below reloads it. */
  const isToday = day !== null && day.date === day.today && plan !== null;
  /** Windows waiting on a removal's Undo, by `windowId`. */
  const hiddenKey = [...undo.hidden].filter((id) => id.startsWith("win-")).sort().join("|");
  /** Today's windows, filled live: the clock, swaps and pulls. A window
   *  waiting on Undo is left out, so its tasks go where they'd go
   *  without it (EC-19). */
  const planned = useMemo(() => {
    if (!plan || !isToday) return null;
    const gone = new Set(hiddenKey.split("|").filter(Boolean).map((id) => id.slice(4)));
    return planDay({
      ...plan.input,
      windows: plan.input.windows.filter((w) => !gone.has(windowId(w))),
      now: nowMinute,
      declined,
      pulledIn,
    });
  }, [plan, isToday, hiddenKey, nowMinute, declined, pulledIn]);
  const needsPlan = day !== null && day.date === day.today && plan === null;
  useEffect(() => {
    if (needsPlan) void refresh();
    // `refresh` is rebuilt each render; the reload is wanted once per
    // missing plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPlan]);

  if (onboarded === null) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;

  const logSomething = () => {
    setEditingActivity(null);
    setActivitySheet(true);
  };

  if (day === null) {
    return (
      <View style={styles.root}>
        <TabToolbar onTask={() => openAdd("task")} onEvent={() => openAdd("event")} onLog={logSomething} settings />
        <ActivityIndicator color={theme.muted} style={styles.loading} />
      </View>
    );
  }

  const canRecord = day.date <= day.today;
  const layout = reduceMotion ? undefined : LinearTransition.duration(200);
  const dayLabel = isToday ? "today" : (spokenDate(day.date).split(",")[0] ?? day.date);
  const hueFor = (t: TodayTask) => theme.areas[t.areaId] ?? theme.accent;
  const askClear = () => void askClearToday(() => void refresh());
  const liveWindows = plan?.hours.windows ?? [];
  const windowEditable = isToday && day.away === null && !day.cleared;

  const toolbar = (
    <TabToolbar
      onTask={() => openAdd("task")}
      onEvent={() => openAdd("event")}
      onWindow={
        windowEditable
          ? () => {
              setOpened((n) => n + 1);
              setWindowSheet({ kind: "times" });
            }
          : undefined
      }
      onLog={logSomething}
      settings
      more={[
        ...(isToday && day.away === null && !day.cleared
          ? [{ label: "Clear today", icon: "moon", onPress: askClear }]
          : []),
        { label: "Day type", icon: "calendar", onPress: () => setKindSheet(true) },
        { label: "Plan this week", icon: "list.bullet.clipboard", onPress: () => router.push("/weekly-pass" as Href) },
      ]}
    />
  );

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      await addPhoto(day.date, res.assets[0].uri);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
    }
  };

  /** Skip an event: this one, or its week if that week hasn't started
   *  (ADR-0040 §2, EC-25). Nothing counts what's skipped. */
  const askSkipEvent = (t: TodayTask) => {
    const weekOk = skipProblem({ kind: "taskWeek", taskId: t.id, date: day.date }, day.today) === null;
    const skip = (input: SkipInput) =>
      void addSkip(input)
        .then(() => refresh())
        .catch((e: unknown) =>
          Alert.alert("It wasn't skipped", e instanceof Error ? e.message : String(e)),
        );
    Alert.alert(t.title, undefined, [
      { text: "Skip this one", onPress: () => skip({ kind: "occurrence", taskId: t.id, date: day.date }) },
      ...(weekOk
        ? [{ text: "Skip this week", onPress: () => skip({ kind: "taskWeek", taskId: t.id, date: day.date }) }]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  /** Today's windows a task could move to: those still to come. */
  const movableTo = (t: TodayTask): TimeRange[] =>
    (planned?.windows ?? [])
      .filter((w) => !w.ended && !w.pinned.some((p) => p.taskId === t.id))
      .map((w) => w.range);

  /** A row, with the gestures the day allows on it. */
  const taskRow = (t: TodayTask, extra: { reason?: string; onSwap?: () => void } = {}) => (
    <TaskRow
      task={t}
      hue={hueFor(t)}
      disabled={!day.editable}
      onToggle={() => void toggle(t)}
      onTag={
        t.completedToday && day.editable && day.communalUnits.length > 0
          ? () => setTaggingTask(t)
          : undefined
      }
      onPartial={
        t.allowsPartial && day.editable && t.progress < 1 && t.doneAheadOn === null
          ? () => setPartialTask(t)
          : undefined
      }
      onMove={
        isToday && t.kind === "task" && !t.completedToday && movableTo(t).length > 0
          ? () => setMovingTask(t)
          : undefined
      }
      onSkip={
        t.kind === "event" && !t.completedToday && day.date >= day.today
          ? () => askSkipEvent(t)
          : undefined
      }
      reason={extra.reason}
      onSwap={extra.onSwap}
      trailing={isToday ? "size" : "points"}
      tagHues={theme.areas}
      theme={theme}
      reduceMotion={reduceMotion}
    />
  );

  /** A window's swaps and pulls belong to it: an edit or removal
   *  forgets them, so a new window at that time starts fresh. */
  const forgetWindow = (start: number) => {
    setDeclined((d) => {
      const next = new Map(d);
      next.delete(start);
      return next;
    });
    setPulledIn((p) => {
      const next = new Map(p);
      next.delete(start);
      return next;
    });
  };
  const removeWindow = (range: TimeRange) => {
    forgetWindow(range.start);
    undo.remove({
      id: `win-${windowId(range)}`,
      message: `Removed ${spanLabel(range)}`,
      run: () => addDayEdit(day.date, { kind: "remove", range }),
    });
  };
  const hiddenWindows = new Set(
    [...undo.hidden].filter((id) => id.startsWith("win-")).map((id) => id.slice(4)),
  );

  const saveTimes = async (range: TimeRange): Promise<string | null> => {
    const from = windowSheet?.kind === "times" ? windowSheet.range : undefined;
    try {
      await addDayEdit(day.date, from ? { kind: "change", from, to: range } : { kind: "add", range });
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    if (from) forgetWindow(from.start);
    setWindowSheet(null);
    void refresh();
    return null;
  };

  const record = (
    <>
      <DayRecord
        day={day}
        theme={theme}
        onEditNote={(note) => {
          setEditingNote(note);
          setNoteSheet(true);
        }}
        onDeleteNote={(id) =>
          undo.remove({ id, message: "Note deleted", run: () => deleteJournalEntry(id) })
        }
        onDeletePhoto={(id) =>
          undo.remove({ id, message: "Photo deleted", run: () => deletePhoto(id) })
        }
      />
      {canRecord ? (
        <RecordActions onAddNote={() => setNoteSheet(true)} onAddPhoto={() => void pickPhoto()} theme={theme} />
      ) : null}
    </>
  );

  const evening = isToday && nowMinute >= eveningFrom(liveWindows);
  const showPassCard =
    isToday &&
    day.away === null &&
    passCardDue({
      today: day.today,
      now: nowMinute,
      mondayFirst: liveWindows[0]?.start ?? null,
      hiddenWeek: passHidden,
    });

  const allTasks = [...day.due, ...day.week, ...day.doneThisWeek];
  const doneOnDay = allTasks.filter((t) => t.completedToday);

  const existingForSheet: ExistingActivity | null = editingActivity
    ? {
        id: editingActivity.id,
        title: editingActivity.title,
        note: editingActivity.note,
        size: editingActivity.size,
        tagUnitIds: editingActivity.tags.map((t) => t.unitId),
      }
    : null;

  return (
    <View style={styles.root}>
      {/* Fixed behind Home's content: its own header sits above the
          scroll view. */}
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      {toolbar}

      <TodayHeader
        day={day}
        weekGrade={weekGrade}
        monthGrades={monthGrades}
        monthOpen={monthOpen}
        onToggleMonth={() => setMonthOpen((v) => !v)}
        viewMonth={viewMonth}
        onChangeMonth={changeMonth}
        onSelect={select}
        onOpenKind={() => setKindSheet(true)}
        topInset={headerInset}
        layout={layout}
        reduceMotion={reduceMotion}
        theme={theme}
      />

      <ScrollView
        style={styles.body}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        {day.finalized ? (
          <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
            This day has settled. You can still change it — editing it now will move the week and
            month it belongs to.
          </AppText>
        ) : null}

        {day.away ? (
          <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
            {[
              "Away",
              day.away.label,
              `back ${new Date(`${addDays(day.away.lastDay, 1)}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </AppText>
        ) : day.kind === "rest" ? (
          <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
            Nothing counts today; anything you do still logs.
          </AppText>
        ) : null}

        {/* Undo works until the day ends (ADR-0040 §4, EC-28). */}
        {day.cleared && isToday ? (
          <View style={styles.clearedRow}>
            <AppText variant="caption" color={theme.muted}>
              Today&apos;s cleared.
            </AppText>
            <Button variant="quiet" label="Undo" onPress={() => undoClear(() => void refresh())} theme={theme} />
          </View>
        ) : null}

        {/* A rest day (ADR-0037): automatic, never offered or chosen. */}
        {day.restDay ? (
          <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
            Nothing’s due today — a rest day. It starts at 70; activities add up to 30, and anything
            you do early counts on top.
          </AppText>
        ) : day.nothingDue && day.kind !== "rest" ? (
          <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
            Nothing’s due today. Do something from later in the week and it becomes a rest day —
            70, plus what you did.
          </AppText>
        ) : null}

        {showPassCard ? (
          <Group theme={theme}>
            <AppText variant="headline" color={theme.ink}>
              Plan this week · about 5 min
            </AppText>
            <View style={styles.cardActions}>
              <Button label="Start" onPress={() => router.push("/weekly-pass" as Href)} theme={theme} />
              <Button
                variant="quiet"
                label="Not now"
                onPress={() => {
                  const week = weekStart(day.today);
                  setPassHidden(week);
                  void hidePassCard(week);
                }}
                theme={theme}
              />
            </View>
          </Group>
        ) : null}

        {!day.hasSnapshot ? (
          <View style={styles.empty}>
            <AppText color={theme.ink} style={styles.centerText}>
              Your day starts with a plan. Sort what matters into tiers first, and the day builds
              itself.
            </AppText>
            <Button label="Set your priorities" onPress={() => router.push("/priorities" as Href)} theme={theme} />
          </View>
        ) : !day.hasTasks && isToday ? (
          <View style={styles.empty}>
            <AppText color={theme.ink} style={styles.centerText}>
              Your daily budget is set. Now give it something to do.
            </AppText>
            <Button label="Plan your tasks" onPress={() => router.navigate("/goals" as Href)} theme={theme} />
          </View>
        ) : (
          <>
            {/* A special day keeps its work (ADR-0023 §3): the rating tops
                the day up, it doesn't stand in for it. */}
            {day.kind === "special" ? (
              <View style={styles.special}>
                <AppText variant="title" color={theme.ink}>
                  {day.title ?? "A special day"}
                </AppText>
                <AppText variant="caption" color={theme.muted}>
                  {day.satisfactionRating !== null
                    ? `Rated ${day.satisfactionRating} of 10 · worth ${specialDayBonus(day.satisfactionRating)} points`
                    : "When it's over, rate how it was."}
                </AppText>
                {day.editable ? (
                  <Button
                    label={day.satisfactionRating === null ? "Rate the day" : "Edit the day"}
                    variant="secondary"
                    onPress={() => setKindSheet(true)}
                    theme={theme}
                  />
                ) : null}
              </View>
            ) : null}

            {isToday && plan && planned ? (
              <HomeToday
                plan={plan}
                planned={planned}
                now={nowMinute}
                hidden={hiddenWindows}
                expanded={expanded}
                onToggleWindow={(id, open) => setExpanded((e) => ({ ...e, [id]: open }))}
                ahead={ahead}
                othersOpen={othersOpen}
                onToggleOthers={() => setOthersOpen((v) => !v)}
                sort={sort}
                onSort={(next) => {
                  setSort(next);
                  void setSetting(SORT_KEY, next);
                }}
                renderRow={taskRow}
                editable={windowEditable}
                onSwap={(start, taskId) =>
                  setDeclined((d) => new Map(d).set(start, new Set([...(d.get(start) ?? []), taskId])))
                }
                onPullIn={(start) => setPulledIn((p) => new Map(p).set(start, (p.get(start) ?? 0) + 1))}
                onAddFromOpen={(start) => {
                  const index = planned.windows.findIndex((w) => w.range.start === start);
                  const w = planned.windows[index];
                  if (!w) return;
                  setOpened((n) => n + 1);
                  setWindowSheet({
                    kind: "add",
                    start,
                    label: spanLabel(w.range),
                    tasks: addableTo(index, planned)
                      .map((id) => plan.tasks.get(id))
                      .filter((t): t is TodayTask => t !== undefined),
                  });
                }}
                onEditTimes={(range) => {
                  setOpened((n) => n + 1);
                  setWindowSheet({ kind: "times", range });
                }}
                onRemove={removeWindow}
                theme={theme}
              />
            ) : !isToday ? (
              // A past day's record: only what was done (spec §5.2). It
              // never lists what wasn't, events included (ADR-0038).
              <View style={styles.past}>
                {doneOnDay.length > 0 ? (
                  <>
                    <AppText variant="caption" color={theme.muted}>
                      Done
                    </AppText>
                    {doneOnDay.map((t) => (
                      <View key={t.id}>{taskRow(t)}</View>
                    ))}
                  </>
                ) : null}
                {day.editable ? (
                  <Pressable onPress={() => setRecording(true)} accessibilityRole="button" style={styles.link}>
                    <AppText color={theme.accent}>＋ Add something you did that day</AppText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        )}

        {day.hasSnapshot ? (
          <ActivitiesBand
            activities={day.activities}
            dayKind={day.kind}
            editable={day.editable}
            onEdit={(a) => {
              setEditingActivity(a);
              setActivitySheet(true);
            }}
            onAdd={logSomething}
            layout={layout}
            theme={theme}
          />
        ) : null}

        {/* The evening card (spec §5.1): an hour before the last window
            ends, or at 6 pm. Earlier in the day the record sits plainly
            at the end. */}
        {evening ? (
          <Group theme={theme} title="How was today?">
            {record}
            <Pressable onPress={() => setKindSheet(true)} accessibilityRole="button" style={styles.link}>
              <AppText variant="caption" color={theme.accent}>
                Day type ›
              </AppText>
            </Pressable>
          </Group>
        ) : (
          record
        )}

        <View style={styles.spacer} />
        <View style={[styles.footer, { borderTopColor: theme.hairline }]}>
          <AppText variant="footnote" color={theme.muted}>
            Grades are guidelines, not judgments.
          </AppText>
        </View>
      </ScrollView>

      <UndoBar undo={undo} theme={theme} />

      {windowSheetShown?.kind === "times" ? (
        <WindowTimesSheet
          key={`times-${opened}`}
          visible={windowSheet?.kind === "times"}
          onDismissed={windowSheetGone}
          initial={windowSheetShown.range}
          dayLabel="today"
          theme={theme}
          onClose={() => setWindowSheet(null)}
          onSave={saveTimes}
        />
      ) : null}

      {windowSheetShown?.kind === "add" ? (
        <AddFromOpenSheet
          key={`add-${opened}`}
          visible={windowSheet?.kind === "add"}
          onDismissed={windowSheetGone}
          windowLabel={windowSheetShown.label}
          tasks={windowSheetShown.tasks}
          hueFor={hueFor}
          theme={theme}
          onClose={() => setWindowSheet(null)}
          onPick={(t) => {
            const start = windowSheetShown.start;
            setWindowSheet(null);
            void saveThen(
              () =>
                pinForDay(t.id, day.date, start, "window", {
                  extra: t.band === "doneThisWeek" && !t.commitment,
                }),
              () => refresh(),
            );
          }}
        />
      ) : null}

      {/* A past day: tick what you forgot (spec §5.2). Every task and
          event on the day, ticked or not, so the list never shows what
          wasn't done (ADR-0038 §5). */}
      {!isToday ? (
        <NativeSheet
          visible={recording}
          onClose={() => setRecording(false)}
          dismiss="done"
          title="Add something you did"
          size="large"
          scroll
        >
          {[...allTasks]
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((t) => (
              <View key={`r-${t.id}`}>{taskRow(t)}</View>
            ))}
        </NativeSheet>
      ) : null}

      {movingTaskShown ? (
        <MoveToWindowSheet
          visible={movingTask !== null}
          onDismissed={movingTaskGone}
          taskTitle={movingTaskShown.title}
          windows={movableTo(movingTaskShown)}
          theme={theme}
          onClose={() => setMovingTask(null)}
          onPick={(w) => {
            const t = movingTaskShown;
            setMovingTask(null);
            void saveThen(() => pinForDay(t.id, day.date, w.start, "window"), () => refresh());
          }}
        />
      ) : null}

      <NoteSheet
        visible={noteSheet}
        dayLabel={dayLabel}
        initialBody={editingNote?.body}
        theme={theme}
        onClose={() => {
          setNoteSheet(false);
          setEditingNote(null);
        }}
        onCommit={(body) => {
          const write = editingNote ? updateJournalEntry(editingNote.id, body) : addJournalEntry(day.date, body);
          void write.then(() => refresh());
        }}
      />

      {partialTaskShown ? (
        <PartialSheet
          visible={partialTask !== null}
          task={partialTaskShown}
          onDismissed={() => {
            partialTaskGone();
            if (moveNext.current) setMovingTask(moveNext.current);
            moveNext.current = null;
          }}
          accent={hueFor(partialTaskShown)}
          theme={theme}
          onClose={() => setPartialTask(null)}
          onPick={(fraction) => {
            const t = partialTaskShown;
            setPartialTask(null);
            void Haptics.selectionAsync();
            void setCompletionFraction(t.id, day.date, fraction).then(() => refresh());
          }}
          onClear={() => {
            const t = partialTaskShown;
            setPartialTask(null);
            void toggleCompletion(t.id, day.date).then(() => refresh());
          }}
          onMove={
            partialTaskShown.completedToday || !isToday || movableTo(partialTaskShown).length === 0
              ? undefined
              : () => {
                  // Opened once this sheet has closed: iOS drops a sheet
                  // presented while another is closing.
                  moveNext.current = partialTaskShown;
                  setPartialTask(null);
                }
          }
        />
      ) : null}

      {taggingTaskShown ? (
        <CompletionTagSheet
          visible={taggingTask !== null}
          onDismissed={taggingTaskGone}
          taskTitle={taggingTaskShown.title}
          units={day.communalUnits}
          selected={taggingTaskShown.tagUnitIds}
          areaColors={theme.areas}
          accent={theme.accent}
          theme={theme}
          onClose={() => setTaggingTask(null)}
          onSave={(unitIds) => {
            void setCompletionTags(taggingTaskShown.id, day.date, unitIds).then(() => refresh());
          }}
        />
      ) : null}

      <DayKindSheet
        visible={kindSheet}
        dayLabel={dayLabel}
        kind={day.kind}
        title={day.title}
        satisfactionRating={day.satisfactionRating}
        theme={theme}
        reduceMotion={reduceMotion}
        onClose={() => setKindSheet(false)}
        onCommit={(kind, opts) => {
          void setDayKind(day.date, kind, opts).then(() => refresh());
        }}
      />

      <ActivitySheet
        visible={activitySheet}
        dayKind={day.kind}
        units={day.units}
        existing={existingForSheet}
        theme={theme}
        onClose={() => {
          setActivitySheet(false);
          setEditingActivity(null);
        }}
        onCommit={(title, note, size, unitIds) => {
          const write = existingForSheet
            ? updateActivity(existingForSheet.id, day.date, title, note, size, unitIds)
            : logActivity(day.date, title, note, size, unitIds);
          void write.then(() => refresh());
        }}
        onDelete={
          existingForSheet
            ? () => {
                const { id } = existingForSheet;
                const { date } = day;
                undo.remove({ id, message: "Activity deleted", run: () => deleteActivity(id, date) });
              }
            : undefined
        }
      />
    </View>
  );
}

/** The day without the notes, photos and activities whose delete is
 *  waiting or landing (`useUndoDelete`). */
function withoutRecord(day: DayData | null, hidden: ReadonlySet<string>): DayData | null {
  if (day === null || hidden.size === 0) return day;
  const touches = (id: string) => hidden.has(id);
  // Only a note, photo or activity changes the day; a window waiting on
  // Undo doesn't, and a new object here would reload what depends on it.
  if (!day.journal.some((j) => touches(j.id)) && !day.photos.some((p) => touches(p.id)) && !day.activities.some((a) => touches(a.id))) {
    return day;
  }
  return {
    ...day,
    journal: day.journal.filter((j) => !hidden.has(j.id)),
    photos: day.photos.filter((p) => !hidden.has(p.id)),
    activities: day.activities.filter((a) => !hidden.has(a.id)),
  };
}

const styles = StyleSheet.create({
  clearedRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  root: { flex: 1, overflow: "hidden" },
  loading: { marginTop: space.xxxl },
  body: { flex: 1 },
  container: {
    paddingHorizontal: space.screen,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    flexGrow: 1,
    gap: space.md,
  },
  spacer: { flexGrow: 1, minHeight: space.xl },
  stateNote: { marginTop: space.md },
  empty: { gap: space.lg, marginTop: space.xxl },
  centerText: { textAlign: "center" },
  special: { gap: space.sm, marginTop: space.md },
  past: { gap: space.xs },
  link: { minHeight: 44, justifyContent: "center" },
  cardActions: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  footer: { paddingTop: space.lg, gap: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
