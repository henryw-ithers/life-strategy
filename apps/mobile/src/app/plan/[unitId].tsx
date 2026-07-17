/**
 * Unit detail: the ranked task list for one Strategic Life Unit.
 * Adding a task runs the Beli comparison flow; points re-derive from
 * rank shares on every change (ADR-0003).
 */
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UnitInfoSheet } from "../../components/diagnostic/UnitInfoSheet";
import { AddTaskModal } from "../../components/plan/AddTaskModal";
import { formatFrequency, formatFrequencyShort } from "../../components/plan/frequency";
import { FrequencyPicker } from "../../components/plan/FrequencyPicker";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, hueWash } from "../../components/ui/Backdrop";
import { Button } from "../../components/ui/Button";
import { UNIT_INFO } from "../../content/units";
import {
  addTask,
  archiveTask,
  loadPlan,
  setTaskFrequency,
  type PlanUnit,
} from "../../db/tasks";
import { getTheme } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";

function guidance(weight: number): string {
  if (weight >= 10) return "A unit this size carries 2–3 tasks well.";
  if (weight >= 5) return "A unit this size carries 1–2 tasks well.";
  if (weight >= 3) return "One task suits a unit this size.";
  return "A weekly task suits a unit this size, if any.";
}

export default function UnitPlanScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const [unit, setUnit] = useState<PlanUnit | null>(null);
  const [adding, setAdding] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  /** Frequency never changes points — mutate locally, write behind. */
  const applyFrequency = (taskId: string, times: number) => {
    setUnit((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId ? { ...t, timesPerWeek: times } : t,
            ),
          }
        : prev,
    );
    void setTaskFrequency(taskId, times);
  };

  const reload = useCallback(async () => {
    const plan = await loadPlan();
    const found = plan.areas
      .flatMap((a) => a.units)
      .find((u) => u.id === unitId);
    setUnit(found ?? null);
  }, [unitId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const accent = unit ? (theme.areas[unit.areaId] ?? theme.accent) : theme.accent;

  const confirmArchive = (taskId: string, title: string) => {
    Alert.alert("Remove this task?", `"${title}" will stop appearing. Its points re-share across the rest.`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void archiveTask(taskId).then(reload);
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={hueWash(accent)} />
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
            ‹ Plan
          </AppText>
        </Pressable>

        {unit === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : (
          <>
            <View style={styles.titleRow}>
              <View style={styles.titleGroup}>
                <AppText variant="display" color={theme.ink} style={styles.titleText}>
                  {unit.name}
                </AppText>
                {UNIT_INFO[unit.id] ? (
                  <Pressable
                    onPress={() => setInfoOpen(true)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={`About ${unit.name}`}
                    style={({ pressed }) => [
                      styles.infoButton,
                      { borderColor: theme.hairline, opacity: pressed ? 0.5 : 1 },
                    ]}
                  >
                    <AppText variant="footnote" color={theme.muted} style={styles.infoGlyph}>
                      i
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
              <AppText variant="title" color={accent} tabular>
                {unit.weight ?? 0}
              </AppText>
            </View>
            <AppText variant="caption" color={theme.muted} style={styles.lead}>
              {unit.weight !== null
                ? `${guidance(unit.weight)} Hold a task to remove it.`
                : "This unit isn't scored."}
            </AppText>

            {unit.tasks.length === 0 ? (
              <View style={styles.empty}>
                {UNIT_INFO[unit.id] ? (
                  <AppText color={theme.ink}>
                    {UNIT_INFO[unit.id]!.description}
                  </AppText>
                ) : null}
                <AppText color={theme.muted}>
                  No tasks yet. Give this unit its first one — it takes the
                  whole {unit.weight ?? 0} points until a second task shares
                  them.
                </AppText>
              </View>
            ) : (
              unit.tasks.map((t) => {
                const expanded = expandedTaskId === t.id;
                return (
                  <View key={t.id}>
                    <Pressable
                      onLongPress={() => confirmArchive(t.id, t.title)}
                      delayLongPress={350}
                      accessibilityLabel={`${t.title}, rank ${t.rankInUnit}, ${t.pointValue} points, ${formatFrequency(t.timesPerWeek).toLowerCase()}`}
                      accessibilityHint="Hold to remove"
                      style={[styles.taskRow, { borderTopColor: theme.hairline }]}
                    >
                      <View style={[styles.rankBadge, { backgroundColor: `${accent}1f` }]}>
                        <AppText variant="caption" color={theme.ink} tabular>
                          {t.rankInUnit}
                        </AppText>
                      </View>
                      <AppText color={theme.ink} style={styles.grow} numberOfLines={2}>
                        {t.title}
                      </AppText>
                      <Pressable
                        onPress={() =>
                          setExpandedTaskId(expanded ? null : t.id)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`${formatFrequency(t.timesPerWeek)}. Tap to change.`}
                        accessibilityState={{ expanded }}
                        hitSlop={6}
                        style={[
                          styles.cadenceChip,
                          {
                            borderColor: expanded ? accent : theme.hairline,
                            backgroundColor: expanded ? `${accent}1a` : "transparent",
                          },
                        ]}
                      >
                        <AppText variant="footnote" color={theme.muted}>
                          {formatFrequencyShort(t.timesPerWeek)}
                        </AppText>
                      </Pressable>
                      <AppText color={theme.ink} tabular style={styles.pts}>
                        {t.pointValue}
                      </AppText>
                    </Pressable>
                    {expanded ? (
                      <View style={styles.inlinePicker}>
                        <FrequencyPicker
                          value={t.timesPerWeek}
                          onChange={(times) => applyFrequency(t.id, times)}
                          accent={accent}
                          theme={theme}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}

            {UNIT_INFO[unit.id] ? (
              <UnitInfoSheet
                visible={infoOpen}
                onClose={() => setInfoOpen(false)}
                unitName={unit.name}
                info={UNIT_INFO[unit.id]!}
                accent={accent}
                theme={theme}
              />
            ) : null}

            {unit.includeInScoring ? (
              <View style={styles.addWrap}>
                <Button
                  label="Add task"
                  color={accent}
                  onPress={() => setAdding(true)}
                  theme={theme}
                />
              </View>
            ) : null}

            <AddTaskModal
              visible={adding}
              onClose={() => setAdding(false)}
              existingTasks={unit.tasks.map((t) => ({ id: t.id, title: t.title }))}
              accent={accent}
              theme={theme}
              onCommit={async (title, timesPerWeek, rank) => {
                await addTask(unit.id, title, timesPerWeek, rank);
                await reload();
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
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.md,
  },
  titleGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  titleText: { flexShrink: 1 },
  infoButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  infoGlyph: { fontWeight: "600", fontStyle: "italic", lineHeight: 13 },
  grow: { flex: 1 },
  lead: { marginTop: space.xs, marginBottom: space.lg },
  empty: { marginTop: space.md, maxWidth: 340, gap: space.md },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cadenceChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 3,
  },
  pts: { minWidth: 26, textAlign: "right" },
  addWrap: { marginTop: space.xl },
  inlinePicker: { paddingBottom: space.md },
});
