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
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import { TaskRow } from "../../components/plan/TaskRow";
import { ReorderableList } from "../../components/ui/ReorderableList";
import type { PickableUnit } from "../../components/plan/UnitPicker";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { Button } from "../../components/ui/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { UNIT_INFO } from "../../content/units";
import {
  addTask,
  archiveTask,
  loadPlan,
  renameTask,
  reorderUnitTasks,
  restoreTask,
  setTaskFrequency,
  setTaskUnits,
  type PlanData,
  type PlanTask,
  type PlanUnit,
} from "../../db/tasks";
import { getTheme } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";

/** Uniform, because the drag maths depends on it. */
const TASK_ROW_HEIGHT = 52;

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
  const [openUnitId, setOpenUnitId] = useState<string | null>(unitParam ?? null);
  const [addingTo, setAddingTo] = useState<PlanUnit | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [infoUnit, setInfoUnit] = useState<PlanUnit | null>(null);
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  /** A task being dragged owns the finger; the page must hold still. */
  const [draggingTask, setDraggingTask] = useState(false);

  const reload = useCallback(async () => {
    setPlan(await loadPlan());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const allUnits: PickableUnit[] = useMemo(
    () =>
      (plan?.areas ?? []).flatMap((a) =>
        a.units
          .filter((u) => u.includeInScoring)
          .map((u) => ({ id: u.id, name: u.name, areaId: u.areaId })),
      ),
    [plan],
  );

  const toggleUnit = (unitId: string) => {
    setOpenUnitId((current) => (current === unitId ? null : unitId));
  };

  const deleteTask = (t: PlanTask) => {
    setUndo({ id: t.id, title: t.title });
    void archiveTask(t.id).then(reload);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <ScreenHeader title="Tasks" theme={theme} />
      <ScrollView
        style={styles.body}
        scrollEnabled={!draggingTask}
        contentContainerStyle={styles.container}
      >
        {plan === null ? (
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
          plan.areas.map((area) => (
            <View key={area.id} style={[styles.group, { borderTopColor: theme.hairline }]}>
              <View style={styles.groupHeader}>
                <View
                  style={[styles.dot, { backgroundColor: theme.areas[area.id] ?? theme.muted }]}
                />
                <AppText variant="headline" color={theme.ink} style={styles.grow}>
                  {area.name}
                </AppText>
                {/* The area's share of the 100. Puts a number in the
                    right-hand column at every level of the page, so
                    "where are my points going" reads down one edge. */}
                <AppText variant="label" color={theme.muted} tabular style={styles.pts}>
                  {area.units
                    .filter((u) => u.includeInScoring)
                    .reduce((sum, u) => sum + (u.weight ?? 0), 0)}
                </AppText>
              </View>

              {area.units.map((unit) => {
                const excluded = !unit.includeInScoring;
                const open = openUnitId === unit.id;
                const hue = theme.areas[area.id] ?? theme.accent;
                return (
                  <Animated.View key={unit.id} layout={layout}>
                    <Pressable
                      disabled={excluded}
                      onPress={() => toggleUnit(unit.id)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      accessibilityLabel={`${unit.name}, ${unit.weight ?? 0} points, ${unit.tasks.length} tasks`}
                      accessibilityHint={open ? "Collapses its tasks" : "Shows its tasks"}
                      style={({ pressed }) => [styles.unitRow, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <AppText
                        variant="label"
                        color={excluded ? theme.muted : theme.muted}
                        style={styles.chev}
                      >
                        {excluded ? "" : open ? "▾" : "▸"}
                      </AppText>
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
                          {/* Only the actionable case gets a caption. A
                              count beside every unit crowded the points
                              column with a second number, and once a
                              unit is open you can see its tasks anyway. */}
                          {unit.tasks.length === 0 ? (
                            <AppText variant="caption" color={theme.muted}>
                              no tasks
                            </AppText>
                          ) : null}
                          <AppText color={theme.ink} tabular style={styles.pts}>
                            {unit.weight ?? 0}
                          </AppText>
                        </>
                      )}
                    </Pressable>

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

                        {unit.tasks.length === 0 ? (
                          <AppText variant="caption" color={theme.muted}>
                            Nothing here yet — this unit's points go unspent.
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
                                  accent={hue}
                                  theme={theme}
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
                          onPress={() => setAddingTo(unit)}
                          accessibilityRole="button"
                          accessibilityLabel={`Add a task to ${unit.name}`}
                          style={({ pressed }) => [
                            styles.addRow,
                            { borderColor: theme.hairline, opacity: pressed ? 0.5 : 1 },
                          ]}
                        >
                          <AppText variant="label" color={theme.accent}>
                            + Add a task
                          </AppText>
                        </Pressable>
                      </Animated.View>
                    ) : null}
                  </Animated.View>
                );
              })}
            </View>
          ))
        )}
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

      {addingTo ? (
        <AddTaskModal
          visible
          onClose={() => setAddingTo(null)}
          existingTasks={addingTo.tasks.map((t) => ({ id: t.id, title: t.title }))}
          units={allUnits}
          homeUnitId={addingTo.id}
          areaColors={theme.areas}
          accent={theme.areas[addingTo.areaId] ?? theme.accent}
          theme={theme}
          onCommit={async (title, timesPerWeek, rank, unitIds) => {
            await addTask(unitIds, title, timesPerWeek, rank);
            await reload();
          }}
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
            } satisfies EditableTask
          }
          units={allUnits}
          areaColors={theme.areas}
          accent={theme.areas[editing.unit.areaId] ?? theme.accent}
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={async (next) => {
            const t = editing.task;
            if (next.title !== t.title) await renameTask(t.id, next.title);
            if (next.timesPerWeek !== t.timesPerWeek) {
              await setTaskFrequency(t.id, next.timesPerWeek);
            }
            if (next.unitIds.join("|") !== t.unitIds.join("|")) {
              await setTaskUnits(t.id, next.unitIds);
            }
            await reload();
          }}
          onDelete={() => deleteTask(editing.task)}
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
  empty: { gap: space.lg, marginTop: space.xxl },
  centerText: { textAlign: "center" },
  // Areas breathe more than the rows inside them — the rhythm is what
  // separates six groups without six heavy dividers.
  group: {
    paddingTop: space.lg,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
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
