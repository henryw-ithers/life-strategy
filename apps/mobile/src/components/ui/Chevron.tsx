/**
 * The two chevrons the app uses: one that says *this leads somewhere*,
 * and one that says *this opens*.
 *
 * They were typed characters — `›`, `▾`, `▸`, `▴` — set inside
 * `AppText`. That is the clearest signal that a screen was assembled
 * rather than designed, and it fails in three concrete ways: the glyph
 * inherits the text baseline instead of sitting on the row's optical
 * centre, it scales with Dynamic Type and drifts out of alignment at
 * large sizes, and its weight is whatever Manrope happens to give that
 * codepoint rather than a chosen one. `›` in particular is a single
 * guillemet — a quotation mark — doing the job of a disclosure arrow.
 *
 * Ionicons because the tab bar already commits to it (DESIGN.md,
 * Navigation). One icon set per app; a second one is a seam a user can
 * feel even when they cannot name it.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet } from "react-native";

import type { ThemeTokens } from "../../theme/colors";

interface ChevronProps {
  /** Muted by default; pass `theme.accent` on an inline action. */
  color?: string;
  theme: ThemeTokens;
  /** Matches the cap height of the text it sits beside. */
  size?: number;
}

/** Trailing a row that navigates. Never on a row that only toggles. */
export function Chevron({ color, theme, size = 16 }: ChevronProps) {
  return (
    <Ionicons
      name="chevron-forward"
      size={size}
      color={color ?? theme.muted}
      style={styles.nudge}
    />
  );
}

/**
 * A section that expands. Points down when open, right when closed —
 * the platform convention, and the one that reads as "there is more
 * below" rather than "there is more over there".
 */
export function Disclosure({
  open,
  color,
  theme,
  size = 16,
}: ChevronProps & { open: boolean }) {
  return (
    <Ionicons
      name={open ? "chevron-down" : "chevron-forward"}
      size={size}
      color={color ?? theme.muted}
      style={styles.nudge}
    />
  );
}

const styles = StyleSheet.create({
  /** The glyph's bounding box sits a hair above the text baseline it
   *  aligns to; one point down puts it back on the optical centre. */
  nudge: { marginTop: 1 },
});
