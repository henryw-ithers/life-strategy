/**
 * A unit's own screen (spec §5.4.2), from its row on Life. The header
 * says its colour, name, tier and weight. Below: its tasks in your
 * order (drag to reorder, which sets how the unit's weight is split),
 * its events, "Need ideas?", and what the unit covers.
 *
 * Only custom units can be renamed, and that's on the unit's own
 * Priorities row; the 18 keep their names. Its highest achievement rank
 * and any run going now sit under the header, opening Achievements
 * (ADR-0047 §7).
 */
import { unitProfile } from "@glide/scoring";
import * as Haptics from "expo-haptics";
import { router, Stack, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import { LinearTransition, useReducedMotion } from "react-native-reanimated";

import { Medal, StreakFlame } from "../../../../components/achievements/Medal";
import { UnitInfoSheet } from "../../../../components/diagnostic/UnitInfoSheet";
import { AddTaskModal } from "../../../../components/plan/AddTaskModal";
import { applyTaskEdit, editableFrom } from "../../../../components/plan/applyTaskEdit";
import { EventSheet } from "../../../../components/plan/EventSheet";
import { PlanUnitSection } from "../../../../components/plan/PlanUnitSection";
import { savedOrSaid, saveEventEdit, saveNewEvent } from "../../../../components/plan/saveEvent";
import { SuggestionsSheet } from "../../../../components/plan/SuggestionsSheet";
import { TaskEditSheet } from "../../../../components/plan/TaskEditSheet";
import { pickableUnits } from "../../../../components/plan/unitSelection";
import { AppText } from "../../../../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../../../../components/ui/Backdrop";
import { LoadFailure } from "../../../../components/ui/ScreenLoad";
import { UndoBar } from "../../../../components/ui/UndoBar";
import { UNIT_INFO } from "../../../../content/units";
import { badgesByUnit, loadAchievements, type UnitBadge } from "../../../../db/achievements";
import { addTask, archiveTask, reorderUnitTasks, type PlanTask } from "../../../../db/tasks";
import { usePlanData } from "../../../../hooks/usePlanData";
import { useRetained } from "../../../../hooks/useRetained";
import { useUndoDelete } from "../../../../hooks/useUndoDelete";
import { RANK_LABEL } from "../../../../lib/achievementCopy";
import { recordProblem } from "../../../../lib/problemLog";
import { getTheme } from "../../../../theme/colors";
import { space } from "../../../../theme/tokens";

const TIER_LABEL = { top: "Top", important: "Important", background: "Background", notNow: "Not now" } as const;

export default function UnitScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const reduceMotion = useReducedMotion();
  const layout = reduceMotion ? undefined : LinearTransition.duration(180);
  const { id } = useLocalSearchParams<{ id: string }>();

  const { plan, reload, save, error, retry } = usePlanData();
  const undo = useUndoDelete(save);
  const unit = useMemo(() => {
    const found = plan?.areas.flatMap((a) => a.units).find((u) => u.id === id) ?? null;
    return found ? { ...found, tasks: found.tasks.filter((t) => !undo.hidden.has(t.id)) } : null;
  }, [plan, id, undo.hidden]);
  const allUnits = useMemo(() => pickableUnits(plan), [plan]);
  const hue = theme.areas[unit?.areaId ?? ""] ?? theme.accent;

  const [adding, setAdding] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);
  const [editing, setEditing] = useState<PlanTask | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [info, setInfo] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [badge, setBadge] = useState<UnitBadge | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      // A badge is a nicety: if it can't load, the screen goes on
      // without it, and the problem log keeps why.
      loadAchievements()
        .then((items) => {
          if (live) setBadge(badgesByUnit(items).get(id) ?? null);
        })
        .catch((e: unknown) => {
          recordProblem(e, "load");
          if (live) setBadge(null);
        });
      return () => {
        live = false;
      };
    }, [id]),
  );
  const [dragging, setDragging] = useState(false);
  const [editingShown, editingGone] = useRetained(editing);
  const [addingEventShown, addingEventGone] = useRetained(addingEvent ? true : null);
  // A new row is tinted long enough to find, then fades.
  useEffect(() => {
    if (justAdded === null) return;
    const timer = setTimeout(() => setJustAdded(null), 2600);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const deleteTask = (t: PlanTask) =>
    undo.remove({ id: t.id, message: `Deleted “${t.title}”`, run: () => archiveTask(t.id) });

  const added = async (taskId: string | null) => {
    await reload();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setJustAdded(taskId);
  };

  const title = <Stack.Screen options={{ title: unit?.name ?? "" }} />;

  if (error) {
    return (
      <View style={styles.root}>
        {title}
        <LoadFailure error={error} onRetry={retry} theme={theme} />
      </View>
    );
  }
  if (!unit) {
    return (
      <View style={styles.root}>
        {title}
        {plan === null ? (
          <ActivityIndicator color={theme.muted} style={styles.loading} />
        ) : (
          // Gone since the link was made (a custom unit removed).
          <AppText color={theme.muted} style={styles.gone}>
            This unit isn&apos;t in your list any more.
          </AppText>
        )}
      </View>
    );
  }

  const tier = unit.tier ? TIER_LABEL[unit.tier] : null;
  const unitInfo = UNIT_INFO[unit.id];

  return (
    <View style={styles.root}>
      {title}
      <ScrollView
        style={styles.root}
        scrollEnabled={!dragging}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        <View style={styles.header} accessible accessibilityLabel={headerLabel(unit.name, tier, unit.weight, unit.recommendedWeight)}>
          <View style={[styles.dot, { backgroundColor: hue }]} />
          <AppText variant="caption" color={theme.muted}>
            {[
              tier,
              unit.weight !== null ? `${unit.weight} of the day's 100` : "No weight",
              unit.recommendedWeight !== null ? `recommended ${unit.recommendedWeight}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </AppText>
        </View>

        <Pressable
          onPress={() => router.push("/goals/achievements" as Href)}
          accessibilityRole="button"
          accessibilityLabel={badgeLabel(badge)}
          style={({ pressed }) => [styles.badge, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Medal rank={badge?.rank ?? null} run={false} theme={theme} size={16} />
          <AppText variant="caption" color={theme.muted}>
            {badge?.rank ? `${RANK_LABEL[badge.rank]} earned` : "Achievements"}
          </AppText>
          {badge?.streak ? (
            <>
              <StreakFlame theme={theme} />
              <AppText variant="caption" color={theme.muted}>
                {runText(badge.streak)}
              </AppText>
            </>
          ) : null}
          <AppText variant="caption" color={theme.accent}>
            ›
          </AppText>
        </Pressable>

        <PlanUnitSection
          unit={unit}
          hue={hue}
          justAdded={justAdded}
          onOpenPriorities={() => router.push("/priorities" as Href)}
          onReorder={(ids) => void save(() => reorderUnitTasks(unit.id, ids))}
          onEditTask={setEditing}
          onDeleteTask={deleteTask}
          onAddTask={() => setAdding(true)}
          onAddEvent={() => setAddingEvent(true)}
          onSuggest={() => setSuggesting(true)}
          onDragStateChange={setDragging}
          layout={layout}
          reduceMotion={reduceMotion}
          theme={theme}
        />

        {unitInfo ? (
          <AppText variant="caption" color={theme.accent} onPress={() => setInfo(true)} accessibilityRole="button" style={styles.link}>
            What {unit.name} covers ›
          </AppText>
        ) : null}
      </ScrollView>

      <UndoBar undo={undo} theme={theme} />

      <AddTaskModal
        visible={adding}
        onClose={() => setAdding(false)}
        units={allUnits}
        homeUnitId={unit.id}
        areaColors={theme.areas}
        theme={theme}
        onCommit={(name, timesPerWeek, unitIds, plannedWeekdays, partOfDay, oneOff, detail) =>
          void save(async () => {
            const taskId = await addTask(unitIds, name, timesPerWeek, plannedWeekdays, partOfDay, oneOff, detail);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setJustAdded(taskId);
          })
        }
      />

      {addingEventShown ? (
      <EventSheet
        visible={addingEvent}
        onDismissed={addingEventGone}
        unitName={unit.name}
        accent={hue}
        theme={theme}
        onClose={() => setAddingEvent(false)}
        onSave={async (input, bounds) => {
          let taskId: string | null = null;
          const saved = await savedOrSaid(async () => {
            taskId = await saveNewEvent([unit.id], input, bounds);
            return true;
          });
          if (!saved) return;
          setAddingEvent(false);
          await added(taskId);
        }}
      />
      ) : null}

      {editingShown && editingShown.kind === "event" ? (
        <EventSheet
          visible={editing !== null}
          onDismissed={editingGone}
          initial={{
            title: editingShown.title,
            plannedWeekdays: editingShown.plannedWeekdays,
            oneOffDate: editingShown.oneOffDate,
            startMinute: editingShown.startMinute,
            endMinute: editingShown.endMinute,
            notes: editingShown.description,
            repeatFrom: editingShown.repeatFrom,
            repeatUntil: editingShown.repeatUntil,
          }}
          seriesId={editingShown.id}
          accent={hue}
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={async (input, bounds) => {
            const t = editingShown;
            const saved = await savedOrSaid(() => saveEventEdit({ ...t, notes: t.description }, input, bounds));
            if (saved) setEditing(null);
            retry();
          }}
          onDelete={() => {
            const t = editingShown;
            setEditing(null);
            deleteTask(t);
          }}
        />
      ) : null}

      {editingShown && editingShown.kind !== "event" ? (
        <TaskEditSheet
          visible={editing !== null}
          onDismissed={editingGone}
          task={editableFrom(editingShown)}
          units={allUnits}
          areaColors={theme.areas}
          accent={hue}
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={(next) => void save(() => applyTaskEdit(editingShown, next))}
          onDelete={() => {
            const t = editingShown;
            setEditing(null);
            deleteTask(t);
          }}
        />
      ) : null}

      <SuggestionsSheet
        visible={suggesting}
        unitId={unit.id}
        unitName={unit.name}
        profile={
          // Null before Priorities is first saved: nothing has a tier
          // or a weight yet.
          unit.weight !== null && unit.tier !== null
            ? unitProfile({ tier: unit.tier, weight: unit.weight })
            : null
        }
        existingTaskTitles={unit.tasks.map((t) => t.title)}
        accent={hue}
        theme={theme}
        onClose={() => setSuggesting(false)}
        onAddTask={(t) => {
          setSuggesting(false);
          void save(async () => {
            const taskId = await addTask([unit.id], t.title, t.timesPerWeek, null, null);
            setJustAdded(taskId);
          });
        }}
      />

      {unitInfo ? (
        <UnitInfoSheet
          visible={info}
          onClose={() => setInfo(false)}
          unitName={unit.name}
          info={unitInfo}
          accent={hue}
          theme={theme}
        />
      ) : null}
    </View>
  );
}

function headerLabel(
  name: string,
  tier: string | null,
  weight: number | null,
  recommended: number | null,
): string {
  return [
    name,
    tier ? `${tier} tier` : null,
    weight !== null ? `${weight} of the day's 100` : "no weight",
    recommended !== null ? `your own weight, recommended ${recommended}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function runText(run: NonNullable<UnitBadge["streak"]>): string {
  return `${run.length} ${run.per === "day" ? "days" : "weeks"} in a row`;
}

function badgeLabel(badge: UnitBadge | null): string {
  return [
    "Achievements",
    badge?.rank ? `${RANK_LABEL[badge.rank]} earned` : null,
    badge?.streak ? runText(badge.streak) : null,
  ]
    .filter(Boolean)
    .join(", ");
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 44 },
  root: { flex: 1 },
  loading: { marginTop: space.xxl },
  gone: { marginTop: space.xxl, paddingHorizontal: space.screen, textAlign: "center" },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl, gap: space.md },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 32 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  link: { minHeight: 44, textAlignVertical: "center", paddingTop: space.md },
});
