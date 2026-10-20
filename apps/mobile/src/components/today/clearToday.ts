/**
 * Clear today (ADR-0040 §4; spec §4.7), asked the same way from Home's
 * ⋯ and from Settings. An Away day has nothing to clear; a day already
 * cleared offers Undo, which works until the day ends (EC-28).
 */
import { Alert } from "react-native";

import { setDayKind } from "../../db/dayGrades";
import { clearToday, isCleared, loadAwayRanges, undoClearToday } from "../../db/skips";
import { currentLocalDate } from "../../lib/calendar";

/** Run a write, then `onDone`; say so if it fails. */
function run(write: () => Promise<unknown>, onDone: () => void): void {
  void write()
    .then(onDone)
    .catch((e: unknown) =>
      Alert.alert("That didn't work", e instanceof Error ? e.message : String(e)),
    );
}

export async function askClearToday(onDone: () => void): Promise<void> {
  const today = currentLocalDate();
  const [cleared, ranges] = await Promise.all([isCleared(today), loadAwayRanges()]);
  if (ranges.some((r) => r.startDate <= today && today <= r.endDate)) {
    Alert.alert("You're away today", "Away days have no windows or events to set aside.");
    return;
  }
  if (cleared) {
    Alert.alert("Today's cleared", undefined, [
      { text: "Undo", onPress: () => run(undoClearToday, onDone) },
      { text: "OK", style: "cancel" },
    ]);
    return;
  }
  Alert.alert(
    "Clear today?",
    "Today's windows and remaining events are set aside. Your open tasks show in one list.",
    [
      { text: "Clear today", onPress: () => run(clearToday, onDone) },
      {
        text: "Make it a day off instead",
        onPress: () => run(() => setDayKind(today, "rest"), onDone),
      },
      { text: "Cancel", style: "cancel" },
    ],
  );
}

/** Undo Clear today, from Home's line. */
export function undoClear(onDone: () => void): void {
  run(undoClearToday, onDone);
}
