/**
 * Delete with Undo (ADR-0043 §1, spec §2.2): the thing disappears at
 * once, an Undo bar shows for about five seconds, and the delete itself
 * only runs when the bar goes. Undo cancels it before it ever runs.
 *
 * Holding the delete back, rather than reversing it afterwards, works
 * the same for every kind of thing, including the ones whose delete
 * cascades (a sub-commitment takes its tasks with it) and a photo,
 * whose file goes too. Nothing has to be rebuilt on Undo.
 *
 * The delete runs when the bar times out, when another delete replaces
 * it, when the screen loses focus or unmounts, when the app goes to the
 * background, or when the screen calls `settle` (before deleting the
 * thing that holds it). Not when the app is only inactive: pulling down
 * Notification Center mustn't take Undo away. If the app is killed
 * before then, the thing survives, which is the safe way to fail.
 *
 * With VoiceOver on, the bar doesn't time out: five seconds is too
 * short to find it. It still goes when you leave the screen.
 *
 * While a delete waits, and until the delete and the reload after it
 * have landed, its id is in `hidden`: the screen leaves that row out.
 * (Clearing it as the delete started let the row flash back until the
 * reload arrived.) Anything the delete would change elsewhere, such as
 * a day's score after an activity goes, changes when it runs.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";

import { useLatest } from "./useLatest";

/** How long the Undo bar stays up. */
export const UNDO_MS = 5000;

export interface PendingDelete {
  /** The row it hides while it waits. */
  id: string;
  /** What the bar says: "Note deleted". */
  message: string;
  /** The delete itself. */
  run: () => Promise<unknown>;
}

export interface UndoDelete {
  /** What the bar is offering to take back. */
  pending: PendingDelete | null;
  /** Rows to leave out: the pending one, and any whose delete is still
   *  landing. */
  hidden: ReadonlySet<string>;
  /** Hides the row and shows the bar. */
  remove: (deletion: PendingDelete) => void;
  /** Puts it back; the delete never runs. */
  undo: () => void;
  /** Runs any waiting delete now. */
  settle: () => Promise<void>;
}

/**
 * `commit` runs a write the way the screen saves: `useScreenLoad`'s
 * `save`, or `saveThen` with the screen's reload.
 */
export function useUndoDelete(
  commit: (write: () => Promise<unknown>) => Promise<unknown>,
): UndoDelete {
  const [pending, setPending] = useState<PendingDelete | null>(null);
  /** Deletes that have started and whose reload hasn't landed. */
  const [landing, setLanding] = useState<ReadonlySet<string>>(new Set());
  // The source of truth for "is anything waiting", set synchronously,
  // so a timeout and a blur in the same moment can't both run it.
  const waiting = useRef<PendingDelete | null>(null);
  const latestCommit = useLatest(commit);

  const finish = useCallback(async () => {
    const deletion = waiting.current;
    if (deletion === null) return;
    waiting.current = null;
    setLanding((ids) => new Set(ids).add(deletion.id));
    setPending(null);
    try {
      await latestCommit.current(deletion.run);
    } finally {
      // A failed delete reloads too (`saveThen`), so the row comes back
      // with the stored data either way.
      setLanding((ids) => {
        const next = new Set(ids);
        next.delete(deletion.id);
        return next;
      });
    }
  }, [latestCommit]);

  const remove = useCallback(
    (deletion: PendingDelete) => {
      void finish();
      waiting.current = deletion;
      setPending(deletion);
    },
    [finish],
  );

  const undo = useCallback(() => {
    if (waiting.current === null) return;
    waiting.current = null;
    setPending(null);
    AccessibilityInfo.announceForAccessibility("Restored");
  }, []);

  // The timeout, unless VoiceOver is on.
  useEffect(() => {
    if (pending === null) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((reading) => {
      if (live && !reading) timer = setTimeout(() => void finish(), UNDO_MS);
    });
    return () => {
      live = false;
      if (timer !== null) clearTimeout(timer);
    };
  }, [pending, finish]);

  // Leaving the screen, or the app, makes it final.
  useFocusEffect(
    useCallback(
      () => () => {
        void finish();
      },
      [finish],
    ),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") void finish();
    });
    return () => {
      sub.remove();
      void finish();
    };
  }, [finish]);

  const hidden = new Set(landing);
  if (pending !== null) hidden.add(pending.id);
  return { pending, hidden, remove, undo, settle: finish };
}
