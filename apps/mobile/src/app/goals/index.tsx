/**
 * The Goals screen: every unit's active, paused, and past goals
 * (ADR-0007). Goals sit between a unit and its tasks — optional,
 * temporary, and never scored directly.
 */
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddGoalModal } from "../../components/goals/AddGoalModal";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import {
  createGoal,
  loadGoals,
  type GoalListItem,
  type GoalsUnit,
} from "../../db/goals";
import { getTheme } from "../../theme/colors";
import { space } from "../../theme/tokens";

function statusLabel(status: GoalListItem["status"]): string {
  switch (status) {
    case "active":
      return "active";
    case "paused":
      return "paused";
    case "abandoned":
      return "set aside";
    case "revised":
      return "revised";
    case "completed":
      return "complete";
  }
}

export default function GoalsScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const [areas, setAreas] = useState<Awaited<ReturnType<typeof loadGoals>>["areas"] | null>(
    null,
  );
  const [addingTo, setAddingTo] = useState<GoalsUnit | null>(null);
  const [addingToAreaId, setAddingToAreaId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setAreas((await loadGoals()).areas);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl },
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

        <AppText variant="display" color={theme.ink}>
          Goals
        </AppText>
        <AppText color={theme.muted} style={styles.lead}>
          Specific, measurable, temporary — the plans your units are working
          toward.
        </AppText>

        {areas === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : (
          areas.map((area) => (
            <View
              key={area.id}
              style={[styles.group, { borderTopColor: theme.hairline }]}
            >
              <View style={styles.groupHeader}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: theme.areas[area.id] ?? theme.muted },
                  ]}
                />
                <AppText variant="headline" color={theme.ink}>
                  {area.name}
                </AppText>
              </View>
              {area.units.map((unit) => (
                <View key={unit.id} style={styles.unitBlock}>
                  <View style={styles.unitRow}>
                    <AppText color={theme.ink} style={styles.grow} numberOfLines={1}>
                      {unit.name}
                    </AppText>
                    <Pressable
                      onPress={() => {
                        setAddingTo(unit);
                        setAddingToAreaId(area.id);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Add a goal to ${unit.name}`}
                      style={({ pressed }) => [
                        styles.quickAdd,
                        {
                          backgroundColor: `${theme.areas[area.id] ?? theme.muted}1f`,
                          opacity: pressed ? 0.5 : 1,
                        },
                      ]}
                    >
                      <AppText variant="headline" color={theme.ink}>
                        +
                      </AppText>
                    </Pressable>
                  </View>

                  {unit.activeGoalCount >= 3 ? (
                    <AppText variant="footnote" color={theme.muted} style={styles.nudge}>
                      {unit.activeGoalCount} active goals in {unit.name}; consider
                      pausing one.
                    </AppText>
                  ) : null}

                  {unit.goals.length === 0 ? (
                    <AppText variant="caption" color={theme.muted} style={styles.emptyGoal}>
                      no goals yet
                    </AppText>
                  ) : (
                    unit.goals.map((g) => (
                      <Pressable
                        key={g.id}
                        onPress={() => router.push(`/goals/${g.id}` as Href)}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.goalRow,
                          { opacity: pressed ? 0.6 : 1 },
                        ]}
                      >
                        <AppText color={theme.ink} style={styles.grow} numberOfLines={1}>
                          {g.title}
                        </AppText>
                        {g.milestoneCount > 0 ? (
                          <AppText variant="caption" color={theme.muted}>
                            {g.completedMilestoneCount}/{g.milestoneCount}
                          </AppText>
                        ) : null}
                        <AppText
                          variant="caption"
                          color={g.status === "active" ? (theme.areas[area.id] ?? theme.accent) : theme.muted}
                        >
                          {statusLabel(g.status)}
                        </AppText>
                      </Pressable>
                    ))
                  )}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {addingTo ? (
        <AddGoalModal
          visible
          onClose={() => {
            setAddingTo(null);
            setAddingToAreaId(null);
          }}
          accent={theme.areas[addingToAreaId ?? ""] ?? theme.accent}
          theme={theme}
          onCommit={async (title, description) => {
            await createGoal(addingTo.id, title, description);
            await reload();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  container: { paddingHorizontal: space.screen },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  lead: { marginTop: space.xs, marginBottom: space.xl },
  group: {
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm + 2,
    marginBottom: space.xs,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
  unitBlock: { paddingLeft: space.lg + 4, marginTop: space.sm },
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 40,
  },
  quickAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  nudge: { marginTop: space.xs },
  emptyGoal: { marginTop: space.xs, marginBottom: space.xs },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 40,
    paddingLeft: space.md,
  },
});
