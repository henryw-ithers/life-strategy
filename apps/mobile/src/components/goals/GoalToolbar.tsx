/**
 * Things you do *to* a goal (ADR-0007): rename, pause, revise, set
 * aside, delete. They sit in the ••• menu in the goal's nav bar, where
 * iOS keeps a page's own actions, so the page itself is only the goal
 * and its work (Phase 3c). They used to be a Manage group at the foot,
 * with a Rename row that repeated tapping the title.
 *
 * Each lifecycle action keeps its one-line explanation as the menu
 * item's subtitle. Delete is last and red, and still asks first.
 */
import { Stack } from "expo-router";

import type { GoalDetail } from "../../db/goals";

export function GoalToolbar({
  status,
  onRename,
  onPause,
  onRevise,
  onSetAside,
  onDelete,
}: {
  status: GoalDetail["status"];
  onRename: () => void;
  onPause: () => void;
  onRevise: () => void;
  onSetAside: () => void;
  onDelete: () => void;
}) {
  const active = status === "active";
  // Set aside is the honest ending for a goal you tried, so it is
  // offered while the goal is still live.
  const canSetAside = active || status === "paused";
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel="Goal actions">
        <Stack.Toolbar.MenuAction icon="pencil" onPress={onRename}>
          Rename
        </Stack.Toolbar.MenuAction>
        {canSetAside ? (
          <Stack.Toolbar.Menu inline>
            {active ? (
              <Stack.Toolbar.MenuAction
                icon="pause.circle"
                subtitle="Stops for now. Its tasks stay in your plan."
                onPress={onPause}
              >
                Pause
              </Stack.Toolbar.MenuAction>
            ) : null}
            {active ? (
              <Stack.Toolbar.MenuAction
                icon="arrow.triangle.branch"
                subtitle="Rewrite it as a new goal, linked to this one."
                onPress={onRevise}
              >
                Revise
              </Stack.Toolbar.MenuAction>
            ) : null}
            {canSetAside ? (
              <Stack.Toolbar.MenuAction
                icon="archivebox"
                subtitle="The honest ending for a goal you tried. Revivable any time."
                onPress={onSetAside}
              >
                Set aside
              </Stack.Toolbar.MenuAction>
            ) : null}
          </Stack.Toolbar.Menu>
        ) : null}
        {/* Below every lifecycle action: for a goal you actually tried,
            Set aside is the honest end and this is not (ADR-0007 §1).
            This is for the goal you mistyped or never meant; anything
            it achieved survives it. */}
        <Stack.Toolbar.Menu inline>
          <Stack.Toolbar.MenuAction
            icon="trash"
            destructive
            subtitle="For a goal you never meant to make."
            onPress={onDelete}
          >
            Delete goal
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
