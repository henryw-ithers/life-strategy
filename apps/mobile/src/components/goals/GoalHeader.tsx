/**
 * The top of a goal's screen: its unit, title, status and description,
 * links to the goals it came from or continues in, and the one action
 * that belongs beside the goal for its current state.
 */
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { GoalDetail } from "../../db/goals";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

/** Footnote text is far short of a 44pt target; the slop makes up the
 *  height without moving anything on screen. */
const LINK_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

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

export function GoalHeader({
  goal,
  accent,
  onComplete,
  onResume,
  onRevive,
  theme,
}: {
  goal: GoalDetail;
  accent: string;
  onComplete: () => void;
  onResume: () => void;
  onRevive: () => void;
  theme: ThemeTokens;
}) {
  /** Finishing is the goal's own ending, not an administrative act on
   *  it, so it sits here rather than under Manage; so do the ways back
   *  from a pause or a setting-aside. */
  const primary =
    goal.status === "active"
      ? { label: "Complete this goal", onPress: onComplete }
      : goal.status === "paused"
        ? { label: "Resume", onPress: onResume }
        : goal.status === "abandoned"
          ? { label: "Revive", onPress: onRevive }
          : null;

  return (
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
          hitSlop={LINK_SLOP}
        >
          <AppText variant="footnote" color={theme.muted} style={styles.link}>
            {goal.linkKind === "follow_up" ? "Follows on from" : "Revised from"} an earlier goal
          </AppText>
        </Pressable>
      ) : null}
      {goal.successorGoalId ? (
        <Pressable
          onPress={() => router.push(`/goals/${goal.successorGoalId}` as Href)}
          accessibilityRole="button"
          hitSlop={LINK_SLOP}
        >
          <AppText variant="footnote" color={theme.muted} style={styles.link}>
            Continued in a newer goal
          </AppText>
        </Pressable>
      ) : null}

      {primary ? (
        <View style={styles.primary}>
          <Button label={primary.label} color={accent} onPress={primary.onPress} theme={theme} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  status: { marginTop: space.xs },
  description: { marginTop: space.md },
  link: { marginTop: space.sm },
  primary: { marginTop: space.xl },
});
