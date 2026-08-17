import { Pressable, StyleSheet, Text } from "react-native";

import { solidFill, type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";

interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * primary: filled, onAccent label. Pass whichever hue the action
   *   belongs to; the fill is resolved through `solidFill`, which in
   *   light theme deepens an area hue to where the white label clears
   *   AA. Callers never need to know which hues need it.
   * tonal: a wash of the accent, ink label — a standing action that
   *   sits on a screen all the time and shouldn't shout every visit,
   *   but would vanish as `secondary` against surface-filled content.
   * secondary: surface-filled, ink label, for neutral actions.
   * quiet: borderless text button for tertiary actions.
   */
  variant?: "primary" | "tonal" | "secondary" | "quiet";
  /** Fill color for primary and tonal (defaults to theme.accent). */
  color?: string;
  /** Leading glyph for tonal, at the label's size; not announced. */
  glyph?: string;
  disabled?: boolean;
  theme: ThemeTokens;
}

/** The app's only button. Four variants, all states. */
export function Button({
  label,
  onPress,
  variant = "primary",
  color,
  glyph,
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

  if (variant === "tonal") {
    // The label stays Ink: the accent on its own wash lands at 4.3:1,
    // under AA at this size. The tint carries which action it is; the
    // ink carries the reading. Dark canvas swallows 12%, so it takes
    // nearer 18% to register as a surface at all.
    const wash = `${fill}${theme.name === "dark" ? "2e" : "1f"}`;
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled === true }}
        style={({ pressed }) => [
          styles.tonal,
          {
            backgroundColor: wash,
            opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          },
        ]}
      >
        {glyph ? (
          <Text
            importantForAccessibility="no"
            style={[typeScale.label, { color: theme.ink }]}
          >
            {glyph}
          </Text>
        ) : null}
        <Text style={[typeScale.label, { color: theme.ink }]}>{label}</Text>
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
          // The one place a hue becomes a fill behind a label; the
          // tonal and secondary variants never need it (Ink labels).
          backgroundColor: solidFill(fill, theme),
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
  tonal: {
    minHeight: 48,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
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
