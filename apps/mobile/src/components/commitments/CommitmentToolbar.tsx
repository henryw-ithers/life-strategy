/**
 * What you do to a commitment as a whole (Henry, 2026-10-02): use
 * sub-commitments or not, archive or unarchive it, delete it. A •••
 * menu in its nav bar, out of the way of what is in it. Renaming is the
 * page's Name row, so it isn't repeated here.
 *
 * A sub-commitment's only option is delete: archiving belongs to the
 * commitment as a whole. Delete is last, and still asks first.
 *
 * Only the heading shapes the menu; the handlers go through
 * `useLatest`, so loading the page doesn't rebuild the bar (see there).
 */
import { Stack } from "expo-router";

import type { CommitmentHeading } from "../../db/commitments";
import { useLatest } from "../../hooks/useLatest";

interface CommitmentToolbarProps {
  heading: CommitmentHeading;
  onToggleSubs: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}

export function CommitmentToolbar({
  heading: { name, sub, archived, subsOn },
  ...handlers
}: CommitmentToolbarProps) {
  const latest = useLatest(handlers);
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={`Options for ${name}`}>
        {!sub && !archived ? (
          <Stack.Toolbar.MenuAction
            icon="square.split.1x2"
            onPress={() => latest.current.onToggleSubs()}
          >
            {subsOn ? "Stop using sub-commitments" : "Use sub-commitments"}
          </Stack.Toolbar.MenuAction>
        ) : null}
        {!sub ? (
          <Stack.Toolbar.MenuAction
            icon="archivebox"
            onPress={() =>
              archived ? latest.current.onUnarchive() : latest.current.onArchive()
            }
          >
            {archived ? "Unarchive" : "Archive"}
          </Stack.Toolbar.MenuAction>
        ) : null}
        <Stack.Toolbar.MenuAction
          icon="trash"
          destructive
          onPress={() => latest.current.onDelete()}
        >
          {sub ? "Delete sub-commitment" : "Delete commitment"}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
