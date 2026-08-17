/**
 * Goal detail: status, milestones, and the tasks currently serving
 * this goal. Actions here drive the ADR-0007 state machine — pause,
 * resume, abandon (revivable), revise (spawns a linked successor),
 * and the three-path completion flow.
 */
import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { ReviseGoalModal } from "../../../components/goals/ReviseGoalModal";
import { AppText } from "../../../components/ui/AppText";
import { Backdrop, hueWash } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import {
  abandonGoal,
  addGoalProgress,
  addMilestone,
  completeGoal,
  completeMilestone,
  deleteGoalProgress,
  loadGoalDetail,
  pauseGoal,
  reviseGoal,
  reviveGoal,
  resumeGoal,
  setGoalMetric,
  setGoalTargetDate,
  type GoalDetail,
} from "../../../db/goals";
import { currentLocalDate } from "../../../db/today";
import { getTheme } from "../../../theme/colors";
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

  const reload = useCallback(async () => {
    setGoal(await loadGoalDetail(goalId));
  }, [goalId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const accent = goal ? theme.areas[goal.areaId] ?? theme.accent : theme.accent;

  const onMilestonePress = async (milestoneId: string) => {
    const { goalShouldComplete } = await completeMilestone(milestoneId);
    if (goalShouldComplete) {
      setCompleting(true);
    } else {
      await reload();
    }
  };

  const submitMilestone = async () => {
    const title = milestoneTitle.trim();
    if (title.length === 0 || !goal) return;
    setMilestoneTitle("");
    await addMilestone(goal.id, title);
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

        {goal === null ? (
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
                  earlier goal ›
                </AppText>
              </Pressable>
            ) : null}
            {goal.successorGoalId ? (
              <Pressable
                onPress={() => router.push(`/goals/${goal.successorGoalId}` as Href)}
                accessibilityRole="button"
              >
                <AppText variant="footnote" color={theme.muted} style={styles.link}>
                  Continued in a newer goal ›
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
            </View>

            {goal.metricKind !== null && goal.targetValue !== null ? (
              <GoalMetricPanel
                kind={goal.metricKind}
                unit={goal.metricUnit}
                targetValue={goal.targetValue}
                targetDate={goal.targetDate}
                entries={goal.progress}
                editable={goal.status === "active"}
                accent={accent}
                theme={theme}
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
                    disabled={m.status !== "current" || goal.status !== "active"}
                    onPress={() => void onMilestonePress(m.id)}
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
                    <AppText
                      color={m.status === "completed" ? theme.muted : theme.ink}
                      style={styles.grow}
                      numberOfLines={2}
                    >
                      {m.title}
                    </AppText>
                    {m.status === "current" && goal.status === "active" ? (
                      <AppText variant="footnote" color={theme.muted}>
                        tap to complete
                      </AppText>
                    ) : null}
                  </Pressable>
                ))
              )}

              {goal.status === "active" ? (
                <View style={styles.addMilestone}>
                  <TextInput
                    value={milestoneTitle}
                    onChangeText={setMilestoneTitle}
                    placeholder="Add a milestone"
                    placeholderTextColor={theme.muted}
                    returnKeyType="done"
                    onSubmitEditing={submitMilestone}
                    style={[
                      styles.milestoneInput,
                      { backgroundColor: theme.surface, color: theme.ink },
                    ]}
                  />
                  <Pressable
                    onPress={submitMilestone}
                    accessibilityRole="button"
                    accessibilityLabel="Add milestone"
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.quickAdd,
                      { backgroundColor: `${accent}1f`, opacity: pressed ? 0.5 : 1 },
                    ]}
                  >
                    <AppText variant="headline" color={theme.ink}>
                      +
                    </AppText>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={[styles.section, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink}>
                Tasks
              </AppText>
              {goal.tasks.length === 0 ? (
                <AppText variant="caption" color={theme.muted} style={styles.emptyNote}>
                  No tasks are attached to this goal.
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
                accent={accent}
                theme={theme}
                onClose={() => setEditingMetric(false)}
                onSave={(metric, targetDate) => {
                  void Promise.all([
                    setGoalMetric(goal.id, metric),
                    setGoalTargetDate(goal.id, targetDate),
                  ]).then(reload);
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
