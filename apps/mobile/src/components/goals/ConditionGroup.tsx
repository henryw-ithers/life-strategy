/**
 * One condition on a goal (ADR-0030): what has to be true, and the tasks
 * hung underneath it. Conditions are parallel prerequisites — none
 * completes on its own.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";

import type { GoalCondition, GoalTask } from "../../db/goals";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Group, GroupDivider } from "../ui/Group";
import { GoalAddRow, GoalTaskRow } from "./GoalTaskRow";

export function ConditionGroup({
  condition: c,
  goalUnitId,
  editable,
  accent,
  onOpenMenu,
  onOpenTask,
  onAddTask,
  theme,
}: {
  condition: GoalCondition;
  goalUnitId: string;
  editable: boolean;
  accent: string;
  /** Rename, reorder or remove the condition. */
  onOpenMenu: () => void;
  onOpenTask: (task: GoalTask) => void;
  onAddTask: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Group theme={theme} flush>
      {/* A visible control, not only a hidden gesture: long press still
          works and is faster once known, but a person new to the screen
          has no reason to guess that holding a heading does anything. */}
      <View style={styles.header}>
        <Pressable
          onLongPress={
            editable
              ? () => {
                  void Haptics.selectionAsync();
                  onOpenMenu();
                }
              : undefined
          }
          delayLongPress={350}
          disabled={!editable}
          accessibilityRole="header"
          accessibilityLabel={c.title}
          style={styles.grow}
        >
          <AppText variant="headline" color={theme.ink}>
            {c.title}
          </AppText>
        </Pressable>
        {editable ? (
          <Pressable
            onPress={onOpenMenu}
            accessibilityRole="button"
            accessibilityLabel={`Edit condition: ${c.title}`}
            accessibilityHint="Rename, reorder or remove"
            hitSlop={10}
            style={({ pressed }) => [styles.more, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.muted} />
          </Pressable>
        ) : null}
      </View>

      {c.tasks.map((t) => (
        <View key={t.id}>
          <GroupDivider theme={theme} />
          <GoalTaskRow
            task={t}
            goalUnitId={goalUnitId}
            areaColors={theme.areas}
            theme={theme}
            onOpen={editable ? () => onOpenTask(t) : undefined}
          />
        </View>
      ))}

      {/* A condition with nothing under it is a statement of intent, not
          an error (ADR-0030 §3) — so the copy says what it is waiting
          for rather than what is missing. */}
      {c.tasks.length === 0 ? (
        <>
          <GroupDivider theme={theme} />
          <AppText variant="caption" color={theme.muted} style={styles.empty}>
            Nothing under this yet.
          </AppText>
        </>
      ) : null}

      {editable ? (
        <>
          <GroupDivider theme={theme} />
          <GoalAddRow label="Add task" accent={accent} onPress={onAddTask} />
        </>
      ) : null}
    </Group>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 48,
    paddingVertical: space.sm,
  },
  grow: { flex: 1 },
  more: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: space.md },
});
