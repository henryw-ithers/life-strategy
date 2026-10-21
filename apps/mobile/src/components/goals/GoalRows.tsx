/**
 * Goals as rows (spec §5.4, §5.6): each with its running total, opening
 * its own screen. Finished and set-aside goals aren't listed here; they
 * stay on their own screens and in the month's summary.
 */
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { GoalSummary } from "../../db/goals";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Chevron } from "../ui/Chevron";
import { Group, GroupDivider } from "../ui/Group";
import { progressText, statusText } from "./goalText";

/** The goals worth a row: active and paused ones. */
export const listedGoals = (goals: readonly GoalSummary[]) =>
  goals.filter((g) => g.status === "active" || g.status === "paused");

export function GoalRows({
  goals,
  onAdd,
  addLabel = "Add a goal",
  theme,
}: {
  goals: readonly GoalSummary[];
  onAdd?: () => void;
  addLabel?: string;
  theme: ThemeTokens;
}) {
  const rows = listedGoals(goals);
  if (rows.length === 0 && !onAdd) return null;
  return (
    <Group theme={theme} flush>
      {rows.map((g, i) => {
        const shown = { kind: g.kind, status: g.status, value: g.value, target: g.target, reached: g.reached };
        const progress = progressText(shown);
        const status = statusText(shown);
        return (
          <View key={g.id}>
            {i > 0 ? <GroupDivider theme={theme} /> : null}
            <Pressable
              onPress={() => router.push(`/goals/goal/${g.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={[g.title, progress, status].filter(Boolean).join(", ")}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={styles.grow}>
                <AppText color={theme.ink} numberOfLines={2}>
                  {g.title}
                </AppText>
                {status ? (
                  <AppText variant="footnote" color={theme.muted}>
                    {status}
                  </AppText>
                ) : null}
              </View>
              {progress ? (
                <AppText variant="caption" color={theme.muted} tabular>
                  {progress}
                </AppText>
              ) : null}
              <Chevron color={theme.muted} theme={theme} size={13} />
            </Pressable>
          </View>
        );
      })}
      {onAdd ? (
        <>
          {rows.length > 0 ? <GroupDivider theme={theme} /> : null}
          <Pressable onPress={onAdd} accessibilityRole="button" style={styles.row}>
            <AppText color={theme.accent}>＋ {addLabel}</AppText>
          </Pressable>
        </>
      ) : null}
    </Group>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingHorizontal: space.lg, paddingVertical: space.sm },
  grow: { flex: 1 },
});
