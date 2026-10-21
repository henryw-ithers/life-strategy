/**
 * The Plan tab: is my week set up? (spec §5.3). A week strip across the
 * top, Sunday to Saturday (ADR-0004 §1), and below it the chosen day:
 * its windows, events and named gaps in time order, each window filled
 * with its pins and live suggestions.
 *
 * Suggestions are worked out each time and never saved
 * (`loadDayPlan`); only what you pin is. **Nothing here changes a
 * score** but a "Do N of these" choice and the hours (ADR-0039 §12),
 * and there's no warning about load anywhere (P3, ADR-0026 §3).
 *
 * The units and their tasks moved to Life in Phase 8 (Henry,
 * 2026-10-20). This tab still opens the New task and New event sheets
 * from its + menu, and from another tab's (`openAdd`).
 */
import { addDays, addedWindowPieces, weekStart, type PinKind, type TimeRange } from "@glide/scoring";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { openAdd, TabToolbar } from "../../../components/nav/TabToolbar";
import { AddFromOpenSheet } from "../../../components/plan/AddFromOpenSheet";
import { AddTaskModal } from "../../../components/plan/AddTaskModal";
import { ChoiceSheet } from "../../../components/plan/ChoiceSheet";
import {
  addableTo,
  dayHeading,
  spanLabel,
  timeline,
  weekLabel,
} from "../../../components/plan/dayView";
import { EventSheet } from "../../../components/plan/EventSheet";
import { PlanWeekStrip } from "../../../components/plan/PlanWeekStrip";
import { savedOrSaid, saveNewEvent } from "../../../components/plan/saveEvent";
import { pickableUnits } from "../../../components/plan/unitSelection";
import { WindowCard } from "../../../components/plan/WindowCard";
import { WindowTimesSheet } from "../../../components/plan/WindowTimesSheet";
import { DayKindSheet } from "../../../components/today/DayKindSheet";
import { AppText } from "../../../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { UndoBar } from "../../../components/ui/UndoBar";
import { setDayKind } from "../../../db/dayGrades";
import { loadDayPlan, loadWeek, type DayPlan, type WeekDay } from "../../../db/dayPlan";
import { addDayEdit } from "../../../db/hours";
import {
  createChoice,
  deleteChoice,
  pinForDay,
  setPinKind,
  unpinForDay,
  updateChoice,
} from "../../../db/pins";
import { addTask, copyLastWeeksEvents, loadPlan, type PlanData } from "../../../db/tasks";
import type { TodayTask } from "../../../db/today";
import { useRetained } from "../../../hooks/useRetained";
import { useUndoDelete } from "../../../hooks/useUndoDelete";
import { currentLocalDate } from "../../../lib/calendar";
import { spokenDate } from "../../../lib/format";
import { getTheme } from "../../../theme/colors";
import { radius, space } from "../../../theme/tokens";

const DAY_KIND_LABEL = { normal: "Normal", special: "Special day", rest: "Day off" } as const;

/** What a window sheet is about. A window is named by its start, not
 *  its place in the list, so a reload can't point an open sheet at a
 *  different window. */
type WindowSheet =
  | { kind: "times"; range?: TimeRange }
  | { kind: "add"; start: number }
  | { kind: "choice"; start: number };

export default function PlanScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const reduceMotion = useReducedMotion();
  const today = currentLocalDate();

  /** `date` opens a day (from Home, or a link); `add` asks for a sheet
   *  from another tab's + menu (`openAdd`). */
  const { date: dateParam, add: addParam } = useLocalSearchParams<{ date?: string; add?: string }>();
  const [selected, setSelected] = useState(dateParam ?? today);
  const [seenDate, setSeenDate] = useState(dateParam);
  if (dateParam !== seenDate) {
    setSeenDate(dateParam);
    if (dateParam) setSelected(dateParam);
  }

  const [loaded, setLoaded] = useState<DayPlan | null>(null);
  const [week, setWeek] = useState<WeekDay[] | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [sheet, setSheet] = useState<WindowSheet | null>(null);
  const [sheetShown, sheetGone] = useRetained(sheet);
  const [kindSheet, setKindSheet] = useState(false);
  const [adding, setAdding] = useState<"task" | "event" | null>(null);
  const [addingShown, addingGone] = useRetained(adding);
  const [eventUnits, setEventUnits] = useState<string[]>([]);

  /** Each load's turn: only the latest may land, so a slow load for a
   *  day you've moved on from can't overwrite the one you're looking at. */
  const loadTurn = useRef(0);
  const load = useCallback(async () => {
    const turn = ++loadTurn.current;
    const [nextDay, nextWeek, nextPlan] = await Promise.all([
      loadDayPlan(selected),
      loadWeek(selected),
      loadPlan(),
    ]);
    if (turn !== loadTurn.current) return;
    setLoaded(nextDay);
    setWeek(nextWeek);
    setPlan(nextPlan);
  }, [selected]);
  const { error, retry, save } = useScreenLoad(load);
  const undo = useUndoDelete(save);

  const allUnits = useMemo(() => pickableUnits(plan), [plan]);
  const canAdd = plan?.hasSnapshot === true && allUnits.length > 0;

  /** Another tab's + asked for a sheet. With no plan to file it under,
   *  Priorities comes first. */
  const [handledAdd, setHandledAdd] = useState<string | undefined>(undefined);
  if (addParam !== handledAdd && plan !== null) {
    setHandledAdd(addParam);
    if (canAdd && (addParam === "task" || addParam === "event")) setAdding(addParam);
  }
  // Navigation is a side effect, so it waits for the commit.
  useEffect(() => {
    if (!addParam || plan === null) return;
    router.setParams({ add: undefined });
    if (!canAdd) router.push("/priorities" as Href);
  }, [addParam, plan, canAdd]);
  // A day link is cleared once followed, so the same link works again.
  useEffect(() => {
    if (dateParam) router.setParams({ date: undefined });
  }, [dateParam]);
  const addHere = (what: "task" | "event") => {
    if (!canAdd) router.push("/priorities" as Href);
    else setAdding(what);
  };

  const hueFor = (t: TodayTask) => theme.areas[t.areaId] ?? theme.accent;
  const date = selected;
  /** The day on screen is only ever the one chosen: until its load
   *  lands it shows as loading, and nothing writes to it. */
  const day = loaded !== null && loaded.day.date === selected ? loaded : null;
  const editable = day !== null && date >= today;
  const dayLabel = date === today ? "today" : (spokenDate(date).split(",")[0] ?? date);

  const goTo = (next: string) => {
    setSelected(next);
    void Haptics.selectionAsync();
  };

  // ── Writes ───────────────────────────────────────────────────────

  const windowAt = (index: number) => day?.planned.windows[index];
  const indexAt = (start: number) =>
    day ? day.planned.windows.findIndex((w) => w.range.start === start) : -1;
  /** A sheet opened afresh each time, so its draft is seeded anew. */
  const [opened, setOpened] = useState(0);
  const openSheet = (next: WindowSheet) => {
    setOpened((n) => n + 1);
    setSheet(next);
  };
  const pin = (taskId: string, index: number) => {
    const w = windowAt(index);
    const t = day?.tasks.get(taskId);
    if (!w || !t) return;
    void save(() =>
      pinForDay(taskId, date, w.range.start, "window", {
        // Pinned after the week's runs are done: an extra run on
        // purpose (windows-and-pins §2.8). Life tasks only.
        extra: t.band === "doneThisWeek" && !t.commitment,
      }),
    );
  };
  const acceptAll = (index: number) => {
    const w = windowAt(index);
    if (!w) return;
    void save(async () => {
      for (const s of w.suggested) await pinForDay(s.taskId, date, w.range.start, "window");
    });
  };
  const unpin = (taskId: string) => void save(() => unpinForDay(taskId, date));
  const pinKind = (ruleId: string, kind: PinKind) => void save(() => setPinKind(ruleId, kind));

  const removeWindow = (range: TimeRange) => {
    undo.remove({
      id: windowKey(date, range),
      message: `Removed ${spanLabel(range)}`,
      run: () => addDayEdit(date, { kind: "remove", range }),
    });
  };

  /** A problem to show in the sheet, or null once saved. */
  const saveTimes = async (range: TimeRange): Promise<string | null> => {
    const from = sheet?.kind === "times" ? sheet.range : undefined;
    // A window over an event is trimmed around it, and can come to
    // nothing (EC-53): say so and save nothing.
    const events = (day?.events ?? []).map((e) => ({ start: e.start, end: e.end }));
    if (addedWindowPieces(range, events).length === 0) {
      return "That time is taken up by an event, so there's no window left.";
    }
    try {
      await addDayEdit(date, from ? { kind: "change", from, to: range } : { kind: "add", range });
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    setSheet(null);
    retry();
    return null;
  };

  const choiceIn = (index: number) => {
    const w = windowAt(index);
    if (!w || !day) return undefined;
    return day.choices.find((c) => c.anchorMinute >= w.range.start && c.anchorMinute < w.range.end);
  };
  const saveChoice = async (start: number, taskIds: string[], plannedCount: number) => {
    const index = indexAt(start);
    const w = windowAt(index);
    if (!w) return "That window has gone.";
    const existing = choiceIn(index);
    try {
      if (existing) await updateChoice(existing.id, { taskIds, plannedCount });
      else {
        // A choice is tasks pinned in one window (ADR-0039 §6).
        for (const id of taskIds) await pinForDay(id, date, w.range.start, "window");
        await createChoice({ localDate: date, anchorMinute: w.range.start, taskIds, plannedCount });
      }
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    } finally {
      // Pins written before a failure show too.
      retry();
    }
    setSheet(null);
    return null;
  };

  const copyEvents = () => {
    void save(async () => {
      const added = await copyLastWeeksEvents(weekStart(date));
      Alert.alert(
        added === 0 ? "Nothing to copy" : "Copied",
        added === 0
          ? "Last week had no one-time events to bring forward, or they're already here."
          : `${added} ${added === 1 ? "event" : "events"} from last week, a week later. Change any times that moved.`,
      );
    });
  };

  // ── Render ───────────────────────────────────────────────────────

  const items = day ? timeline(day.hours, day.events) : [];
  const visibleWindows = day
    ? day.planned.windows.filter((w) => !undo.hidden.has(windowKey(date, w.range)))
    : [];
  const openList = day
    ? [...day.planned.unplacedPins.map((p) => p.taskId), ...day.planned.later, ...day.planned.doesntFit]
    : [];

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.body}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        {week ? (
          <PlanWeekStrip
            days={week}
            label={weekLabel(selected)}
            selected={selected}
            today={today}
            onSelect={goTo}
            onPrevWeek={() => goTo(addDays(selected, -7))}
            onNextWeek={() => goTo(addDays(selected, 7))}
            theme={theme}
          />
        ) : null}

        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : day === null ? (
          <ActivityIndicator color={theme.muted} style={styles.loading} />
        ) : (
          <View style={styles.day}>
            <AppText variant="headline" color={theme.ink} accessibilityRole="header">
              {dayHeading(date, visibleWindows.length, day.freeMinutes)}
            </AppText>
            {day.day.away ? (
              <AppText variant="caption" color={theme.muted}>
                Away{day.day.away.label ? ` · ${day.day.away.label}` : ""}. Nothing is planned.
              </AppText>
            ) : day.day.cleared ? (
              <AppText variant="caption" color={theme.muted}>
                Today&apos;s cleared. Its windows are set aside.
              </AppText>
            ) : day.hours.usingDefaults ? (
              <Pressable
                onPress={() => router.push("/hours" as Href)}
                accessibilityRole="button"
                style={styles.link}
              >
                <AppText variant="caption" color={theme.accent}>
                  These are starter windows. Set your working hours ›
                </AppText>
              </Pressable>
            ) : null}

            {items.map((item) => {
              if (item.kind === "event") {
                const e = item.event;
                return (
                  <View
                    key={`e-${e.id}`}
                    style={[styles.event, { borderLeftColor: theme.areas[e.areaId] ?? theme.accent }]}
                    accessible
                    accessibilityLabel={`${e.title}, ${spanLabel({ start: e.start, end: e.end })}${e.done ? ", attended" : ""}`}
                  >
                    <AppText variant="label" color={theme.ink} tabular>
                      {spanLabel({ start: e.start, end: e.end })}
                    </AppText>
                    <AppText variant="body" color={theme.ink} style={styles.grow} numberOfLines={2}>
                      {e.title}
                    </AppText>
                  </View>
                );
              }
              if (item.kind === "gap" || item.kind === "buffer") {
                const label =
                  item.kind === "gap" ? item.name.toLowerCase() : `${item.range.end - item.range.start} min`;
                return (
                  <AppText
                    key={`${item.kind}-${item.range.start}`}
                    variant="footnote"
                    color={theme.muted}
                    style={styles.gap}
                  >
                    · {label} ·
                  </AppText>
                );
              }
              const w = day.planned.windows[item.index];
              if (!w || undo.hidden.has(windowKey(date, w.range))) return null;
              const choice = choiceIn(item.index);
              return (
                <WindowCard
                  key={windowKey(date, w.range)}
                  window={w}
                  tasks={day.tasks}
                  choices={choice ? [choice] : []}
                  addable={addableTo(item.index, day.planned).length}
                  editable={editable}
                  isToday={date === today}
                  hueFor={hueFor}
                  theme={theme}
                  onPin={(id) => pin(id, item.index)}
                  onAcceptAll={() => acceptAll(item.index)}
                  onUnpin={unpin}
                  onPinKind={pinKind}
                  onAddFromOpen={() => openSheet({ kind: "add", start: w.range.start })}
                  onEditTimes={() => openSheet({ kind: "times", range: w.range })}
                  onRemove={() => removeWindow(w.range)}
                  onChoice={() => openSheet({ kind: "choice", start: w.range.start })}
                />
              );
            })}

            {openList.length > 0 ? (
              <View style={styles.section}>
                <AppText variant="caption" color={theme.muted}>
                  Other open tasks
                </AppText>
                {openList.map((id) => {
                  const t = day.tasks.get(id);
                  return t ? (
                    <AppText key={id} variant="body" color={theme.ink}>
                      {t.title}
                    </AppText>
                  ) : null;
                })}
              </View>
            ) : null}

            {editable && !day.day.away ? (
              <Button
                variant="tonal"
                icon="add"
                label="Add window"
                onPress={() => openSheet({ kind: "times" })}
                theme={theme}
              />
            ) : null}

            <View style={styles.links}>
              {date <= today ? (
                <Pressable
                  onPress={() => setKindSheet(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Day type, ${DAY_KIND_LABEL[day.day.kind]}`}
                  style={styles.link}
                >
                  <AppText variant="caption" color={theme.accent}>
                    Day type: {DAY_KIND_LABEL[day.day.kind]} ›
                  </AppText>
                </Pressable>
              ) : null}
              {editable ? (
                <Pressable onPress={copyEvents} accessibilityRole="button" style={styles.link}>
                  <AppText variant="caption" color={theme.accent}>
                    Copy last week&apos;s events ›
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      <TabToolbar
        onTask={() => addHere("task")}
        onEvent={() => addHere("event")}
        onWindow={editable ? () => openSheet({ kind: "times" }) : undefined}
        onLog={() => openAdd("activity")}
        more={[
          { label: "Working hours", icon: "clock", onPress: () => router.push("/hours" as Href) },
          { label: "Copy last week's events", icon: "doc.on.doc", onPress: copyEvents },
          { label: "Time away", icon: "airplane", onPress: () => router.push("/away" as Href) },
        ]}
      />

      <UndoBar undo={undo} theme={theme} />

      {sheetShown?.kind === "times" ? (
        <WindowTimesSheet
          key={`times-${opened}`}
          visible={sheet?.kind === "times"}
          onDismissed={sheetGone}
          initial={sheetShown.range}
          dayLabel={dayLabel}
          theme={theme}
          onClose={() => setSheet(null)}
          onSave={saveTimes}
        />
      ) : null}

      {sheetShown?.kind === "add" && day && indexAt(sheetShown.start) >= 0 ? (
        <AddFromOpenSheet
          key={`add-${opened}`}
          visible={sheet?.kind === "add"}
          onDismissed={sheetGone}
          windowLabel={spanLabel(day.planned.windows[indexAt(sheetShown.start)]!.range)}
          tasks={addableTo(indexAt(sheetShown.start), day.planned)
            .map((id) => day.tasks.get(id))
            .filter((t): t is TodayTask => t !== undefined)}
          hueFor={hueFor}
          theme={theme}
          onClose={() => setSheet(null)}
          onPick={(t) => {
            setSheet(null);
            pin(t.id, indexAt(sheetShown.start));
          }}
        />
      ) : null}

      {sheetShown?.kind === "choice" && day && indexAt(sheetShown.start) >= 0 ? (
        <ChoiceSheet
          key={`choice-${opened}`}
          visible={sheet?.kind === "choice"}
          onDismissed={sheetGone}
          windowLabel={spanLabel(day.planned.windows[indexAt(sheetShown.start)]!.range)}
          candidates={choiceCandidates(day, indexAt(sheetShown.start))}
          initial={choiceIn(indexAt(sheetShown.start))}
          hueFor={hueFor}
          theme={theme}
          onClose={() => setSheet(null)}
          onSave={(ids, n) => saveChoice(sheetShown.start, ids, n)}
          onRemove={
            choiceIn(indexAt(sheetShown.start))
              ? () => {
                  const c = choiceIn(indexAt(sheetShown.start));
                  setSheet(null);
                  if (c) void save(() => deleteChoice(c.id));
                }
              : undefined
          }
        />
      ) : null}

      {day && date <= today ? (
        <DayKindSheet
          visible={kindSheet}
          dayLabel={dayLabel}
          kind={day.day.kind}
          title={day.day.title}
          satisfactionRating={day.day.satisfactionRating}
          theme={theme}
          reduceMotion={reduceMotion}
          onClose={() => setKindSheet(false)}
          onCommit={(kind, opts) => {
            setKindSheet(false);
            void save(() => setDayKind(date, kind, opts));
          }}
        />
      ) : null}

      {addingShown === "task" ? (
        <AddTaskModal
          visible={adding === "task"}
          onDismissed={addingGone}
          onClose={() => setAdding(null)}
          units={allUnits}
          areaColors={theme.areas}
          theme={theme}
          onCommit={async (title, timesPerWeek, unitIds, plannedWeekdays, partOfDay, oneOff, detail) => {
            await save(() =>
              addTask(unitIds, title, timesPerWeek, plannedWeekdays, partOfDay, oneOff, detail),
            );
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      ) : null}

      {addingShown === "event" ? (
        <EventSheet
          visible={adding === "event"}
          onDismissed={addingGone}
          unitChoice={{
            units: allUnits,
            value: eventUnits,
            onChange: setEventUnits,
            areaColors: theme.areas,
          }}
          accent={theme.accent}
          theme={theme}
          onClose={() => setAdding(null)}
          onSave={async (input, bounds) => {
            const saved = await savedOrSaid(async () => {
              await saveNewEvent(eventUnits, input, bounds);
              return true;
            });
            if (!saved) return;
            setAdding(null);
            setEventUnits([]);
            retry();
          }}
        />
      ) : null}
    </View>
  );
}

/** A window's identity on its day: its times. Windows have no names. */
const windowKey = (date: string, r: TimeRange) => `win-${date}-${r.start}-${r.end}`;

/** Commitment work due on the day, in this window or offered to it:
 *  what a "Do N of these" may hold (ADR-0039 §6). */
function choiceCandidates(day: DayPlan, index: number): TodayTask[] {
  const w = day.planned.windows[index];
  if (!w) return [];
  const ids = [
    ...w.pinned.map((p) => p.taskId),
    ...w.timed,
    ...w.suggested.map((s) => s.taskId),
    ...w.showAll.map((s) => s.taskId),
  ];
  return ids
    .map((id) => day.tasks.get(id))
    .filter(
      (t): t is TodayTask =>
        t !== undefined && t.commitment && !t.offSchedule && t.band === "due" && t.kind === "task",
    );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl },
  loading: { marginTop: space.xxl },
  day: { gap: space.md },
  event: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
    paddingLeft: space.md,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
  },
  grow: { flex: 1 },
  gap: { textAlign: "center" },
  section: { gap: space.xs },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: space.md },
  link: { minHeight: 44, justifyContent: "center" },
});
