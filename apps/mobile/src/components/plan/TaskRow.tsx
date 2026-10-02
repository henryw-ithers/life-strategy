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
import { useEffect } from "react";
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
import { formatFrequency, formatFrequencyShort } from "./frequency";
import {
  formatWeekdaySummary,
  parseWeekdays,
  PART_OF_DAY_LABEL,
  type PartOfDay,
} from "./planning";

/** Past this, releasing deletes. Also where the row turns red. */
const COMMIT_AT = -96;
/** Hard stop, so the row can't be dragged off into nothing. */
const MAX_PULL = -132;

interface TaskRowProps {
  title: string;
  timesPerWeek: number;
  /**
   * What it is worth, or null when it has no one worth. A commitment
   * task is priced by the day it lands on (ADR-0032), so a stored
   * figure would be a number true on no particular day — the row leaves
   * the column empty rather than show a 0 that reads as "worthless".
   */
  pointValue: number | null;
  /** Leads the detail line: the part a commitment task is filed under. */
  context?: string | null;
  /** Other units this task also serves, for the secondary line. */
  otherUnitNames: string[];
  /** `"1,3,5"`, or null for flexible (ADR-0024). */
  plannedWeekdays: string | null;
  /** Null is *Anytime*, which the row leaves unsaid. */
  partOfDay: PartOfDay | null;
  accent: string;
  theme: ThemeTokens;
  /** Tinted while true: the row you just created, in a list you didn't
   *  write in order. Held by the screen, not timed here. */
  highlight?: boolean;
  onDelete: () => void;
  onEdit: () => void;
}

export function TaskRow({
  context = null,
  title,
  timesPerWeek,
  pointValue,
  otherUnitNames,
  plannedWeekdays,
  partOfDay,
  accent,
  theme,
  highlight = false,
  onDelete,
  onEdit,
}: TaskRowProps) {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const armed = useSharedValue(false);
  /** 0 resting, 1 freshly added. Out is slower than in — arriving is an
   *  event, leaving shouldn't be. */
  const fresh = useSharedValue(0);

  useEffect(() => {
    // Every row mounts un-highlighted; only the one that changes state
    // animates, rather than seventeen no-op timings per expand.
    if (!highlight && fresh.value === 0) return;
    const to = highlight ? 1 : 0;
    fresh.value = reduceMotion
      ? to
      : withTiming(to, { duration: highlight ? 180 : 480 });
  }, [highlight, reduceMotion, fresh]);

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

  /**
   * The plan, in the row that holds it: "Mon, Wed, Fri · Morning".
   *
   * Without this the days and the part of day were invisible outside
   * the edit sheet — you set a plan and then had to reopen the task to
   * see it, which makes the list a worse answer to "what have I set up"
   * than the sheet is. Flexible tasks say nothing here: the frequency
   * on the right already covers them, and "Any days" as row metadata
   * would put a word on every row to describe the default.
   *
   * The other-units note joins the same line rather than taking a
   * second one — rows are a uniform height, so there is one line to
   * spend and it goes to whatever the task actually has.
   */
  const facts = [
    context,
    formatWeekdaySummary(parseWeekdays(plannedWeekdays)),
    partOfDay ? PART_OF_DAY_LABEL[partOfDay] : null,
    otherUnitNames.length > 0 ? `also ${otherUnitNames.join(" · ")}` : null,
  ].filter(Boolean);
  const detail = facts.length > 0 ? facts.join(" · ") : null;

  const surface = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const backing = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, COMMIT_AT / 2, COMMIT_AT], [0, 0.5, 1]),
  }));

  const freshTint = useAnimatedStyle(() => ({ opacity: fresh.value }));

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
          // Spoken in full: the row's abbreviations ("3×/wk", "Mon, Wed,
          // Fri") are for the eye, and a screen reader gets the words.
          accessibilityLabel={[
            title,
            formatFrequency(timesPerWeek),
            formatWeekdaySummary(parseWeekdays(plannedWeekdays)),
            partOfDay ? PART_OF_DAY_LABEL[partOfDay] : null,
            context,
            pointValue === null ? null : `${pointValue} points`,
            otherUnitNames.length
              ? `also counts toward ${otherUnitNames.join(" and ")}`
              : null,
          ]
            .filter(Boolean)
            .join(", ")}
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
          {/* Under the content, over the fill: the row reads normally,
              it's just briefly wearing its unit's colour. */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              freshTint,
              { backgroundColor: `${accent}33` },
            ]}
          />
          <View style={[styles.pip, { backgroundColor: accent }]} />
          <View style={styles.text}>
            {/* Two lines when the title is all there is, one when it
                shares the row with the detail line. Rows are a
                uniform height — `ReorderableList` positions them by
                index — so the budget is fixed and this is how it gets
                spent. The title's length is capped at `TASK_TITLE_MAX`
                so two lines is always enough to show the whole thing. */}
            <AppText color={theme.ink} numberOfLines={detail ? 1 : 2}>
              {title}
            </AppText>
            {detail ? (
              <AppText variant="footnote" color={theme.muted} numberOfLines={1}>
                {detail}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" color={theme.muted}>
            {formatFrequencyShort(timesPerWeek)}
          </AppText>
          <AppText color={theme.ink} tabular style={styles.pts}>
            {pointValue ?? ""}
          </AppText>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Fills the slot the list gives it, so the swipe backing behind the
   *  surface is never visible around its edges. */
  root: { flex: 1, overflow: "hidden", borderRadius: radius.sm },
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
    height: "100%",
    paddingLeft: space.sm,
    paddingRight: space.sm,
  },
  pip: { width: 6, height: 6, borderRadius: 3 },
  text: { flex: 1, gap: 1 },
  pts: { minWidth: 26, textAlign: "right" },
});
