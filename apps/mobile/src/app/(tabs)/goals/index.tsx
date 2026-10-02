/**
 * The Goals screen, in two halves: **Goals** and **Commitments**.
 *
 * Goals sit between a unit and its tasks (ADR-0007) — optional,
 * temporary, never scored directly. Commitments are the other kind of
 * thing you are in the middle of: a course, a job, a team, with a
 * schedule and its own share of a scheduled day (ADR-0035).
 *
 * They share a tab because they are the same question asked twice —
 * *what am I currently committed to* — and because the tab bar is the
 * most expensive space in the app and neither half earns a sixth
 * destination on its own. A segmented control rather than two screens:
 * the two lists are peers, and switching between peers is what a
 * segment is for.
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
import { BandSheet } from "../../../components/commitments/BandSheet";
import {
  CommitmentSheet,
  type CommitmentSheetMode,
} from "../../../components/commitments/CommitmentSheet";
import { CommitmentsList } from "../../../components/commitments/CommitmentsList";
import { Segmented } from "../../../components/plan/Segmented";
import { AppText } from "../../../components/ui/AppText";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { Backdrop, constellation } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import { Group } from "../../../components/ui/Group";
import { ScreenHeader } from "../../../components/ui/ScreenHeader";
import {
  loadCommitmentsScreen,
  type CommitmentsScreenData,
} from "../../../db/commitments";
import { createCommitment } from "../../../db/commitmentWrites";
import {
  createGoal,
  loadGoals,
  type GoalListItem,
  type GoalsUnit,
} from "../../../db/goals";
import { setCommitmentBand, clearCommitmentBand } from "../../../db/settings";
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
  const [tab, setTab] = useState<"goals" | "commitments">("goals");
  const [commitments, setCommitments] = useState<CommitmentsScreenData | null>(
    null,
  );
  const [bandOpen, setBandOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<CommitmentSheetMode | null>(null);

  const reload = useCallback(async () => {
    const [goals, screen] = await Promise.all([
      loadGoals(),
      loadCommitmentsScreen(),
    ]);
    setAreas(goals.areas);
    setCommitments(screen);
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

      <View style={styles.segment}>
        <Segmented
          segments={[
            { value: "goals" as const, label: "Goals" },
            { value: "commitments" as const, label: "Commitments" },
          ]}
          value={tab}
          onChange={setTab}
          accent={theme.accent}
          theme={theme}
          label="What to show"
        />
      </View>

      {/* Furniture, like the header above it and the add bar on Tasks.
          It is the only way to start a goal in a unit that has none,
          now that the list shows goals rather than every place one
          could go. */}
      {areas !== null ? (
        <View style={styles.addBar}>
          {tab === "goals" ? (
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
          ) : commitments?.canAddMore === true ? (
            <Button
              variant="tonal"
              icon="add"
              label="Add commitment"
              onPress={() => setSheetMode({ kind: "commitment" })}
              theme={theme}
            />
          ) : (
            /* The cap says why rather than showing a dead control.
               A disabled button with no explanation is the version of
               this that makes people tap twice and give up. */
            <AppText variant="caption" color={theme.muted}>
              Three commitments is the most at once. Finish one to add
              another.
            </AppText>
          )}
        </View>
      ) : null}

      <ScrollView style={styles.body} contentContainerStyle={styles.container}>
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : areas === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : tab === "commitments" ? (
          commitments === null ? null : (
            <CommitmentsList
              band={commitments.band}
              commitments={commitments.commitments}
              archived={commitments.archived}
              hue={theme.areas["work-money"] ?? theme.accent}
              theme={theme}
              onOpenBand={() => setBandOpen(true)}
              onOpen={(id) =>
                router.push(`/goals/commitment/${id}` as Href)
              }
            />
          )
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
                        {/* What is actually behind the goal. It used to
                            read "2/5" of milestones, which was 0/0 on
                            most goals and, after ADR-0030, counts a
                            concept that no longer exists — conditions
                            run in parallel and never complete, so there
                            is no fraction to show. */}
                        {g.taskCount > 0 ? (
                          <AppText variant="caption" color={theme.muted} tabular>
                            {g.taskCount} {g.taskCount === 1 ? "task" : "tasks"}
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

      {bandOpen ? (
        <BandSheet
          visible
          band={commitments?.band ?? null}
          commitments={commitments?.commitments.length ?? 0}
          theme={theme}
          onClose={() => setBandOpen(false)}
          onSave={async (band) => {
            if (band === null) await clearCommitmentBand();
            else await setCommitmentBand(band);
            setBandOpen(false);
            await reload();
          }}
        />
      ) : null}

      {sheetMode !== null ? (
        <CommitmentSheet
          visible
          mode={sheetMode}
          others={(commitments?.commitments ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            percent: c.sharePercent,
          }))}
          theme={theme}
          onClose={() => setSheetMode(null)}
          onSave={async ({ name, percent }) => {
            await createCommitment({ name, percent });
            setSheetMode(null);
            await reload();
          }}
        />
      ) : null}

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
          // a goal a goal — conditions, a metric, the tasks that serve
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
  segment: {
    paddingHorizontal: space.screen,
    paddingBottom: space.md,
  },
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
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 40,
    paddingLeft: space.md,
  },
});
