/**
 * Goal detail: what the goal is, what has to be true for it to happen,
 * and the work doing it.
 *
 * **Built around conditions (ADR-0030).** A goal's child structure is a
 * set of *conditions* — parallel prerequisites, each holding its own
 * tasks, none completing. The screen reads top to bottom as one
 * sentence: this is the goal · here is how it is measured · here is what
 * has to be true · here is how to manage it.
 *
 * **The lifecycle actions sit at the foot.** Complete is the one action
 * that belongs beside the goal; pause, revise, set aside and delete are
 * things you do *to* a goal, and they live in a quiet Manage group.
 * Actions drive the ADR-0007 state machine — pause, resume, abandon
 * (revivable), revise (spawns a linked successor), and the three-path
 * completion flow.
 *
 * Composition only: data is `useGoalDetail`; the header, conditions,
 * task rows and Manage group are components in `components/goals/`.
 */
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AbandonGoalModal } from "../../../components/goals/AbandonGoalModal";
import { AddExistingTaskSheet } from "../../../components/goals/AddExistingTaskSheet";
import { CompleteGoalModal } from "../../../components/goals/CompleteGoalModal";
import { ConditionForm } from "../../../components/goals/ConditionForm";
import { ConditionGroup } from "../../../components/goals/ConditionGroup";
import { DeleteGoalModal } from "../../../components/goals/DeleteGoalModal";
import { GoalHeader } from "../../../components/goals/GoalHeader";
import { ConditionMenu, fromMenu, GoalTaskMenu } from "../../../components/goals/GoalMenus";
import { GoalManageGroup } from "../../../components/goals/GoalManageGroup";
import { GoalMetricPanel } from "../../../components/goals/GoalMetricPanel";
import { GoalMetricSheet } from "../../../components/goals/GoalMetricSheet";
import { GoalAddRow, GoalTaskRow } from "../../../components/goals/GoalTaskRow";
import { ReviseGoalModal } from "../../../components/goals/ReviseGoalModal";
import { AddTaskModal } from "../../../components/plan/AddTaskModal";
import { AppText } from "../../../components/ui/AppText";
import { Backdrop, hueWash } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import { Group, GroupDivider } from "../../../components/ui/Group";
import { MenuSheet } from "../../../components/ui/MenuSheet";
import { LoadFailure } from "../../../components/ui/ScreenLoad";
import {
  abandonGoal,
  addCondition,
  addGoalProgress,
  attachTaskToGoal,
  completeGoal,
  deleteCondition,
  deleteGoal,
  deleteGoalProgress,
  detachTaskFromGoal,
  pauseGoal,
  renameCondition,
  reorderConditions,
  reviseGoal,
  reviveGoal,
  resumeGoal,
  setGoalAutocountTask,
  setGoalMetric,
  setGoalTargetDate,
  setTaskCondition,
  type GoalCondition,
  type GoalTask,
} from "../../../db/goals";
import { addTask } from "../../../db/tasks";
import { useGoalDetail } from "../../../hooks/useGoalDetail";
import { currentLocalDate } from "../../../lib/calendar";
import { getTheme } from "../../../theme/colors";
import { space } from "../../../theme/tokens";

/** Where an add was started: straight off the goal (`null`), or from a
 *  condition. */
type AddFrom = { conditionId: string | null };

export default function GoalDetailScreen() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { goal, loaded, units, attachable, reload, save, error, retry } = useGoalDetail(goalId);

  const [completing, setCompleting] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [revising, setRevising] = useState(false);
  const [editingMetric, setEditingMetric] = useState(false);
  /** Deleting is the one irreversible act here, so the one that asks. */
  const [deleting, setDeleting] = useState(false);
  /** The add-task sheet, and where it was opened from. */
  const [addingTask, setAddingTask] = useState<AddFrom | null>(null);
  /** The inline condition form, shared between adding and renaming —
   *  `editingCondition` says which. */
  const [conditionTitle, setConditionTitle] = useState("");
  const [editingCondition, setEditingCondition] = useState<string | null>(null);
  const [composingCondition, setComposingCondition] = useState(false);
  const [conditionMenu, setConditionMenu] = useState<GoalCondition | null>(null);
  const [movingTask, setMovingTask] = useState<GoalTask | null>(null);
  /** An "add" waiting on its choice: write a new task, or pull in one
   *  you already have. */
  const [choosingAdd, setChoosingAdd] = useState<AddFrom | null>(null);
  const [addingExisting, setAddingExisting] = useState<AddFrom | null>(null);

  const accent = goal ? (theme.areas[goal.areaId] ?? theme.accent) : theme.accent;
  const editable = goal?.status === "active";
  const layout = reduceMotion ? undefined : LinearTransition.duration(200);
  const entering = reduceMotion ? undefined : FadeIn.duration(180);

  const cancelCondition = () => {
    setEditingCondition(null);
    setComposingCondition(false);
    setConditionTitle("");
  };

  const submitCondition = () => {
    const title = conditionTitle.trim();
    if (title.length === 0 || !goal) {
      cancelCondition();
      return;
    }
    const editing = editingCondition;
    cancelCondition();
    save(() => (editing ? renameCondition(editing, title) : addCondition(goal.id, title)));
  };

  /** Conditions are parallel, so this is arrangement, not precedence —
   *  a menu rather than a drag, because a drag inside a ScrollView fights
   *  the scroll and screen readers cannot use one. */
  const moveCondition = (id: string, delta: -1 | 1) => {
    if (!goal) return;
    const ids = goal.conditions.map((c) => c.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    save(() => reorderConditions(ids));
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={hueWash(accent)} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          // Pushed inside the Goals tab, so the bar is still on screen and
          // owns the bottom inset. Back stays — this is a detail screen.
          { paddingTop: insets.top + space.md, paddingBottom: space.xxxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={styles.back}
        >
          <AppText variant="label" color={theme.muted}>
            ‹ Back
          </AppText>
        </Pressable>

        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : goal === null && !loaded ? (
          <ActivityIndicator color={theme.muted} style={styles.loading} />
        ) : goal === null ? (
          /* Kind rather than alarming: a goal you deleted is a goal you
             meant to delete, and a stale link is nobody's mistake. */
          <View style={styles.notFound}>
            <AppText variant="title" color={theme.ink}>
              This goal is gone
            </AppText>
            <AppText color={theme.muted}>
              It was deleted, or the link is out of date. Anything it achieved is still in your
              log.
            </AppText>
            <View style={styles.groupAction}>
              <Button
                label="Back to goals"
                variant="secondary"
                onPress={() => router.back()}
                theme={theme}
              />
            </View>
          </View>
        ) : (
          <>
            <GoalHeader
              goal={goal}
              accent={accent}
              onComplete={() => setCompleting(true)}
              onResume={() => save(() => resumeGoal(goal.id))}
              onRevive={() => save(() => reviveGoal(goal.id))}
              theme={theme}
            />

            {/* ── Measure ── */}
            {goal.metricKind !== null &&
            (goal.metricKind === "habit" || goal.targetValue !== null) ? (
              <GoalMetricPanel
                kind={goal.metricKind}
                unit={goal.metricUnit}
                targetValue={goal.targetValue}
                streak={goal.streak}
                targetDate={goal.targetDate}
                entries={goal.progress}
                editable={editable}
                accent={accent}
                theme={theme}
                onComplete={() => setCompleting(true)}
                onEdit={() => setEditingMetric(true)}
                onAdd={(value, note) => {
                  save(() => addGoalProgress(goal.id, currentLocalDate(), value, note));
                }}
                onDelete={(entryId) => {
                  save(() => deleteGoalProgress(entryId));
                }}
              />
            ) : editable ? (
              <Group theme={theme} title="Measure">
                {/* An offer, not a nudge: a goal with no number is a
                    first-class shape (ADR-0015 §1's null kind). */}
                <AppText variant="caption" color={theme.muted}>
                  Some goals have a number to move — 24 books, 225 lb. Give this one a measure and
                  you can log readings against it.
                </AppText>
                <View style={styles.groupAction}>
                  <Button
                    label="Add a measure"
                    variant="quiet"
                    onPress={() => setEditingMetric(true)}
                    theme={theme}
                  />
                </View>
              </Group>
            ) : null}

            {/* ── Tasks off the goal itself ── Rendered whenever the goal
                is editable: conditions are optional, so the plain "add a
                task" path has to exist on a goal that has neither. */}
            {goal.tasks.length > 0 || editable ? (
              <Group
                theme={theme}
                title={goal.conditions.length > 0 ? "Other tasks" : "Tasks"}
                flush
              >
                {goal.tasks.map((t, i) => (
                  <View key={t.id}>
                    {i > 0 ? <GroupDivider theme={theme} /> : null}
                    <GoalTaskRow
                      task={t}
                      goalUnitId={goal.unitId}
                      areaColors={theme.areas}
                      theme={theme}
                      onOpen={editable ? () => setMovingTask(t) : undefined}
                    />
                  </View>
                ))}
                {editable ? (
                  <>
                    {goal.tasks.length > 0 ? <GroupDivider theme={theme} /> : null}
                    <GoalAddRow
                      label="Add task"
                      accent={accent}
                      onPress={() => setChoosingAdd({ conditionId: null })}
                    />
                  </>
                ) : null}
              </Group>
            ) : null}

            {/* ── Conditions ── */}
            {goal.conditions.map((c) => (
              <Animated.View key={c.id} layout={layout} entering={entering}>
                <ConditionGroup
                  condition={c}
                  goalUnitId={goal.unitId}
                  editable={editable}
                  accent={accent}
                  onOpenMenu={() => setConditionMenu(c)}
                  onOpenTask={setMovingTask}
                  onAddTask={() => setChoosingAdd({ conditionId: c.id })}
                  theme={theme}
                />
              </Animated.View>
            ))}

            {/* The empty state teaches the concept rather than reporting a
                count — most goals will not have conditions, and that is a
                fine way for a goal to be. */}
            {editable && goal.conditions.length === 0 && !composingCondition ? (
              <Group theme={theme} title="Conditions">
                <AppText variant="caption" color={theme.muted}>
                  What has to be true for this to happen? Name each one, and hang the work that makes
                  it true underneath — a condition can pull in a task from anywhere in your plan, not
                  just {goal.unitName}. Goals do fine without them.
                </AppText>
                <View style={styles.groupAction}>
                  <Button
                    label="Add a condition"
                    variant="quiet"
                    onPress={() => setComposingCondition(true)}
                    theme={theme}
                  />
                </View>
              </Group>
            ) : null}

            {editable && composingCondition ? (
              <ConditionForm
                value={conditionTitle}
                onChangeText={setConditionTitle}
                renaming={editingCondition !== null}
                onSubmit={submitCondition}
                onCancel={cancelCondition}
                accent={accent}
                entering={entering}
                theme={theme}
              />
            ) : null}

            {editable && goal.conditions.length > 0 && !composingCondition ? (
              <GoalAddRow
                label="Add a condition"
                accent={accent}
                style={styles.standaloneAdd}
                onPress={() => setComposingCondition(true)}
              />
            ) : null}

            {/* ── Manage ── */}
            <GoalManageGroup
              status={goal.status}
              onPause={() => save(() => pauseGoal(goal.id))}
              onRevise={() => setRevising(true)}
              onSetAside={() => setAbandoning(true)}
              onDelete={() => setDeleting(true)}
              theme={theme}
            />

            {/* ── Sheets and menus ── */}
            {editingMetric ? (
              <GoalMetricSheet
                visible
                metric={
                  goal.metricKind !== null && goal.targetValue !== null
                    ? {
                        kind: goal.metricKind,
                        unit: goal.metricUnit ?? "",
                        targetValue: goal.targetValue,
                      }
                    : null
                }
                targetDate={goal.targetDate}
                tasks={goal.allTasks}
                autocountTaskId={goal.autocountTaskId}
                accent={accent}
                theme={theme}
                onClose={() => setEditingMetric(false)}
                onSave={(metric, targetDate, autocountTaskId) => {
                  save(() =>
                    Promise.all([
                      setGoalMetric(goal.id, metric),
                      setGoalTargetDate(goal.id, targetDate),
                      setGoalAutocountTask(goal.id, autocountTaskId),
                    ]),
                  );
                }}
              />
            ) : null}

            <CompleteGoalModal
              visible={completing}
              onClose={() => setCompleting(false)}
              goalTitle={goal.title}
              tasks={goal.allTasks}
              accent={accent}
              theme={theme}
              onArchive={async () => {
                await completeGoal(goal.id, "archive");
                await reload();
              }}
              onMaintenance={async () => {
                await completeGoal(goal.id, "maintenance");
                await reload();
              }}
              onFollowUp={async (newTitle, taskCarry) => {
                const { successorGoalId } = await completeGoal(goal.id, "follow_up", {
                  newTitle,
                  taskCarry,
                });
                if (successorGoalId) router.replace(`/goals/${successorGoalId}` as Href);
                else await reload();
              }}
            />

            <AbandonGoalModal
              visible={abandoning}
              onClose={() => setAbandoning(false)}
              goalTitle={goal.title}
              tasks={goal.allTasks}
              accent={accent}
              theme={theme}
              onCommit={async (decisions) => {
                await abandonGoal(goal.id, decisions);
                await reload();
              }}
            />

            <ReviseGoalModal
              visible={revising}
              onClose={() => setRevising(false)}
              goalTitle={goal.title}
              goalDescription={goal.description}
              tasks={goal.allTasks}
              accent={accent}
              theme={theme}
              onCommit={async (newTitle, newDescription, taskCarry) => {
                const newId = await reviseGoal(goal.id, newTitle, newDescription, taskCarry);
                router.replace(`/goals/${newId}` as Href);
              }}
            />

            {addingTask ? (
              <AddTaskModal
                visible
                onClose={() => setAddingTask(null)}
                units={units}
                homeUnitId={goal.unitId}
                areaColors={theme.areas}
                theme={theme}
                onCommit={async (
                  title,
                  timesPerWeek,
                  unitIds,
                  plannedWeekdays,
                  partOfDay,
                  oneOff,
                  detail,
                ) => {
                  await addTask(
                    unitIds,
                    title,
                    timesPerWeek,
                    plannedWeekdays,
                    partOfDay,
                    goal.id,
                    oneOff,
                    addingTask.conditionId,
                    detail,
                  );
                  await reload();
                }}
              />
            ) : null}

            <ConditionMenu
              condition={conditionMenu}
              conditions={goal.conditions}
              onClose={() => setConditionMenu(null)}
              onRename={(c) => {
                setEditingCondition(c.id);
                setConditionTitle(c.title);
                setComposingCondition(true);
              }}
              onMove={(c, delta) => moveCondition(c.id, delta)}
              onRemove={(c) => save(() => deleteCondition(c.id))}
              theme={theme}
            />

            <GoalTaskMenu
              task={movingTask}
              conditions={goal.conditions}
              onClose={() => setMovingTask(null)}
              onEdit={(t) => router.push(`/plan?unit=${t.unitId}` as Href)}
              onMoveTo={(t, conditionId) => save(() => setTaskCondition(t.id, conditionId))}
              onDetach={(t) => save(() => detachTaskFromGoal(t.id))}
              theme={theme}
            />

            {/* "Add task" means two different things, and a person should
                not have to guess which one the button does. */}
            <MenuSheet
              visible={choosingAdd !== null}
              theme={theme}
              onClose={() => setChoosingAdd(null)}
              rows={[
                {
                  label: "Write a new task",
                  onPress: fromMenu(choosingAdd, () => setChoosingAdd(null), setAddingTask),
                },
                {
                  label: "Add one you already have",
                  onPress: fromMenu(choosingAdd, () => setChoosingAdd(null), setAddingExisting),
                },
              ]}
            />

            {addingExisting ? (
              <AddExistingTaskSheet
                visible
                tasks={attachable}
                conditionTitle={
                  goal.conditions.find((c) => c.id === addingExisting.conditionId)?.title ?? null
                }
                areaColors={theme.areas}
                accent={accent}
                theme={theme}
                onClose={() => setAddingExisting(null)}
                onPick={(taskId) => {
                  const where = addingExisting;
                  setAddingExisting(null);
                  save(() => attachTaskToGoal(taskId, goal.id, where.conditionId));
                }}
              />
            ) : null}

            <DeleteGoalModal
              visible={deleting}
              goalTitle={goal.title}
              onCancel={() => setDeleting(false)}
              onDelete={() => {
                setDeleting(false);
                save(
                  () => deleteGoal(goal.id),
                  () => router.back(),
                );
              }}
              theme={theme}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  container: { paddingHorizontal: space.screen },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  loading: { marginTop: space.xxl },
  notFound: { marginTop: space.xxl, gap: space.sm },
  groupAction: { alignSelf: "flex-start", marginTop: space.xs },
  /** Groups carry `marginTop: space.xl` of their own; an add row standing
   *  outside one has to match it or the rhythm breaks. */
  standaloneAdd: { marginTop: space.md, paddingHorizontal: space.xs },
});
