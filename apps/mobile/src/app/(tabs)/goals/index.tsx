/**
 * The Goals screen: every unit's active, paused, and past goals
 * (ADR-0007). Goals sit between a unit and its tasks — optional,
 * temporary, and never scored directly.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

import { AddGoalModal } from "../../../components/goals/AddGoalModal";
import { AppText } from "../../../components/ui/AppText";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { Backdrop, constellation } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import { Group } from "../../../components/ui/Group";
import { ScreenHeader } from "../../../components/ui/ScreenHeader";
import {
  createGoal,
  loadGoals,
  type GoalListItem,
  type GoalsUnit,
} from "../../../db/goals";
import { getTheme } from "../../../theme/colors";
import { space } from "../../../theme/tokens";

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
  const [areas, setAreas] = useState<Awaited<ReturnType<typeof loadGoals>>["areas"] | null>(
    null,
  );
  const [adding, setAdding] = useState(false);
  const [addingTo, setAddingTo] = useState<GoalsUnit | null>(null);
  const [addingToAreaId, setAddingToAreaId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setAreas((await loadGoals()).areas);
  }, []);

  /** Every unit a goal can hang off, flattened for the sheet's picker. */
  const allUnits = useMemo(
    () =>
      (areas ?? []).flatMap((a) =>
        a.units.map((u) => ({ id: u.id, name: u.name, areaId: a.id })),
      ),
    [areas],
  );

  const { error, retry } = useScreenLoad(reload);

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <ScreenHeader title="Goals" theme={theme} />

      {/* Furniture, like the header above it and the add bar on Tasks.
          It is the only way to start a goal in a unit that has none,
          now that the list shows goals rather than every place one
          could go. */}
      {areas !== null ? (
        <View style={styles.addBar}>
          <Button
            variant="tonal"
            icon="add"
            label="Add goal"
            onPress={() => {
              setAdding(true);
              setAddingTo(null);
              setAddingToAreaId(null);
            }}
            theme={theme}
          />
        </View>
      ) : null}

      <ScrollView style={styles.body} contentContainerStyle={styles.container}>
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : areas === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : (
          areas.every((a) => a.units.every((u) => u.goals.length === 0)) ? (
            <View style={styles.empty}>
              <AppText color={theme.ink} style={styles.emptyText}>
                A goal is one thing you are working toward, with an end you
                would recognise.
              </AppText>
              <AppText variant="caption" color={theme.muted} style={styles.emptyText}>
                Tasks are what you do every week. Goals are what they add up
                to.
              </AppText>
            </View>
          ) : (
          areas
            .map((area) => ({
              ...area,
              // Only units that actually hold goals. This screen used to
              // render all eighteen so that every one could carry its own
              // "+", which meant a person with two goals scrolled past
              // sixteen rows of "no goals yet" to find them. The add
              // button moved into the sheet, so the list can be a list of
              // your goals instead of a map of where goals could go.
              units: area.units.filter((u) => u.goals.length > 0),
            }))
            .filter((area) => area.units.length > 0)
            .map((area) => (
            <Group key={area.id} theme={theme}>
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
                        setAdding(true);
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
                      <Ionicons name="add" size={17} color={theme.ink} />
                    </Pressable>
                  </View>

                  {unit.activeGoalCount >= 3 ? (
                    <AppText variant="footnote" color={theme.muted} style={styles.nudge}>
                      {unit.activeGoalCount} active goals in {unit.name}; consider
                      pausing one.
                    </AppText>
                  ) : null}

                  {unit.goals.map((g) => (
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
                  ))}
                </View>
              ))}
            </Group>
          ))
        )
        )}
      </ScrollView>

      {adding ? (
        <AddGoalModal
          visible
          onClose={() => {
            setAdding(false);
            setAddingTo(null);
            setAddingToAreaId(null);
          }}
          accent={theme.areas[addingToAreaId ?? ""] ?? theme.accent}
          theme={theme}
          units={allUnits}
          areaColors={theme.areas}
          homeUnitId={addingTo?.id}
          // Straight to the goal you just made, rather than back to a
          // list where it is one row among many. Everything that makes
          // a goal a goal — milestones, a metric, the tasks that serve
          // it — lives on that screen and nowhere else, so landing on
          // the list left the richest surface in the app undiscovered.
          onCommit={async (unitId, title, description, target, unit) => {
            const newId = await createGoal(
              unitId,
              title,
              description,
              target ?? undefined,
              unit ?? undefined,
            );
            await reload();
            if (newId) router.push(`/goals/${newId}` as Href);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  addBar: { paddingHorizontal: space.screen, paddingBottom: space.sm },
  empty: { marginTop: space.xxxl, gap: space.sm },
  emptyText: { maxWidth: 340 },
  root: { flex: 1, overflow: "hidden" },
  /** Takes the space between the fixed header and the tab bar; the
   *  list scrolls inside it while both stay put. */
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xl },
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
