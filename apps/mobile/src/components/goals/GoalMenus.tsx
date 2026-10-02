/**
 * The two press-and-hold menus on a goal's screen: one for a condition,
 * one for a task under the goal. Each closes itself before acting, so
 * the screen only says what each choice does.
 */
import type { GoalCondition, GoalTask } from "../../db/goals";
import type { ThemeTokens } from "../../theme/colors";
import { MenuSheet, type MenuRow } from "../ui/MenuSheet";

/** Close the menu, then act on what it was opened for. */
export const fromMenu =
  <T,>(target: T | null, close: () => void, act: (t: T) => void) =>
  () => {
    close();
    if (target) act(target);
  };

/** Rename · reorder · remove, held by a long press — the same gesture
 *  and card the day record uses. */
export function ConditionMenu({
  condition,
  conditions,
  onClose,
  onRename,
  onMove,
  onRemove,
  theme,
}: {
  /** The condition the menu is open for; null while closed. */
  condition: GoalCondition | null;
  /** All the goal's conditions, in order, for the move bounds. */
  conditions: GoalCondition[];
  onClose: () => void;
  onRename: (c: GoalCondition) => void;
  onMove: (c: GoalCondition, delta: -1 | 1) => void;
  onRemove: (c: GoalCondition) => void;
  theme: ThemeTokens;
}) {
  const act = (fn: (c: GoalCondition) => void) => fromMenu(condition, onClose, fn);
  return (
    <MenuSheet
      visible={condition !== null}
      theme={theme}
      onClose={onClose}
      rows={[
        { label: "Rename", onPress: act(onRename) },
        {
          label: "Move up",
          disabled: conditions[0]?.id === condition?.id,
          onPress: act((c) => onMove(c, -1)),
        },
        {
          label: "Move down",
          disabled: conditions[conditions.length - 1]?.id === condition?.id,
          onPress: act((c) => onMove(c, 1)),
        },
        {
          // A condition is a grouping, and removing a grouping must never
          // delete the work in it (ADR-0030) — said on the button,
          // because that is where the decision is made.
          label: "Remove condition (keeps its tasks)",
          destructive: true,
          onPress: act(onRemove),
        },
      ]}
    />
  );
}

/** Everything you might want to do to a task from a goal. Editing routes
 *  to the Plan screen rather than duplicating its edit sheet: task
 *  mechanics live in one place. */
export function GoalTaskMenu({
  task,
  conditions,
  onClose,
  onEdit,
  onMoveTo,
  onDetach,
  theme,
}: {
  /** The task the menu is open for; null while closed. */
  task: GoalTask | null;
  conditions: GoalCondition[];
  onClose: () => void;
  onEdit: (t: GoalTask) => void;
  /** Into a condition, or out of one (`null`). */
  onMoveTo: (t: GoalTask, conditionId: string | null) => void;
  onDetach: (t: GoalTask) => void;
  theme: ThemeTokens;
}) {
  const act = (fn: (t: GoalTask) => void) => fromMenu(task, onClose, fn);
  const currentTitle = conditions.find((c) => c.id === task?.conditionId)?.title;

  const rows: MenuRow[] = [
    { label: "Edit in your plan", onPress: act(onEdit) },
    ...conditions
      .filter((c) => c.id !== task?.conditionId)
      .map((c) => ({ label: `Move to “${c.title}”`, onPress: act((t) => onMoveTo(t, c.id)) })),
  ];
  if (task?.conditionId) {
    rows.push({
      label: currentTitle ? `Move out of “${currentTitle}”` : "Move out of its condition",
      onPress: act((t) => onMoveTo(t, null)),
    });
  }
  rows.push({
    // Destructive-coloured because it removes something, but the task
    // survives — back on its own under its unit, still earning.
    label: "Remove from this goal",
    destructive: true,
    onPress: act(onDetach),
  });

  return (
    <MenuSheet
      visible={task !== null}
      theme={theme}
      onClose={onClose}
      title={task?.title}
      rows={rows}
    />
  );
}
