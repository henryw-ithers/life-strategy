/**
 * One section of Home's day (spec §5.1, ADR-0048): a window, or a part
 * of the day. Today's windows are for getting things done, so a row is
 * ticked, swapped or dragged somewhere else.
 *
 * - **It never disappears.** A window that's over keeps its tasks, to
 *   tick tonight; it starts open while it holds any and folds once
 *   they're done. A later one starts folded to "3 tasks". Tap the
 *   header to open or close any of them.
 * - The open window says how long it has left, in plain words.
 * - Hold a task and drag it here, folded or not, to move it here for
 *   today; drag it within to change your order.
 * - When it's full: "That's this window" and "Pull in another". No
 *   celebration for doing planned work.
 * - A window's ••• has Edit times and Remove (spec §3.5).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatMinutes, type TimeRange } from "@glide/scoring";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

import type { TodayTask } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { cardStyle } from "../../theme/surfaces";
import { space } from "../../theme/tokens";
import { reasonLabel, spanLabel, spokenSpan } from "../plan/dayView";
import { showActions } from "../ui/actionSheet";
import { AppText } from "../ui/AppText";
import { DragRow, useDropTarget } from "./DayDrag";
import { foldedLabel, PART_LABEL, type HomeSection, type SectionRow, type TimedRow } from "./homeSections";
import { timeLeft, type WindowState } from "./homeDay";

export interface RowExtra {
  reason?: string;
  onSwap?: () => void;
  /** The window the row sits in, so a tick is filed there. */
  windowStart: number | null;
  /** In a `DragRow`, which owns the hold. */
  dragged: boolean;
}

interface HomeSectionCardProps {
  section: HomeSection;
  state: WindowState;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** The minute it is now, on today. */
  now: number | null;
  tasks: ReadonlyMap<string, TodayTask>;
  renderRow: (task: TodayTask, extra: RowExtra) => React.ReactNode;
  /** What holding a row and letting go does: its menu. */
  holdFor: (task: TodayTask, windowStart: number | null) => (() => void) | undefined;
  canDrag: (task: TodayTask) => boolean;
  onSwap: (taskId: string) => void;
  onPullIn: () => void;
  onAddFromOpen: () => void;
  onEditTimes: () => void;
  onRemove: () => void;
  editable: boolean;
  reduceMotion: boolean;
  theme: ThemeTokens;
}

export function HomeSectionCard({
  section,
  state,
  expanded,
  onToggleExpanded,
  now,
  tasks,
  renderRow,
  holdFor,
  canDrag,
  onSwap,
  onPullIn,
  onAddFromOpen,
  onEditTimes,
  onRemove,
  editable,
  reduceMotion,
  theme,
}: HomeSectionCardProps) {
  const open = state === "open";
  const [showAll, setShowAll] = useState(false);
  const isWindow = section.kind === "window";
  const range: TimeRange | null = isWindow ? section.window.range : section.range;
  const windowStart = isWindow ? section.window.range.start : null;
  const title = isWindow ? spanLabel(section.window.range) : PART_LABEL[section.part];
  const spoken = isWindow ? `window ${spokenSpan(section.window.range)}` : PART_LABEL[section.part];
  // "Now" only inside it; the window you're waiting for is "Next".
  const inside = open && (now === null || range === null || now >= range.start);
  const lead = open ? (inside ? "NOW · " : "NEXT · ") : "";
  const past = state === "past";
  // A window that's over says so, in the same quiet words as Plan.
  const right = expanded
    ? inside && now !== null && range
      ? timeLeft(range, now)
      : past
        ? "Over"
        : ""
    : foldedLabel(section, state) || (past ? "Over" : "");
  const overflow = isWindow ? section.overflow : [];
  const shownRows = showAll ? [...section.rows, ...overflow] : section.rows;
  const [over, attach] = useDropTarget(section.key, shownRows.map((r) => r.taskId));
  // Edit times and Remove are for windows on a day you can still change.
  const editableWindow = editable && isWindow;

  const header = (
    <Pressable
      onPress={onToggleExpanded}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${open ? (inside ? "Now, " : "Next, ") : ""}${spoken}${right ? `, ${right}` : ""}`}
      style={styles.header}
    >
      <AppText variant="label" color={open ? theme.accent : past ? theme.muted : theme.ink} tabular style={styles.grow}>
        {lead}
        {title}
      </AppText>
      {right ? (
        <AppText variant="caption" color={theme.muted} tabular>
          {right}
        </AppText>
      ) : null}
      <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={theme.muted} />
    </Pressable>
  );

  const row = (r: SectionRow) => {
    const t = tasks.get(r.taskId);
    if (!t) return null;
    const reason =
      r.reason === undefined
        ? undefined
        : r.reason === "stillOpen"
          ? "Still open"
          : r.reason === "extra"
            ? "Extra"
            : reasonLabel(r.reason);
    return (
      <Animated.View key={r.taskId} layout={reduceMotion ? undefined : LinearTransition.duration(220)}>
        <DragRow id={r.taskId} sectionKey={section.key} enabled={editable && canDrag(t)} onHold={holdFor(t, windowStart)}>
          {renderRow(t, {
            reason,
            onSwap: r.swappable && editable ? () => onSwap(r.taskId) : undefined,
            windowStart,
            dragged: true,
          })}
        </DragRow>
      </Animated.View>
    );
  };

  // Events and timed tasks stay at their time: above the rows, not
  // dragged, and held for their own menu.
  const timedRow = (r: TimedRow) => {
    const t = tasks.get(r.taskId);
    if (!t) return null;
    return (
      <View key={`at-${r.taskId}`}>
        {renderRow(t, { reason: r.event ? undefined : `At ${formatMinutes(r.start)}`, windowStart: null, dragged: false })}
      </View>
    );
  };
  const timed = section.kind === "part" ? section.timed : [];

  return (
    <View
      ref={attach}
      collapsable={false}
      style={[
        cardStyle(theme),
        styles.card,
        // The current window, and a section a task is being dragged
        // over, are outlined in the accent.
        open || over ? { borderWidth: 1.5, borderColor: theme.accent } : null,
      ]}
    >
      {editableWindow ? (
        <View style={styles.headerRow}>
          <View style={styles.grow}>{header}</View>
          <Pressable
            onPress={() =>
              showActions(`Window ${title}`, [
                { label: "Edit times", onPress: onEditTimes },
                { label: "Remove", destructive: true, onPress: onRemove },
              ])
            }
            accessibilityRole="button"
            accessibilityLabel={`More for ${spoken}`}
            hitSlop={6}
            style={({ pressed }) => [styles.more, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.muted} />
          </Pressable>
        </View>
      ) : (
        header
      )}

      {expanded ? (
        <View style={styles.rows}>
          {timed.map(timedRow)}
          {shownRows.map(row)}
          {shownRows.length === 0 && timed.length === 0 ? (
            <AppText variant="caption" color={theme.muted} style={styles.empty}>
              {isWindow ? "Nothing here. Drag a task in." : "Drag a task here."}
            </AppText>
          ) : null}
          {isWindow && section.window.full && editable ? (
            <View style={styles.footer}>
              <AppText variant="caption" color={theme.muted}>
                That&apos;s this window
              </AppText>
              <Pressable onPress={onPullIn} accessibilityRole="button" style={styles.link}>
                <AppText variant="caption" color={theme.accent}>
                  Pull in another
                </AppText>
              </Pressable>
            </View>
          ) : null}
          {editableWindow ? (
            <View style={styles.footer}>
              {overflow.length > 0 && !showAll ? (
                <Pressable onPress={() => setShowAll(true)} accessibilityRole="button" style={styles.link}>
                  <AppText variant="caption" color={theme.accent}>
                    Show all ({section.rows.length + overflow.length})
                  </AppText>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable onPress={onAddFromOpen} accessibilityRole="button" style={styles.link}>
                <AppText variant="caption" color={theme.accent}>
                  Add from open
                </AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  more: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 },
  grow: { flex: 1 },
  rows: { paddingBottom: space.xs },
  empty: { paddingVertical: space.sm },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { minHeight: 44, justifyContent: "center" },
});
