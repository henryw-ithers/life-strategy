/**
 * The two menus on a goal's screen, as native menus (ADR-0043 §1): one
 * for a condition, opened from its heading or its •••, and one for a
 * task under the goal, opened by tapping the row. These build the
 * actions; `ActionMenu` draws them.
 *
 * A move that can't happen (up from the top) is left out rather than
 * greyed, as iOS menus do.
 */
import type { GoalCondition, GoalTask } from "../../db/goals";
import type { MenuAction } from "../ui/ActionMenu";

/** Rename · reorder · remove. */
export function conditionActions(
  c: GoalCondition,
  /** All the goal's conditions, in order, for the move bounds. */
  conditions: GoalCondition[],
  on: {
    rename: (c: GoalCondition) => void;
    move: (c: GoalCondition, delta: -1 | 1) => void;
    remove: (c: GoalCondition) => void;
  },
): MenuAction[] {
  const first = conditions[0]?.id === c.id;
  const last = conditions[conditions.length - 1]?.id === c.id;
  return [
    { label: "Rename", icon: "pencil", onPress: () => on.rename(c) },
    ...(first ? [] : [{ label: "Move up", icon: "arrow.up" as const, onPress: () => on.move(c, -1) }]),
    ...(last ? [] : [{ label: "Move down", icon: "arrow.down" as const, onPress: () => on.move(c, 1) }]),
    {
      // A condition is a grouping, and removing a grouping must never
      // delete the work in it (ADR-0030), so the label says so: that is
      // where the decision is made.
      label: "Remove condition (keeps its tasks)",
      icon: "trash",
      destructive: true,
      onPress: () => on.remove(c),
    },
  ];
}

/** Everything you might want to do to a task from a goal. Editing routes
 *  to the Plan screen rather than duplicating its edit sheet: task
 *  mechanics live in one place. */
export function goalTaskActions(
  t: GoalTask,
  conditions: GoalCondition[],
  on: {
    edit: (t: GoalTask) => void;
    /** Into a condition, or out of one (`null`). */
    moveTo: (t: GoalTask, conditionId: string | null) => void;
    detach: (t: GoalTask) => void;
  },
): MenuAction[] {
  const current = conditions.find((c) => c.id === t.conditionId)?.title;
  const actions: MenuAction[] = [
    { label: "Edit in your plan", icon: "square.and.pencil", onPress: () => on.edit(t) },
    ...conditions
      .filter((c) => c.id !== t.conditionId)
      .map((c) => ({
        label: `Move to “${c.title}”`,
        icon: "arrow.right" as const,
        onPress: () => on.moveTo(t, c.id),
      })),
  ];
  if (t.conditionId) {
    actions.push({
      label: current ? `Move out of “${current}”` : "Move out of its condition",
      icon: "arrow.uturn.left",
      onPress: () => on.moveTo(t, null),
    });
  }
  actions.push({
    // Red because it removes something, but the task survives: back on
    // its own under its unit, still earning.
    label: "Remove from this goal",
    icon: "minus.circle",
    destructive: true,
    onPress: () => on.detach(t),
  });
  return actions;
}
