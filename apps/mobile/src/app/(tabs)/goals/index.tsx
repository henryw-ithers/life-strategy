/**
 * The Life tab: what am I working on, and does it match my priorities?
 * (spec §5.4). A list, and each row opens its own screen:
 *
 * - **Commitments**, with what each holds.
 * - **Your units** by tier, in your order, with Priorities beside the
 *   heading. Each has its task count and a bar of its share of the time
 *   you spent in the last 4 weeks. The bar has **no target** (ADR-0041
 *   §5); weights live on Priorities, so a bar can't read as falling
 *   short. Not now starts closed.
 * - **A unit opens in place** (Henry, 2026-10-25): its tasks, each
 *   opening its edit sheet, and Add task. ⓘ opens the unit's own
 *   screen for its weight, events and what it covers.
 *
 * Achievements open from the top (ADR-0047 §7), and each unit's row
 * carries its highest rank and a streak mark while a run is going.
 * Adding a task or event from the + menu happens on Plan (`openAdd`).
 */
import { addDays } from "@glide/scoring";
import { router, type Href } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import {
  CommitmentSheet,
  type CommitmentSheetMode,
} from "../../../components/commitments/CommitmentSheet";
import { CommitmentsList } from "../../../components/commitments/CommitmentsList";
import { Medal, StreakFlame } from "../../../components/achievements/Medal";
import { tierGroups, type TierGroup } from "../../../components/life/lifeRows";
import { openAdd, TabToolbar } from "../../../components/nav/TabToolbar";
import { AddTaskModal } from "../../../components/plan/AddTaskModal";
import { applyTaskEdit, editableFrom } from "../../../components/plan/applyTaskEdit";
import { taskWhen } from "../../../components/plan/ItemRow";
import { TaskEditSheet } from "../../../components/plan/TaskEditSheet";
import { pickableUnits } from "../../../components/plan/unitSelection";
import { AppText } from "../../../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import { Chevron } from "../../../components/ui/Chevron";
import { Group, GroupDivider } from "../../../components/ui/Group";
import { InfoButton } from "../../../components/ui/InfoButton";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { badgesByUnit, highestRank, loadAchievements, type UnitBadge } from "../../../db/achievements";
import { loadCommitmentsScreen, type CommitmentsScreenData } from "../../../db/commitments";
import { createCommitment } from "../../../db/commitmentWrites";
import { addTask, archiveTask, loadPlan, type PlanData, type PlanTask } from "../../../db/tasks";
import { loadWorkShares } from "../../../db/weeklyPass";
import { useRetained } from "../../../hooks/useRetained";
import { RANK_LABEL } from "../../../lib/achievementCopy";
import { currentLocalDate } from "../../../lib/calendar";
import { recordProblem } from "../../../lib/problemLog";
import { getTheme, type ThemeTokens } from "../../../theme/colors";
import { radius, space } from "../../../theme/tokens";

/** "The last 4 weeks", to today. */
const SHARE_DAYS = 28;

export default function LifeScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [commitments, setCommitments] = useState<CommitmentsScreenData | null>(null);
  const [groups, setGroups] = useState<TierGroup[] | null>(null);
  const [hasPlan, setHasPlan] = useState(true);
  const [notNowOpen, setNotNowOpen] = useState(false);
  const [badges, setBadges] = useState<ReadonlyMap<string, UnitBadge>>(new Map());
  const [earned, setEarned] = useState<{ count: number; top: UnitBadge["rank"] }>({ count: 0, top: null });
  const [sheet, setSheet] = useState<CommitmentSheetMode | null>(null);
  const [sheetShown, sheetGone] = useRetained(sheet);
  const [plan, setPlan] = useState<PlanData | null>(null);
  /** Units opened in place. */
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<PlanTask | null>(null);
  const [editingShown, editingGone] = useRetained(editing);
  /** The unit Add task was tapped in. */
  const [adding, setAdding] = useState<string | null>(null);
  const [addingShown, addingGone] = useRetained(adding);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const reload = useCallback(async () => {
    const today = currentLocalDate();
    const [nextCommitments, plan, shares, achievements] = await Promise.all([
      loadCommitmentsScreen(),
      loadPlan(),
      loadWorkShares(addDays(today, -(SHARE_DAYS - 1)), today),
      // Badges are a nicety: if they can't load, Life goes on without
      // them, and the problem log keeps why.
      loadAchievements().catch((e: unknown) => {
        recordProblem(e, "load");
        return [];
      }),
    ]);
    setCommitments(nextCommitments);
    setBadges(badgesByUnit(achievements));
    setEarned({
      count: achievements.reduce((n, a) => n + a.earned.length, 0),
      top: highestRank(achievements),
    });
    setHasPlan(plan.hasSnapshot);
    setPlan(plan);
    setGroups(tierGroups(plan.areas.flatMap((a) => a.units), shares));
  }, []);
  const { error, retry, save } = useScreenLoad(reload);
  const tasksOf = useMemo(() => {
    const out = new Map<string, PlanTask[]>();
    for (const a of plan?.areas ?? []) {
      for (const u of a.units) out.set(u.id, u.tasks.filter((t) => t.kind !== "event"));
    }
    return out;
  }, [plan]);
  const allUnits = useMemo(() => pickableUnits(plan), [plan]);
  const rowsProps = {
    badges,
    open,
    tasksOf,
    onToggle: toggle,
    onEdit: setEditing,
    onAdd: setAdding,
    theme,
  };

  return (
    <View style={styles.root}>
      {/* The scroll view comes first, so the large title and the tab bar
          follow it; the backdrop goes inside it. */}
      <ScrollView
        style={styles.root}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : commitments === null || groups === null ? (
          <ActivityIndicator color={theme.muted} style={styles.loading} />
        ) : (
          <>
            <Group theme={theme} flush>
              <Pressable
                onPress={() => router.push("/goals/achievements" as Href)}
                accessibilityRole="button"
                accessibilityLabel={`Achievements, ${earned.count} earned`}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Medal rank={earned.top} run={false} theme={theme} />
                <AppText color={theme.ink} style={styles.grow}>
                  Achievements
                </AppText>
                <AppText variant="caption" color={theme.muted}>
                  {earned.count} earned
                </AppText>
                <Chevron color={theme.muted} theme={theme} size={13} />
              </Pressable>
            </Group>

            <View style={styles.unitsHeading}>
              <AppText variant="headline" color={theme.ink} accessibilityRole="header" style={styles.grow}>
                Commitments
              </AppText>
              <InfoButton
                title="Commitments"
                body="Something with set hours, like School, Work or a club. On a day with commitment work, each commitment takes its time that day out of your working hours, and the rest of your life keeps what's left."
                theme={theme}
              />
            </View>
            <CommitmentsList
              commitments={commitments.commitments}
              archived={commitments.archived}
              hue={theme.areas["work-money"] ?? theme.accent}
              theme={theme}
              onOpen={(id) => router.push(`/goals/commitment/${id}` as Href)}
            />
            {commitments.canAddMore ? (
              <Button
                variant="tonal"
                icon="add"
                label="Add a commitment"
                onPress={() => setSheet({ kind: "commitment" })}
                theme={theme}
              />
            ) : (
              // The cap says why rather than showing a dead control.
              <AppText variant="caption" color={theme.muted}>
                Three commitments is the most at once. Archive one to add another.
              </AppText>
            )}

            <View style={styles.unitsHeading}>
              <AppText variant="headline" color={theme.ink} accessibilityRole="header" style={styles.grow}>
                Your units
              </AppText>
              <InfoButton
                title="Your units"
                body="Each bar is that unit's share of the time you spent in the last 4 weeks. Tap a unit for its tasks; the info button opens the unit itself."
                theme={theme}
              />
              <Pressable
                onPress={() => router.push("/priorities" as Href)}
                accessibilityRole="button"
                style={styles.link}
              >
                <AppText variant="caption" color={theme.accent}>
                  Priorities ›
                </AppText>
              </Pressable>
            </View>
            {!hasPlan ? (
              <View style={styles.empty}>
                <AppText color={theme.ink}>
                  Your plan starts with your priorities. Sort what matters into tiers first.
                </AppText>
                <Button label="Set your priorities" onPress={() => router.push("/priorities" as Href)} theme={theme} />
              </View>
            ) : (
              <>
                {groups.map((g) =>
                  g.tier === "notNow" ? (
                    <View key={g.tier}>
                      <Pressable
                        onPress={() => setNotNowOpen((v) => !v)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: notNowOpen }}
                        style={styles.link}
                      >
                        <AppText variant="caption" color={theme.muted}>
                          {notNowOpen ? "▾" : "▸"} Not now ({g.units.length})
                        </AppText>
                      </Pressable>
                      {notNowOpen ? <UnitRows units={g.units} {...rowsProps} /> : null}
                    </View>
                  ) : (
                    <View key={g.tier}>
                      <AppText variant="caption" color={theme.muted} style={styles.tier}>
                        {g.label}
                      </AppText>
                      <UnitRows units={g.units} {...rowsProps} />
                    </View>
                  ),
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <TabToolbar
        onTask={() => openAdd("task")}
        onEvent={() => openAdd("event")}
        onLog={() => openAdd("activity")}
        settings
      />

      {sheetShown !== null ? (
        <CommitmentSheet
          visible={sheet !== null}
          onDismissed={sheetGone}
          mode={sheetShown}
          theme={theme}
          onClose={() => setSheet(null)}
          onSave={async ({ name, usesSubCommitments }) => {
            await createCommitment({ name, usesSubCommitments });
            setSheet(null);
            await reload();
          }}
        />
      ) : null}

      {editingShown ? (
        <TaskEditSheet
          visible={editing !== null}
          onDismissed={editingGone}
          task={editableFrom(editingShown)}
          units={allUnits}
          areaColors={theme.areas}
          accent={theme.accent}
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={(next) => void save(() => applyTaskEdit(editingShown, next))}
          onDelete={() => {
            const t = editingShown;
            setEditing(null);
            void save(() => archiveTask(t.id));
          }}
        />
      ) : null}

      {addingShown !== null ? (
        <AddTaskModal
          visible={adding !== null}
          onClose={() => setAdding(null)}
          onDismissed={addingGone}
          units={allUnits}
          homeUnitId={addingShown}
          areaColors={theme.areas}
          theme={theme}
          onCommit={(title, timesPerWeek, unitIds, plannedWeekdays, partOfDay, oneOff, detail) =>
            void save(() => addTask(unitIds, title, timesPerWeek, plannedWeekdays, partOfDay, oneOff, detail))
          }
        />
      ) : null}
    </View>
  );
}

function UnitRows({
  units,
  badges,
  open,
  tasksOf,
  onToggle,
  onEdit,
  onAdd,
  theme,
}: {
  units: TierGroup["units"];
  badges: ReadonlyMap<string, UnitBadge>;
  open: ReadonlySet<string>;
  tasksOf: ReadonlyMap<string, PlanTask[]>;
  onToggle: (unitId: string) => void;
  onEdit: (task: PlanTask) => void;
  onAdd: (unitId: string) => void;
  theme: ThemeTokens;
}) {
  return (
    <Group theme={theme} flush>
      {units.map((u, i) => {
        const hue = theme.areas[u.areaId] ?? theme.accent;
        const pct = Math.round(u.share * 100);
        const badge = badges.get(u.id);
        const run = badge?.streak ?? null;
        const expanded = open.has(u.id);
        const tasks = tasksOf.get(u.id) ?? [];
        return (
          <View key={u.id}>
            {i > 0 ? <GroupDivider theme={theme} /> : null}
            <View style={styles.row}>
              <Pressable
                onPress={() => onToggle(u.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={[
                  u.name,
                  `${u.tasks} ${u.tasks === 1 ? "task" : "tasks"}`,
                  pct > 0 ? `${pct}% of your time` : null,
                  badge?.rank ? `${RANK_LABEL[badge.rank]} earned` : null,
                  run ? `${run.length} ${run.per === "day" ? "days" : "weeks"} in a row` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
                style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={[styles.dot, { backgroundColor: hue }]} />
                <View style={styles.grow}>
                  <AppText color={theme.ink} numberOfLines={1}>
                    {u.name}
                  </AppText>
                  {/* A share of your time, drawn against the largest. */}
                  <View style={[styles.track, { backgroundColor: theme.fill }]}>
                    <View style={[styles.fill, { width: `${u.bar * 100}%`, backgroundColor: hue }]} />
                  </View>
                </View>
                {run ? (
                  <View style={styles.streak}>
                    <StreakFlame theme={theme} />
                    <AppText variant="caption" color={theme.muted} tabular>
                      {run.length}
                    </AppText>
                  </View>
                ) : null}
                {badge?.rank ? <Medal rank={badge.rank} run={false} theme={theme} size={16} /> : null}
                <AppText variant="caption" color={theme.muted} tabular>
                  {u.tasks}
                </AppText>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={15} color={theme.muted} />
              </Pressable>
              <Pressable
                onPress={() => router.push(`/goals/unit/${u.id}` as Href)}
                accessibilityRole="button"
                accessibilityLabel={`${u.name} details`}
                hitSlop={6}
                style={({ pressed }) => [styles.info, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Ionicons name="information-circle-outline" size={20} color={theme.muted} />
              </Pressable>
            </View>
            {expanded ? (
              <View style={[styles.tasks, { backgroundColor: theme.fill }]}>
                {tasks.map((t, j) => (
                  <Pressable
                    key={t.id}
                    onPress={() => onEdit(t)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.title}, ${taskWhen(t)}`}
                    accessibilityHint="Edits the task"
                    style={({ pressed }) => [
                      styles.taskRow,
                      j > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline } : null,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <AppText color={theme.ink} style={styles.grow} numberOfLines={1}>
                      {t.title}
                    </AppText>
                    <AppText variant="caption" color={theme.muted}>
                      {taskWhen(t)}
                    </AppText>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => onAdd(u.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add a task to ${u.name}`}
                  style={({ pressed }) => [
                    styles.taskRow,
                    tasks.length > 0
                      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline }
                      : null,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons name="add" size={18} color={theme.accent} />
                  <AppText variant="label" color={theme.accent} style={styles.grow}>
                    Add task
                  </AppText>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </Group>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { marginTop: space.xxl },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl, gap: space.sm },
  heading: { paddingTop: space.lg },
  unitsHeading: { flexDirection: "row", alignItems: "center", paddingTop: space.lg },
  tier: { paddingTop: space.md, paddingBottom: space.xs },
  grow: { flex: 1, gap: space.xs },
  link: { minHeight: 44, justifyContent: "center" },
  empty: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", paddingRight: space.sm },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingLeft: space.lg,
    paddingVertical: space.sm,
  },
  info: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  tasks: {
    marginHorizontal: space.md,
    marginBottom: space.md,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  taskRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  streak: { flexDirection: "row", alignItems: "center", gap: 2 },
  track: { height: 4, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 4, borderRadius: radius.pill },
});
