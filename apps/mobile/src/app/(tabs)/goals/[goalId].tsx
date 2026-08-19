/**
 * Goal detail: status, milestones, and the tasks currently serving
 * this goal. Actions here drive the ADR-0007 state machine — pause,
 * resume, abandon (revivable), revise (spawns a linked successor),
 * and the three-path completion flow.
 */
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AbandonGoalModal } from "../../../components/goals/AbandonGoalModal";
import { CompleteGoalModal } from "../../../components/goals/CompleteGoalModal";
import { GoalMetricPanel } from "../../../components/goals/GoalMetricPanel";
import { GoalMetricSheet } from "../../../components/goals/GoalMetricSheet";
import { PastDaySheet } from "../../../components/goals/PastDaySheet";
import { AddTaskModal } from "../../../components/plan/AddTaskModal";
import type { PickableUnit } from "../../../components/plan/UnitPicker";
import { ReviseGoalModal } from "../../../components/goals/ReviseGoalModal";
import { AppText } from "../../../components/ui/AppText";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { Backdrop, hueWash } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import {
  abandonGoal,
  addGoalProgress,
  addMilestone,
  completeGoal,
  completeMilestone,
  deleteGoal,
  deleteGoalProgress,
  deleteMilestone,
  loadGoalDetail,
  pauseGoal,
  reviseGoal,
  reviveGoal,
  resumeGoal,
  setGoalAutocountTask,
  setGoalMetric,
  setGoalTargetDate,
  updateMilestone,
  type GoalDetail,
} from "../../../db/goals";
import { addTask, loadPlan } from "../../../db/tasks";
import { currentLocalDate } from "../../../db/today";
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

export default function GoalDetailScreen() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [completing, setCompleting] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [revising, setRevising] = useState(false);
  const [editingMetric, setEditingMetric] = useState(false);
  const [milestoneTarget, setMilestoneTarget] = useState("");
  /** The rung awaiting a date. Completion is a two-step here: pick the
   *  rung, then say when it actually happened (ADR-0015 §5). */
  const [datingMilestone, setDatingMilestone] = useState<{
    id: string;
    title: string;
  } | null>(null);
  /** Held by a long press, the same gesture the day record uses for
   *  its notes and photos — a row of edit/delete glyphs beside every
   *  rung would make a ladder read as a list of things to manage. */
  const [milestoneMenu, setMilestoneMenu] = useState<{
    id: string;
    title: string;
  } | null>(null);
  /** Set while the inline form below is rewriting a rung rather than
   *  adding one; the inputs and the button are shared. */
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null);
  /** Deleting a goal is the one irreversible act on this screen, so it
   *  is the one that asks. */
  const [deleting, setDeleting] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  /** Every scoreable unit, for the add sheet's unit row. A goal's task
   *  defaults to the goal's own unit but may serve others (ADR-0019). */
  const [units, setUnits] = useState<PickableUnit[]>([]);

  const reload = useCallback(async () => {
    const [detail, plan] = await Promise.all([loadGoalDetail(goalId), loadPlan()]);
    setGoal(detail);
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
  }, [goalId]);

  const { error, retry } = useScreenLoad(reload);

  const accent = goal ? theme.areas[goal.areaId] ?? theme.accent : theme.accent;

  const finishMilestone = async (milestoneId: string, completedOn: string) => {
    const { goalShouldComplete } = await completeMilestone(milestoneId, completedOn);
    if (goalShouldComplete) {
      setCompleting(true);
    } else {
      await reload();
    }
  };

  const submitMilestone = async () => {
    const title = milestoneTitle.trim();
    if (title.length === 0 || !goal) return;
    const threshold = Number(milestoneTarget);
    // A rung only carries a threshold on a goal that has a metric to
    // compare it against (ADR-0015 §5).
    const target =
      goal.metricKind !== null && Number.isFinite(threshold) && milestoneTarget.trim()
        ? threshold
        : null;
    const editing = editingMilestone;
    setMilestoneTitle("");
    setMilestoneTarget("");
    setEditingMilestone(null);
    if (editing) {
      await updateMilestone(editing, title, target);
    } else {
      await addMilestone(goal.id, title, target);
    }
    await reload();
  };

  /** Seeds the inline form from an existing rung. */
  const startEditingMilestone = (m: {
    id: string;
    title: string;
    targetValue: number | null;
  }) => {
    setEditingMilestone(m.id);
    setMilestoneTitle(m.title);
    setMilestoneTarget(m.targetValue === null ? "" : String(m.targetValue));
  };

  const cancelEditingMilestone = () => {
    setEditingMilestone(null);
    setMilestoneTitle("");
    setMilestoneTarget("");
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
          { paddingTop: insets.top + space.md, paddingBottom: space.xl },
        ]}
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
      ) : goal === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : (
          <>
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

            <View style={styles.actions}>
              {goal.status === "active" ? (
                <>
                  <Button
                    label="Complete"
                    color={accent}
                    onPress={() => setCompleting(true)}
                    theme={theme}
                  />
                  <Button
                    label="Pause"
                    variant="secondary"
                    onPress={() => void pauseGoal(goal.id).then(reload)}
                    theme={theme}
                  />
                  <Button
                    label="Revise"
                    variant="secondary"
                    onPress={() => setRevising(true)}
                    theme={theme}
                  />
                  <Button
                    label="Set aside"
                    variant="quiet"
                    onPress={() => setAbandoning(true)}
                    theme={theme}
                  />
                </>
              ) : null}
              {goal.status === "paused" ? (
                <>
                  <Button
                    label="Resume"
                    color={accent}
                    onPress={() => void resumeGoal(goal.id).then(reload)}
                    theme={theme}
                  />
                  <Button
                    label="Set aside"
                    variant="quiet"
                    onPress={() => setAbandoning(true)}
                    theme={theme}
                  />
                </>
              ) : null}
              {goal.status === "abandoned" ? (
                <Button
                  label="Revive"
                  color={accent}
                  onPress={() => void reviveGoal(goal.id).then(reload)}
                  theme={theme}
                />
              ) : null}

              {/* Sits below every lifecycle action and reads quieter
                  than all of them, because for a goal you actually
                  tried, "Set aside" is the honest end and this is not
                  (ADR-0007 §1). This is for the goal you mistyped or
                  never meant — anything it achieved survives it. */}
              <Button
                label="Delete goal"
                variant="quiet"
                onPress={() => setDeleting(true)}
                theme={theme}
              />
            </View>

            {goal.metricKind !== null &&
            (goal.metricKind === "habit" || goal.targetValue !== null) ? (
              <GoalMetricPanel
                kind={goal.metricKind}
                unit={goal.metricUnit}
                targetValue={goal.targetValue}
                streak={goal.streak}
                targetDate={goal.targetDate}
                entries={goal.progress}
                milestones={goal.milestones}
                editable={goal.status === "active"}
                accent={accent}
                theme={theme}
                onComplete={() => setCompleting(true)}
                onAdvanceMilestone={(id) => {
                  const m = goal.milestones.find((x) => x.id === id);
                  if (m) setDatingMilestone({ id: m.id, title: m.title });
                }}
                onAdd={(value, note) => {
                  void addGoalProgress(
                    goal.id,
                    currentLocalDate(),
                    value,
                    note,
                  ).then(reload);
                }}
                onDelete={(entryId) => {
                  void deleteGoalProgress(entryId).then(reload);
                }}
                onEdit={() => setEditingMetric(true)}
              />
            ) : goal.status === "active" ? (
              <View style={[styles.section, { borderTopColor: theme.hairline }]}>
                <AppText variant="headline" color={theme.ink}>
                  Progress
                </AppText>
                {/* An offer, not a nudge: a goal with no number is a
                    first-class shape (ADR-0015 §1's null kind), so this
                    describes what a measure would add and stops. */}
                <AppText variant="caption" color={theme.muted} style={styles.emptyNote}>
                  Some goals have a number to move — 24 books, 225 lb. Give this
                  one a measure and you can log readings against it.
                </AppText>
                <Button
                  label="Add a measure"
                  variant="quiet"
                  onPress={() => setEditingMetric(true)}
                  theme={theme}
                />
              </View>
            ) : null}

            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                Milestones
              </AppText>
              {goal.milestones.length === 0 ? (
                <AppText variant="caption" color={theme.muted} style={styles.emptyNote}>
                  No milestones yet. A flat list of checkpoints, if this goal
                  wants one.
                </AppText>
              ) : (
                goal.milestones.map((m) => (
                  <Pressable
                    key={m.id}
                    // Completing still needs the rung to be current and
                    // the goal active; editing and deleting do not — a
                    // typo in a finished rung is still a typo.
                    onPress={() => {
                      if (m.status === "current" && goal.status === "active") {
                        setDatingMilestone({ id: m.id, title: m.title });
                      }
                    }}
                    onLongPress={() => {
                      void Haptics.selectionAsync();
                      setMilestoneMenu({ id: m.id, title: m.title });
                    }}
                    delayLongPress={350}
                    accessibilityRole="button"
                    accessibilityLabel={m.title}
                    accessibilityHint="Press and hold to edit or delete"
                    // Screen readers cannot long-press, so the same two
                    // actions get explicit rotor entries.
                    accessibilityActions={[
                      { name: "magicTap", label: "Edit or delete milestone" },
                    ]}
                    onAccessibilityAction={(e) => {
                      if (e.nativeEvent.actionName === "magicTap") {
                        setMilestoneMenu({ id: m.id, title: m.title });
                      }
                    }}
                    style={[styles.milestoneRow, { borderTopColor: theme.hairline }]}
                  >
                    <View
                      style={[
                        styles.milestoneDot,
                        {
                          borderColor: accent,
                          backgroundColor: m.status === "completed" ? accent : "transparent",
                        },
                      ]}
                    />
                    <View style={styles.grow}>
                      <AppText
                        color={m.status === "completed" ? theme.muted : theme.ink}
                        numberOfLines={2}
                      >
                        {m.title}
                      </AppText>
                      {/* The rung's own number, and when it actually
                          happened — the latter matters because a
                          milestone noticed late would otherwise file
                          in the wrong month (ADR-0015 §5). */}
                      {m.targetValue !== null || m.completedOn !== null ? (
                        <AppText variant="footnote" color={theme.muted} tabular>
                          {[
                            m.targetValue !== null
                              ? `${m.targetValue}${goal.metricUnit ? ` ${goal.metricUnit}` : ""}`
                              : null,
                            m.completedOn,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </AppText>
                      ) : null}
                    </View>
                    {m.status === "current" && goal.status === "active" ? (
                      <AppText variant="footnote" color={theme.muted}>
                        tap to complete
                      </AppText>
                    ) : null}
                  </Pressable>
                ))
              )}

              {goal.status === "active" ? (
                <>
                  <View style={styles.addMilestone}>
                    <TextInput
                      value={milestoneTitle}
                      accessibilityLabel="Milestone"
                      onChangeText={setMilestoneTitle}
                      placeholder={
                        editingMilestone ? "Milestone" : "Add a milestone"
                      }
                      placeholderTextColor={theme.muted}
                      returnKeyType="done"
                      onSubmitEditing={submitMilestone}
                      style={[
                        styles.milestoneInput,
                        { backgroundColor: theme.surface, color: theme.ink },
                      ]}
                    />
                    {/* Only on a measured goal: a threshold with nothing
                        to compare against would be a number that never
                        does anything (ADR-0015 §5).

                        The placeholder is the goal's own unit ("kg",
                        "books") rather than the word "at", which named
                        the grammar of the sentence instead of the thing
                        being typed and left you guessing at the units. */}
                    {goal.metricKind !== null ? (
                      <TextInput
                        value={milestoneTarget}
                        onChangeText={setMilestoneTarget}
                        placeholder={goal.metricUnit ?? "number"}
                        placeholderTextColor={theme.muted}
                        keyboardType="numeric"
                        returnKeyType="done"
                        onSubmitEditing={submitMilestone}
                        accessibilityLabel={`Reading this milestone is reached at${
                          goal.metricUnit ? `, in ${goal.metricUnit}` : ""
                        }`}
                        style={[
                          styles.milestoneTarget,
                          { backgroundColor: theme.surface, color: theme.ink },
                        ]}
                      />
                    ) : null}
                    <Pressable
                      onPress={submitMilestone}
                      accessibilityRole="button"
                      accessibilityLabel={
                        editingMilestone ? "Save milestone" : "Add milestone"
                      }
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.quickAdd,
                        { backgroundColor: `${accent}1f`, opacity: pressed ? 0.5 : 1 },
                      ]}
                    >
                      <AppText variant="headline" color={theme.ink}>
                        {editingMilestone ? "✓" : "+"}
                      </AppText>
                    </Pressable>
                  </View>
                  {editingMilestone ? (
                    <Pressable
                      onPress={cancelEditingMilestone}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.cancelEdit,
                        { opacity: pressed ? 0.5 : 1 },
                      ]}
                    >
                      <AppText variant="caption" color={theme.muted}>
                        Cancel
                      </AppText>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </View>

            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                Tasks
              </AppText>
              {goal.tasks.length === 0 ? (
                <AppText variant="caption" color={theme.muted} style={styles.emptyNote}>
                  Nothing serves this goal yet. A goal is what you want;
                  tasks are what you actually do about it.
                </AppText>
              ) : (
                goal.tasks.map((t) => (
                  <View key={t.id} style={[styles.taskRow, { borderTopColor: theme.hairline }]}>
                    <AppText color={theme.ink} style={styles.grow} numberOfLines={2}>
                      {t.title}
                    </AppText>
                    <AppText color={theme.ink} tabular>
                      {t.pointValue}
                    </AppText>
                  </View>
                ))
              )}

              {/* The way in that never existed: `task.goal_id` has been
                  in the schema since ADR-0002 and no screen ever wrote
                  it, so a goal could only ever be a list of tasks you
                  had already made elsewhere — and nothing told you how.
                  Files into the goal's own unit, so its points come
                  from the same place they always would. */}
              {goal.status === "active" ? (
                <Pressable
                  onPress={() => setAddingTask(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add a task for this goal"
                  style={({ pressed }) => [
                    styles.addTaskRow,
                    { borderColor: theme.hairline, opacity: pressed ? 0.5 : 1 },
                  ]}
                >
                  <AppText variant="label" color={theme.accent}>
                    + Add task
                  </AppText>
                </Pressable>
              ) : null}
            </View>

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
                tasks={goal.tasks}
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

            {datingMilestone ? (
              <PastDaySheet
                visible
                title={datingMilestone.title}
                today={currentLocalDate()}
                accent={accent}
                theme={theme}
                onClose={() => setDatingMilestone(null)}
                onPick={(localDate) => {
                  void finishMilestone(datingMilestone.id, localDate);
                }}
              />
            ) : null}

            <CompleteGoalModal
              visible={completing}
              onClose={() => setCompleting(false)}
              goalTitle={goal.title}
              tasks={goal.tasks}
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
              tasks={goal.tasks}
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
              tasks={goal.tasks}
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
                onClose={() => setAddingTask(false)}
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
                ) => {
                  await addTask(
                    unitIds,
                    title,
                    timesPerWeek,
                    plannedWeekdays,
                    partOfDay,
                    goal.id,
                  );
                  await reload();
                }}
              />
            ) : null}

            {/* Edit or delete one rung. A plain sheet rather than a
                destructive confirm, matching the day record's own
                press-and-hold menu: removing a checkpoint is small, and
                the alternative is two steps on the common case. */}
            <Modal
              visible={milestoneMenu !== null}
              transparent
              statusBarTranslucent
              animationType="fade"
              onRequestClose={() => setMilestoneMenu(null)}
            >
              <Pressable
                style={styles.menuBackdrop}
                onPress={() => setMilestoneMenu(null)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <View
                  style={[
                    styles.menuCard,
                    { backgroundColor: theme.canvas, borderColor: theme.hairline },
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      const target = milestoneMenu;
                      setMilestoneMenu(null);
                      const m = goal.milestones.find((x) => x.id === target?.id);
                      if (m) startEditingMilestone(m);
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <AppText color={theme.ink}>Edit</AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const target = milestoneMenu;
                      setMilestoneMenu(null);
                      if (target) void deleteMilestone(target.id).then(reload);
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <AppText color={theme.danger}>Delete</AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => setMilestoneMenu(null)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <AppText color={theme.muted}>Cancel</AppText>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>

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
                    “{goal.title}” and its milestones go for good. Anything you
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

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  container: { paddingHorizontal: space.screen },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  status: { marginTop: space.xs },
  description: { marginTop: space.md },
  link: { marginTop: space.sm },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.xl,
  },
  section: {
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  emptyNote: { marginTop: space.sm },
  grow: { flex: 1 },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  milestoneDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  addMilestone: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.md,
  },
  milestoneTarget: {
    ...typeScale.body,
    width: 64,
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    textAlign: "center",
  },
  milestoneInput: {
    ...typeScale.body,
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  quickAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelEdit: {
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center",
  },
  /** Bordered, matching the Tasks screen's own add row — one action,
   *  one look, wherever a task can be created. */
  addTaskRow: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space.md,
  },
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
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
