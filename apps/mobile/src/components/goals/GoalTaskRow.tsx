/**
 * A task under a goal, and the inline add row beneath a goal's lists.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import type { GoalTask } from "../../db/goals";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { formatFrequency } from "../plan/frequency";
import { AppText } from "../ui/AppText";

/**
 * One task under a goal.
 *
 * **No point value.** `task.point_value` stores a *weight* since formula
 * v9 — what a completion pays depends on the day — so a bare number here
 * would read as points and not be one. The cadence takes the slot.
 *
 * **The unit shows only when it differs from the goal's** (ADR-0030 §2):
 * a condition may recruit a task from anywhere, and that is worth saying
 * only where it is news. A pip plus muted text, never hue-coloured text:
 * four of the six area hues fail AA as text in the light theme.
 */
export function GoalTaskRow({
  task,
  goalUnitId,
  areaColors,
  theme,
  onOpen,
}: {
  task: GoalTask;
  goalUnitId: string;
  areaColors: Record<string, string>;
  theme: ThemeTokens;
  /** Opens the task's actions. Undefined on a goal that is not
   *  editable, where the row is a readout. */
  onOpen?: () => void;
}) {
  const elsewhere = task.unitId !== goalUnitId;
  const meta = [formatFrequency(task.timesPerWeek), elsewhere ? task.unitName : null].filter(
    Boolean,
  );

  return (
    <Pressable
      // Tap, not only long press: there is nowhere for a task to navigate
      // to from inside a goal, so the tap opens the actions it does have.
      // Holding does the same, for the muscle memory the day record
      // teaches.
      onPress={onOpen}
      onLongPress={
        onOpen
          ? () => {
              void Haptics.selectionAsync();
              onOpen();
            }
          : undefined
      }
      delayLongPress={350}
      disabled={!onOpen}
      accessibilityRole={onOpen ? "button" : "text"}
      accessibilityLabel={`${task.title}, ${meta.join(", ")}`}
      accessibilityHint={onOpen ? "Edit, move, or remove from this goal" : undefined}
      style={({ pressed }) => [styles.row, { opacity: pressed && onOpen ? 0.6 : 1 }]}
    >
      <View style={styles.grow}>
        <AppText color={theme.ink} numberOfLines={2}>
          {task.title}
        </AppText>
        <View style={styles.meta}>
          {elsewhere ? (
            <View
              style={[styles.pip, { backgroundColor: areaColors[task.areaId] ?? theme.muted }]}
            />
          ) : null}
          <AppText variant="footnote" color={theme.muted}>
            {meta.join(" · ")}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

/** The inline add row shared by conditions and tasks — one action, one
 *  look. */
export function GoalAddRow({
  label,
  onPress,
  accent,
  style,
}: {
  label: string;
  onPress: () => void;
  accent: string;
  /** Inside a Group the box supplies the rhythm; standing alone it has
   *  to bring its own. */
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.addRow, style, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name="add" size={16} color={accent} />
      <AppText variant="label" color={accent}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
    paddingVertical: space.sm,
  },
  grow: { flex: 1 },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: 2 },
  /** A pip, not coloured text and not a fill behind text (DESIGN.md). */
  pip: { width: 7, height: 7, borderRadius: 4 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 48,
    paddingVertical: space.sm,
  },
});
