/**
 * One window on Plan's day (spec §5.3, windows-and-pins.md §§2–3): its
 * times, a plain bar of how much it holds, and its rows. Pins first,
 * then tasks with a clock time in it, then suggestions; done ones where
 * they were done.
 *
 * - **The pin** at the start of each row cycles in one tap at a time
 *   (Henry, 2026-10-25): an outline pin is a suggestion; one tap pins
 *   it here (accent); a second keeps it pinned until done (amber); a
 *   third unpins it, back to a suggestion wherever it fits.
 * - **Accept all** pins every suggestion shown (§3.3).
 * - **Add from open** pins any open task here, moving it from wherever
 *   it was today (one window per task per day, §2.7).
 * - The window's ••• has Edit times and Remove.
 *
 * **No load warning** (P3, ADR-0026 §3): the bar is an amount, the same
 * colour at any level, and nothing says a window is too full.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import type { PinKind, PlannedWindow } from "@glide/scoring";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { TodayTask } from "../../db/today";
import { wash, type ThemeTokens } from "../../theme/colors";
import { PALETTE } from "../../theme/palette";
import { cardStyle } from "../../theme/surfaces";
import { space } from "../../theme/tokens";
import { ActionMenu, type MenuAction } from "../ui/ActionMenu";
import { AppText } from "../ui/AppText";
import { fillLabel, plannedMinutes, reasonLabel, spanLabel, spokenSpan } from "./dayView";

interface WindowCardProps {
  window: PlannedWindow;
  tasks: ReadonlyMap<string, TodayTask>;
  /** How many open tasks "Add from open" offers. */
  addable: number;
  /** The day can still be planned: today or later. */
  editable: boolean;
  /** The day shown is today, for "Due today" or "Due that day". */
  isToday: boolean;
  hueFor: (t: TodayTask) => string;
  theme: ThemeTokens;
  onPin: (taskId: string) => void;
  onAcceptAll: () => void;
  onUnpin: (taskId: string) => void;
  onPinKind: (ruleId: string, kind: PinKind) => void;
  onAddFromOpen: () => void;
  /** Omitted, the window's menu has no Edit times. */
  onEditTimes?: () => void;
  onRemove: () => void;
}

export function WindowCard({
  window: w,
  tasks,
  addable,
  editable,
  isToday,
  hueFor,
  theme,
  onPin,
  onAcceptAll,
  onUnpin,
  onPinKind,
  onAddFromOpen,
  onEditTimes,
  onRemove,
}: WindowCardProps) {
  const [showAll, setShowAll] = useState(false);
  /** Rows whose pin was tapped and is saving: a second tap waits for
   *  the window to come back, so it can't act on a pin that's moved. */
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [seen, setSeen] = useState(w);
  if (seen !== w) {
    setSeen(w);
    setSaving(new Set());
  }
  const once = (taskId: string, write: () => void) => () => {
    if (saving.has(taskId)) return;
    setSaving(new Set([...saving, taskId]));
    write();
  };
  const live = editable && !w.ended;
  const sizeOf = (id: string) => {
    const t = tasks.get(id);
    return t?.size ?? t?.oneOffSize ?? null;
  };
  const planned = plannedMinutes(w, sizeOf);
  const length = w.range.end - w.range.start;
  const share = Math.min(1, length > 0 ? planned / length : 0);
  const suggestions = showAll ? [...w.suggested, ...w.showAll] : w.suggested;

  const windowActions: MenuAction[] = [
    ...(onEditTimes ? [{ label: "Edit times", icon: "clock" as const, onPress: onEditTimes }] : []),
    { label: "Remove", icon: "trash", destructive: true, onPress: onRemove },
  ];

  const header = (
    <View style={styles.header}>
      <AppText variant="label" color={theme.ink} tabular style={styles.grow}>
        {spanLabel(w.range)}
      </AppText>
      <AppText variant="caption" color={theme.muted} tabular>
        {w.ended ? "Over" : fillLabel(planned, w.range)}
      </AppText>
    </View>
  );

  return (
    <View
      // An ended window keeps full contrast and says so in words: a
      // faded card would take its text below 4.5:1 (WCAG 1.4.3).
      style={[cardStyle(theme), styles.card]}
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
        const untilDone = p.kind === "untilDone";
        return (
          <Row
            key={`pin-${p.taskId}`}
            pin={
              live
                ? {
                    state: untilDone ? "untilDone" : "here",
                    onPress: once(p.taskId, () =>
                      untilDone ? onUnpin(p.taskId) : onPinKind(p.ruleId, "untilDone"),
                    ),
                  }
                : undefined
            }
            icon="pin.fill"
            fallback="pin"
            title={t.title}
            caption={p.carried ? "Still open" : undefined}
            hue={hueFor(t)}
            said={`${t.title}, ${untilDone ? "pinned until done" : "pinned here"}`}
            theme={theme}
          />
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
              <Row
                key={`s-${s.taskId}`}
                pin={{ state: "none", onPress: once(s.taskId, () => onPin(s.taskId)) }}
                icon="pin"
                fallback="pin-outline"
                title={t.title}
                hue={hueFor(t)}
                said={`${t.title}, suggested, ${reasonLabel(s.reason, isToday)}`}
                theme={theme}
              />
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

/** Where a row's pin is in its cycle. */
type PinState = "none" | "here" | "untilDone";

const PIN_NEXT: Record<PinState, string> = {
  none: "Pins it to this window",
  here: "Keeps it pinned until done",
  untilDone: "Unpins it",
};

function Row({
  pin,
  icon,
  fallback,
  title,
  caption,
  hue,
  muted = false,
  said,
  theme,
}: {
  /** The pin button, where the row has one. */
  pin?: { state: PinState; onPress: () => void };
  icon: SFSymbol;
  fallback: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  caption?: string;
  hue: string;
  muted?: boolean;
  /** What VoiceOver reads for the row. */
  said?: string;
  theme: ThemeTokens;
}) {
  // Accent for pinned here, amber for until done; a suggestion's pin is
  // a grey outline, waiting to be filled.
  const pinColour =
    pin?.state === "untilDone" ? PALETTE.orange[theme.name] : pin?.state === "here" ? theme.accent : theme.muted;
  const glyph = (
    <SymbolView
      name={pin ? (pin.state === "none" ? "pin" : "pin.fill") : icon}
      size={18}
      tintColor={pin ? pinColour : hue}
      fallback={
        <Ionicons
          name={pin ? (pin.state === "none" ? "pin-outline" : "pin") : fallback}
          size={18}
          color={pin ? pinColour : hue}
        />
      }
    />
  );
  return (
    <View style={styles.row}>
      {pin ? (
        <Pressable
          onPress={pin.onPress}
          accessibilityRole="button"
          accessibilityLabel={said}
          accessibilityHint={PIN_NEXT[pin.state]}
          hitSlop={4}
          style={({ pressed }) => [
            styles.pin,
            pin.state !== "none" ? { backgroundColor: wash(pinColour, theme) } : null,
            { opacity: pressed ? 0.5 : 1 },
          ]}
        >
          {glyph}
        </Pressable>
      ) : (
        <View style={styles.pin}>{glyph}</View>
      )}
      <View style={styles.grow} accessible={!pin} accessibilityLabel={pin ? undefined : said}>
        <View style={styles.titleRow}>
          {pin ? <View style={[styles.dot, { backgroundColor: hue }]} /> : null}
          <AppText
            variant="body"
            color={muted ? theme.muted : theme.ink}
            numberOfLines={2}
            style={[styles.grow, muted ? styles.struck : null]}
          >
            {title}
          </AppText>
        </View>
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
  card: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.xs },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 32 },
  grow: { flex: 1 },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48 },
  /** 36pt visible, 44pt with its slop: the pin is the row's control. */
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pin: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  struck: { textDecorationLine: "line-through" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  link: { minHeight: 44, justifyContent: "center" },
});
