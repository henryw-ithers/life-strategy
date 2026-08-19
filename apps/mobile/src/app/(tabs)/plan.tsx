/**
 * The Plan screen: your portfolio's units with their weights, and the
 * tasks that spend them. The durable home of "do."
 *
 * One screen, not two. A unit's tasks open in place rather than on a
 * pushed route — the whole plan is ~18 rows, and the question people
 * actually have ("where are my points going?") is answered by seeing
 * several units at once, which a drill-down destroys. Expanding one
 * collapses the rest, so the screen never becomes a wall.
 */
import { unitProfile } from "@glide/scoring";
import * as Haptics from "expo-haptics";
import {
  router,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";

import { UnitInfoSheet } from "../../components/diagnostic/UnitInfoSheet";
import { AddTaskModal } from "../../components/plan/AddTaskModal";
import { TaskEditSheet, type EditableTask } from "../../components/plan/TaskEditSheet";
import { SuggestionsSheet } from "../../components/plan/SuggestionsSheet";
import { TaskRow } from "../../components/plan/TaskRow";
import {
  COMMUNAL_TASK_NOTE,
  type PartOfDay,
} from "../../components/plan/planning";
import { ReorderableList } from "../../components/ui/ReorderableList";
import type { PickableUnit } from "../../components/plan/UnitPicker";
import { AppText } from "../../components/ui/AppText";
import { Disclosure } from "../../components/ui/Chevron";
import { LoadFailure, useScreenLoad } from "../../components/ui/ScreenLoad";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { Button } from "../../components/ui/Button";
import { Group } from "../../components/ui/Group";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { LIBRARY } from "../../content/library";
import { UNIT_INFO } from "../../content/units";
import { addMilestone, createGoal, loadGoals, setGoalMetric } from "../../db/goals";
import {
  addTask,
  archiveTask,
  latestRatings,
  loadPlan,
  reorderUnitTasks,
  restoreTask,
  setTaskDetails,
  setTaskFortnightOffset,
  setTaskFrequency,
  setTaskGoal,
  setTaskPlanning,
  setTaskUnits,
  setUnitScoring,
  type PlanData,
  type PlanTask,
  type PlanUnit,
} from "../../db/tasks";
import { getTheme } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";

/** Uniform, because the drag maths depends on it. Sized for two lines
 *  of body text (24 × 2) plus the row's own padding — titles wrap now,
 *  and a variable-height row would break `ReorderableList`, which
 *  positions every row from its index. */
const TASK_ROW_HEIGHT = 64;

interface EditTarget {
  task: PlanTask;
  unit: PlanUnit;
}

export default function PlanScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const reduceMotion = useReducedMotion();
  // Reanimated's layout transition, matching the Today screen —
  // `LayoutAnimation` is the legacy path and behaves inconsistently
  // under the New Architecture this SDK defaults to.
  const layout = reduceMotion ? undefined : LinearTransition.duration(180);

  /** The post-diagnostic diff links here with a unit to open — the
   *  prompts say "Friendship rose to 12 points" and landing on a
   *  collapsed list would strand that intent (ADR-0005 §2). */
  const { unit: unitParam } = useLocalSearchParams<{ unit?: string }>();

  const [plan, setPlan] = useState<PlanData | null>(null);
  /** Active goals per unit, for the edit sheet's goal row. */
  const [goalsByUnit, setGoalsByUnit] = useState<
    Record<string, { id: string; title: string }[]>
  >({});
  const [openUnitId, setOpenUnitId] = useState<string | null>(unitParam ?? null);
  /** `homeUnit: null` is the quick add from the top of the screen — the
   *  sheet opens with no unit chosen and asks for one. */
  const [adding, setAdding] = useState<{ homeUnit: PlanUnit | null } | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [infoUnit, setInfoUnit] = useState<PlanUnit | null>(null);
  /** The unit whose library ideas are open (ADR-0006 §3: pull). */
  const [suggestingFor, setSuggestingFor] = useState<PlanUnit | null>(null);
  /** Latest diagnostic ratings, for the unit profile that orders
   *  those ideas. Empty before the first diagnostic. */
  const [ratings, setRatings] = useState<
    Map<string, { importance: number; satisfaction: number }>
  >(new Map());
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  /** The task just created, tinted until the timer clears it. */
  const [justAdded, setJustAdded] = useState<string | null>(null);
  /** A task being dragged owns the finger; the page must hold still. */
  const [draggingTask, setDraggingTask] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  /** The scroll content, as the frame every unit's offset is measured
   *  against — `onLayout` only ever reports a position inside its own
   *  parent, and a unit sits two boxes deep. */
  const contentRef = useRef<View>(null);
  const unitRefs = useRef<Record<string, View | null>>({});
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      if (freshTimer.current) clearTimeout(freshTimer.current);
    },
    [],
  );

  const reload = useCallback(async () => {
    const [next, goals, rated] = await Promise.all([
      loadPlan(),
      loadGoals(),
      latestRatings(),
    ]);
    setPlan(next);
    setRatings(rated);
    const byUnit: Record<string, { id: string; title: string }[]> = {};
    for (const area of goals.areas) {
      for (const u of area.units) {
        const active = u.goals.filter((g) => g.status === "active");
        if (active.length > 0) {
          byUnit[u.id] = active.map((g) => ({ id: g.id, title: g.title }));
        }
      }
    }
    setGoalsByUnit(byUnit);
  }, []);

  const { error, retry } = useScreenLoad(reload);

  /**
   * Every scoreable unit, communal ones included (ADR-0027 §4). They
   * hold tasks like any other unit now — the special case was that
   * they never could, which made the Tasks screen's relationship rows
   * dead ends: an "Add task" button that opened a sheet with no chip
   * to file the result under.
   */
  const allUnits: PickableUnit[] = useMemo(
    () =>
      (plan?.areas ?? []).flatMap((a) =>
        a.units
          .filter((u) => u.includeInScoring)
          .map((u) => ({
            id: u.id,
            name: u.name,
            areaId: u.areaId,
            motivationKind: u.motivationKind,
          })),
      ),
    [plan],
  );

  const toggleUnit = (unitId: string) => {
    setOpenUnitId((current) => (current === unitId ? null : unitId));
  };

  /**
   * The number in the right-hand column: the unit's own diagnostic
   * weight, whether or not it currently spends it.
   *
   * ADR-0027 §2 withdraws the reallocation that used to inflate a
   * covered unit's number past its own weight — a unit with no daily
   * task simply cannot earn this, and nobody else receives it either,
   * so the figure shown here and the figure in the day's ceiling are
   * the same one.
   */
  const shownPoints = (unit: PlanUnit): number => unit.weight ?? 0;

  /** The unit holding the most points, which is where a first task is
   *  worth the most. Onboarding hands the user straight to this screen
   *  (ADR-0011 as amended), so the opening move has to be obvious. */
  const topUnit = useMemo(() => {
    const scored = (plan?.areas ?? [])
      .flatMap((a) => a.units)
      .filter((u) => u.includeInScoring && u.weight !== null);
    return scored.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0] ?? null;
  }, [plan]);

  /** True on a fresh plan: the diagnostic is done, nothing spends its
   *  points yet. Also true again if someone clears every task, which is
   *  the same situation and deserves the same help. */
  const noTasksYet =
    plan !== null &&
    plan.hasSnapshot &&
    plan.areas.every((a) => a.units.every((u) => u.tasks.length === 0));

  const deleteTask = (t: PlanTask) => {
    setUndo({ id: t.id, title: t.title });
    void archiveTask(t.id).then(reload);
  };

  /**
   * Scroll a unit to the top of the viewport. Waits out the expand and
   * collapse first: both run at 180ms, and measuring mid-transition
   * lands on wherever the row happened to be that frame.
   */
  const revealUnit = (unitId: string) => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      const node = unitRefs.current[unitId];
      const content = contentRef.current;
      if (!node || !content) return;
      node.measureLayout(
        content,
        (_x, y) => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, y - space.lg),
            animated: !reduceMotion,
          });
        },
        () => {},
      );
    }, 260);
  };

  /**
   * A new task lands last in its unit, so the screen has to say where
   * it went: open that unit, bring it into view, and tint the row for
   * long enough to find it. The drag handle is then right there, which
   * is where ranking moved to when it left the add sheet.
   */
  const commitTask = async (
    title: string,
    timesPerWeek: number,
    unitIds: string[],
    plannedWeekdays: string | null,
    partOfDay: PartOfDay | null,
  ) => {
    const id = await addTask(
      unitIds,
      title,
      timesPerWeek,
      plannedWeekdays,
      partOfDay,
    );
    const home = unitIds[0];
    if (home) setOpenUnitId(home);
    await reload();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (home) revealUnit(home);
    if (id) {
      setJustAdded(id);
      if (freshTimer.current) clearTimeout(freshTimer.current);
      freshTimer.current = setTimeout(() => setJustAdded(null), 2600);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <ScreenHeader title="Tasks" theme={theme} />

      {/* Capture, before navigation. Adding a task used to start with
          finding its unit and expanding it; this opens the same sheet
          with the unit as a field inside it. Fixed rather than scrolled
          away with the list — it's furniture, like the header it sits
          under. */}
      {plan?.hasSnapshot && allUnits.length > 0 ? (
        <View style={styles.addBar}>
          <Button
            variant="tonal"
            glyph="+"
            label="Add task"
            onPress={() => setAdding({ homeUnit: null })}
            theme={theme}
          />
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        scrollEnabled={!draggingTask}
        contentContainerStyle={styles.container}
      >
        <View ref={contentRef}>
          {error ? (
        <LoadFailure error={error} onRetry={retry} theme={theme} />
      ) : plan === null ? (
            <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
          ) : !plan.hasSnapshot ? (
            <View style={styles.empty}>
              <AppText color={theme.ink} style={styles.centerText}>
                Your plan starts with a diagnostic. Rate what matters first, and
                the weights land here.
              </AppText>
              <Button
                label="Run the diagnostic"
                onPress={() => router.push("/diagnostic" as Href)}
                theme={theme}
              />
            </View>
          ) : (
            <>
              {/* Teaches the screen instead of leaving eighteen rows of
                  zero to be interpreted. Sits above the list rather than
                  replacing it, so the weights the user just earned are
                  visible while they read what to do with them. */}
              {noTasksYet ? (
                <View style={[styles.firstRun, { borderColor: theme.hairline }]}>
                  <AppText variant="headline" color={theme.ink}>
                    Your points are all unspent
                  </AppText>
                  <AppText color={theme.muted}>
                    Every part of your life below holds a share of your daily
                    100. A task earns those points when you tick it off, so
                    nothing counts until you add some.
                  </AppText>
                  {topUnit ? (
                    <Button
                      label={`Add a task to ${topUnit.name}`}
                      onPress={() => {
                        setOpenUnitId(topUnit.id);
                        setAdding({ homeUnit: topUnit });
                      }}
                      theme={theme}
                    />
                  ) : null}
                  <AppText variant="caption" color={theme.muted}>
                    {topUnit
                      ? `${topUnit.name} carries the most points, so it's the best place to start. Any unit works.`
                      : "Open any unit below to add one."}
                  </AppText>
                </View>
              ) : null}

              {plan.areas.map((area) => (
              <Group key={area.id} theme={theme}>
                <View style={styles.groupHeader}>
                  <View
                    style={[styles.dot, { backgroundColor: theme.areas[area.id] ?? theme.muted }]}
                  />
                  <AppText variant="headline" color={theme.ink} style={styles.grow}>
                    {area.name}
                  </AppText>
                  {/* Puts a number in the right-hand column at every
                      level of the page, so "where are my points going"
                      reads down one edge. It's the sum of the numbers
                      directly beneath it, which is the area's own share
                      of the 100 — ADR-0027 §2 withdrew the reallocation
                      that used to make this bigger than the diagnostic's
                      own number for a covered area. */}
                  <AppText variant="label" color={theme.muted} tabular style={styles.pts}>
                    {area.units
                      .filter((u) => u.includeInScoring)
                      .reduce((sum, u) => sum + shownPoints(u), 0)}
                  </AppText>
                </View>

                {area.units.map((unit) => {
                  const excluded = !unit.includeInScoring;
                  const open = openUnitId === unit.id;
                  const hue = theme.areas[area.id] ?? theme.accent;
                  return (
                    <Animated.View key={unit.id} layout={layout}>
                      <Pressable
                        ref={(node) => {
                          unitRefs.current[unit.id] = node;
                        }}
                        // Excluded units open too (ADR-0027 §2): the
                        // panel is the only way back into the plan, and
                        // a decision you cannot reverse from where you
                        // made it is not a scope control.
                        onPress={() => toggleUnit(unit.id)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        accessibilityLabel={
                          excluded
                            ? `${unit.name}, not part of your plan`
                            : unit.tasks.length === 0
                              ? `${unit.name}, no tasks, ${unit.weight ?? 0} points not in play`
                              : `${unit.name}, ${unit.weight ?? 0} points, ${unit.tasks.length} tasks`
                        }
                        accessibilityHint={open ? "Collapses its tasks" : "Shows its tasks"}
                        style={({ pressed }) => [styles.unitRow, { opacity: pressed ? 0.6 : 1 }]}
                      >
                        <View style={styles.chev}>
                          <Disclosure open={open} theme={theme} size={15} />
                        </View>
                        <AppText
                          color={excluded ? theme.muted : theme.ink}
                          style={styles.grow}
                          numberOfLines={1}
                        >
                          {unit.name}
                        </AppText>
                        {excluded ? (
                          <AppText variant="caption" color={theme.muted}>
                            not scored
                          </AppText>
                        ) : (
                          <>
                            {/* The count is only useful while the unit is
                                shut — open, the list is right there, and
                                the caption would be restating it. */}
                            {unit.tasks.length === 0 ? (
                              <AppText variant="caption" color={theme.muted}>
                                no tasks
                              </AppText>
                            ) : open ? null : (
                              <AppText variant="caption" color={theme.muted}>
                                {unit.tasks.length}{" "}
                                {unit.tasks.length === 1 ? "task" : "tasks"}
                              </AppText>
                            )}
                            {/* Muted means "not in play": the number is
                                what this unit would bring, not what it
                                currently spends. */}
                            <AppText
                              color={unit.tasks.length === 0 ? theme.muted : theme.ink}
                              tabular
                              style={styles.pts}
                            >
                              {shownPoints(unit)}
                            </AppText>
                          </>
                        )}
                      </Pressable>

                      {open && excluded ? (
                        <Animated.View
                          entering={reduceMotion ? undefined : FadeIn.duration(160)}
                          layout={layout}
                          style={[styles.panel, { backgroundColor: theme.surface }]}
                        >
                          <AppText variant="caption" color={theme.muted}>
                            Not part of your plan, so its points sit outside
                            your 100 and the rest of your units share them.
                          </AppText>
                          <Pressable
                            onPress={() => {
                              void setUnitScoring(unit.id, true).then(reload);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Put ${unit.name} back in my plan`}
                            style={({ pressed }) => [
                              styles.addRow,
                              { borderColor: theme.hairline, opacity: pressed ? 0.5 : 1 },
                            ]}
                          >
                            <AppText variant="label" color={theme.accent}>
                              Put back in my plan
                            </AppText>
                          </Pressable>
                        </Animated.View>
                      ) : null}

                      {open && !excluded ? (
                        <Animated.View
                          entering={reduceMotion ? undefined : FadeIn.duration(160)}
                          layout={layout}
                          style={[styles.panel, { backgroundColor: theme.surface }]}
                        >
                          {UNIT_INFO[unit.id] ? (
                            <Pressable
                              onPress={() => setInfoUnit(unit)}
                              accessibilityRole="button"
                              accessibilityLabel={`What ${unit.name} covers`}
                              style={({ pressed }) => [
                                styles.panelHead,
                                { opacity: pressed ? 0.5 : 1 },
                              ]}
                            >
                              <AppText variant="caption" color={theme.accent}>
                                What this covers
                              </AppText>
                            </Pressable>
                          ) : null}

                          {/* A nudge, not a gate (ADR-0027 §4): the unit
                              takes a task exactly like any other, this
                              just says the part a checklist can't hold. */}
                          {unit.motivationKind === "communal" ? (
                            <AppText variant="caption" color={theme.muted}>
                              {COMMUNAL_TASK_NOTE}
                            </AppText>
                          ) : null}

                          {unit.tasks.length === 0 ? (
                            <AppText variant="caption" color={theme.muted}>
                              No tasks yet, so these points go unearned until
                              you add one.
                            </AppText>
                          ) : (
                            // Rank is the thing you most often want to
                            // change while looking at the list, so the
                            // grip is here rather than two taps away in
                            // the edit sheet.
                            <ReorderableList
                              items={unit.tasks.map((t) => ({ id: t.id, label: t.title }))}
                              rowHeight={TASK_ROW_HEIGHT}
                              scrollable={false}
                              onDragStateChange={setDraggingTask}
                              onReorder={(ids) => {
                                void reorderUnitTasks(unit.id, ids).then(reload);
                              }}
                              renderItem={(item) => {
                                const t = unit.tasks.find((x) => x.id === item.id);
                                if (!t) return null;
                                return (
                                  <TaskRow
                                    title={t.title}
                                    timesPerWeek={t.timesPerWeek}
                                    pointValue={t.pointValue}
                                    otherUnitNames={t.otherUnitNames}
                                    plannedWeekdays={t.plannedWeekdays}
                                    partOfDay={t.partOfDay}
                                    accent={hue}
                                    theme={theme}
                                    highlight={t.id === justAdded}
                                    onDelete={() => deleteTask(t)}
                                    onEdit={() => setEditing({ task: t, unit })}
                                  />
                                );
                              }}
                              theme={theme}
                            />
                          )}

                          {/* Bordered, so the one action in the panel
                              reads as a control instead of a third line
                              of left-aligned text under the list. */}
                          <Pressable
                            onPress={() => setAdding({ homeUnit: unit })}
                            accessibilityRole="button"
                            accessibilityLabel={`Add a task to ${unit.name}`}
                            style={({ pressed }) => [
                              styles.addRow,
                              { borderColor: theme.hairline, opacity: pressed ? 0.5 : 1 },
                            ]}
                          >
                            {/* Same words as the bar at the top of the
                                screen: one action, named once. */}
                            <AppText variant="label" color={theme.accent}>
                              + Add task
                            </AppText>
                          </Pressable>

                          {/* The library's one way in (ADR-0006 §3:
                              available when a unit is opened, silent
                              otherwise). Sits under the add row because
                              writing your own is the primary act and
                              borrowing an idea is the fallback. */}
                          {LIBRARY[unit.id] ? (
                            <Pressable
                              onPress={() => setSuggestingFor(unit)}
                              accessibilityRole="button"
                              accessibilityLabel={`Ideas for ${unit.name}`}
                              style={({ pressed }) => [
                                styles.setAside,
                                { opacity: pressed ? 0.5 : 1 },
                              ]}
                            >
                              <AppText variant="caption" color={theme.muted}>
                                Need ideas?
                              </AppText>
                            </Pressable>
                          ) : null}

                          {/* The exclusion valve (ADR-0027 §2). Worded
                              as scope, never as giving up, and quiet —
                              it sits under the action you actually came
                              for. No confirmation: it is one tap back. */}
                          <Pressable
                            onPress={() => {
                              void setUnitScoring(unit.id, false).then(reload);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Take ${unit.name} out of my plan for now`}
                            style={({ pressed }) => [
                              styles.setAside,
                              { opacity: pressed ? 0.5 : 1 },
                            ]}
                          >
                            <AppText variant="caption" color={theme.muted}>
                              Not part of my plan right now
                            </AppText>
                          </Pressable>
                        </Animated.View>
                      ) : null}
                    </Animated.View>
                  );
                })}
              </Group>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {undo ? (
        <View
          style={[
            styles.undo,
            {
              backgroundColor: theme.surface,
              borderColor: theme.hairline,
              // Sits above the tab bar, which already clears the home
              // indicator — adding the inset again would hide it behind.
              bottom: space.lg,
            },
          ]}
        >
          <AppText color={theme.ink} style={styles.grow} numberOfLines={1}>
            Deleted “{undo.title}”
          </AppText>
          <Pressable
            onPress={() => {
              const id = undo.id;
              setUndo(null);
              void restoreTask(id).then(reload);
            }}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <AppText variant="label" color={theme.accent}>
              Undo
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => setUndo(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <AppText variant="label" color={theme.muted}>
              ✕
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {adding ? (
        <AddTaskModal
          visible
          onClose={() => setAdding(null)}
          units={allUnits}
          homeUnitId={adding.homeUnit?.id}
          areaColors={theme.areas}
          theme={theme}
          onCommit={commitTask}
        />
      ) : null}

      {editing ? (
        <TaskEditSheet
          visible
          task={
            {
              id: editing.task.id,
              title: editing.task.title,
              timesPerWeek: editing.task.timesPerWeek,
              unitIds: editing.task.unitIds,
              plannedWeekdays: editing.task.plannedWeekdays,
              partOfDay: editing.task.partOfDay,
              goalId: editing.task.goalId,
              fortnightOffset: editing.task.fortnightOffset,
            } satisfies EditableTask
          }
          units={allUnits}
          goals={goalsByUnit[editing.unit.id] ?? []}
          areaColors={theme.areas}
          accent={theme.areas[editing.unit.areaId] ?? theme.accent}
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            const t = editing.task;
            // The description field is gone from the sheet (2026-08-18)
            // but the column stays, so this preserves whatever was
            // already written rather than clearing it on the next save.
            if (next.title !== t.title) {
              await setTaskDetails(t.id, next.title, t.description);
            }
            if (next.timesPerWeek !== t.timesPerWeek) {
              await setTaskFrequency(t.id, next.timesPerWeek);
            }
            if (next.unitIds.join("|") !== t.unitIds.join("|")) {
              await setTaskUnits(t.id, next.unitIds);
            }
            if (
              next.plannedWeekdays !== t.plannedWeekdays ||
              next.partOfDay !== t.partOfDay
            ) {
              await setTaskPlanning(t.id, next.plannedWeekdays, next.partOfDay);
            }
            if (next.goalId !== t.goalId) {
              await setTaskGoal(t.id, next.goalId);
            }
            if (next.fortnightOffset !== t.fortnightOffset) {
              await setTaskFortnightOffset(
                t.id,
                next.fortnightOffset === 1 ? 1 : 0,
              );
            }
            await reload();
          }}
          onDelete={() => deleteTask(editing.task)}
        />
      ) : null}

      {suggestingFor ? (
        <SuggestionsSheet
          visible
          unitId={suggestingFor.id}
          unitName={suggestingFor.name}
          profile={
            // Null before the first diagnostic: nothing has a weight or
            // a rating yet, so there is no situation to read.
            suggestingFor.weight !== null && ratings.has(suggestingFor.id)
              ? unitProfile({
                  weight: suggestingFor.weight,
                  importance: ratings.get(suggestingFor.id)!.importance,
                  satisfaction: ratings.get(suggestingFor.id)!.satisfaction,
                })
              : null
          }
          existingTaskTitles={suggestingFor.tasks.map((t) => t.title)}
          existingGoalTitles={(goalsByUnit[suggestingFor.id] ?? []).map(
            (g) => g.title,
          )}
          accent={theme.areas[suggestingFor.areaId] ?? theme.accent}
          theme={theme}
          onClose={() => setSuggestingFor(null)}
          onAddTask={(t) => {
            const unit = suggestingFor;
            setSuggestingFor(null);
            void commitTask(t.title, t.timesPerWeek, [unit.id], null, null);
          }}
          onAddGoal={(g) => {
            const unit = suggestingFor;
            setSuggestingFor(null);
            void (async () => {
              const id = await createGoal(
                unit.id,
                g.title,
                g.description ?? undefined,
              );
              // The library's rungs and metric arrive with it — a goal
              // stripped of them would be the title only, which is the
              // least useful half of what was written.
              for (const title of g.milestones) await addMilestone(id, title);
              if (g.metric && g.metric.suggestedTarget !== null) {
                await setGoalMetric(id, {
                  kind: g.metric.kind,
                  unit: g.metric.unit,
                  targetValue: g.metric.suggestedTarget,
                });
              }
              await reload();
              router.push(`/goals/${id}` as Href);
            })();
          }}
        />
      ) : null}

      {infoUnit && UNIT_INFO[infoUnit.id] ? (
        <UnitInfoSheet
          visible
          onClose={() => setInfoUnit(null)}
          unitName={infoUnit.name}
          info={UNIT_INFO[infoUnit.id]!}
          accent={theme.areas[infoUnit.areaId] ?? theme.accent}
          theme={theme}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  /** Takes the space between the fixed header and the tab bar; the
   *  unit list scrolls inside it while both stay put. */
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl },
  /** Tight under the header, loose above the list: the button belongs
   *  to the furniture, not to the first area. */
  addBar: {
    paddingHorizontal: space.screen,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  empty: { gap: space.lg, marginTop: space.xxl },
  centerText: { textAlign: "center" },
  /** Outlined rather than surface-filled: `Group` below owns the filled
   *  look, and a filled block above filled blocks reads as a nested
   *  card. */
  firstRun: {
    marginTop: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  // Areas breathe more than the rows inside them — the rhythm is what
  // separates six groups without six heavy dividers.
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm + 2,
    minHeight: 32,
    marginBottom: space.xs,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 46,
    paddingLeft: space.sm,
  },
  chev: { width: 14 },
  /** Quieter than the add row above it: scope is a rarer decision than
   *  adding a task, and shouldn't compete with it. */
  setAside: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  /** One right-hand column for every number on the page. */
  pts: { minWidth: 30, textAlign: "right" },
  /** The open unit is the only surface on the screen, which is what
   *  makes it read as the thing being worked on. Only one opens at a
   *  time, so this never becomes a grid of cards. */
  panel: {
    gap: space.sm,
    borderRadius: radius.md,
    padding: space.lg,
    marginTop: space.xs,
    marginBottom: space.sm,
  },
  panelHead: {
    alignSelf: "flex-start",
    minHeight: 28,
    justifyContent: "center",
  },
  addRow: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space.xs,
  },
  undo: {
    position: "absolute",
    left: space.screen,
    right: space.screen,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
