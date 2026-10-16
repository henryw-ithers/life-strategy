/**
 * Goal detail: what the goal is, what has to be true for it to happen,
 * and the work doing it.
 *
 * **Built around conditions (ADR-0030).** A goal's child structure is a
 * set of *conditions* — parallel prerequisites, each holding its own
 * tasks, none completing. The screen reads top to bottom as one
 * sentence: this is the goal · here is how it is measured · here is what
 * has to be true.
 *
 * **The lifecycle actions sit in the nav bar.** Complete is the one
 * action that belongs beside the goal; rename, pause, revise, set aside
 * and delete are things you do *to* a goal, and they live in the •••
 * menu (`GoalToolbar`). Actions drive the ADR-0007 state machine:
 * pause, resume, abandon (revivable), revise (spawns a linked
 * successor), and the three-path completion flow.
 *
 * Composition only: data is `useGoalDetail`; the header, conditions,
 * task rows and toolbar are components in `components/goals/`.
 */
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, useColorScheme, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";

import { AbandonGoalModal } from "../../../components/goals/AbandonGoalModal";
import { AddExistingTaskSheet } from "../../../components/goals/AddExistingTaskSheet";
import { CompleteGoalModal } from "../../../components/goals/CompleteGoalModal";
import { ConditionForm } from "../../../components/goals/ConditionForm";
import { ConditionGroup } from "../../../components/goals/ConditionGroup";
import { GoalHeader } from "../../../components/goals/GoalHeader";
import { conditionActions, goalTaskActions } from "../../../components/goals/GoalMenus";
import { GoalToolbar } from "../../../components/goals/GoalToolbar";
import { GoalMetricPanel } from "../../../components/goals/GoalMetricPanel";
import { GoalMetricSheet } from "../../../components/goals/GoalMetricSheet";
import { GoalAddRow, GoalTaskRow } from "../../../components/goals/GoalTaskRow";
import { ReviseGoalModal } from "../../../components/goals/ReviseGoalModal";
import { AddTaskModal } from "../../../components/plan/AddTaskModal";
import { AppText } from "../../../components/ui/AppText";
import type { MenuAction } from "../../../components/ui/ActionMenu";
import { hueWash, ScrollBackdrop } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import { Group, GroupDivider } from "../../../components/ui/Group";
import { KeyboardScroll } from "../../../components/ui/KeyboardScroll";
import { LoadFailure } from "../../../components/ui/ScreenLoad";
import { UndoBar } from "../../../components/ui/UndoBar";
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
  renameGoal,
  readGoalHeading,
  reorderConditions,
  reviseGoal,
  reviveGoal,
  resumeGoal,
  setGoalAutocountTask,
  setGoalMetric,
  setGoalTargetDate,
  setTaskCondition,
  type GoalCondition,
  type GoalDetail,
  type GoalTask,
} from "../../../db/goals";
import { addTask } from "../../../db/tasks";
import { useGoalDetail } from "../../../hooks/useGoalDetail";
import { currentLocalDate } from "../../../lib/calendar";
import { getTheme } from "../../../theme/colors";
import { space } from "../../../theme/tokens";
import { useFirstRead } from "../../../hooks/useFirstRead";
import { useRetained } from "../../../hooks/useRetained";
import { useUndoDelete } from "../../../hooks/useUndoDelete";

/** Where an add was started: straight off the goal (`null`), or from a
 *  condition. */
type AddFrom = { conditionId: string | null };

export default function GoalDetailScreen() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const reduceMotion = useReducedMotion();
  const {
    goal: storedGoal,
    loaded,
    units,
    attachable,
    reload,
    save,
    error,
    retry,
  } = useGoalDetail(goalId);
  const undo = useUndoDelete(save);
  /** The goal as shown: a reading or condition waiting on Undo is
   *  already gone from it. */
  const goal = withoutPending(storedGoal, undo.hidden);
  /** The nav bar's title and menu, from the first frame of the push,
   *  then from the loaded goal (`useFirstRead`). */
  const firstHeading = useFirstRead(() => readGoalHeading(goalId));
  const heading = goal ?? firstHeading;

  const [completing, setCompleting] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [revising, setRevising] = useState(false);
  const [editingMetric, setEditingMetric] = useState(false);
  /** The add-task sheet, and where it was opened from. */
  const [addingTask, setAddingTask] = useState<AddFrom | null>(null);
  /** The inline condition form, shared between adding and renaming —
   *  `editingCondition` says which. */
  const [conditionTitle, setConditionTitle] = useState("");
  const [editingCondition, setEditingCondition] = useState<string | null>(null);
  const [composingCondition, setComposingCondition] = useState(false);
  const [addingExisting, setAddingExisting] = useState<AddFrom | null>(null);
  const [metricShown, metricGone] = useRetained(editingMetric ? true : null);
  const [addingTaskShown, addingTaskGone] = useRetained(addingTask);
  const [addingExistingShown, addingExistingGone] = useRetained(addingExisting);
  // Mounted only while open: each is a SwiftUI host, and building three
  // of them as the page pushed delayed the push.
  const [completingShown, completingGone] = useRetained(completing ? true : null);
  const [abandoningShown, abandoningGone] = useRetained(abandoning ? true : null);
  const [revisingShown, revisingGone] = useRetained(revising ? true : null);

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

  const conditionHandlers = {
    rename: (c: GoalCondition) => {
      setEditingCondition(c.id);
      setConditionTitle(c.title);
      setComposingCondition(true);
    },
    move: (c: GoalCondition, delta: -1 | 1) => moveCondition(c.id, delta),
    remove: (c: GoalCondition) =>
      undo.remove({
        id: c.id,
        message: `Removed “${c.title}”`,
        run: () => deleteCondition(c.id),
      }),
  };
  const taskActions = (t: GoalTask) =>
    goalTaskActions(t, goal?.conditions ?? [], {
      edit: (task) => router.push(`/plan?unit=${task.unitId}` as Href),
      moveTo: (task, conditionId) => save(() => setTaskCondition(task.id, conditionId)),
      detach: (task) => save(() => detachTaskFromGoal(task.id)),
    });

  /** Deleting is the one irreversible act here, so the one that asks,
   *  in a native alert (ADR-0043 §1). The copy says what survives as
   *  well as what goes, since "delete" reads worse than it is. */
  const confirmDelete = () => {
    if (!goal) return;
    const { id, title } = goal;
    Alert.alert(
      "Delete this goal?",
      `“${title}” and its conditions go for good. Anything you already achieved stays in your log, and its tasks stay in your plan. They just stop pointing at this goal.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          // A reading or condition still waiting on Undo goes first, so
          // nothing reloads a goal that's gone.
          onPress: () =>
            void undo.settle().then(() =>
              save(
                () => deleteGoal(id),
                () => router.back(),
              ),
            ),
        },
      ],
    );
  };

  /** "Add task" means two things, and a person shouldn't have to guess
   *  which one the button does: a native menu asks. */
  const addChoices = (conditionId: string | null): MenuAction[] => [
    {
      label: "Write a new task",
      icon: "square.and.pencil",
      onPress: () => setAddingTask({ conditionId }),
    },
    {
      label: "Add one you already have",
      icon: "text.badge.plus",
      onPress: () => setAddingExisting({ conditionId }),
    },
  ];

  /** The system's rename prompt, from the ••• menu (ADR-0043 §5). A
   *  name only: Revise is for changing the goal. */
  const renameTitle = () => {
    if (!goal) return;
    Alert.prompt(
      "Rename goal",
      undefined,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save", onPress: (title?: string) => save(() => renameGoal(goal.id, title ?? "")) },
      ],
      "plain-text",
      goal.title,
    );
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: heading?.title ?? "" }} />
      {heading ? (
        <GoalToolbar
          status={heading.status}
          onRename={renameTitle}
          onPause={() => goal && save(() => pauseGoal(goal.id))}
          onRevise={() => setRevising(true)}
          onSetAside={() => setAbandoning(true)}
          onDelete={confirmDelete}
        />
      ) : null}
      <KeyboardScroll
        // First in the screen, so the nav bar's title collapses on
        // scroll; automatic insets keep it and the tab bar clear.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.container,
          { paddingTop: space.sm, paddingBottom: space.xxxl },
        ]}
      >
        <ScrollBackdrop circles={hueWash(accent)} />

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
                onDelete={(entryId) =>
                  undo.remove({
                    id: entryId,
                    message: "Reading deleted",
                    run: () => deleteGoalProgress(entryId),
                  })
                }
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
                      actions={editable ? taskActions(t) : undefined}
                    />
                  </View>
                ))}
                {editable ? (
                  <>
                    {goal.tasks.length > 0 ? <GroupDivider theme={theme} /> : null}
                    <GoalAddRow label="Add task" accent={accent} choices={addChoices(null)} />
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
                  menu={conditionActions(c, goal.conditions, conditionHandlers)}
                  taskActions={taskActions}
                  addChoices={addChoices(c.id)}
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

            {/* ── Sheets and menus ── */}
            {metricShown ? (
              <GoalMetricSheet
                visible={editingMetric}
                onDismissed={metricGone}
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

            {completingShown ? (
              <CompleteGoalModal
                visible={completing}
                onDismissed={completingGone}
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
            ) : null}

            {abandoningShown ? (
              <AbandonGoalModal
                visible={abandoning}
                onDismissed={abandoningGone}
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
            ) : null}

            {revisingShown ? (
              <ReviseGoalModal
                visible={revising}
                onDismissed={revisingGone}
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
            ) : null}

            {addingTaskShown ? (
              <AddTaskModal
                visible={addingTask !== null}
                onDismissed={addingTaskGone}
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
                    addingTaskShown.conditionId,
                    detail,
                  );
                  await reload();
                }}
              />
            ) : null}

            {addingExistingShown ? (
              <AddExistingTaskSheet
                visible={addingExisting !== null}
                onDismissed={addingExistingGone}
                tasks={attachable}
                conditionTitle={
                  goal.conditions.find((c) => c.id === addingExistingShown.conditionId)?.title ?? null
                }
                areaColors={theme.areas}
                accent={accent}
                theme={theme}
                onClose={() => setAddingExisting(null)}
                onPick={(taskId) => {
                  const where = addingExistingShown;
                  setAddingExisting(null);
                  save(() => attachTaskToGoal(taskId, goal.id, where.conditionId));
                }}
              />
            ) : null}

          </>
        )}
      </KeyboardScroll>
      <UndoBar undo={undo} theme={theme} />
    </View>
  );
}

/** The goal without the readings and conditions whose delete is
 *  waiting or landing (`useUndoDelete`). */
function withoutPending(goal: GoalDetail | null, hidden: ReadonlySet<string>): GoalDetail | null {
  if (goal === null || hidden.size === 0) return goal;
  // Removing a condition keeps its tasks (ADR-0030): they show under
  // the goal's own tasks while the removal waits, as they will after.
  const removed = goal.conditions.filter((c) => hidden.has(c.id));
  return {
    ...goal,
    progress: goal.progress.filter((e) => !hidden.has(e.id)),
    conditions: goal.conditions.filter((c) => !hidden.has(c.id)),
    tasks: [
      ...goal.tasks,
      ...removed.flatMap((c) => c.tasks.map((t) => ({ ...t, conditionId: null }))),
    ],
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: space.screen },
  loading: { marginTop: space.xxl },
  notFound: { marginTop: space.xxl, gap: space.sm },
  groupAction: { alignSelf: "flex-start", marginTop: space.xs },
  /** Groups carry `marginTop: space.xl` of their own; an add row standing
   *  outside one has to match it or the rhythm breaks. */
  standaloneAdd: { marginTop: space.md, paddingHorizontal: space.xs },
});
