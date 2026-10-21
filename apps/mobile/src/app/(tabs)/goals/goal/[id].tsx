/**
 * One goal (spec §5.6): its running total, and the tasks it counts.
 *
 * - Progress is a total like "18 / 30 times", with no pace line
 *   (ADR-0008). A streak shows its current run from 7 days, and the 7,
 *   30 and 66-day marks when reached; nothing is said when a run ends.
 * - A times done goal, and a time spent goal counting tasks you chose,
 *   can count more tasks or fewer. A tick counts if its task was linked
 *   when it was made, so changing the list never rewrites progress.
 * - Its ••• has Pause or Resume, Finish (reaching a target invites it,
 *   never does it), Set aside or Revive, and Delete. Finishing makes an
 *   achievement for the month, never a day's grade.
 */
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import { KIND_LABEL, progressText, statusText, streakMarks } from "../../../../components/goals/goalText";
import { AppText } from "../../../../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../../../../components/ui/Backdrop";
import { Group, GroupDivider } from "../../../../components/ui/Group";
import { LoadFailure, useScreenLoad } from "../../../../components/ui/ScreenLoad";
import {
  changeGoalStatus,
  completeGoal,
  deleteGoal,
  linkGoalTask,
  loadGoals,
  loadGoalTaskOptions,
  unlinkGoalTask,
  type GoalSummary,
  type GoalTaskOption,
} from "../../../../db/goals";
import { useLatest } from "../../../../hooks/useLatest";
import { getTheme } from "../../../../theme/colors";
import { space } from "../../../../theme/tokens";

const MONTH = (m: string) =>
  new Date(`${m}-15T12:00:00`).toLocaleDateString("en-AU", { month: "long", year: "numeric" });

export default function GoalScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<GoalSummary | null>(null);
  const [options, setOptions] = useState<GoalTaskOption[]>([]);
  const [gone, setGone] = useState(false);

  const load = useCallback(async () => {
    const found = (await loadGoals()).find((g) => g.id === id) ?? null;
    setGone(found === null);
    setGoal(found);
    if (found) setOptions(await loadGoalTaskOptions(found.unitId));
  }, [id]);
  const { error, retry, save } = useScreenLoad(load);

  const chooses = goal !== null && (goal.kind === "timesDone" || (goal.kind === "timeSpent" && goal.taskIds.length > 0));
  const counted = options.filter((o) => goal?.taskIds.includes(o.id));
  const others = options.filter((o) => o.kind === "task" && !goal?.taskIds.includes(o.id));
  const shown = goal
    ? { kind: goal.kind, status: goal.status, value: goal.value, target: goal.target, reached: goal.reached }
    : null;

  const actions = useLatest({
    pause: () => goal && void save(() => changeGoalStatus(goal.id, goal.status === "paused" ? "resume" : "pause")),
    aside: () => goal && void save(() => changeGoalStatus(goal.id, goal.status === "abandoned" ? "revive" : "abandon")),
    finish: () => goal && void save(() => completeGoal(goal.id)),
    remove: () => {
      if (!goal) return;
      Alert.alert(`Delete ${goal.title}?`, "Its progress goes with it. Anything it already achieved stays in your log.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void save(() => deleteGoal(goal.id), () => router.back()),
        },
      ]);
    },
  });

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: goal?.title ?? "" }} />
      {goal && goal.status !== "completed" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={`Options for ${goal.title}`}>
            {goal.status !== "abandoned" ? (
              <Stack.Toolbar.MenuAction icon={goal.status === "paused" ? "play" : "pause"} onPress={() => actions.current.pause()}>
                {goal.status === "paused" ? "Resume" : "Pause"}
              </Stack.Toolbar.MenuAction>
            ) : null}
            {goal.kind !== "streak" && goal.status === "active" ? (
              <Stack.Toolbar.MenuAction icon="checkmark.circle" onPress={() => actions.current.finish()}>
                Finish
              </Stack.Toolbar.MenuAction>
            ) : null}
            <Stack.Toolbar.MenuAction icon="tray" onPress={() => actions.current.aside()}>
              {goal.status === "abandoned" ? "Revive" : "Set aside"}
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction icon="trash" destructive onPress={() => actions.current.remove()}>
              Delete
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      <ScrollView
        style={styles.root}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : gone ? (
          <AppText color={theme.muted} style={styles.center}>
            This goal isn&apos;t here any more.
          </AppText>
        ) : !goal || !shown ? (
          <ActivityIndicator color={theme.muted} style={styles.loading} />
        ) : (
          <>
            <AppText variant="caption" color={theme.muted}>
              {KIND_LABEL[goal.kind].name}
              {goal.targetDate ? ` · by ${MONTH(goal.targetDate)}` : ""}
            </AppText>
            {progressText(shown) ? (
              <AppText variant="title" color={theme.ink} tabular>
                {progressText(shown)}
              </AppText>
            ) : null}
            {streakMarks(goal.kind === "streak" ? goal.value : null).length > 0 ? (
              <AppText color={theme.ink}>
                {streakMarks(goal.value).map((m) => `${m}-day mark`).join(" · ")} reached
              </AppText>
            ) : null}
            {statusText(shown) ? (
              <AppText variant="caption" color={theme.muted}>
                {statusText(shown)}
              </AppText>
            ) : null}

            {goal.kind === "pointsEarned" ? (
              <AppText variant="caption" color={theme.muted}>
                Counts everything you do here, as a running total.
              </AppText>
            ) : goal.kind === "timeSpent" && goal.taskIds.length === 0 ? (
              <AppText variant="caption" color={theme.muted}>
                Counts every task here, including ones you add later.
              </AppText>
            ) : (
              <Group theme={theme} title={goal.kind === "streak" ? "The task" : "Tasks it counts"} flush>
                {counted.map((o, i) => (
                  <View key={o.id}>
                    {i > 0 ? <GroupDivider theme={theme} /> : null}
                    <View style={styles.row}>
                      <AppText color={theme.ink} style={styles.grow}>
                        {o.title}
                      </AppText>
                      {chooses && counted.length > 1 && goal.status !== "completed" ? (
                        <Pressable
                          onPress={() => void save(() => unlinkGoalTask(goal.id, o.id))}
                          accessibilityRole="button"
                          accessibilityLabel={`Stop counting ${o.title}`}
                          style={styles.link}
                        >
                          <AppText variant="caption" color={theme.accent}>
                            Stop counting
                          </AppText>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </Group>
            )}

            {chooses && others.length > 0 && goal.status !== "completed" ? (
              <Group theme={theme} title="Count another" footnote="From now on. Ticks already made aren't counted after the fact." flush>
                {others.map((o, i) => (
                  <View key={o.id}>
                    {i > 0 ? <GroupDivider theme={theme} /> : null}
                    <Pressable
                      onPress={() => void save(() => linkGoalTask(goal.id, o.id))}
                      accessibilityRole="button"
                      accessibilityLabel={`Count ${o.title}`}
                      style={styles.row}
                    >
                      <AppText color={theme.accent}>＋ {o.title}</AppText>
                    </Pressable>
                  </View>
                ))}
              </Group>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { marginTop: space.xxl },
  center: { marginTop: space.xxl, textAlign: "center" },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl, gap: space.md },
  row: { flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: space.lg, gap: space.md },
  grow: { flex: 1 },
  link: { minHeight: 44, justifyContent: "center" },
});
