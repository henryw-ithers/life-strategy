/**
 * "Deleted …  Undo  ✕" — floats above the tab bar after a delete that
 * can be taken back.
 */
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "./AppText";

export function UndoToast({
  message,
  onUndo,
  onDismiss,
  theme,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  theme: ThemeTokens;
}) {
  return (
    <View
      style={[
        styles.toast,
        {
          backgroundColor: theme.surface,
          borderColor: theme.hairline,
          // Above the tab bar, which already clears the home indicator —
          // adding the inset again would hide it behind.
          bottom: space.lg,
        },
      ]}
    >
      <AppText color={theme.ink} style={styles.grow} numberOfLines={1}>
        {message}
      </AppText>
      <Pressable
        onPress={onUndo}
        hitSlop={8}
        accessibilityRole="button"
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <AppText variant="label" color={theme.accent}>
          Undo
        </AppText>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <AppText variant="label" color={theme.muted}>
          ✕
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: space.screen,
    right: space.screen,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  grow: { flex: 1 },
});
