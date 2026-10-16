/**
 * One condition on a goal (ADR-0030): what has to be true, and the tasks
 * hung underneath it. Conditions are parallel prerequisites — none
 * completes on its own.
 */
import { StyleSheet, View } from "react-native";

import type { GoalCondition, GoalTask } from "../../db/goals";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { ActionMenu, type MenuAction } from "../ui/ActionMenu";
import { AppText } from "../ui/AppText";
import { Group, GroupDivider } from "../ui/Group";
import { GoalAddRow, GoalTaskRow } from "./GoalTaskRow";

export function ConditionGroup({
  condition: c,
  goalUnitId,
  editable,
  accent,
  menu,
  taskActions,
  addChoices,
  theme,
}: {
  condition: GoalCondition;
  goalUnitId: string;
  editable: boolean;
  accent: string;
  /** Rename, reorder or remove the condition (`conditionActions`). */
  menu: MenuAction[];
  /** A task's menu (`goalTaskActions`). */
  taskActions: (task: GoalTask) => MenuAction[];
  /** Write a new task, or add one you have (`GoalAddRow`). */
  addChoices: MenuAction[];
  theme: ThemeTokens;
}) {
  return (
    <Group theme={theme} flush>
      {/* A native menu, from a tap on the heading or its •••: a
          visible control, so nobody has to guess that the heading does
          anything. */}
      {editable ? (
        <ActionMenu actions={menu} label={c.title} moreColor={theme.muted} heading>
          <View style={styles.header}>
            <AppText variant="headline" color={theme.ink}>
              {c.title}
            </AppText>
          </View>
        </ActionMenu>
      ) : (
        <View style={styles.header}>
          <AppText variant="headline" color={theme.ink} accessibilityRole="header">
            {c.title}
          </AppText>
        </View>
      )}

      {c.tasks.map((t) => (
        <View key={t.id}>
          <GroupDivider theme={theme} />
          <GoalTaskRow
            task={t}
            goalUnitId={goalUnitId}
            areaColors={theme.areas}
            theme={theme}
            actions={editable ? taskActions(t) : undefined}
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
          <GoalAddRow
            label="Add task"
            spokenLabel={`Add task to ${c.title}`}
            accent={accent}
            choices={addChoices}
          />
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
  empty: { paddingVertical: space.md },
});
