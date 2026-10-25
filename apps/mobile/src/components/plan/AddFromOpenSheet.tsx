/**
 * "Add from open" (spec §5.3): every open task the day lists, to pin
 * into one window, grouped by tier (Top, Important, Background) with
 * commitment work in its own group (Henry, 2026-10-25). **New task**
 * at the top writes one and pins it here in the same step.
 *
 * Pinning moves a task here from wherever it was that day; one window
 * per task per day (windows-and-pins.md §2.7). Work planned for a later
 * day can be pinned too, to do it early (ADR-0037 §3).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Tier } from "@glide/scoring";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { pinForDay } from "../../db/pins";
import { addTask, loadPlan, type PlanData } from "../../db/tasks";
import type { TodayTask } from "../../db/today";
import { recordProblem } from "../../lib/problemLog";
import type { ThemeTokens } from "../../theme/colors";
import { cardStyle } from "../../theme/surfaces";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";
import { AddTaskModal } from "./AddTaskModal";
import { formatFrequencyShort } from "./frequency";
import { pickableUnits } from "./unitSelection";

interface AddFromOpenSheetProps {
  visible: boolean;
  /** "09:00–11:00". */
  windowLabel: string;
  /** The day and window a new task is pinned into. */
  date: string;
  windowStart: number;
  tasks: readonly TodayTask[];
  hueFor: (t: TodayTask) => string;
  theme: ThemeTokens;
  onClose: () => void;
  onDismissed?: () => void;
  onPick: (task: TodayTask) => void;
  /** After New task has written and pinned one. */
  onAdded: () => void;
}

type GroupKey = Tier | "commitments" | "other";

const GROUPS: readonly { key: GroupKey; label: string }[] = [
  { key: "top", label: "Top" },
  { key: "important", label: "Important" },
  { key: "background", label: "Background" },
  { key: "commitments", label: "Commitments" },
  { key: "other", label: "Other" },
];

export function AddFromOpenSheet({
  visible,
  windowLabel,
  date,
  windowStart,
  tasks,
  hueFor,
  theme,
  onClose,
  onDismissed,
  onPick,
  onAdded,
}: AddFromOpenSheetProps) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  /** New task is open in place of the list. */
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    if (!visible || plan !== null) return;
    let cancelled = false;
    void loadPlan()
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch((e: unknown) => recordProblem(e instanceof Error ? e : new Error(String(e)), "load"));
    return () => {
      cancelled = true;
    };
  }, [visible, plan]);

  const tierOf = useMemo(() => {
    const out = new Map<string, Tier>();
    for (const a of plan?.areas ?? []) for (const u of a.units) if (u.tier) out.set(u.id, u.tier);
    return out;
  }, [plan]);

  const grouped = useMemo(() => {
    const by = new Map<GroupKey, TodayTask[]>();
    for (const t of tasks) {
      const key: GroupKey = t.commitment ? "commitments" : (tierOf.get(t.unitId) ?? "other");
      by.set(key, [...(by.get(key) ?? []), t]);
    }
    return GROUPS.flatMap((g) => {
      const list = by.get(g.key) ?? [];
      return list.length > 0 ? [{ ...g, list }] : [];
    });
  }, [tasks, tierOf]);

  return (
    <>
      <NativeSheet
        visible={visible && !writing}
        onClose={onClose}
        onDismissed={writing ? undefined : onDismissed}
        title={`Add to ${windowLabel}`}
        size="large"
        scroll
      >
        <Pressable
          onPress={() => setWriting(true)}
          accessibilityRole="button"
          accessibilityHint="Writes a task and pins it to this window"
          style={({ pressed }) => [
            styles.newTask,
            { backgroundColor: theme.fill, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="add-circle" size={22} color={theme.accent} />
          <AppText variant="label" color={theme.accent}>
            New task
          </AppText>
        </Pressable>

        {tasks.length === 0 ? (
          <AppText color={theme.muted} style={styles.empty}>
            Everything open is already here.
          </AppText>
        ) : (
          grouped.map((g) => (
            <View key={g.key} style={styles.group}>
              <AppText variant="caption" color={theme.muted} style={styles.groupLabel}>
                {g.label.toUpperCase()}
              </AppText>
              <View style={[cardStyle(theme), styles.card]}>
                {g.list.map((t, i) => (
                  <Pressable
                    key={t.id}
                    onPress={() => onPick(t)}
                    accessibilityRole="button"
                    accessibilityLabel={t.title}
                    accessibilityHint="Pins it to this window"
                    style={({ pressed }) => [
                      styles.row,
                      i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline } : null,
                      { opacity: pressed ? 0.5 : 1 },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: hueFor(t) }]} />
                    <AppText variant="body" color={theme.ink} style={styles.grow} numberOfLines={1}>
                      {t.title}
                    </AppText>
                    {t.oneOffSize === null ? (
                      <AppText variant="footnote" color={theme.muted} tabular>
                        {formatFrequencyShort(t.timesPerWeek)}
                      </AppText>
                    ) : null}
                    <Ionicons name="add" size={20} color={theme.accent} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </NativeSheet>

      {writing ? (
        <AddTaskModal
          visible={visible && writing}
          onClose={() => {
            setWriting(false);
            onClose();
          }}
          onDismissed={onDismissed}
          units={pickableUnits(plan)}
          areaColors={theme.areas}
          theme={theme}
          onCommit={async (title, timesPerWeek, unitIds, plannedWeekdays, partOfDay, oneOff, detail) => {
            try {
              const id = await addTask(unitIds, title, timesPerWeek, plannedWeekdays, partOfDay, oneOff, detail);
              if (id) await pinForDay(id, date, windowStart, "window");
            } catch (e) {
              recordProblem(e instanceof Error ? e : new Error(String(e)), "save");
              Alert.alert("That task wasn't added", e instanceof Error ? e.message : String(e));
            }
            onAdded();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  newTask: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: 14,
  },
  empty: { marginTop: space.md },
  group: { gap: space.xs, marginTop: space.lg },
  groupLabel: { paddingHorizontal: space.xs, letterSpacing: 0.6 },
  card: { paddingHorizontal: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
});
