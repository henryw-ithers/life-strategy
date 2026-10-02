/**
 * The Plan screen: your portfolio's units with their weights, and the
 * tasks that spend them. The durable home of "do."
 *
 * One screen, not two. A unit's tasks open in place rather than on a
 * pushed route — the whole plan is ~18 rows, and the question people
 * actually have ("where are my points going?") is answered by seeing
 * several units at once, which a drill-down destroys. Expanding one
 * collapses the rest, so the screen never becomes a wall.
 *
 * Composition only: data is `usePlanData`, each unit is a
 * `PlanUnitSection`, each commitment a `CommitmentTasks`. What stays
 * here is which sheet is open and what each one commits.
 */
import { unitProfile } from "@glide/scoring";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import { LinearTransition, useReducedMotion } from "react-native-reanimated";

import { UnitInfoSheet } from "../../components/diagnostic/UnitInfoSheet";
import { AddTaskModal } from "../../components/plan/AddTaskModal";
import { applyTaskEdit, editableFrom } from "../../components/plan/applyTaskEdit";
import { CommitmentTasks } from "../../components/plan/CommitmentTasks";
import { CoverageBar } from "../../components/plan/CoverageBar";
import { EventSheet } from "../../components/plan/EventSheet";
import { FirstRunCard } from "../../components/plan/FirstRunCard";
import { type PartOfDay } from "../../components/plan/planning";
import { PlanUnitSection } from "../../components/plan/PlanUnitSection";
import type { OneOffState } from "../../components/plan/SchedulePicker";
import { SuggestionsSheet } from "../../components/plan/SuggestionsSheet";
import { NO_DETAIL, type TaskDetail } from "../../components/plan/TaskDetailPicker";
import { TaskEditSheet } from "../../components/plan/TaskEditSheet";
import type { PickableUnit } from "../../components/plan/UnitPicker";
import { COMMITMENT_AREA, pickableUnits } from "../../components/plan/unitSelection";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { Button } from "../../components/ui/Button";
import { Group } from "../../components/ui/Group";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { LoadFailure } from "../../components/ui/ScreenLoad";
import { UndoToast } from "../../components/ui/UndoToast";
import { UNIT_INFO } from "../../content/units";
import { createGoal, setGoalMetric } from "../../db/goals";
import {
  addEvent,
  addTask,
  archiveTask,
  reorderUnitTasks,
  restoreTask,
  setUnitScoring,
  updateEvent,
  type PlanTask,
  type PlanUnit,
} from "../../db/tasks";
import { usePlanData } from "../../hooks/usePlanData";
import { getTheme } from "../../theme/colors";
import { space } from "../../theme/tokens";

interface EditTarget {
  task: PlanTask;
  /** Where it is listed — a life unit, or a commitment or its part.
   *  Only its id and hue are read. */
  unit: { id: string; areaId: string };
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

  const { plan, commitmentDay, goalsByUnit, ratings, reload, error, retry } = usePlanData();
  const [openUnitId, setOpenUnitId] = useState<string | null>(unitParam ?? null);
  /** `homeUnit: null` is the quick add from the top of the screen — the
   *  sheet opens with no unit chosen and asks for one. */
  const [adding, setAdding] = useState<{ homeUnit: { id: string } | null } | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  /** Adding an event (ADR-0038). `unitName` is set when added from a
   *  unit, which then needs no choosing. */
  const [addingEvent, setAddingEvent] = useState<{
    unitIds: string[];
    unitName?: string;
  } | null>(null);
  const [infoUnit, setInfoUnit] = useState<PlanUnit | null>(null);
  /** The unit whose library ideas are open (ADR-0006 §3: pull). */
  const [suggestingFor, setSuggestingFor] = useState<PlanUnit | null>(null);
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  /** The task just created, tinted until the timer clears it. */
  const [justAdded, setJustAdded] = useState<string | null>(null);
  /** A task being dragged owns the finger; the page must hold still. */
  const [draggingTask, setDraggingTask] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  /** The scroll content, as the frame every unit's offset is measured
   *  against — `onLayout` only reports a position inside its own parent,
   *  and a unit sits two boxes deep. */
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

  /** Commitments and their parts first, then the scored life units — one
   *  list for every sheet that files a task (see `pickableUnits`). */
  const allUnits: PickableUnit[] = useMemo(() => pickableUnits(plan), [plan]);

  /** The unit holding the most points, which is where a first task is
   *  worth the most. Onboarding hands the user straight to this screen
   *  (ADR-0011 as amended), so the opening move has to be obvious. */
  const topUnit = useMemo(() => {
    const scored = (plan?.areas ?? [])
      .flatMap((a) => a.units)
      .filter((u) => u.includeInScoring && u.weight !== null);
    return scored.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0] ?? null;
  }, [plan]);

  /** A fresh plan, or one cleared of every task — the same situation,
   *  deserving the same help. */
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
   * collapse first: both run at 180ms, and measuring mid-transition lands
   * on wherever the row happened to be that frame.
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
          scrollRef.current?.scrollTo({ y: Math.max(0, y - space.lg), animated: !reduceMotion });
        },
        () => {},
      );
    }, 260);
  };

  /**
   * Something new lands last in its unit, so the screen has to say where
   * it went: open that unit, bring it into view, and tint the row for
   * long enough to find it. The drag handle is then right there.
   */
  const revealAdded = async (id: string | null, home: string | undefined) => {
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

  const commitTask = async (
    title: string,
    timesPerWeek: number,
    unitIds: string[],
    plannedWeekdays: string | null,
    partOfDay: PartOfDay | null,
    oneOff: OneOffState | null = null,
    detail: TaskDetail = NO_DETAIL,
  ) => {
    const id = await addTask(
      unitIds,
      title,
      timesPerWeek,
      plannedWeekdays,
      partOfDay,
      null,
      oneOff,
      null,
      detail,
    );
    await revealAdded(id, unitIds[0]);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <ScreenHeader title="Tasks" theme={theme} />

      {/* The screen's own thesis, above everything it applies to: how
          much of your hundred is in play, and so what today can score. */}
      {plan?.hasSnapshot ? (
        <CoverageBar areas={plan.areas} day={commitmentDay} theme={theme} />
      ) : null}

      {/* Capture, before navigation: the same sheet as a unit's own add,
          with the unit as a field inside it. Fixed rather than scrolled
          away — it's furniture, like the header it sits under. Two kinds
          of thing, two doors (ADR-0038): work you fit in, and a time you
          turn up for. */}
      {plan?.hasSnapshot && allUnits.length > 0 ? (
        <View style={styles.addBar}>
          <View style={styles.grow}>
            <Button
              variant="tonal"
              icon="add"
              label="Add task"
              onPress={() => setAdding({ homeUnit: null })}
              theme={theme}
            />
          </View>
          <View style={styles.grow}>
            <Button
              variant="tonal"
              icon="calendar-outline"
              label="Add event"
              onPress={() => setAddingEvent({ unitIds: [] })}
              theme={theme}
            />
          </View>
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
            <ActivityIndicator color={theme.muted} style={styles.loading} />
          ) : !plan.hasSnapshot ? (
            <View style={styles.empty}>
              <AppText color={theme.ink} style={styles.centerText}>
                Your plan starts with a diagnostic. Rate what matters first, and the weights land
                here.
              </AppText>
              <Button
                label="Run the diagnostic"
                onPress={() => router.push("/diagnostic" as Href)}
                theme={theme}
              />
            </View>
          ) : (
            <>
              {noTasksYet ? (
                <FirstRunCard
                  topUnitName={topUnit?.name ?? null}
                  onAddToTopUnit={() => {
                    if (!topUnit) return;
                    setOpenUnitId(topUnit.id);
                    setAdding({ homeUnit: topUnit });
                  }}
                  theme={theme}
                />
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
                    {/* A number in the right-hand column at every level, so
                        "where are my points going" reads down one edge: the
                        area's own share of the 100. */}
                    <AppText variant="label" color={theme.muted} tabular style={styles.pts}>
                      {area.units
                        .filter((u) => u.includeInScoring)
                        .reduce((sum, u) => sum + (u.weight ?? 0), 0)}
                    </AppText>
                  </View>

                  {area.units.map((unit) => (
                    <PlanUnitSection
                      key={unit.id}
                      unit={unit}
                      hue={theme.areas[area.id] ?? theme.accent}
                      open={openUnitId === unit.id}
                      rowRef={(node) => {
                        unitRefs.current[unit.id] = node;
                      }}
                      justAdded={justAdded}
                      onToggle={() =>
                        setOpenUnitId((current) => (current === unit.id ? null : unit.id))
                      }
                      onShowInfo={() => setInfoUnit(unit)}
                      onSetScoring={(include) => void setUnitScoring(unit.id, include).then(reload)}
                      onReorder={(ids) => void reorderUnitTasks(unit.id, ids).then(reload)}
                      onEditTask={(t) => setEditing({ task: t, unit })}
                      onDeleteTask={deleteTask}
                      onAddTask={() => setAdding({ homeUnit: unit })}
                      onAddEvent={() => setAddingEvent({ unitIds: [unit.id], unitName: unit.name })}
                      onSuggest={() => setSuggestingFor(unit)}
                      onDragStateChange={setDraggingTask}
                      layout={layout}
                      reduceMotion={reduceMotion}
                      theme={theme}
                    />
                  ))}
                </Group>
              ))}

              {plan.commitments.map((c) => (
                <CommitmentTasks
                  key={c.id}
                  commitment={c}
                  justAdded={justAdded}
                  onEditTask={(t) =>
                    setEditing({ task: t, unit: { id: t.homeUnitId, areaId: COMMITMENT_AREA } })
                  }
                  onDeleteTask={deleteTask}
                  onAddTask={() => setAdding({ homeUnit: { id: c.id } })}
                  onAddEvent={() => setAddingEvent({ unitIds: [c.id], unitName: c.name })}
                  theme={theme}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {undo ? (
        <UndoToast
          message={`Deleted “${undo.title}”`}
          onUndo={() => {
            const id = undo.id;
            setUndo(null);
            void restoreTask(id).then(reload);
          }}
          onDismiss={() => setUndo(null)}
          theme={theme}
        />
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

      {addingEvent ? (
        <EventSheet
          visible
          unitName={addingEvent.unitName}
          unitChoice={
            addingEvent.unitName
              ? undefined
              : {
                  units: allUnits,
                  value: addingEvent.unitIds,
                  onChange: (unitIds) => setAddingEvent({ unitIds }),
                  areaColors: theme.areas,
                }
          }
          accent={theme.accent}
          theme={theme}
          onClose={() => setAddingEvent(null)}
          onSave={async (input) => {
            const unitIds = addingEvent.unitIds;
            setAddingEvent(null);
            const id = await addEvent(unitIds, input);
            await revealAdded(id, unitIds[0]);
          }}
        />
      ) : null}

      {/* An event opens its own sheet, not the task editor — it is
          planned by when, not by how often (ADR-0038). */}
      {editing && editing.task.kind === "event" ? (
        <EventSheet
          visible
          initial={{
            title: editing.task.title,
            plannedWeekdays: editing.task.plannedWeekdays,
            oneOffDate: editing.task.oneOffDate,
            startMinute: editing.task.startMinute,
            endMinute: editing.task.endMinute,
            location: editing.task.location,
            notes: editing.task.description,
          }}
          accent={theme.areas[editing.unit.areaId] ?? theme.accent}
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            const id = editing.task.id;
            setEditing(null);
            await updateEvent(id, input);
            await reload();
          }}
          onDelete={() => {
            const t = editing.task;
            setEditing(null);
            deleteTask(t);
          }}
        />
      ) : null}

      {editing && editing.task.kind !== "event" ? (
        <TaskEditSheet
          visible
          task={editableFrom(editing.task)}
          units={allUnits}
          goals={goalsByUnit[editing.unit.id] ?? []}
          areaColors={theme.areas}
          accent={theme.areas[editing.unit.areaId] ?? theme.accent}
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            await applyTaskEdit(editing.task, next);
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
            // Null before the first diagnostic: nothing has a weight or a
            // rating yet, so there is no situation to read.
            suggestingFor.weight !== null && ratings.has(suggestingFor.id)
              ? unitProfile({
                  weight: suggestingFor.weight,
                  importance: ratings.get(suggestingFor.id)!.importance,
                  satisfaction: ratings.get(suggestingFor.id)!.satisfaction,
                })
              : null
          }
          existingTaskTitles={suggestingFor.tasks.map((t) => t.title)}
          existingGoalTitles={(goalsByUnit[suggestingFor.id] ?? []).map((g) => g.title)}
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
              const id = await createGoal(unit.id, g.title, g.description ?? undefined);
              // The library's metric arrives with it — a goal stripped of
              // it would be the least useful half of what was written. A
              // metric goal has one finish line (ADR-0030 §5).
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
  /** Takes the space between the fixed header and the tab bar; the unit
   *  list scrolls inside it while both stay put. */
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl },
  loading: { marginTop: space.xxl },
  /** Tight under the header, loose above the list: the buttons belong to
   *  the furniture, not to the first area. */
  addBar: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.screen,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  empty: { gap: space.lg, marginTop: space.xxl },
  centerText: { textAlign: "center" },
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
  /** One right-hand column for every number on the page. */
  pts: { minWidth: 30, textAlign: "right" },
});
