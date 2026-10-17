/**
 * Whether Reduce Transparency is on (Settings › Accessibility › Display
 * & Text Size). Custom glass becomes solid when it is (ADR-0043 §2).
 *
 * One app-wide reading, started when this module loads and kept up to
 * date by one listener, so every `Glass` starts from the same answer
 * instead of each one reading it and flipping a moment later. iOS only:
 * the web preview has no such setting.
 */
import { useSyncExternalStore } from "react";
import { AccessibilityInfo, Platform } from "react-native";

let reduce = false;
const listeners = new Set<() => void>();
const set = (on: boolean) => {
  if (on === reduce) return;
  reduce = on;
  listeners.forEach((l) => l());
};

if (Platform.OS === "ios") {
  void AccessibilityInfo.isReduceTransparencyEnabled().then(set);
  AccessibilityInfo.addEventListener("reduceTransparencyChanged", set);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useReduceTransparency(): boolean {
  return useSyncExternalStore(subscribe, () => reduce);
}
