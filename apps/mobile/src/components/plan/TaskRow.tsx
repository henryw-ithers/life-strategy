/**
 * One task inside a unit's expanded list.
 *
 * Swipe left to delete, tap to edit. The delete is a soft archive
 * (ADR-0002), so it
 * commits immediately and offers undo rather than stopping to ask; a
 * confirmation dialog for a reversible action is a tax on the common
 * case. The red only appears once the swipe has passed the point where
 * releasing would delete, so the colour is feedback, not decoration.
 */
import * as Haptics from "expo-haptics";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { formatFrequencyShort } from "./frequency";

/** Past this, releasing deletes. Also where the row turns red. */
const COMMIT_AT = -96;
/** Hard stop, so the row can't be dragged off into nothing. */
const MAX_PULL = -132;

interface TaskRowProps {
  title: string;
  timesPerWeek: number;
  pointValue: number;
  /** Other units this task also serves, for the secondary line. */
  otherUnitNames: string[];
  accent: string;
  theme: ThemeTokens;
  onDelete: () => void;
  onEdit: () => void;
}

export function TaskRow({
  title,
  timesPerWeek,
  pointValue,
  otherUnitNames,
  accent,
  theme,
  onDelete,
  onEdit,
}: TaskRowProps) {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const armed = useSharedValue(false);

  const tick = () => {
    void Haptics.selectionAsync();
  };
  const thud = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const pan = Gesture.Pan()
    // Horizontal only: a vertical drag belongs to the scroll view.
    .activeOffsetX([-12, 12])
    .failOffsetY([-8, 8])
    .onUpdate((e) => {
      x.value = Math.max(MAX_PULL, Math.min(0, e.translationX));
      const past = x.value <= COMMIT_AT;
      if (past !== armed.value) {
        armed.value = past;
        runOnJS(tick)();
      }
    })
    .onEnd(() => {
      if (x.value <= COMMIT_AT) {
        runOnJS(thud)();
        runOnJS(onDelete)();
        // Leave it open; the list drops the row on reload.
        x.value = withTiming(MAX_PULL, { duration: 120 });
      } else {
        x.value = reduceMotion ? 0 : withTiming(0, { duration: 180 });
      }
      armed.value = false;
    });

  const tap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(onEdit)();
  });

  // Exclusive, pan first: a swipe that has already travelled 12pt owns
  // the finger, so releasing at the end of a swipe can't also register
  // as a tap and throw the edit sheet up over the delete.
  const gesture = Gesture.Exclusive(pan, tap);

  const surface = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const backing = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, COMMIT_AT / 2, COMMIT_AT], [0, 0.5, 1]),
  }));

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents="none"
        style={[styles.backing, backing, { backgroundColor: theme.danger }]}
      >
        <AppText variant="label" color={theme.onAccent}>
          Delete
        </AppText>
      </Animated.View>

      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[surface, styles.row, { backgroundColor: theme.surface }]}
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${formatFrequencyShort(timesPerWeek)}, ${pointValue} points${
            otherUnitNames.length ? `, also counts toward ${otherUnitNames.join(" and ")}` : ""
          }`}
          accessibilityHint="Opens this task's settings"
          accessibilityActions={[
            { name: "activate", label: "Edit" },
            { name: "magicTap", label: "Delete" },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "activate") onEdit();
            if (e.nativeEvent.actionName === "magicTap") onDelete();
          }}
        >
          <View style={[styles.pip, { backgroundColor: accent }]} />
          <View style={styles.text}>
            <AppText color={theme.ink} numberOfLines={1}>
              {title}
            </AppText>
            {otherUnitNames.length > 0 ? (
              <AppText variant="footnote" color={theme.muted} numberOfLines={1}>
                Also counts toward {otherUnitNames.join(" · ")}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" color={theme.muted}>
            {formatFrequencyShort(timesPerWeek)}
          </AppText>
          <AppText color={theme.ink} tabular style={styles.pts}>
            {pointValue}
          </AppText>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden", borderRadius: radius.sm },
  backing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: space.lg,
    borderRadius: radius.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
    paddingLeft: space.sm,
    paddingRight: space.sm,
  },
  pip: { width: 6, height: 6, borderRadius: 3 },
  text: { flex: 1, gap: 1 },
  pts: { minWidth: 26, textAlign: "right" },
});
