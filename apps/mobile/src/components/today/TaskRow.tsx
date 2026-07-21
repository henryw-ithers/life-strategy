import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { TodayTask } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

interface TaskRowProps {
  task: TodayTask;
  hue: string;
  disabled: boolean;
  onToggle: () => void;
  theme: ThemeTokens;
  reduceMotion: boolean;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
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

  const caption = progressCaption(task);

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={`${task.title}${caption ? `, ${caption}` : ""}`}
      style={({ pressed }) => [
        styles.row,
        { opacity: disabled ? 0.45 : pressed ? 0.6 : 1 },
      ]}
    >
      <View style={[styles.circle, { borderColor: hue }]}>
        <Animated.View style={[styles.circleFill, { backgroundColor: hue }, fillStyle]}>
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
      <AppText variant="footnote" color={theme.muted} tabular>
        {task.extraToday && checked
          ? `+${task.pointsIfCompletedNow}`
          : `${task.pointValue}`}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.xs,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  circleFill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  check: { lineHeight: 16 },
  text: { flex: 1, gap: 1 },
});
