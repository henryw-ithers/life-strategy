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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import { LinearTransition, useReducedMotion } from "react-native-reanimated";

import { UnitInfoSheet } from "../../../components/diagnostic/UnitInfoSheet";
import { openAdd, TabToolbar } from "../../../components/nav/TabToolbar";
import { AddTaskModal } from "../../../components/plan/AddTaskModal";
import { applyTaskEdit, editableFrom } from "../../../components/plan/applyTaskEdit";
import { CommitmentTasks } from "../../../components/plan/CommitmentTasks";
import { CoverageBar } from "../../../components/plan/CoverageBar";
import { EventSheet } from "../../../components/plan/EventSheet";
import { FirstRunCard } from "../../../components/plan/FirstRunCard";
import { type PartOfDay } from "../../../components/plan/planning";
import { PlanUnitSection } from "../../../components/plan/PlanUnitSection";
import type { OneOffState } from "../../../components/plan/SchedulePicker";
import { SuggestionsSheet } from "../../../components/plan/SuggestionsSheet";
import { NO_DETAIL, type TaskDetail } from "../../../components/plan/TaskDetailPicker";
import { TaskEditSheet } from "../../../components/plan/TaskEditSheet";
import type { PickableUnit } from "../../../components/plan/UnitPicker";
import { COMMITMENT_AREA, pickableUnits } from "../../../components/plan/unitSelection";
import { AppText } from "../../../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import { Group } from "../../../components/ui/Group";
import { LoadFailure } from "../../../components/ui/ScreenLoad";
import { UndoBar } from "../../../components/ui/UndoBar";
import { UNIT_INFO } from "../../../content/units";
import {
  addEvent,
  addTask,
  archiveTask,
  reorderUnitTasks,
  setUnitScoring,
  updateEvent,
  type PlanData,
  type PlanTask,
  type PlanUnit,
} from "../../../db/tasks";
import { usePlanData } from "../../../hooks/usePlanData";
import { getTheme } from "../../../theme/colors";
import { space } from "../../../theme/tokens";
import { useRetained } from "../../../hooks/useRetained";
import { useUndoDelete } from "../../../hooks/useUndoDelete";

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
  const { unit: unitParam, add: addParam } = useLocalSearchParams<{
    unit?: string;
    add?: string;
  }>();

  const {
    plan: storedPlan,
    commitmentDay,
    reload,
    save,
    error,
    retry,
  } = usePlanData();
  const undo = useUndoDelete(save);
  /** The plan as shown: a task waiting on Undo is already gone from it. */
  const plan = withoutTask(storedPlan, undo.hidden);
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
    undo.remove({ id: t.id, message: `Deleted “${t.title}”`, run: () => archiveTask(t.id) });
  };

  /**
   * Scroll a unit to the top of the viewport. Waits out the expand and
   * collapse first: both run at 180ms, and measuring mid-transition lands
   * on wherever the row happened to be that frame.
   */
  const revealUnit = useCallback(
    (unitId: string) => {
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
    },
    [reduceMotion],
  );

  /** A tab stays mounted, so the `unit` param only seeds state on the
   *  first visit. Every later link — from a goal, or the post-diagnostic
   *  diff — arrives here instead, and must open its unit too. Cleared
   *  once handled, so a second link to the same unit still changes it.
   *  Opening the unit happens as the link arrives (during render, the
   *  React way to follow a changed value); scrolling to it and clearing
   *  the link are side effects, so they stay in the effect. */
  const [seenUnitParam, setSeenUnitParam] = useState(unitParam);
  if (unitParam !== seenUnitParam) {
    setSeenUnitParam(unitParam);
    if (unitParam) setOpenUnitId(unitParam);
  }
  useEffect(() => {
    if (!unitParam) return;
    revealUnit(unitParam);
    router.setParams({ unit: undefined });
  }, [unitParam, revealUnit]);

  /** Another tab's + menu asked for a task or an event (`openAdd`).
   *  It waits for the plan to load. Then, with something to file it
   *  under, the sheet opens as the request is seen (during render, as
   *  for the unit link above); with no plan yet, the effect sends it to
   *  the diagnostic, which is where Plan's own empty state points. The
   *  effect also clears the request so the next one registers. */
  const canAdd = plan?.hasSnapshot === true && allUnits.length > 0;
  const [editingShown, editingGone] = useRetained(editing);
  const [infoUnitShown, infoUnitGone] = useRetained(infoUnit);
  const [suggestingForShown, suggestingForGone] = useRetained(suggestingFor);
  const [addingEventShown, addingEventGone] = useRetained(addingEvent);
  const [addingShown, addingGone] = useRetained(adding);
  const [handledAdd, setHandledAdd] = useState<string | undefined>(undefined);
  if (addParam !== handledAdd && plan !== null) {
    setHandledAdd(addParam);
    if (canAdd && addParam === "task") setAdding({ homeUnit: null });
    else if (canAdd && addParam === "event") setAddingEvent({ unitIds: [] });
  }
  useEffect(() => {
    if (!addParam || plan === null) return;
    router.setParams({ add: undefined });
    if (!canAdd) router.push("/priorities" as Href);
  }, [addParam, plan, canAdd]);

  /** Plan's own + menu: the same rule, decided at the tap. */
  const addHere = (what: "task" | "event") => {
    if (!canAdd) router.push("/priorities" as Href);
    else if (what === "task") setAdding({ homeUnit: null });
    else setAddingEvent({ unitIds: [] });
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
      oneOff,
      detail,
    );
    await revealAdded(id, unitIds[0]);
  };

  return (
    <View style={styles.root}>
      {/* The scroll view comes first: iOS follows the first child down to
          find what drives the large title and the tab bar's shrinking.
          So the backdrop goes inside it. */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        scrollEnabled={!draggingTask}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        <View ref={contentRef}>
          {/* The screen's own thesis, above everything it applies to: how
              much of your hundred is in play, and so what today can score.
              It scrolls with the list now that the nav bar is native. */}
          {plan?.hasSnapshot ? (
            <CoverageBar areas={plan.areas} day={commitmentDay} theme={theme} />
          ) : null}
          {error ? (
            <LoadFailure error={error} onRetry={retry} theme={theme} />
          ) : plan === null ? (
            <ActivityIndicator color={theme.muted} style={styles.loading} />
          ) : !plan.hasSnapshot ? (
            <View style={styles.empty}>
              <AppText color={theme.ink} style={styles.centerText}>
                Your plan starts with your priorities. Sort what matters into tiers first, and the
                weights land here.
              </AppText>
              <Button
                label="Set your priorities"
                onPress={() => router.push("/priorities" as Href)}
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
                      onSetScoring={(include) => save(() => setUnitScoring(unit.id, include))}
                      onReorder={(ids) => save(() => reorderUnitTasks(unit.id, ids))}
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

      {/* Shown in every state, so the + never pops in late. */}
      <TabToolbar
        onTask={() => addHere("task")}
        onEvent={() => addHere("event")}
        onLog={() => openAdd("activity")}
      />

      <UndoBar undo={undo} theme={theme} />

      {addingShown ? (
        <AddTaskModal
          visible={adding !== null}
          onDismissed={addingGone}
          onClose={() => setAdding(null)}
          units={allUnits}
          homeUnitId={addingShown.homeUnit?.id}
          areaColors={theme.areas}
          theme={theme}
          onCommit={commitTask}
        />
      ) : null}

      {addingEventShown ? (
        <EventSheet
          visible={addingEvent !== null}
          onDismissed={addingEventGone}
          unitName={addingEventShown.unitName}
          unitChoice={
            addingEventShown.unitName
              ? undefined
              : {
                  units: allUnits,
                  value: addingEventShown.unitIds,
                  onChange: (unitIds) => setAddingEvent({ unitIds }),
                  areaColors: theme.areas,
                }
          }
          accent={theme.accent}
          theme={theme}
          onClose={() => setAddingEvent(null)}
          onSave={async (input) => {
            const unitIds = addingEventShown.unitIds;
            setAddingEvent(null);
            const id = await addEvent(unitIds, input);
            await revealAdded(id, unitIds[0]);
          }}
        />
      ) : null}

      {/* An event opens its own sheet, not the task editor — it is
          planned by when, not by how often (ADR-0038). */}
      {editingShown && editingShown.task.kind === "event" ? (
        <EventSheet
          visible={editing !== null}
          onDismissed={editingGone}
          initial={{
            title: editingShown.task.title,
            plannedWeekdays: editingShown.task.plannedWeekdays,
            oneOffDate: editingShown.task.oneOffDate,
            startMinute: editingShown.task.startMinute,
            endMinute: editingShown.task.endMinute,
            notes: editingShown.task.description,
          }}
          accent={theme.areas[editingShown.unit.areaId] ?? theme.accent}
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            const id = editingShown.task.id;
            setEditing(null);
            await updateEvent(id, input);
            await reload();
          }}
          onDelete={() => {
            const t = editingShown.task;
            setEditing(null);
            deleteTask(t);
          }}
        />
      ) : null}

      {editingShown && editingShown.task.kind !== "event" ? (
        <TaskEditSheet
          visible={editing !== null}
          onDismissed={editingGone}
          task={editableFrom(editingShown.task)}
          units={allUnits}
          areaColors={theme.areas}
          accent={theme.areas[editingShown.unit.areaId] ?? theme.accent}
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            await applyTaskEdit(editingShown.task, next);
            await reload();
          }}
          onDelete={() => deleteTask(editingShown.task)}
        />
      ) : null}

      {suggestingForShown ? (
        <SuggestionsSheet
          visible={suggestingFor !== null}
          onDismissed={suggestingForGone}
          unitId={suggestingForShown.id}
          unitName={suggestingForShown.name}
          profile={
            // Null before Priorities is first saved: nothing has a tier
            // or a weight yet, so there is no situation to read.
            suggestingForShown.weight !== null && suggestingForShown.tier !== null
              ? unitProfile({
                  tier: suggestingForShown.tier,
                  weight: suggestingForShown.weight,
                })
              : null
          }
          existingTaskTitles={suggestingForShown.tasks.map((t) => t.title)}
          accent={theme.areas[suggestingForShown.areaId] ?? theme.accent}
          theme={theme}
          onClose={() => setSuggestingFor(null)}
          onAddTask={(t) => {
            const unit = suggestingForShown;
            setSuggestingFor(null);
            // `commitTask` reloads and reveals the row itself.
            save(
              () => commitTask(t.title, t.timesPerWeek, [unit.id], null, null),
              () => {},
            );
          }}
        />
      ) : null}

      {infoUnitShown && UNIT_INFO[infoUnitShown.id] ? (
        <UnitInfoSheet
          visible={infoUnit !== null}
          onDismissed={infoUnitGone}
          onClose={() => setInfoUnit(null)}
          unitName={infoUnitShown.name}
          info={UNIT_INFO[infoUnitShown.id]!}
          accent={theme.areas[infoUnitShown.areaId] ?? theme.accent}
          theme={theme}
        />
      ) : null}
    </View>
  );
}

/** The plan without the tasks whose delete is waiting or landing
 *  (`useUndoDelete`), everywhere they're listed. */
function withoutTask(plan: PlanData | null, hidden: ReadonlySet<string>): PlanData | null {
  if (plan === null || hidden.size === 0) return plan;
  return {
    ...plan,
    areas: plan.areas.map((a) => ({
      ...a,
      units: a.units.map((u) => ({ ...u, tasks: u.tasks.filter((t) => !hidden.has(t.id)) })),
    })),
    commitments: plan.commitments.map((c) => ({
      ...c,
      tasks: c.tasks.filter((t) => !hidden.has(t.id)),
    })),
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  /** Takes the space between the fixed header and the tab bar; the unit
   *  list scrolls inside it while both stay put. */
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl },
  loading: { marginTop: space.xxl },
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
