/**
 * Today — the daily checklist, the app's home. A checklist and a
 * number: today's tasks, a grade that only climbs while you watch it,
 * and the day's life-log. Any past day can be opened from the strip;
 * "today" is just the selected day.
 *
 * Composition only. Data and the tap-to-tick loop are `useDayData`; the
 * arrangement of rows into sections is `arrangeDay` (daySections.ts);
 * the header, tail sections, activities and the move prompt are their
 * own components. What stays here is which sheet is open, and the
 * writes each one commits.
 */
import { isEditable, specialDayBonus, type Window as GridWindow } from "@glide/scoring";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Redirect, router, type Href } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearTransition, useReducedMotion } from "react-native-reanimated";

import { type PartOfDay } from "../../components/plan/planning";
import { ActivitiesBand } from "../../components/today/ActivitiesBand";
import { ActivitySheet, type ExistingActivity } from "../../components/today/ActivitySheet";
import { CompletionTagSheet } from "../../components/today/CompletionTagSheet";
import { DayGrid, windowKey } from "../../components/today/DayGrid";
import { DayKindSheet } from "../../components/today/DayKindSheet";
import { DayRecord } from "../../components/today/DayRecord";
import {
  arrangeDay,
  isDone,
  minuteOfToday,
  type SectionKey,
} from "../../components/today/daySections";
import { DropScopeSheet } from "../../components/today/DropScopeSheet";
import { MoveTaskSheet } from "../../components/today/MoveTaskSheet";
import { NoteSheet } from "../../components/today/NoteSheet";
import { PartialSheet } from "../../components/today/PartialSheet";
import { RecordActions } from "../../components/today/RecordActions";
import { SectionedChecklist } from "../../components/today/SectionedChecklist";
import { TailSection } from "../../components/today/TailSection";
import { TaskRow } from "../../components/today/TaskRow";
import { TodayHeader } from "../../components/today/TodayHeader";
import { WindowSheet } from "../../components/today/WindowSheet";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { Button } from "../../components/ui/Button";
import { deleteActivity, logActivity, updateActivity } from "../../db/activities";
import { createPool, deletePool, updatePool } from "../../db/commitmentWrites";
import { setCompletionFraction, setCompletionTags, toggleCompletion } from "../../db/completions";
import { setDayKind } from "../../db/dayGrades";
import { addJournalEntry, deleteJournalEntry, updateJournalEntry } from "../../db/journal";
import { isOnboardingComplete } from "../../db/onboarding";
import { addPhoto, deletePhoto } from "../../db/photos";
import { clearPlacementForDay, placeTaskForDay } from "../../db/placements";
import { loadDayLayout, setDayLayout, type DayLayout } from "../../db/settings";
import { reorderDayTasks, setTaskPartOfDay } from "../../db/tasks";
import type { TodayActivity, TodayTask } from "../../db/today";
import { usePlannedAhead, useDayData } from "../../hooks/useDayData";
import { spokenDate } from "../../lib/format";
import { getTheme } from "../../theme/colors";
import { space } from "../../theme/tokens";

/** Uniform, because `ReorderableList` positions rows from their index.
 *  Fits a title plus its factual caption with the row's own padding. */
const CHECKLIST_ROW_HEIGHT = 56;

/** The header block above each part of the day, including the air
 *  that separates it from the slot above. Fixed, because the drag
 *  layout walks these to place every row. */
const CHECKLIST_HEADER_HEIGHT = 48;

export default function TodayScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  /** Dynamic Type, so the grid's hours grow with its labels. */
  const { fontScale } = useWindowDimensions();

  const { day, weekGrade, monthGrades, viewMonth, pools, refresh, select, changeMonth, toggle } =
    useDayData();

  const [monthOpen, setMonthOpen] = useState(false);
  const [kindSheet, setKindSheet] = useState(false);
  const [activitySheet, setActivitySheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  /** Set while the note sheet is rewriting an existing entry rather
   *  than writing a new one. */
  const [editingNote, setEditingNote] = useState<{ id: string; body: string } | null>(null);
  const [editingActivity, setEditingActivity] = useState<TodayActivity | null>(null);
  const [taggingTask, setTaggingTask] = useState<TodayTask | null>(null);
  /** The row whose slot is being changed (ADR-0024 phase 3). */
  const [movingTask, setMovingTask] = useState<TodayTask | null>(null);
  /** The row whose part-credit sheet is open (ADR-0014 §4). */
  const [partialTask, setPartialTask] = useState<TodayTask | null>(null);
  /** Checklist or hours. Presentation only — both hold the same day. */
  const [dayLayout, setDayLayoutState] = useState<DayLayout>("checklist");
  /** The window whose pool is being edited (ADR-0033 §2). */
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
  const [collapsed, setCollapsed] = useState<Partial<Record<SectionKey, boolean>>>({});
  /** "Planned for other days" opens collapsed and loads its one-offs
   *  only once opened; every other section opens expanded. */
  const isCollapsed = (key: SectionKey) => collapsed[key] ?? key === "otherDays";
  const ahead = usePlannedAhead(day, !isCollapsed("otherDays"));
  /** null while unknown — the gate must not flash Today before it
   *  resolves (ADR-0011 decision 1). Reads fail open. */
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    void isOnboardingComplete().then(setOnboarded);
    void loadDayLayout().then(setDayLayoutState);
  }, []);

  // The onboarding gate (ADR-0011). Hooks above run unconditionally;
  // only the render is withheld. Splash covers the null case.
  if (onboarded === null) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;

  if (day === null) {
    return (
      <View style={[styles.root, { backgroundColor: theme.canvas }]}>
        <Backdrop circles={constellation(theme.areas, { faint: true })} />
        <ActivityIndicator color={theme.muted} style={styles.loading} />
      </View>
    );
  }

  const isToday = day.date === day.today;
  /** Notes and photos stay addable past the edit window (ADR-0002:
   *  grades finalize, memories don't) — only the future is off-limits. */
  const canRecord = day.date <= day.today;
  const layout = reduceMotion ? undefined : LinearTransition.duration(200);
  const dayLabel = isToday ? "today" : (spokenDate(day.date).split(",")[0] ?? day.date);
  const hueFor = (t: TodayTask) => theme.areas[t.areaId] ?? theme.accent;

  const {
    allTasks,
    openTasks,
    todayTasks,
    shownPart,
    byPlan,
    arrangeable,
    tailSections,
    gridTasks,
    showsGrid,
  } = arrangeDay(day, ahead, isToday ? minuteOfToday() : null, dayLayout);

  /** What each window already holds, keyed the way the grid keys them. */
  const pooledByWindow = new Map<string, string[]>(pools.map((p) => [windowKey(p), p.taskIds]));

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      await addPhoto(day.date, res.assets[0].uri);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
    }
  };

  /**
   * A row was dropped. **Reordered inside its slot** — persist the new
   * order and say nothing; arrangement is a preference, not a plan.
   * **Dragged into another slot** — a scheduling decision, so it asks
   * whether this is how the task goes from now on, or just today.
   */
  const onDropTask = (rowId: string, toSectionKey: string, toIndex: number) => {
    const moved = openTasks.find((t) => t.id === rowId);
    if (!moved) return;
    const toPart: PartOfDay | null =
      toSectionKey === "anytime" ? null : (toSectionKey as PartOfDay);

    // The slot's order after the drop, against where rows are *shown*: a
    // morning task carried into the afternoon and reordered there is a
    // reorder, not a move that needs its scope asked.
    const ordered = openTasks
      .filter((t) => t.id !== rowId && (shownPart(t) ?? "anytime") === toSectionKey)
      .sort(byPlan)
      .map((t) => t.id);
    ordered.splice(Math.min(toIndex, ordered.length), 0, rowId);

    if (shownPart(moved) === toPart) {
      void reorderDayTasks(ordered).then(() => refresh());
      return;
    }
    setDropped({ task: moved, part: toPart, ordered });
  };

  /** Commit the drop's scope: a placement for today, or the task's own
   *  part of day — clearing any placement that would override it. */
  const commitDrop = (scope: "today" | "always") => {
    const d = dropped;
    setDropped(null);
    if (!d) return;
    void (async () => {
      if (scope === "today") {
        await placeTaskForDay(d.task.id, day.date, d.part);
      } else {
        await setTaskPartOfDay(d.task.id, d.part);
        await clearPlacementForDay(d.task.id, day.date);
      }
      await reorderDayTasks(d.ordered);
      await refresh();
    })();
  };

  const openNoteEditor = (note: { id: string; body: string }) => {
    setEditingNote(note);
    setNoteSheet(true);
  };

  /** The day's record, and the way to add to it. */
  const record = (
    <>
      <DayRecord
        day={day}
        theme={theme}
        onEditNote={openNoteEditor}
        onDeleteNote={(id) => void deleteJournalEntry(id).then(() => refresh())}
        onDeletePhoto={(id) => void deletePhoto(id).then(() => refresh())}
      />
      {canRecord ? (
        <RecordActions
          onAddNote={() => setNoteSheet(true)}
          onAddPhoto={() => void pickPhoto()}
          theme={theme}
        />
      ) : null}
    </>
  );

  /** A checklist row, with the gestures the day allows on it. */
  const taskRow = (t: TodayTask, tail: boolean) => (
    <TaskRow
      task={t}
      hue={hueFor(t)}
      disabled={
        !day.editable ||
        (tail && t.doneAheadOn !== null && !isEditable(t.doneAheadOn, day.today))
      }
      onToggle={() => void toggle(t)}
      onTag={
        t.completedToday && day.editable && day.communalUnits.length > 0
          ? () => setTaggingTask(t)
          : undefined
      }
      onPartial={
        t.allowsPartial && day.editable && t.progress < 1 && (!tail || t.doneAheadOn === null)
          ? () => setPartialTask(t)
          : undefined
      }
      onMove={
        day.editable && !(tail ? isDone(t) : t.completedToday)
          ? () => setMovingTask(t)
          : undefined
      }
      tagHues={theme.areas}
      theme={theme}
      reduceMotion={reduceMotion}
    />
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

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />

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
        showsGrid={showsGrid}
        dayLayout={dayLayout}
        onChangeLayout={(next) => {
          setDayLayoutState(next);
          void setDayLayout(next);
        }}
        topInset={insets.top}
        layout={layout}
        reduceMotion={reduceMotion}
        theme={theme}
      />

      <ScrollView
        style={styles.body}
        scrollEnabled={!draggingTask}
        contentContainerStyle={styles.container}
      >
        {day.finalized ? (
          <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
            This day has settled. You can still change it — editing it now will move the week and
            month it belongs to.
          </AppText>
        ) : null}

        {day.kind === "rest" ? (
          <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
            Nothing counts today; anything you do still logs.
          </AppText>
        ) : null}

        {/* A rest day (ADR-0037): automatic on a day that asks nothing,
            never offered or chosen. Said once, plainly, as what the day
            is — not as a reward or a warning. */}
        {day.restDay ? (
          <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
            Nothing’s due — a rest day. It starts at 70; activities add up to 30, and anything you
            do early counts on top.
          </AppText>
        ) : day.nothingDue && day.kind !== "rest" ? (
          <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
            Nothing’s due today. Do something from later in the week and it becomes a rest day —
            70, plus what you did.
          </AppText>
        ) : null}

        {/* The day's record leads on past days, where the log is the
            point; on today it follows the checklist, where doing is. */}
        {!isToday ? record : null}

        {!day.hasSnapshot ? (
          <View style={styles.empty}>
            <AppText color={theme.ink} style={styles.centerText}>
              Your day starts with a plan. Rate what matters first, and the checklist builds
              itself.
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
            {/* A special day keeps its checklist (ADR-0023 §3): the rating
                tops the day up, it doesn't stand in for the work. */}
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
                    label={day.satisfactionRating === null ? "Rate the day" : "Edit the day"}
                    variant="secondary"
                    onPress={() => setKindSheet(true)}
                    theme={theme}
                  />
                ) : null}
              </View>
            ) : null}

            {/* The four parts of the day are one drag surface: reorder
                inside a slot, or drag a task into another slot. Empty
                periods are drop targets too — "do this in the afternoon"
                matters most when the afternoon is empty. */}
            {dayLayout === "grid" ? (
              <DayGrid
                tasks={gridTasks}
                hueFor={hueFor}
                theme={theme}
                fontScale={fontScale}
                // A line for where you are, only on the day you are in.
                nowMinute={isToday ? minuteOfToday() : null}
                onPress={(t) => void toggle(t)}
                pooledByWindow={pooledByWindow}
                onPlanWindow={
                  day.editable
                    ? (w, _own, carried) => {
                        const existing = pools.find((p) => windowKey(p) === windowKey(w));
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
                sections={arrangeable.map((s) => ({ key: s.key, rowIds: s.tasks.map((t) => t.id) }))}
                rowHeight={CHECKLIST_ROW_HEIGHT}
                headerHeights={arrangeable.map(() => CHECKLIST_HEADER_HEIGHT)}
                onDragStateChange={setDraggingTask}
                onMove={onDropTask}
                theme={theme}
                renderHeader={(key) => {
                  const s = arrangeable.find((x) => x.key === key);
                  if (!s) return null;
                  const empty = s.tasks.length === 0;
                  return (
                    <View style={styles.dragHeader}>
                      <View
                        style={styles.sectionHeader}
                        accessible={empty}
                        accessibilityLabel={empty ? `${s.label}, ${s.emptyNote}` : undefined}
                      >
                        <AppText variant="caption" color={theme.muted}>
                          {s.label}
                        </AppText>
                        <AppText variant="caption" color={theme.muted} tabular={!empty}>
                          {empty ? s.emptyNote : `${s.pts} pts`}
                        </AppText>
                      </View>
                    </View>
                  );
                }}
                renderRow={(rowId) => {
                  const t = openTasks.find((x) => x.id === rowId);
                  return t ? taskRow(t, false) : null;
                }}
              />
            ) : null}

            {tailSections.map((s) => (
              <TailSection
                key={s.key}
                section={s}
                collapsed={isCollapsed(s.key)}
                onToggleCollapsed={() =>
                  setCollapsed((prev) => ({ ...prev, [s.key]: !isCollapsed(s.key) }))
                }
                countOnly={ahead === null}
                renderRow={(t) => taskRow(t, true)}
                layout={layout}
                theme={theme}
              />
            ))}
          </>
        )}

        {day.hasSnapshot && day.hasTasks ? (
          <ActivitiesBand
            activities={day.activities}
            dayKind={day.kind}
            editable={day.editable}
            onEdit={(a) => {
              setEditingActivity(a);
              setActivitySheet(true);
            }}
            onAdd={() => {
              setEditingActivity(null);
              setActivitySheet(true);
            }}
            layout={layout}
            theme={theme}
          />
        ) : null}

        {isToday ? record : null}

        {/* Takes up whatever's left so the footer sits at the bottom on a
            short day instead of floating mid-screen above blank canvas. */}
        <View style={styles.spacer} />

        {/* The line that has to stay next to the number. */}
        <View style={[styles.footer, { borderTopColor: theme.hairline }]}>
          <AppText variant="footnote" color={theme.muted}>
            Grades are guidelines, not judgments.
          </AppText>
        </View>
      </ScrollView>

      {/* One sheet, both jobs: blank to add, seeded to rewrite. */}
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
          const write = editingNote
            ? updateJournalEntry(editingNote.id, body)
            : addJournalEntry(day.date, body);
          void write.then(() => refresh());
        }}
      />

      <DropScopeSheet
        drop={dropped ? { title: dropped.task.title, part: dropped.part } : null}
        onJustToday={() => commitDrop("today")}
        onFromNowOn={() => commitDrop("always")}
        onCancel={() => {
          setDropped(null);
          void refresh();
        }}
        theme={theme}
      />

      {planning ? (
        <WindowSheet
          visible
          window={planning.window}
          // Only open work: offering something already ticked would be
          // offering to plan the past.
          candidates={todayTasks.filter((t) => !planning.carried.includes(t.id))}
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
                await updatePool(p.poolId, { taskIds: p.chosen, plannedCount: p.plannedCount });
              } else {
                await createPool({
                  localDate: day.date,
                  taskIds: p.chosen,
                  plannedCount: p.plannedCount,
                  afterTaskId: p.window.afterTaskId,
                  partOfDay: p.window.partOfDay,
                });
              }
              await refresh();
            })();
          }}
          onClear={
            planning.poolId === null
              ? undefined
              : () => {
                  const id = planning.poolId;
                  setPlanning(null);
                  if (id !== null) void deletePool(id).then(() => refresh());
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
            void setCompletionFraction(t.id, day.date, fraction).then((scored) => refresh(scored));
          }}
          onClear={() => {
            const t = partialTask;
            setPartialTask(null);
            void toggleCompletion(t.id, day.date).then((scored) => refresh(scored));
          }}
          // The gesture's older job, kept reachable (ADR-0024 §3).
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
          dayLabel={isToday ? "today" : (spokenDate(day.date).split(",")[0] ?? "that day")}
          accent={hueFor(movingTask)}
          theme={theme}
          onClose={() => setMovingTask(null)}
          onPick={(part, scope) => {
            const t = movingTask;
            setMovingTask(null);
            void (async () => {
              if (scope === "always") {
                // Changing the task itself; any placement for this day
                // would otherwise keep overriding it.
                await setTaskPartOfDay(t.id, part);
                await clearPlacementForDay(t.id, day.date);
              } else {
                await placeTaskForDay(t.id, day.date, part);
              }
              await refresh();
            })();
          }}
          onClearPlacement={
            movingTask.placedToday
              ? () => {
                  const t = movingTask;
                  setMovingTask(null);
                  void clearPlacementForDay(t.id, day.date).then(() => refresh());
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
            void setCompletionTags(taggingTask.id, day.date, unitIds).then(() => refresh());
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
            ? () => void deleteActivity(existingForSheet.id, day.date).then(() => refresh())
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  loading: { marginTop: space.xxxl },
  /** Takes the space between the fixed header and the tab bar. */
  body: { flex: 1 },
  container: {
    paddingHorizontal: space.screen,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    flexGrow: 1,
  },
  spacer: { flexGrow: 1, minHeight: space.xl },
  stateNote: { marginTop: space.md },
  empty: { gap: space.lg, marginTop: space.xxl },
  centerText: { textAlign: "center" },
  special: { gap: space.sm, marginTop: space.xl },
  /** The header sits at the bottom of its block, so the air above it
   *  separates it from the slot before rather than from its own rows. */
  dragHeader: { height: CHECKLIST_HEADER_HEIGHT, justifyContent: "flex-end" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 32,
  },
  footer: {
    paddingTop: space.lg,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
