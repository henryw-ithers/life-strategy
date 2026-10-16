/**
 * The latest value, read through a ref that never changes.
 *
 * For handlers in a nav-bar toolbar. Any change to a screen's toolbar
 * makes react-native-screens rebuild every button in the bar, which
 * iOS 26 animates, so the buttons flicker between dim and bright
 * (Phase 3c). A toolbar whose handlers close over loaded data would
 * change on every load. Call `latest.current.onX()` from the button
 * instead: the button stays the same object, and the tap still runs
 * the newest handler.
 */
import { useLayoutEffect, useRef } from "react";

export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
