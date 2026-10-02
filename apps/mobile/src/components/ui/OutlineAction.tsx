/**
 * A bordered, full-width text action — "+ Add task", "Put back in my
 * plan". Bordered so the one action in a panel reads as a control rather
 * than as another line of left-aligned text under a list.
 */
import { Pressable, StyleSheet } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "./AppText";

export function OutlineAction({
  label,
  accessibilityLabel,
  onPress,
  theme,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.hairline, opacity: pressed ? 0.5 : 1 },
      ]}
    >
      <AppText variant="label" color={theme.accent}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space.xs,
  },
});
