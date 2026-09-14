import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { TodayTask } from "../../db/today";
import { progressLabel } from "./PartialSheet";
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
  /**
   * Press-and-hold on a part-credit row: how much of it did you do
   * (ADR-0014 §4). Takes precedence over `onMove`, and the sheet it
   * opens carries the move along so nothing is lost.
   */
  onPartial?: () => void;
  /** Area hue per tagged unit, for the pips. */
  tagHues?: Record<string, string>;
  theme: ThemeTokens;
  reduceMotion: boolean;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/**
 * A daily task's run of days.
 *
 * **Only once it's worth saying, and only while it's true.** Below a
 * week there is no run to speak of, and a row that announced "1 day"
 * every time you restarted would be reporting the break rather than
 * the habit. That is the one thing docs/backburner.md warned a streak
 * must never do: its emotional weight lives entirely in the reset.
 *
 * So: nothing at 0, nothing at 3, and a quiet count from 7 up.
 */
function streakCaption(task: TodayTask): string | null {
  if (task.streak === null || task.streak < 7) return null;
  return `${task.streak} days`;
}

/** Progress copy stays factual — counts, never deficits (ADR-0008).
 *  Ordinal phrasing: the run at hand — "2nd of 5 this week" is the
 *  one just done (checked) or the one a tap would log (unchecked). */
function progressCaption(task: TodayTask): string | null {
  if (task.timesPerWeek === 7) return null;
  const span = task.timesPerWeek === 0 ? "fortnight" : "week";
  const at = task.completedToday ? task.doneCount : task.doneCount + 1;
  if (task.band === "doneThisWeek") {
    return `${task.goalCount} of ${task.goalCount} this ${span} · +${task.pointsIfCompletedNow} for another`;
  }
  return `${ordinal(at)} of ${task.goalCount} this ${span}`;
}

/** One checklist row: area-hue check circle, title, factual caption. */
export function TaskRow({
  task,
  hue,
  disabled,
  onToggle,
  onTag,
  onMove,
  onPartial,
  tagHues,
  theme,
  reduceMotion,
}: TaskRowProps) {
  const checked = task.completedToday;
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

  // Part done leads, because it is the most specific true thing about
  // the row and the only one a tap is about to change. It reads as a
  // count up, never as a shortfall (ADR-0014 §5).
  const partial = task.progress > 0 && task.progress < 1;
  // Daily tasks have no frequency caption, so the run takes that slot
  // rather than adding a line to the row.
  const caption = partial
    ? progressLabel(task.progress)
    : (progressCaption(task) ?? streakCaption(task));

  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onTag ?? onPartial ?? onMove}
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
      accessibilityActions={
        onTag
          ? [{ name: "magicTap", label: "Where else it counts" }]
          : onPartial
            ? [{ name: "magicTap", label: "How much of it you did" }]
            : onMove
              ? [{ name: "magicTap", label: "Move to another part of the day" }]
              : undefined
      }
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "magicTap") {
          (onTag ?? onPartial ?? onMove)?.();
        }
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
        {task.extraToday && checked
          ? `+${task.pointsIfCompletedNow}`
          : `${task.pointValue}`}
      </AppText>
    </Pressable>
  );
}

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
});
