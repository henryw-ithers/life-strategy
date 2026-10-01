/**
 * Goal detail: what the goal is, what has to be true for it to happen,
 * and the work doing it.
 *
 * **Built around conditions (ADR-0030).** A goal's child structure was
 * once a flat ladder of milestones; it is a set of *conditions* now —
 * parallel prerequisites, each holding its own tasks, none completing.
 * The screen reads top to bottom as one sentence: this is the goal ·
 * here is how it is measured · here is what has to be true · here is
 * how to manage it.
 *
 * **The lifecycle actions moved to the foot.** Five buttons used to sit
 * between the title and the content, so the substance of a goal opened
 * below the fold behind an admin block. Complete is the one action that
 * belongs beside the goal; pause, revise, set aside and delete are
 * things you do *to* a goal, not things the goal is, and they live in a
 * quiet Manage group at the bottom where the settings screen keeps its
 * own equivalents.
 *
 * Actions still drive the ADR-0007 state machine — pause, resume,
 * abandon (revivable), revise (spawns a linked successor), and the
 * three-path completion flow.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AbandonGoalModal } from "../../../components/goals/AbandonGoalModal";
import { CompleteGoalModal } from "../../../components/goals/CompleteGoalModal";
import { GoalMetricPanel } from "../../../components/goals/GoalMetricPanel";
import { GoalMetricSheet } from "../../../components/goals/GoalMetricSheet";
import { AddExistingTaskSheet, type AttachableTask } from "../../../components/goals/AddExistingTaskSheet";
import { AddTaskModal } from "../../../components/plan/AddTaskModal";
import { formatFrequency } from "../../../components/plan/frequency";
import type { PickableUnit } from "../../../components/plan/UnitPicker";
import { ReviseGoalModal } from "../../../components/goals/ReviseGoalModal";
import { AppText } from "../../../components/ui/AppText";
import { Group, GroupDivider } from "../../../components/ui/Group";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { SettingsRow } from "../../../components/ui/SettingsRow";
import { Backdrop, hueWash } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
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
  loadGoalDetail,
  loadGoals,
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
  type GoalDetail,
  type GoalTask,
} from "../../../db/goals";
import { addTask, loadPlan } from "../../../db/tasks";
import { currentLocalDate } from "../../../db/today";
import type { ThemeTokens } from "../../../theme/colors";
import { getTheme, SCRIM } from "../../../theme/colors";
import { radius, space, type as typeScale } from "../../../theme/tokens";

function statusLabel(status: GoalDetail["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "abandoned":
      return "Set aside";
    case "revised":
      return "Revised";
    case "completed":
      return "Complete";
  }
}

/**
 * One task under a goal.
 *
 * **No point value.** The row used to end in `task.point_value`, which
 * since formula v9 stores a *weight* rather than points — what a
 * completion actually pays is `90 × weight ÷ that day's expected load`,
 * so a bare number here read as points and was not one. The Plan screen
 * is where "where are my points going" is answered; this screen is
 * about intent. The cadence takes the slot instead, which is the thing
 * you actually want to know about a task you are looking at inside a
 * goal.
 *
 * **The unit shows only when it differs from the goal's** (ADR-0030
 * §2). A condition may recruit a task from anywhere in the portfolio,
 * and that task is paid out of its own unit's weight — worth saying,
 * but only where it is news. A chip on every row would be noise; a chip
 * on the exception is information. It is a pip plus muted text, never
 * hue-coloured text or a hue fill: four of the six area hues fail AA as
 * text or as a fill behind text in the light theme (DESIGN.md §2).
 */
function TaskRow({
  task,
  goalUnitId,
  areaColors,
  theme,
  onOpen,
}: {
  task: GoalTask;
  goalUnitId: string;
  areaColors: Record<string, string>;
  theme: ThemeTokens;
  /** Opens the task's actions. Undefined on a goal that is not
   *  editable, where the row is a readout. */
  onOpen?: () => void;
}) {
  const elsewhere = task.unitId !== goalUnitId;
  const meta = [
    formatFrequency(task.timesPerWeek),
    elsewhere ? task.unitName : null,
  ].filter(Boolean);

  return (
    <Pressable
      // **Tap, not only long press.** A dead row is worse than a
      // discoverable one: there is nowhere for a task to navigate to
      // from inside a goal, so the tap opens the actions it does have.
      // Holding does the same thing, for the muscle memory the day
      // record already teaches.
      onPress={onOpen}
      onLongPress={
        onOpen
          ? () => {
              void Haptics.selectionAsync();
              onOpen();
            }
          : undefined
      }
      delayLongPress={350}
      disabled={!onOpen}
      accessibilityRole={onOpen ? "button" : "text"}
      accessibilityLabel={`${task.title}, ${meta.join(", ")}`}
      accessibilityHint={onOpen ? "Edit, move, or remove from this goal" : undefined}
      style={({ pressed }) => [styles.taskRow, { opacity: pressed && onOpen ? 0.6 : 1 }]}
    >
      <View style={styles.grow}>
        <AppText color={theme.ink} numberOfLines={2}>
          {task.title}
        </AppText>
        <View style={styles.taskMeta}>
          {elsewhere ? (
            <View
              style={[
                styles.unitPip,
                { backgroundColor: areaColors[task.areaId] ?? theme.muted },
              ]}
            />
          ) : null}
          <AppText variant="footnote" color={theme.muted}>
            {meta.join(" · ")}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

/** The inline add row shared by conditions and tasks — one action, one
 *  look, matching the Tasks screen's own add row. */
function AddRow({
  label,
  onPress,
  theme,
  accent,
  style,
}: {
  label: string;
  onPress: () => void;
  theme: ThemeTokens;
  accent: string;
  /** Inside a Group the box supplies the rhythm; standing alone it has
   *  to bring its own, or it butts against the group above it. */
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.addRow, style, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name="add" size={16} color={accent} />
      <AppText variant="label" color={accent}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function GoalDetailScreen() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  /**
   * Whether a load has finished, as distinct from what it found.
   *
   * `goal === null` covers two states that need different screens:
   * still loading, and loaded but there is no such goal. Without this
   * flag they collapse, and a goal deleted on another screen — or a
   * stale deep link — leaves a spinner turning forever with nothing to
   * tap. `useScreenLoad` only sees thrown errors; a query returning no
   * row is a perfectly successful query.
   */
  const [loaded, setLoaded] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [revising, setRevising] = useState(false);
  const [editingMetric, setEditingMetric] = useState(false);
  /** Deleting a goal is the one irreversible act here, so the one that
   *  asks. */
  const [deleting, setDeleting] = useState(false);

  /** Which condition the add-task sheet was opened from. `null` inside
   *  the object means "straight off the goal"; the object being null
   *  means the sheet is closed. */
  const [addingTask, setAddingTask] = useState<{ conditionId: string | null } | null>(
    null,
  );
  /** The inline condition form. Shared between adding and renaming —
   *  `editingCondition` says which. */
  const [conditionTitle, setConditionTitle] = useState("");
  const [editingCondition, setEditingCondition] = useState<string | null>(null);
  const [composingCondition, setComposingCondition] = useState(false);
  /** Held by a long press, the same gesture the day record uses. */
  const [conditionMenu, setConditionMenu] = useState<GoalCondition | null>(null);
  const [movingTask, setMovingTask] = useState<GoalTask | null>(null);
  /** Which condition an "add" was started from, while the user picks
   *  between writing a new task and pulling in one they already have. */
  const [choosingAdd, setChoosingAdd] = useState<{ conditionId: string | null } | null>(
    null,
  );
  const [addingExisting, setAddingExisting] = useState<{
    conditionId: string | null;
  } | null>(null);
  /** Everything in the plan that could join this goal (ADR-0030 §2:
   *  any unit, not just the goal's own). */
  const [attachable, setAttachable] = useState<AttachableTask[]>([]);

  /** Every scoreable unit, for the add sheet's unit row. A goal's task
   *  defaults to the goal's own unit but may serve others (ADR-0019),
   *  which is what lets a condition reach across the portfolio. */
  const [units, setUnits] = useState<PickableUnit[]>([]);

  const reload = useCallback(async () => {
    const [detail, plan, goalTree] = await Promise.all([
      loadGoalDetail(goalId),
      loadPlan(),
      loadGoals(),
    ]);
    setGoal(detail);
    setLoaded(true);
    setUnits(
      plan.areas.flatMap((a) =>
        a.units
          .filter((u) => u.includeInScoring)
          .map((u) => ({
            id: u.id,
            name: u.name,
            areaId: u.areaId,
            motivationKind: u.motivationKind,
          })),
      ),
    );

    // Every task in the plan that is not already on this goal — from
    // any unit, because that is what a condition is for. A task serving
    // a *different* goal is offered and labelled: moving work between
    // goals is legitimate, and hiding it would leave someone hunting
    // for a task the app can see perfectly well.
    const goalTitles = new Map(
      goalTree.areas.flatMap((a) =>
        a.units.flatMap((u) => u.goals.map((g) => [g.id, g.title] as const)),
      ),
    );
    setAttachable(
      plan.areas.flatMap((a) =>
        a.units.flatMap((u) =>
          u.tasks
            .filter((t) => t.goalId !== goalId)
            .map((t) => ({
              id: t.id,
              title: t.title,
              timesPerWeek: t.timesPerWeek,
              unitId: u.id,
              unitName: u.name,
              areaId: u.areaId,
              servingGoalTitle:
                t.goalId === null ? null : goalTitles.get(t.goalId) ?? null,
            })),
        ),
      ),
    );
  }, [goalId]);

  const { error, retry } = useScreenLoad(reload);

  const accent = goal ? theme.areas[goal.areaId] ?? theme.accent : theme.accent;
  const editable = goal?.status === "active";
  const layout = reduceMotion ? undefined : LinearTransition.duration(200);
  const entering = reduceMotion ? undefined : FadeIn.duration(180);

  const submitCondition = async () => {
    const title = conditionTitle.trim();
    if (title.length === 0 || !goal) {
      cancelCondition();
      return;
    }
    const editing = editingCondition;
    setConditionTitle("");
    setEditingCondition(null);
    setComposingCondition(false);
    if (editing) await renameCondition(editing, title);
    else await addCondition(goal.id, title);
    await reload();
  };

  const cancelCondition = () => {
    setEditingCondition(null);
    setComposingCondition(false);
    setConditionTitle("");
  };

  /** Conditions are parallel, so this is arrangement, not precedence —
   *  and it is a menu rather than a drag because a drag surface inside
   *  a ScrollView fights the scroll and screen readers cannot use one. */
  const moveCondition = async (id: string, delta: -1 | 1) => {
    if (!goal) return;
    const ids = goal.conditions.map((c) => c.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    await reorderConditions(ids);
    await reload();
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={hueWash(accent)} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          // Pushed inside the Goals tab, so the bar is still on screen
          // and owns the bottom inset. Back stays — this is a detail
          // screen, not a destination.
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
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : goal === null ? (
          /* Kind rather than alarming: a goal you deleted is a goal you
             meant to delete, and a stale link is nobody's mistake. */
          <View style={styles.notFound}>
            <AppText variant="title" color={theme.ink}>
              This goal is gone
            </AppText>
            <AppText color={theme.muted}>
              It was deleted, or the link is out of date. Anything it achieved
              is still in your log.
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
            {/* ── The goal itself ─────────────────────────────── */}
            <AppText variant="caption" color={theme.muted}>
              {goal.unitName}
            </AppText>
            <AppText variant="display" color={theme.ink}>
              {goal.title}
            </AppText>
            <AppText variant="label" color={accent} style={styles.status}>
              {statusLabel(goal.status)}
            </AppText>
            {goal.description ? (
              <AppText color={theme.ink} style={styles.description}>
                {goal.description}
              </AppText>
            ) : null}

            {goal.linkedFromGoalId ? (
              <Pressable
                onPress={() => router.push(`/goals/${goal.linkedFromGoalId}` as Href)}
                accessibilityRole="button"
              >
                <AppText variant="footnote" color={theme.muted} style={styles.link}>
                  {goal.linkKind === "follow_up" ? "Follows on from" : "Revised from"} an
                  earlier goal
                </AppText>
              </Pressable>
            ) : null}
            {goal.successorGoalId ? (
              <Pressable
                onPress={() => router.push(`/goals/${goal.successorGoalId}` as Href)}
                accessibilityRole="button"
              >
                <AppText variant="footnote" color={theme.muted} style={styles.link}>
                  Continued in a newer goal
                </AppText>
              </Pressable>
            ) : null}

            {/* The one action that belongs beside the goal rather than
                under Manage: finishing it is the goal's own ending, not
                an administrative act on it. */}
            {goal.status === "active" ? (
              <View style={styles.primaryAction}>
                <Button
                  label="Complete this goal"
                  color={accent}
                  onPress={() => setCompleting(true)}
                  theme={theme}
                />
              </View>
            ) : null}
            {goal.status === "paused" ? (
              <View style={styles.primaryAction}>
                <Button
                  label="Resume"
                  color={accent}
                  onPress={() => void resumeGoal(goal.id).then(reload)}
                  theme={theme}
                />
              </View>
            ) : null}
            {goal.status === "abandoned" ? (
              <View style={styles.primaryAction}>
                <Button
                  label="Revive"
                  color={accent}
                  onPress={() => void reviveGoal(goal.id).then(reload)}
                  theme={theme}
                />
              </View>
            ) : null}

            {/* ── Measure ─────────────────────────────────────── */}
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
                  void addGoalProgress(goal.id, currentLocalDate(), value, note).then(
                    reload,
                  );
                }}
                onDelete={(entryId) => {
                  void deleteGoalProgress(entryId).then(reload);
                }}
              />
            ) : editable ? (
              <Group theme={theme} title="Measure">
                {/* An offer, not a nudge: a goal with no number is a
                    first-class shape (ADR-0015 §1's null kind), so this
                    describes what a measure would add and stops. */}
                <AppText variant="caption" color={theme.muted}>
                  Some goals have a number to move — 24 books, 225 lb. Give
                  this one a measure and you can log readings against it.
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

            {/* ── Conditions ──────────────────────────────────── */}
            {/* Rendered whenever the goal is editable, not only when it
                already holds loose tasks. Conditions are optional and
                plenty of goals will never have one, so **the plain
                "add a task" path has to exist on a goal that has
                neither** — gating this on `tasks.length > 0` left a
                brand-new goal with no way to add work at all. */}
            {goal.tasks.length > 0 || editable ? (
              <Group
                theme={theme}
                title={goal.conditions.length > 0 ? "Not under a condition" : "Tasks"}
                flush
              >
                {goal.tasks.map((t, i) => (
                  <View key={t.id}>
                    {i > 0 ? <GroupDivider theme={theme} /> : null}
                    <TaskRow
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
                    <AddRow
                      label="Add task"
                      accent={accent}
                      theme={theme}
                      onPress={() => setChoosingAdd({ conditionId: null })}
                    />
                  </>
                ) : null}
              </Group>
            ) : null}

            {goal.conditions.map((c) => (
              <Animated.View key={c.id} layout={layout} entering={entering}>
                <Group theme={theme} flush>
                  {/* A visible control, not only a hidden gesture. Long
                      press still works and is the faster path once you
                      know it — but rename, reorder and remove are the
                      only ways to manage a condition, and a person who
                      has never used this screen has no reason to guess
                      that holding a heading does anything. */}
                  <View style={styles.conditionHeader}>
                    <Pressable
                      onLongPress={
                        editable
                          ? () => {
                              void Haptics.selectionAsync();
                              setConditionMenu(c);
                            }
                          : undefined
                      }
                      delayLongPress={350}
                      disabled={!editable}
                      accessibilityRole="header"
                      accessibilityLabel={c.title}
                      style={styles.grow}
                    >
                      <AppText variant="headline" color={theme.ink}>
                        {c.title}
                      </AppText>
                    </Pressable>
                    {editable ? (
                      <Pressable
                        onPress={() => setConditionMenu(c)}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit condition: ${c.title}`}
                        accessibilityHint="Rename, reorder or remove"
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.conditionMore,
                          { opacity: pressed ? 0.5 : 1 },
                        ]}
                      >
                        <Ionicons
                          name="ellipsis-horizontal"
                          size={18}
                          color={theme.muted}
                        />
                      </Pressable>
                    ) : null}
                  </View>

                  {c.tasks.map((t) => (
                    <View key={t.id}>
                      <GroupDivider theme={theme} />
                      <TaskRow
                        task={t}
                        goalUnitId={goal.unitId}
                        areaColors={theme.areas}
                        theme={theme}
                        onOpen={editable ? () => setMovingTask(t) : undefined}
                      />
                    </View>
                  ))}

                  {/* A condition with nothing under it is a statement of
                      intent, not an error (ADR-0030 §3) — so the copy
                      says what it is waiting for rather than what is
                      missing. */}
                  {c.tasks.length === 0 ? (
                    <>
                      <GroupDivider theme={theme} />
                      <AppText variant="caption" color={theme.muted} style={styles.conditionEmpty}>
                        Named, with nothing doing it yet.
                      </AppText>
                    </>
                  ) : null}

                  {editable ? (
                    <>
                      <GroupDivider theme={theme} />
                      <AddRow
                        label="Add task"
                        accent={accent}
                        theme={theme}
                        onPress={() => setChoosingAdd({ conditionId: c.id })}
                      />
                    </>
                  ) : null}
                </Group>
              </Animated.View>
            ))}

            {/* The empty state teaches the concept rather than reporting
                a count — most goals will not have conditions and that is
                a fine way for a goal to be. */}
            {editable && goal.conditions.length === 0 && !composingCondition ? (
              <Group theme={theme} title="Conditions">
                <AppText variant="caption" color={theme.muted}>
                  What has to be true for this to happen? Name each one, and
                  hang the work that makes it true underneath — a condition
                  can pull in a task from anywhere in your plan, not just{" "}
                  {goal.unitName}. Goals do fine without them.
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
              <Animated.View entering={entering} style={styles.conditionForm}>
                <TextInput
                  value={conditionTitle}
                  onChangeText={setConditionTitle}
                  accessibilityLabel="Condition"
                  placeholder={editingCondition ? "Condition" : "What has to be true?"}
                  placeholderTextColor={theme.muted}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={submitCondition}
                  style={[
                    styles.conditionInput,
                    { backgroundColor: theme.surface, color: theme.ink },
                  ]}
                />
                <Pressable
                  onPress={submitCondition}
                  accessibilityRole="button"
                  accessibilityLabel={editingCondition ? "Save condition" : "Add condition"}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.quickAdd,
                    { backgroundColor: accent, opacity: pressed ? 0.5 : 1 },
                  ]}
                >
                  <Ionicons
                    name={editingCondition ? "checkmark" : "add"}
                    size={17}
                    color={theme.onAccent}
                  />
                </Pressable>
                <Pressable
                  onPress={cancelCondition}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  hitSlop={8}
                  style={({ pressed }) => [styles.cancelEdit, { opacity: pressed ? 0.5 : 1 }]}
                >
                  <AppText variant="label" color={theme.muted}>
                    Cancel
                  </AppText>
                </Pressable>
              </Animated.View>
            ) : null}

            {editable && goal.conditions.length > 0 && !composingCondition ? (
              <AddRow
                label="Add a condition"
                accent={accent}
                theme={theme}
                style={styles.standaloneAdd}
                onPress={() => setComposingCondition(true)}
              />
            ) : null}

            {/* ── Manage ──────────────────────────────────────── */}
            <Group theme={theme} title="Manage" flush>
              {goal.status === "active" ? (
                <>
                  <SettingsRow
                    label="Pause"
                    detail="Stops for now. Its tasks stay in your plan."
                    onPress={() => void pauseGoal(goal.id).then(reload)}
                    theme={theme}
                  />
                  <GroupDivider theme={theme} />
                  <SettingsRow
                    label="Revise"
                    detail="Rewrite it as a new goal, linked back to this one."
                    onPress={() => setRevising(true)}
                    theme={theme}
                  />
                  <GroupDivider theme={theme} />
                  <SettingsRow
                    label="Set aside"
                    detail="The honest ending for a goal you tried. Revivable any time."
                    onPress={() => setAbandoning(true)}
                    theme={theme}
                  />
                  <GroupDivider theme={theme} />
                </>
              ) : null}
              {goal.status === "paused" ? (
                <>
                  <SettingsRow
                    label="Set aside"
                    detail="The honest ending for a goal you tried. Revivable any time."
                    onPress={() => setAbandoning(true)}
                    theme={theme}
                  />
                  <GroupDivider theme={theme} />
                </>
              ) : null}
              {/* Sits below every lifecycle action and reads quieter
                  than all of them, because for a goal you actually
                  tried, "Set aside" is the honest end and this is not
                  (ADR-0007 §1). This is for the goal you mistyped or
                  never meant — anything it achieved survives it. */}
              <SettingsRow
                label="Delete goal"
                detail="For a goal you never meant to make."
                destructive
                hint="Asks before deleting"
                onPress={() => setDeleting(true)}
                theme={theme}
              />
            </Group>

            {/* ── Sheets and menus ────────────────────────────── */}
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
                  void Promise.all([
                    setGoalMetric(goal.id, metric),
                    setGoalTargetDate(goal.id, targetDate),
                    setGoalAutocountTask(goal.id, autocountTaskId),
                  ]).then(reload);
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
                if (successorGoalId) {
                  router.replace(`/goals/${successorGoalId}` as Href);
                } else {
                  await reload();
                }
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

            {/* Rename · reorder · remove, held by a long press — the
                same gesture and the same card the day record uses, so
                one gesture has one look app-wide. */}
            <MenuSheet
              visible={conditionMenu !== null}
              theme={theme}
              onClose={() => setConditionMenu(null)}
              rows={[
                {
                  label: "Rename",
                  onPress: () => {
                    const target = conditionMenu;
                    setConditionMenu(null);
                    if (!target) return;
                    setEditingCondition(target.id);
                    setConditionTitle(target.title);
                    setComposingCondition(true);
                  },
                },
                {
                  label: "Move up",
                  disabled: goal.conditions[0]?.id === conditionMenu?.id,
                  onPress: () => {
                    const target = conditionMenu;
                    setConditionMenu(null);
                    if (target) void moveCondition(target.id, -1);
                  },
                },
                {
                  label: "Move down",
                  disabled:
                    goal.conditions[goal.conditions.length - 1]?.id === conditionMenu?.id,
                  onPress: () => {
                    const target = conditionMenu;
                    setConditionMenu(null);
                    if (target) void moveCondition(target.id, 1);
                  },
                },
                {
                  // The tasks survive: a condition is a grouping, and
                  // removing a grouping must never delete the work in it
                  // (ADR-0030, `deleteCondition`).
                  label: "Remove condition",
                  destructive: true,
                  onPress: () => {
                    const target = conditionMenu;
                    setConditionMenu(null);
                    if (target) void deleteCondition(target.id).then(reload);
                  },
                },
              ]}
            />

            {/* Everything a person might reasonably want to do to a task
                from here. Editing routes to the Plan screen rather than
                duplicating its edit sheet: task mechanics — cadence,
                weekdays, which units it serves — live in one place, and
                two editors would be two things to keep in step. */}
            <MenuSheet
              visible={movingTask !== null}
              theme={theme}
              onClose={() => setMovingTask(null)}
              title={movingTask?.title}
              rows={[
                {
                  label: "Edit in your plan",
                  onPress: () => {
                    const t = movingTask;
                    setMovingTask(null);
                    if (t) router.push(`/plan?unit=${t.unitId}` as Href);
                  },
                },
                ...goal.conditions
                  .filter((c) => c.id !== movingTask?.conditionId)
                  .map((c) => ({
                    label: `Move to “${c.title}”`,
                    onPress: () => {
                      const t = movingTask;
                      setMovingTask(null);
                      if (t) void setTaskCondition(t.id, c.id).then(reload);
                    },
                  })),
                ...(movingTask?.conditionId
                  ? [
                      {
                        label: "Take out of its condition",
                        onPress: () => {
                          const t = movingTask;
                          setMovingTask(null);
                          if (t) void setTaskCondition(t.id, null).then(reload);
                        },
                      },
                    ]
                  : []),
                {
                  // The inverse of adding one. It is destructive-coloured
                  // because it is the row that removes something, but the
                  // task itself survives — it goes back to standing on
                  // its own under its unit, still earning.
                  label: "Remove from this goal",
                  destructive: true,
                  onPress: () => {
                    const t = movingTask;
                    setMovingTask(null);
                    if (t) void detachTaskFromGoal(t.id).then(reload);
                  },
                },
              ]}
            />

            {/* "Add task" means two different things and a person should
                not have to guess which one the button does. */}
            <MenuSheet
              visible={choosingAdd !== null}
              theme={theme}
              onClose={() => setChoosingAdd(null)}
              rows={[
                {
                  label: "Write a new task",
                  onPress: () => {
                    const where = choosingAdd;
                    setChoosingAdd(null);
                    if (where) setAddingTask(where);
                  },
                },
                {
                  label: "Add one you already have",
                  onPress: () => {
                    const where = choosingAdd;
                    setChoosingAdd(null);
                    if (where) setAddingExisting(where);
                  },
                },
              ]}
            />

            {addingExisting ? (
              <AddExistingTaskSheet
                visible
                tasks={attachable}
                conditionTitle={
                  goal.conditions.find((c) => c.id === addingExisting.conditionId)
                    ?.title ?? null
                }
                areaColors={theme.areas}
                accent={accent}
                theme={theme}
                onClose={() => setAddingExisting(null)}
                onPick={(taskId) => {
                  const where = addingExisting;
                  setAddingExisting(null);
                  void attachTaskToGoal(
                    taskId,
                    goal.id,
                    where?.conditionId ?? null,
                  ).then(reload);
                }}
              />
            ) : null}

            {/* The one irreversible act here, so the one that asks —
                and the copy says what survives rather than only what
                goes, since "delete" reads worse than it is. */}
            <Modal
              visible={deleting}
              transparent
              statusBarTranslucent
              animationType="fade"
              onRequestClose={() => setDeleting(false)}
            >
              <View style={styles.menuBackdrop}>
                <View
                  style={[
                    styles.confirmCard,
                    { backgroundColor: theme.canvas, borderColor: theme.hairline },
                  ]}
                >
                  <AppText variant="title" color={theme.ink}>
                    Delete this goal?
                  </AppText>
                  <AppText color={theme.muted}>
                    “{goal.title}” and its conditions go for good. Anything you
                    already achieved stays in your log, and its tasks stay in
                    your plan — they just stop pointing at this goal.
                  </AppText>
                  <View style={styles.confirmActions}>
                    <View style={styles.grow}>
                      <Button
                        label="Cancel"
                        variant="quiet"
                        onPress={() => setDeleting(false)}
                        theme={theme}
                      />
                    </View>
                    <View style={styles.grow}>
                      <Button
                        label="Delete"
                        color={theme.danger}
                        onPress={() => {
                          setDeleting(false);
                          void deleteGoal(goal.id).then(() => router.back());
                        }}
                        theme={theme}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The press-and-hold menu: a centred card over a scrim, matching the
 * day record's own so one gesture has one look app-wide.
 *
 * Extracted because this screen now raises three of them — conditions,
 * tasks and legacy checkpoints — and three hand-rolled copies of the
 * same modal is how vocabularies drift apart.
 */
function MenuSheet({
  visible,
  rows,
  theme,
  onClose,
  title,
}: {
  visible: boolean;
  rows: { label: string; onPress: () => void; destructive?: boolean; disabled?: boolean }[];
  theme: ThemeTokens;
  onClose: () => void;
  title?: string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.menuBackdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <View
          style={[
            styles.menuCard,
            { backgroundColor: theme.canvas, borderColor: theme.hairline },
          ]}
        >
          {title ? (
            <AppText variant="caption" color={theme.muted} style={styles.menuTitle} numberOfLines={1}>
              {title}
            </AppText>
          ) : null}
          {rows.map((row) => (
            <Pressable
              key={row.label}
              onPress={row.onPress}
              disabled={row.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: row.disabled }}
              style={({ pressed }) => [
                styles.menuRow,
                { opacity: row.disabled ? 0.35 : pressed ? 0.5 : 1 },
              ]}
            >
              <AppText color={row.destructive ? theme.danger : theme.ink}>
                {row.label}
              </AppText>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
          >
            <AppText color={theme.muted}>Cancel</AppText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  container: { paddingHorizontal: space.screen },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  status: { marginTop: space.xs },
  description: { marginTop: space.md },
  link: { marginTop: space.sm },
  grow: { flex: 1 },
  primaryAction: { marginTop: space.xl },
  notFound: { marginTop: space.xxl, gap: space.sm },
  groupAction: { alignSelf: "flex-start", marginTop: space.xs },

  conditionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 48,
    paddingVertical: space.sm,
  },
  conditionMore: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  conditionEmpty: { paddingVertical: space.md },
  conditionForm: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xl,
  },
  conditionInput: {
    ...typeScale.body,
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  quickAdd: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelEdit: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.xs },

  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
    paddingVertical: space.sm,
  },
  taskMeta: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: 2 },
  /** A pip, not coloured text and not a fill behind text: four of the
   *  six area hues fail AA either way in the light theme (DESIGN.md). */
  unitPip: { width: 7, height: 7, borderRadius: 4 },

  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 48,
    paddingVertical: space.sm,
  },
  /** Groups carry `marginTop: space.xl` of their own; an add row
   *  standing outside one has to match it or the rhythm breaks. */
  standaloneAdd: { marginTop: space.md, paddingHorizontal: space.xs },

  /** Centred card over a scrim, matching the day record's own
   *  press-and-hold menu so one gesture has one look app-wide. */
  menuBackdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.screen,
  },
  menuCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.xs,
  },
  menuTitle: {
    textAlign: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  menuRow: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  confirmCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xl,
    gap: space.md,
  },
  confirmActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.sm,
  },
});
