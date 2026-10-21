/**
 * What you do to a commitment as a whole (Henry, 2026-10-02): archive
 * or unarchive it, delete it. There's no switch for sub-commitments:
 * adding the first splits it (ADR-0044 §7). A •••
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
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}

export function CommitmentToolbar({
  heading: { name, sub, archived },
  ...handlers
}: CommitmentToolbarProps) {
  const latest = useLatest(handlers);
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={`Options for ${name}`}>
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
