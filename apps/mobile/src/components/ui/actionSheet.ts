/**
 * A short list of actions from a tap, as iOS's own action sheet
 * (Henry, 2026-10-26: a window's ••• "does nothing"). The SwiftUI menu
 * hosted inside a card didn't open reliably there; the system action
 * sheet always does. The web preview gets an alert with the same
 * buttons.
 */
import { ActionSheetIOS, Alert, Platform } from "react-native";

export interface SheetAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

export function showActions(title: string | undefined, actions: readonly SheetAction[]): void {
  if (actions.length === 0) return;
  if (Platform.OS === "ios") {
    const labels = [...actions.map((a) => a.label), "Cancel"];
    const destructive = actions
      .map((a, i) => (a.destructive ? i : -1))
      .filter((i) => i >= 0);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: destructive.length > 0 ? destructive : undefined,
      },
      (i) => actions[i]?.onPress(),
    );
    return;
  }
  Alert.alert(title ?? "", undefined, [
    ...actions.map((a) => ({
      text: a.label,
      style: a.destructive ? ("destructive" as const) : ("default" as const),
      onPress: a.onPress,
    })),
    { text: "Cancel", style: "cancel" as const },
  ]);
}
