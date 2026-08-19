/**
 * One row of a settings list: a name on the left, an optional value,
 * and a chevron when tapping it goes somewhere.
 *
 * **One component so every row has the same metrics.** The rows were
 * hand-built per screen, which meant five slightly different heights,
 * three different press opacities, and a chevron that was the text
 * character `›` set at Label weight. A typographic glyph standing in
 * for an icon is the clearest tell that a screen was assembled rather
 * than designed: it inherits the text baseline, drifts with Dynamic
 * Type, and sits at whatever weight the font happens to give it. This
 * uses the icon set the tab bar already commits to.
 *
 * **No leading icons, deliberately.** The obvious move here is Apple
 * Settings' tinted glyph tiles, and it is the wrong one twice over: the
 * app's six area hues already mean something specific (they identify
 * Strategic Life Areas), so spending them on "Reminders" would dilute
 * the one place colour carries meaning; and a ten-row settings screen
 * does not have the scanning problem that thirty-row iOS Settings
 * solves with colour. Rank, spacing and a single accent do the work.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "./AppText";

interface SettingsRowProps {
  label: string;
  /** A second line, for rows whose names are not self-explanatory. */
  detail?: string;
  /** Right-aligned current state — a time, a count, a status. */
  value?: string;
  onPress: () => void;
  /** Destructive actions take `danger`; everything else stays Ink. */
  destructive?: boolean;
  /** Screen-reader hint, for rows where the consequence is not obvious. */
  hint?: string;
  theme: ThemeTokens;
}

export function SettingsRow({
  label,
  detail,
  value,
  onPress,
  destructive,
  hint,
  theme,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={hint}
      // 0.6 is the app's pressed step for a filled surface. The row is
      // the target, not the words in it: the whole width responds.
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.text}>
        <AppText color={destructive === true ? theme.danger : theme.ink}>
          {label}
        </AppText>
        {detail ? (
          <AppText variant="caption" color={theme.muted}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText color={theme.muted} tabular>
          {value}
        </AppText>
      ) : null}
      {/* Sized to the cap height of Body rather than to the row, so it
          reads as punctuation on the line and not as a button. */}
      <Ionicons
        name="chevron-forward"
        size={16}
        color={theme.muted}
        style={styles.chevron}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * 52 rather than the 44 HIG floor: these rows carry a second line
   * often enough that a 44 row would grow unevenly down the list, and
   * an even rhythm is most of what makes a settings screen feel built.
   * Vertical padding as well as a floor, so the two-line rows breathe.
   */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.sm,
  },
  text: { flex: 1, gap: 1 },
  /** Optically centred: the glyph's own bounding box sits a hair high. */
  chevron: { marginTop: 1 },
});
