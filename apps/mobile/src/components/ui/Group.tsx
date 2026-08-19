/**
 * A grouped block: one `surface` fill holding a set of related rows,
 * with its label sitting outside and above it.
 *
 * This is the inset-grouped list idiom, which HIG names for
 * settings-shaped content and Material reaches for with its own
 * containers. It replaces the top-hairline-per-section pattern the
 * screens used before, where a section's extent was implied by a line
 * above it and you had to infer where it ended.
 *
 * Deliberately **not** a card grid: the fill is flat (DESIGN.md
 * reserves shadow for sheets), groups vary in height with their
 * content, and nothing nests — a `Group` inside a `Group` is always
 * the wrong answer, and rows inside one separate with hairlines.
 */
import { StyleSheet, View, type ViewStyle } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "./AppText";

interface GroupProps {
  children: React.ReactNode;
  theme: ThemeTokens;
  /** Sits above the fill, not inside it — so the box holds only content. */
  title?: string;
  /**
   * One line under the fill, explaining what the group does or costs.
   *
   * The place consequence belongs. Rows should read as names — "Daily
   * reminder", "Reset everything" — and a row that has to carry its own
   * caveat stops being scannable. Putting the caveat under the group
   * keeps the list short and still says the thing before the tap, which
   * is the whole grammar of a settings screen.
   */
  footnote?: string;
  /** Rows manage their own padding (list-shaped groups). */
  flush?: boolean;
  style?: ViewStyle;
}

export function Group({
  children,
  theme,
  title,
  footnote,
  flush,
  style,
}: GroupProps) {
  return (
    <View style={styles.wrap}>
      {title ? (
        <AppText variant="caption" color={theme.muted} style={styles.title}>
          {title}
        </AppText>
      ) : null}
      <View
        style={[
          styles.box,
          { backgroundColor: theme.surface },
          flush ? styles.flush : styles.padded,
          style,
        ]}
      >
        {children}
      </View>
      {footnote ? (
        <AppText variant="footnote" color={theme.muted} style={styles.footnote}>
          {footnote}
        </AppText>
      ) : null}
    </View>
  );
}

/** A hairline between rows inside a flush Group. Never below the last. */
export function GroupDivider({ theme }: { theme: ThemeTokens }) {
  return <View style={[styles.divider, { backgroundColor: theme.hairline }]} />;
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xl, gap: space.sm },
  title: { paddingHorizontal: space.xs },
  /** Tucked closer to its box than the box is to the next group, so it
   *  reads as belonging upward rather than floating between two. */
  footnote: { paddingHorizontal: space.xs, marginTop: -2 },
  box: { borderRadius: radius.md, overflow: "hidden" },
  padded: { padding: space.lg, gap: space.sm },
  flush: { paddingHorizontal: space.lg },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
});
