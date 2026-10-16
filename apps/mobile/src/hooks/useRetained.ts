/**
 * Keeps a native sheet mounted for exactly as long as it's on screen.
 *
 * A sheet driven by "what's open" state (a task, an edit target, or
 * `true`) needs three things that plain `{x ? <Sheet/> : null}` can't
 * give it:
 *
 * - **Mounted while it slides away.** When the state clears, the sheet
 *   stays, showing the last value, so it closes with its animation
 *   instead of vanishing (`NativeSheet`).
 * - **Gone once it has closed.** `onDismissed` lets it go, so the next
 *   open mounts it fresh and its own state (a draft, a choice) starts
 *   over rather than carrying the last one.
 * - **Live `visible`.** Tie `visible` to the live state, not this.
 *
 *     const [shown, gone] = useRetained(editing);
 *     {shown ? <Sheet visible={editing !== null} onDismissed={gone} … /> : null}
 *
 * Pass state, not a value rebuilt on every render: a new object each
 * render would be stored again on every render.
 */
import { useState } from "react";

export function useRetained<T>(value: T | null): [T | null, () => void] {
  const [kept, setKept] = useState<T | null>(value);
  if (value !== null && value !== kept) setKept(value);
  const gone = () => {
    // Only if it hasn't been opened again while it was closing.
    if (value === null) setKept(null);
  };
  return [value ?? kept, gone];
}
