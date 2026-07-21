import { Pressable, StyleSheet, Text } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";

interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * primary: filled, onAccent label (fill must be an accent/area hue).
   * secondary: surface-filled, ink label, for neutral actions.
   * quiet: borderless text button for tertiary actions.
   */
  variant?: "primary" | "secondary" | "quiet";
  /** Fill color for primary (defaults to theme.accent). */
  color?: string;
  disabled?: boolean;
  theme: ThemeTokens;
}

/** The app's only button. Two variants, all states. */
export function Button({
  label,
  onPress,
  variant = "primary",
  color,
  disabled,
  theme,
}: ButtonProps) {
  const fill = color ?? theme.accent;

  if (variant === "quiet") {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled === true }}
        style={({ pressed }) => [styles.quiet, { opacity: disabled ? 0.4 : pressed ? 0.55 : 1 }]}
      >
        <Text style={[typeScale.label, { color: theme.muted }]}>{label}</Text>
      </Pressable>
    );
  }

  if (variant === "secondary") {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled === true }}
        style={({ pressed }) => [
          styles.secondary,
          {
            backgroundColor: theme.surface,
            opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[typeScale.label, { color: theme.ink }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      style={({ pressed }) => [
        styles.primary,
        {
          backgroundColor: fill,
          opacity: disabled ? 0.35 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Text style={[typeScale.headline, { color: theme.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  secondary: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
  },
  quiet: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
});
