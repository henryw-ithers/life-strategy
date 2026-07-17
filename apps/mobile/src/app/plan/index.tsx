/**
 * The Plan screen: your portfolio's units with their weights, and the
 * state of each unit's task plan. The durable home of "do."
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

import { AddTaskModal } from "../../components/plan/AddTaskModal";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { Button } from "../../components/ui/Button";
import { addTask, loadPlan, type PlanData, type PlanUnit } from "../../db/tasks";
import { getTheme } from "../../theme/colors";
import { space } from "../../theme/tokens";

export default function PlanScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [addingTo, setAddingTo] = useState<PlanUnit | null>(null);

  const reload = useCallback(async () => {
    setPlan(await loadPlan());
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
          Plan
        </AppText>
        <AppText color={theme.muted} style={styles.lead}>
          Your 100 points, given things to do.
        </AppText>

        {plan === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : !plan.hasSnapshot ? (
          <View style={styles.empty}>
            <AppText color={theme.ink} style={{ textAlign: "center" }}>
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
              {area.units.map((unit) => {
                const excluded = !unit.includeInScoring;
                return (
                  <Pressable
                    key={unit.id}
                    disabled={excluded}
                    onPress={() => router.push(`/plan/${unit.id}` as Href)}
                    accessibilityRole="button"
                    accessibilityLabel={`${unit.name}, ${unit.weight ?? 0} points, ${unit.tasks.length} tasks`}
                    style={({ pressed }) => [styles.unitRow, { opacity: pressed ? 0.6 : 1 }]}
                  >
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
                        <AppText
                          variant="caption"
                          color={
                            unit.tasks.length === 0 ? theme.muted : theme.ink
                          }
                        >
                          {unit.tasks.length === 0
                            ? "no tasks yet"
                            : `${unit.tasks.length} ${unit.tasks.length === 1 ? "task" : "tasks"}`}
                        </AppText>
                        <AppText color={theme.ink} tabular style={styles.pts}>
                          {unit.weight ?? 0}
                        </AppText>
                        <Pressable
                          onPress={() => setAddingTo(unit)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Add a task to ${unit.name}`}
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
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {addingTo ? (
        <AddTaskModal
          visible
          onClose={() => setAddingTo(null)}
          existingTasks={addingTo.tasks.map((t) => ({ id: t.id, title: t.title }))}
          accent={theme.areas[addingTo.areaId] ?? theme.accent}
          theme={theme}
          onCommit={async (title, timesPerWeek, rank) => {
            await addTask(addingTo.id, title, timesPerWeek, rank);
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
  empty: { gap: space.lg, marginTop: space.xxl },
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
  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
    paddingLeft: space.lg + 4,
  },
  pts: { minWidth: 28, textAlign: "right" },
  quickAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
