import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { TodayTask } from "../../db/today";
import { rowCaption } from "./rowCaption";
import { solidFill, type ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

interface TaskRowProps {
  task: TodayTask;
  hue: string;
  disabled: boolean;
  onToggle: () => void;
  /** Press-and-hold on a completed row: where else it counts
   *  (ADR-0025 §4). Absent when the row can't carry tags. */
  onTag?: () => void;
  /**
   * Press-and-hold on an *incomplete* row: move it to another part
   * of the day. The two gestures never collide — tagging needs a
   * completion to hang on, and a row you have already ticked is
   * not one you are still deciding when to do.
   */
  onMove?: () => void;
  /** Press-and-hold on an unticked event: skip it (ADR-0040 §2). An
   *  event has its own time, so it isn't moved, it's skipped. */
  onSkip?: () => void;
  /**
   * Press-and-hold on a part-credit row: how much of it did you do
   * (ADR-0014 §4). Takes precedence over `onMove`, and the sheet it
   * opens carries the move along so nothing is lost.
   */
  onPartial?: () => void;
  /** Area hue per tagged unit, for the pips. */
  tagHues?: Record<string, string>;
  /** Why it's suggested here ("Due today", "Still open"), shown in place
   *  of the row's usual caption (windows-and-pins §3.3). */
  reason?: string;
  /** Swap it for the next that fits (spec §4.4); a ⇄ at the end. */
  onSwap?: () => void;
  /** What the end of the row shows: today's points (the default), or
   *  the task's size, as Home's windows do (spec §5.1). */
  trailing?: "points" | "size";
  theme: ThemeTokens;
  reduceMotion: boolean;
}

/** One checklist row: area-hue check circle, title, factual caption. */
export function TaskRow({
  task,
  hue,
  disabled,
  onToggle,
  onTag,
  onMove,
  onSkip,
  onPartial,
  tagHues,
  reason,
  onSwap,
  trailing = "points",
  theme,
  reduceMotion,
}: TaskRowProps) {
  // Done ahead reads as done: the session is finished, on another day.
  const checked = task.completedToday || task.doneAheadOn !== null;
  const fill = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(checked ? 1 : 0, {
      duration: reduceMotion ? 0 : 180,
    });
  }, [checked, fill, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.4 + fill.value * 0.6 }],
    opacity: fill.value,
  }));

  const partial = task.progress > 0 && task.progress < 1;
  // What earns the row's one line is decided in `rowCaption`.
  const caption = reason ?? rowCaption(task);
  const longPress = onTag ?? onSkip ?? onPartial ?? onMove;
  const longPressLabel = onTag
    ? "Where else it counts"
    : onSkip
      ? "Skip this event"
      : onPartial
        ? "How much of it you did"
        : onMove
          ? "Move it"
          : null;

  return (
    <Pressable
      onPress={onToggle}
      onLongPress={longPress}
      delayLongPress={350}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={`${task.title}${caption ? `, ${caption}` : ""}${
        task.tagUnitIds.length > 0
          ? `, also counts in ${task.tagUnitIds.length}`
          : ""
      }`}
      // Long-press is invisible to a screen reader, so the same action
      // needs an explicit rotor entry (ADR-0025 §4's gesture is the
      // only route to tagging).
      accessibilityActions={[
        ...(longPressLabel ? [{ name: "magicTap", label: longPressLabel }] : []),
        ...(onSwap && !checked ? [{ name: "swap", label: "Swap for another" }] : []),
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "magicTap") longPress?.();
        if (e.nativeEvent.actionName === "swap") onSwap?.();
      }}
      style={({ pressed }) => [
        styles.row,
        { opacity: disabled ? 0.45 : pressed ? 0.6 : 1 },
      ]}
    >
      {/* The ring is the hue as drawn; the fill behind the tick goes
          through `solidFill`, since a caption-size ✓ in `onAccent` on
          raw Green or Amber is the same 3.78:1 / 3.16:1 the primary
          button had. */}
      <View style={[styles.circle, { borderColor: hue }]}>
        {/* A partial fills from the bottom rather than dimming or
            half-ticking: "some of it" needs to read as a level, and a
            faded tick reads as a disabled one. */}
        {partial ? (
          <View
            style={[
              styles.level,
              {
                backgroundColor: solidFill(hue, theme),
                height: CIRCLE * task.progress,
              },
            ]}
          />
        ) : null}
        <Animated.View
          style={[styles.circleFill, { backgroundColor: solidFill(hue, theme) }, fillStyle]}
        >
          <AppText variant="caption" color={theme.onAccent} style={styles.check}>
            ✓
          </AppText>
        </Animated.View>
      </View>
      <View style={styles.text}>
        <AppText
          color={checked ? theme.muted : theme.ink}
          numberOfLines={1}
        >
          {task.title}
        </AppText>
        {caption ? (
          <AppText variant="footnote" color={theme.muted}>
            {caption}
          </AppText>
        ) : null}
      </View>
      {/* Where else it counted, as area-hue pips. The row is the daily
          surface: it says a tag exists, and the sheet says what it is. */}
      {task.tagUnitIds.length > 0 ? (
        <View style={styles.pips} importantForAccessibility="no-hide-descendants">
          {task.tagUnitIds.map((id) => (
            <View
              key={id}
              style={[
                styles.pip,
                { backgroundColor: tagHues?.[id] ?? theme.muted },
              ]}
            />
          ))}
        </View>
      ) : null}
      <AppText variant="footnote" color={theme.muted} tabular>
        {/* Nothing for a session done ahead: it was paid on the day it
            was done, and a 0 here would read as "worth nothing". */}
        {trailing === "size"
          ? SIZE_LABEL[task.size ?? task.oneOffSize ?? "normal"]
          : task.doneAheadOn !== null
            ? ""
            : task.extraToday && checked
              ? `+${task.pointsIfCompletedNow}`
              : `${task.pointValue}`}
      </AppText>
      {onSwap && !checked ? (
        <Pressable
          onPress={onSwap}
          accessibilityRole="button"
          accessibilityLabel={`Swap ${task.title} for another`}
          // The row's own custom action covers it for VoiceOver.
          accessibilityElementsHidden
          importantForAccessibility="no"
          hitSlop={8}
          style={styles.swap}
        >
          <AppText variant="label" color={theme.muted}>
            ⇄
          </AppText>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const SIZE_LABEL = { quick: "Quick", normal: "Normal", big: "Big" } as const;

/** The check circle's diameter; the partial level is a share of it. */
const CIRCLE = 26;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.xs,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  level: { position: "absolute", left: 0, right: 0, bottom: 0 },
  circleFill: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  check: { lineHeight: 16 },
  text: { flex: 1, gap: 1 },
  pips: { flexDirection: "row", gap: 3, marginRight: space.xs },
  pip: { width: 6, height: 6, borderRadius: 3 },
  swap: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
});
