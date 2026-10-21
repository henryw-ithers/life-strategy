/**
 * One window on Home (spec §5.1, windows-and-pins.md §3.3): today's
 * windows are for getting things done, so a row is ticked, swapped or
 * moved, never pinned from here.
 *
 * - Only the open window starts open. A past one closes to "✓ 2 done",
 *   or just its times; a later one to "3 tasks". Tap the header to open
 *   or close it.
 * - The open one says how long it has left, in plain words.
 * - When everything shown is done and there's room, the next task comes
 *   in as "Next up". When it's full: "That's this window" and "Pull in
 *   another". No celebration for doing planned work.
 * - Its ••• has Edit times and Remove (spec §3.5).
 */
import type { PlannedWindow } from "@glide/scoring";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { TodayTask } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { reasonLabel, spanLabel, spokenSpan } from "../plan/dayView";
import { ActionMenu } from "../ui/ActionMenu";
import { AppText } from "../ui/AppText";
import { closedLabel, timeLeft, type WindowState } from "./homeDay";

interface HomeWindowProps {
  window: PlannedWindow;
  state: WindowState;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** The minute it is now, on today. */
  now: number | null;
  tasks: ReadonlyMap<string, TodayTask>;
  /** A row for a task, with the gestures the day allows on it. */
  renderRow: (task: TodayTask, extra: { reason?: string; onSwap?: () => void }) => React.ReactNode;
  /** Shown suggestions had nothing before them: the refill's label. */
  refilled: boolean;
  onSwap: (taskId: string) => void;
  onPullIn: () => void;
  onAddFromOpen: () => void;
  onEditTimes: () => void;
  onRemove: () => void;
  editable: boolean;
  theme: ThemeTokens;
}

export function HomeWindow({
  window: w,
  state,
  expanded,
  onToggleExpanded,
  now,
  tasks,
  renderRow,
  refilled,
  onSwap,
  onPullIn,
  onAddFromOpen,
  onEditTimes,
  onRemove,
  editable,
  theme,
}: HomeWindowProps) {
  const open = state === "open";
  const [showAll, setShowAll] = useState(false);
  const right = expanded
    ? open && now !== null
      ? timeLeft(w.range, now)
      : ""
    : closedLabel(w, state);
  const live = editable && state !== "past";

  const header = (
    <Pressable
      onPress={onToggleExpanded}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${open ? "Now, " : ""}window ${spokenSpan(w.range)}${right ? `, ${right}` : ""}`}
      style={styles.header}
    >
      <AppText variant="label" color={open ? theme.accent : theme.ink} tabular style={styles.grow}>
        {open ? "NOW · " : ""}
        {spanLabel(w.range)}
      </AppText>
      {right ? (
        <AppText variant="caption" color={theme.muted} tabular>
          {right}
        </AppText>
      ) : null}
    </Pressable>
  );

  const row = (id: string, reason?: string, swappable = false) => {
    const t = tasks.get(id);
    if (!t) return null;
    return (
      <View key={id}>
        {renderRow(t, { reason, onSwap: swappable && live ? () => onSwap(id) : undefined })}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: open ? theme.accent : "transparent",
        },
      ]}
    >
      {live ? (
        <View style={styles.headerRow}>
          <View style={styles.grow}>{header}</View>
          <ActionMenu
            label={`Window ${spokenSpan(w.range)}`}
            moreColor={theme.muted}
            sizing="content"
            actions={[
              { label: "Edit times", icon: "clock", onPress: onEditTimes },
              { label: "Remove", icon: "trash", destructive: true, onPress: onRemove },
            ]}
          >
            <View />
          </ActionMenu>
        </View>
      ) : (
        header
      )}

      {expanded ? (
        <View style={styles.rows}>
          {w.done.map((id) => row(id))}
          {w.pinned.map((p) => row(p.taskId, p.carried ? "Still open" : undefined))}
          {w.timed.map((id) => row(id))}
          {w.suggested.map((s, i) =>
            row(
              s.taskId,
              refilled && i === 0 ? `Next up · ${reasonLabel(s.reason)}` : reasonLabel(s.reason),
              true,
            ),
          )}
          {showAll ? w.showAll.map((s) => row(s.taskId, reasonLabel(s.reason), true)) : null}
          {w.full && live ? (
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
          {live ? (
            <View style={styles.footer}>
              {w.showAll.length > 0 && !showAll ? (
                <Pressable onPress={() => setShowAll(true)} accessibilityRole="button" style={styles.link}>
                  <AppText variant="caption" color={theme.accent}>
                    Show all ({w.suggested.length + w.showAll.length})
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
  card: { borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.xs, borderWidth: 1.5 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 },
  grow: { flex: 1 },
  rows: { paddingBottom: space.xs },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { minHeight: 44, justifyContent: "center" },
});
