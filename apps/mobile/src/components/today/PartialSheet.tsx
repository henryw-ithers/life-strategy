/**
 * How much of it did you do? (ADR-0014 §4.)
 *
 * **Tap is still done.** This is the long-press sheet, and it opens
 * only on a task whose owner turned part credit on — one tap, checklist
 * feel, is the constraint ADR-0004 §2 set and the one the reserved slot
 * warned this feature could break. Nothing on the checklist's surface
 * changes to make room for it.
 *
 * **Progress, never deficit** (§5). Every line here counts up: what
 * this brings you to and what it pays. There is no "remaining", no
 * colour state, no prompt to finish, and the sheet is as happy to be
 * closed at a quarter as at a whole.
 *
 * **Each option is offered at most once.** From half done, "three
 * quarters" and "all of it" would both land on 100% and pay the same —
 * two rows for one outcome, one of them a lie about what it does. So
 * increments that overshoot are dropped, and finishing is always the
 * last row.
 *
 * The move action is carried along because press-and-hold on an
 * unfinished row already meant *move it* (ADR-0024 §3). Taking that
 * over for fractions would silently cost a gesture people use.
 */
import { PARTIAL_FRACTIONS, partialPoints } from "@glide/scoring";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { TodayTask } from "../../db/today";
import { wash, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";
import { progressLabel } from "./rowCaption";

/** "a quarter", "half" — the increment, in words. */
const INCREMENT_LABEL: Record<number, string> = {
  0.25: "A quarter of it",
  0.5: "Half of it",
  0.75: "Three quarters of it",
};

interface PartialSheetProps {
  visible: boolean;
  task: TodayTask;
  theme: ThemeTokens;
  accent: string;
  onClose: () => void;
  /** The fraction this completion is for; the day holds one at a time. */
  onPick: (fraction: number) => void;
  /** Take today's completion back off. Only offered when there is one. */
  onClear: () => void;
  /** Offered when the row could also be moved — the gesture's old job. */
  onMove?: () => void;
}

export function PartialSheet({
  visible,
  task,
  theme,
  accent,
  onClose,
  onPick,
  onClear,
  onMove,
}: PartialSheetProps) {
  const insets = useSafeAreaInsets();
  /**
   * What this sheet adds to: everything banked **except today**.
   *
   * A day holds one completion per task, so picking again replaces
   * today's rather than stacking on it — the options have to start
   * from where the day began. For a recurring task that is always
   * zero; for a one-off it is the earlier days `loadDay` carries.
   */
  const done = Math.min(
    1,
    Math.max(0, task.progress - (task.fractionToday ?? 0)),
  );
  const picked = task.fractionToday;
  const value = task.pointsIfCompletedNow;

  const steps = PARTIAL_FRACTIONS.filter((f) => f < 1 && done + f < 1).map(
    (f) => ({
      fraction: f,
      label: INCREMENT_LABEL[f] ?? `${Math.round(f * 100)}%`,
      brings: done + f,
      pays: partialPoints(value, [done], f),
    }),
  );

  const finish = {
    fraction: 1,
    label: done > 0 ? "Finish it" : "All of it",
    brings: 1,
    pays: partialPoints(value, [done], 1),
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SheetFrame onClose={onClose}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.canvas,
              borderColor: theme.hairline,
              paddingBottom: insets.bottom + space.lg,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.hairline }]} />
          <AppText variant="title" color={theme.ink} numberOfLines={2}>
            {task.title}
          </AppText>
          <AppText variant="caption" color={theme.muted}>
            {done > 0
              ? `${progressLabel(done)} from before. How much today?`
              : "How much of it did you do?"}
          </AppText>

          {[...steps, finish].map((step) => (
            <Pressable
              key={step.fraction}
              onPress={() => onPick(step.fraction)}
              accessibilityRole="button"
              accessibilityLabel={`${step.label}, ${Math.round(
                step.brings * 100,
              )} per cent done, ${step.pays} points`}
              accessibilityState={{ selected: step.fraction === picked }}
              style={({ pressed }) => [
                styles.step,
                {
                  backgroundColor:
                    step.fraction === picked || step.fraction === 1
                      ? wash(accent, theme)
                      : theme.surface,
                  opacity: pressed ? 0.6 : 1,
                },
                step.fraction === picked
                  ? { borderWidth: 1, borderColor: accent }
                  : null,
              ]}
            >
              <View style={styles.grow}>
                <AppText color={theme.ink}>{step.label}</AppText>
                <AppText variant="footnote" color={theme.muted}>
                  {/* Where it takes you, not what is left over. */}
                  Takes you to {Math.round(step.brings * 100)}%
                </AppText>
              </View>
              <AppText variant="headline" color={theme.ink} tabular>
                {step.pays > 0 ? `+${step.pays}` : "0"}
              </AppText>
            </Pressable>
          ))}

          {picked !== null ? (
            <Button
              label="Clear what I logged today"
              variant="quiet"
              onPress={onClear}
              theme={theme}
            />
          ) : null}
          {onMove ? (
            <Button
              label="Move it to another part of the day"
              variant="quiet"
              onPress={onMove}
              theme={theme}
            />
          ) : null}
          <Button label="Cancel" variant="quiet" onPress={onClose} theme={theme} />
        </View>
      </SheetFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.sm + 2,
    gap: space.sm,
    maxHeight: "92%",
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    marginTop: space.xs,
  },
  grow: { flex: 1 },
});
