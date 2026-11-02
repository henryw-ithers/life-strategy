/**
 * The Life tab: what am I working on, and does it match my priorities?
 * (spec §5.4). A list, and each row opens its own screen:
 *
 * - **Commitments**, with what each holds.
 * - **Your units** by tier, in your order: this is where you set your
 *   priorities (ADR-0041 as amended by ADR-0048). Hold a unit and drag
 *   it to another tier or another place in its own; it saves at once.
 *   Hold and let go for its menu: your own weight, or a tier. Each row
 *   has its task count and a bar of its share of the time you spent in
 *   the last 4 weeks. The bar has **no target** (ADR-0041 §5): weights
 *   show only in a unit's sheet, so a bar can't read as falling short.
 *   Not now starts closed.
 * - **A unit opens in place** (Henry, 2026-10-25): its tasks, each
 *   opening its edit sheet, and Add task. ⓘ opens the unit's own
 *   screen for its weight, events and what it covers.
 *
 * Achievements open from the top (ADR-0047 §7), and each unit's row
 * carries its highest rank and a streak mark while a run is going.
 * Adding a task or event from the + menu happens on Plan (`openAdd`).
 */
import { addDays, TIERS } from "@glide/scoring";
import { router, type Href } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import {
  CommitmentSheet,
  type CommitmentSheetMode,
} from "../../../components/commitments/CommitmentSheet";
import { CommitmentsList } from "../../../components/commitments/CommitmentsList";
import { Medal, StreakFlame } from "../../../components/achievements/Medal";
import { tierGroups, type LifeUnitRow, type TierGroup } from "../../../components/life/lifeRows";
import { type Slot } from "../../../components/priorities/board";
import { TIER_LABEL, UnitSheet } from "../../../components/priorities/UnitSheet";
import { DayDrag, DragRow, useDropTarget } from "../../../components/today/DayDrag";
import { showActions } from "../../../components/ui/actionSheet";
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
import { ExpandChevron } from "../../../components/ui/ExpandChevron";
import { Group, GroupDivider } from "../../../components/ui/Group";
import { InfoButton } from "../../../components/ui/InfoButton";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { UndoBar } from "../../../components/ui/UndoBar";
import { badgesByUnit, highestRank, loadAchievements, type UnitBadge } from "../../../db/achievements";
import { loadCommitmentsScreen, type CommitmentsScreenData } from "../../../db/commitments";
import { createCommitment } from "../../../db/commitmentWrites";
import { addTask, archiveTask, loadPlan, type PlanData, type PlanTask } from "../../../db/tasks";
import { loadWorkShares } from "../../../db/weeklyPass";
import { SLOT_LABEL, usePriorityBoard } from "../../../hooks/usePriorityBoard";
import { useRetained } from "../../../hooks/useRetained";
import { useUndoDelete } from "../../../hooks/useUndoDelete";
import { RANK_LABEL } from "../../../lib/achievementCopy";
import { currentLocalDate } from "../../../lib/calendar";
import { recordProblem } from "../../../lib/problemLog";
import { getTheme, type ThemeTokens } from "../../../theme/colors";
import { radius, space } from "../../../theme/tokens";

/** Opening and closing in place (Henry, 2026-10-26): a quick fade as
 *  the rows below slide. Reanimated follows Reduce Motion for these. */
const OPEN = FadeIn.duration(180);
const CLOSE = FadeOut.duration(120);
const MOVE = LinearTransition.duration(200);

/** "The last 4 weeks", to today. */
const SHARE_DAYS = 28;

export default function LifeScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [commitments, setCommitments] = useState<CommitmentsScreenData | null>(null);
  const [groups, setGroups] = useState<TierGroup[] | null>(null);
  /** A unit whose weight and tier are being set. */
  const [weighing, setWeighing] = useState<string | null>(null);
  const [weighingShown, weighingGone] = useRetained(weighing);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  /** After a save, the screen reads everything again. */
  const afterSave = useRef<() => void>(() => undefined);
  const priority = usePriorityBoard(() => afterSave.current());
  const [notNowOpen, setNotNowOpen] = useState(false);
  const [badges, setBadges] = useState<ReadonlyMap<string, UnitBadge>>(new Map());
  const [topRank, setTopRank] = useState<UnitBadge["rank"]>(null);
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
    setTopRank(highestRank(achievements));
    setPlan(plan);
    setGroups(tierGroups(plan.areas.flatMap((a) => a.units), shares));
    await priority.reload();
    // `priority.reload` is stable (a useCallback with no deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { error, retry, save } = useScreenLoad(reload);
  useEffect(() => {
    afterSave.current = () => void retry();
  }, [retry]);
  // A deleted task waits on Undo, as on the unit screen.
  const undo = useUndoDelete(save);
  const tasksOf = useMemo(() => {
    const out = new Map<string, PlanTask[]>();
    for (const a of plan?.areas ?? []) {
      for (const u of a.units) {
        out.set(
          u.id,
          u.tasks.filter((t) => t.kind !== "event" && !undo.hidden.has(t.id)),
        );
      }
    }
    return out;
  }, [plan, undo.hidden]);
  const allUnits = useMemo(() => pickableUnits(plan), [plan]);
  /** Each unit's row, by id, in whatever tier it's in now. */
  const rowOf = useMemo(
    () => new Map((groups ?? []).flatMap((g) => g.units).map((u) => [u.id, u] as const)),
    [groups],
  );
  /** What holding a unit and letting go offers. */
  const unitMenu = (u: LifeUnitRow) => () => {
    const here = priority.placement.find((p) => p.unitId === u.id)?.tier;
    showActions(u.name, [
      // A weight's recommendation settles once every unit has a tier.
      ...(here && here !== "unsorted" && here !== "notNow" && priority.unsorted === 0
        ? [{ label: "Your weight", onPress: () => setWeighing(u.id) }]
        : []),
      ...TIERS.filter((t) => t !== here).map((t) => ({
        label: `Move to ${TIER_LABEL[t]}`,
        onPress: () => priority.moveToEnd(u.id, t),
      })),
    ]);
  };
  const rowsProps = {
    badges,
    open,
    tasksOf,
    onToggle: toggle,
    onEdit: setEditing,
    onAdd: setAdding,
    onHold: unitMenu,
    theme,
  };
  const weighingUnit = weighingShown ? priority.board?.units.find((u) => u.unitId === weighingShown) : undefined;
  const weighingTier = priority.placement.find((p) => p.unitId === weighingShown)?.tier;

  return (
    <View style={styles.root}>
      {/* The scroll view comes first, so the large title and the tab bar
          follow it; the backdrop goes inside it. */}
      <DayDrag
        onDrop={(unitId, _from, to) => priority.move(unitId, to.sectionKey as Slot, to.index)}
        onDraggingChange={setDragging}
        renderGhost={(id) => {
          const u = rowOf.get(id);
          return u ? (
            <View style={styles.ghost}>
              <View style={[styles.dot, { backgroundColor: theme.areas[u.areaId] ?? theme.accent }]} />
              <AppText color={theme.ink}>{u.name}</AppText>
            </View>
          ) : null;
        }}
        scroll={{
          y: () => scrollY.current,
          to: (y) => scroller.current?.scrollTo({ y, animated: false }),
        }}
        theme={theme}
      >
      <ScrollView
        ref={scroller}
        style={styles.root}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
        scrollEnabled={!dragging}
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
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
                accessibilityLabel="Achievements"
                style={({ pressed }) => [styles.achievements, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Medal rank={topRank} run={false} theme={theme} />
                <AppText color={theme.ink} style={styles.grow}>
                  Achievements
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
                body="Your priorities. Drag a unit to another tier, or higher in its own, to give it more of the day; Not now is out of the plan. Hold a unit for your own weight. Each bar is that unit's share of your time over the last 4 weeks."
                theme={theme}
              />
            </View>
            {priority.unsorted > 0 ? (
              <AppText color={theme.muted}>Drag each unit into a tier. Not now is a tier too.</AppText>
            ) : null}
            {priority.unsorted === 0 && priority.live.problem ? (
              <AppText variant="footnote" color={theme.muted}>
                {priority.live.problem}
              </AppText>
            ) : null}
            {priority.slots.map((slot) => (
              <TierSection
                key={slot}
                slot={slot}
                units={priority.placement
                  .filter((p) => p.tier === slot)
                  .map((p) => rowOf.get(p.unitId))
                  .filter((u): u is LifeUnitRow => u !== undefined)}
                collapsed={slot === "notNow" && !notNowOpen}
                onToggleCollapsed={slot === "notNow" ? () => setNotNowOpen((v) => !v) : undefined}
                rowsProps={rowsProps}
                theme={theme}
              />
            ))}
          </>
        )}
      </ScrollView>
      </DayDrag>

      <UndoBar undo={undo} theme={theme} />

      {weighingShown && weighingUnit && weighingTier && weighingTier !== "unsorted" ? (
        <UnitSheet
          key={weighingShown}
          visible={weighing !== null}
          onDismissed={weighingGone}
          unitName={weighingUnit.name}
          tier={weighingTier}
          recommended={priority.live.recommended.get(weighingShown) ?? 0}
          override={priority.overrides.get(weighingShown) ?? null}
          canMoveUp={false}
          canMoveDown={false}
          theme={theme}
          onMove={() => undefined}
          onSave={({ tier, override: own }) => priority.setUnit(weighingShown, tier, own)}
          onClose={() => setWeighing(null)}
        />
      ) : null}

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
            undo.remove({ id: t.id, message: `Deleted “${t.title}”`, run: () => archiveTask(t.id) });
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

/** One tier on Life: its label and its units, a place to drop a unit
 *  whether or not it holds any. Not now folds; dropping on its label
 *  still moves a unit there. */
function TierSection({
  slot,
  units,
  collapsed,
  onToggleCollapsed,
  rowsProps,
  theme,
}: {
  slot: Slot;
  units: LifeUnitRow[];
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  rowsProps: Omit<React.ComponentProps<typeof UnitRows>, "units" | "slot">;
  theme: ThemeTokens;
}) {
  const [over, attach] = useDropTarget(slot, collapsed ? [] : units.map((u) => u.id));
  const label = slot === "notNow" ? `Not now (${units.length})` : SLOT_LABEL[slot];
  return (
    <View
      ref={attach}
      collapsable={false}
      style={over ? [styles.over, { borderColor: theme.accent }] : styles.notOver}
    >
      {onToggleCollapsed ? (
        <Pressable
          onPress={onToggleCollapsed}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
          style={styles.link}
        >
          <View style={styles.toggleRow}>
            <AppText variant="caption" color={theme.muted}>
              {label}
            </AppText>
            <ExpandChevron open={!collapsed} color={theme.muted} size={13} />
          </View>
        </Pressable>
      ) : (
        <AppText variant="caption" color={theme.muted} style={styles.tier}>
          {label}
        </AppText>
      )}
      {collapsed ? null : units.length === 0 ? (
        <View style={[styles.emptyTier, { borderColor: theme.hairline }]}>
          <AppText variant="caption" color={theme.muted}>
            Drag a unit here
          </AppText>
        </View>
      ) : (
        <Animated.View entering={OPEN} exiting={CLOSE}>
          <UnitRows units={units} slot={slot} {...rowsProps} />
        </Animated.View>
      )}
    </View>
  );
}

function UnitRows({
  units,
  slot,
  onHold,
  badges,
  open,
  tasksOf,
  onToggle,
  onEdit,
  onAdd,
  theme,
}: {
  units: TierGroup["units"];
  /** The tier they're in, for the drag. */
  slot: Slot;
  /** Holding a unit and letting go: its menu. */
  onHold: (u: LifeUnitRow) => () => void;
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
          // Rows below an opening unit slide down rather than jump.
          <Animated.View key={u.id} layout={MOVE}>
            {i > 0 ? <GroupDivider theme={theme} /> : null}
            <DragRow id={u.id} sectionKey={slot} enabled onHold={onHold(u)}>
            <View style={styles.row}>
              <Pressable
                onPress={() => onToggle(u.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                // Dragging can't be done with VoiceOver: the same menu a
                // hold opens is an action here (WCAG 2.2 SC 2.5.7).
                accessibilityActions={[{ name: "menu", label: "Tier and weight" }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === "menu") onHold(u)();
                }}
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
                  <AppText color={theme.ink} numberOfLines={2}>
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
                <ExpandChevron open={expanded} color={theme.muted} />
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
            </DragRow>
            {expanded ? (
              <Animated.View
                entering={OPEN}
                exiting={CLOSE}
                layout={MOVE}
                style={[styles.tasks, { backgroundColor: theme.fill }]}
              >
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
              </Animated.View>
            ) : null}
          </Animated.View>
        );
      })}
    </Group>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { marginTop: space.xxl },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl, gap: space.sm },
  unitsHeading: { flexDirection: "row", alignItems: "center", paddingTop: space.lg },
  tier: { paddingTop: space.md, paddingBottom: space.xs },
  grow: { flex: 1, gap: space.xs },
  link: { minHeight: 44, justifyContent: "center" },
  empty: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", paddingRight: space.sm },
  /** A settings-style row: 52pt, like the rows in Settings. */
  achievements: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52 },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingLeft: space.lg,
    paddingVertical: space.sm,
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space.xs },
  /** A tier being dragged over, outlined; the same space when not, so
   *  nothing shifts as a drag passes. */
  over: { borderWidth: 1.5, borderRadius: radius.md, margin: -1.5 },
  notOver: {},
  emptyTier: {
    minHeight: 52,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
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
