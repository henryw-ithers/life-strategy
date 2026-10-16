/**
 * A value read synchronously on a screen's first render, and kept.
 *
 * For a pushed screen's nav bar (`readGoalHeading`,
 * `readCommitmentHeading`): its title and menu have to be right on the
 * first frame of the push, because a header that changes mid-push
 * rebuilds the bar's buttons over the transition (Phase 3c). The
 * screen's own load still runs and takes over once it lands.
 *
 * A failed read gives null and nothing else. All it costs is a title
 * that arrives a moment late; the screen's own load meets the same
 * failure and reports it.
 */
import { useState } from "react";

export function useFirstRead<T>(read: () => T | null): T | null {
  const [value] = useState(() => {
    try {
      return read();
    } catch {
      return null;
    }
  });
  return value;
}
