/**
 * One window on Plan's day (spec §5.3, windows-and-pins.md §§2–3): its
 * times, a plain bar of how much it holds, and its rows. Pins first,
 * then tasks with a clock time in it, then suggestions; done ones where
 * they were done.
 *
 * - Tap a suggestion to pin it here. **Accept all** pins every one
 *   shown (§3.3).
 * - A pin's menu switches it between "this window" and "until done", or
 *   unpins it. Unpinned, it's a suggestion again wherever it fits.
 * - **Add from open** pins any open task here, moving it from wherever
 *   it was today (one window per task per day, §2.7).
 * - The window's ••• has Edit times, Remove and "Do N of these".
 *
 * **No load warning** (P3, ADR-0026 §3): the bar is an amount, the same
 * colour at any level, and nothing says a window is too full.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import type { PinKind, PlannedWindow } from "@glide/scoring";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { WindowChoice } from "../../db/pins";
import type { TodayTask } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { ActionMenu, type MenuAction } from "../ui/ActionMenu";
import { AppText } from "../ui/AppText";
import { fillLabel, plannedMinutes, reasonLabel, spanLabel, spokenSpan } from "./dayView";

interface WindowCardProps {
  window: PlannedWindow;
  tasks: ReadonlyMap<string, TodayTask>;
  /** "Do N of these" in this window. */
  choices: readonly WindowChoice[];
  /** How many open tasks "Add from open" offers. */
  addable: number;
  /** The day can still be planned: today or later. */
  editable: boolean;
  hueFor: (t: TodayTask) => string;
  theme: ThemeTokens;
  onPin: (taskId: string) => void;
  onAcceptAll: () => void;
  onUnpin: (taskId: string) => void;
  onPinKind: (ruleId: string, kind: PinKind) => void;
  onAddFromOpen: () => void;
  onEditTimes: () => void;
  onRemove: () => void;
  onChoice: () => void;
}

export function WindowCard({
  window: w,
  tasks,
  choices,
  addable,
  editable,
  hueFor,
  theme,
  onPin,
  onAcceptAll,
  onUnpin,
  onPinKind,
  onAddFromOpen,
  onEditTimes,
  onRemove,
  onChoice,
}: WindowCardProps) {
  const [showAll, setShowAll] = useState(false);
  const live = editable && !w.ended;
  const sizeOf = (id: string) => {
    const t = tasks.get(id);
    return t?.size ?? t?.oneOffSize ?? null;
  };
  const planned = plannedMinutes(w, sizeOf);
  const length = w.range.end - w.range.start;
  const share = Math.min(1, length > 0 ? planned / length : 0);
  const suggestions = showAll ? [...w.suggested, ...w.showAll] : w.suggested;
  const inChoice = new Set(choices.flatMap((c) => c.taskIds));

  const windowActions: MenuAction[] = [
    { label: "Edit times", icon: "clock", onPress: onEditTimes },
    { label: "Do N of these…", icon: "square.stack", onPress: onChoice },
    { label: "Remove", icon: "trash", destructive: true, onPress: onRemove },
  ];

  const header = (
    <View style={styles.header}>
      <AppText variant="label" color={theme.ink} tabular style={styles.grow}>
        {spanLabel(w.range)}
      </AppText>
      <AppText variant="caption" color={theme.muted} tabular>
        {fillLabel(planned, w.range)}
      </AppText>
    </View>
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, opacity: w.ended ? 0.55 : 1 },
      ]}
    >
      {live ? (
        <ActionMenu
          label={`Window ${spokenSpan(w.range)}, ${fillLabel(planned, w.range)} planned`}
          moreColor={theme.muted}
          actions={windowActions}
        >
          {header}
        </ActionMenu>
      ) : (
        <View accessible accessibilityLabel={`Window ${spokenSpan(w.range)}${w.ended ? ", over" : ""}`}>
          {header}
        </View>
      )}

      {/* A plain amount, never a warning. */}
      <View
        style={[styles.track, { backgroundColor: theme.hairline }]}
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: theme.muted }]} />
      </View>

      {w.done.map((id) => {
        const t = tasks.get(id);
        if (!t) return null;
        return (
          <Row
            key={`done-${id}`}
            icon="checkmark.circle.fill"
            fallback="checkmark-circle"
            title={t.title}
            hue={hueFor(t)}
            muted
            said={`${t.title}, done`}
            theme={theme}
          />
        );
      })}

      {w.pinned.map((p) => {
        const t = tasks.get(p.taskId);
        if (!t) return null;
        const kindLabel = p.kind === "untilDone" ? "Pinned until done" : "Pinned here";
        const row = (
          <Row
            icon="pin.fill"
            fallback="pin"
            title={t.title}
            caption={[inChoice.has(t.id) ? "One of a choice" : null, p.carried ? "Still open" : null]
              .filter(Boolean)
              .join(" · ") || undefined}
            hue={hueFor(t)}
            said={`${t.title}, ${kindLabel}`}
            theme={theme}
          />
        );
        return live ? (
          <ActionMenu
            key={`pin-${p.taskId}`}
            label={`${t.title}, ${kindLabel}`}
            moreColor={theme.muted}
            actions={[
              p.kind === "untilDone"
                ? { label: "Pin to this window only", icon: "pin", onPress: () => onPinKind(p.ruleId, "window") }
                : { label: "Pin until done", icon: "pin.circle", onPress: () => onPinKind(p.ruleId, "untilDone") },
              { label: "Unpin", icon: "pin.slash", onPress: () => onUnpin(p.taskId) },
            ]}
          >
            {row}
          </ActionMenu>
        ) : (
          <View key={`pin-${p.taskId}`}>{row}</View>
        );
      })}

      {w.timed.map((id) => {
        const t = tasks.get(id);
        if (!t) return null;
        return (
          <Row
            key={`timed-${id}`}
            icon="clock"
            fallback="time-outline"
            title={t.title}
            hue={hueFor(t)}
            said={`${t.title}, at its time`}
            theme={theme}
          />
        );
      })}

      {live
        ? suggestions.map((s) => {
            const t = tasks.get(s.taskId);
            if (!t) return null;
            return (
              <Pressable
                key={`s-${s.taskId}`}
                onPress={() => onPin(s.taskId)}
                accessibilityRole="button"
                accessibilityLabel={`${t.title}, suggested, ${reasonLabel(s.reason)}`}
                accessibilityHint="Pins it to this window"
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <Row
                  icon="circle"
                  fallback="ellipse-outline"
                  title={t.title}
                  caption={`Suggested · ${reasonLabel(s.reason)}`}
                  hue={hueFor(t)}
                  theme={theme}
                />
              </Pressable>
            );
          })
        : null}

      {live && w.showAll.length > 0 && !showAll ? (
        <Pressable
          onPress={() => setShowAll(true)}
          accessibilityRole="button"
          style={styles.link}
        >
          <AppText variant="caption" color={theme.accent}>
            Show all ({w.suggested.length + w.showAll.length})
          </AppText>
        </Pressable>
      ) : null}

      {live ? (
        <View style={styles.footer}>
          {addable > 0 ? (
            <Pressable
              onPress={onAddFromOpen}
              accessibilityRole="button"
              accessibilityLabel={`Add from open, ${addable} tasks`}
              style={styles.link}
            >
              <AppText variant="caption" color={theme.accent}>
                + Add from open ({addable})
              </AppText>
            </Pressable>
          ) : (
            <View />
          )}
          {w.suggested.length > 0 ? (
            <Pressable
              onPress={onAcceptAll}
              accessibilityRole="button"
              accessibilityHint="Pins every suggestion to this window"
              style={styles.link}
            >
              <AppText variant="caption" color={theme.accent}>
                Accept all
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Row({
  icon,
  fallback,
  title,
  caption,
  hue,
  muted = false,
  said,
  theme,
}: {
  icon: SFSymbol;
  fallback: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  caption?: string;
  hue: string;
  muted?: boolean;
  /** Set where the row is its own VoiceOver stop. */
  said?: string;
  theme: ThemeTokens;
}) {
  return (
    <View
      style={styles.row}
      accessible={said !== undefined}
      accessibilityLabel={said}
    >
      <SymbolView
        name={icon}
        size={16}
        tintColor={hue}
        fallback={<Ionicons name={fallback} size={16} color={hue} />}
      />
      <View style={styles.grow}>
        <AppText
          variant="body"
          color={muted ? theme.muted : theme.ink}
          numberOfLines={2}
          style={muted ? styles.struck : null}
        >
          {title}
        </AppText>
        {caption ? (
          <AppText variant="footnote" color={theme.muted}>
            {caption}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.md, gap: space.sm },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 32 },
  grow: { flex: 1 },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 },
  struck: { textDecorationLine: "line-through" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { minHeight: 44, justifyContent: "center" },
});
