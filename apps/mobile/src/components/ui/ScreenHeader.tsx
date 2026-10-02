/**
 * A tab screen's fixed header. It does not scroll — the content below
 * it does.
 *
 * This replaces the large-title-collapsing-on-scroll pattern the tab
 * bar first shipped with. Both solve "which page am I on," but a
 * screen framed top and bottom (header, tab bar) with one scrolling
 * middle gives the content more room and a steadier reading position:
 * the list moves, the furniture doesn't. It also drops a whole
 * scroll-linked animation for a plain View.
 *
 * The title is Display (28px), matching Home and the ritual screens —
 * every page header in the app is now one size.
 *
 * A screen pushed on top of the tabs passes `onBack` and gets the same
 * "‹ Back" link the other pushed screens carry. Settings needed it: it
 * moved from a tab to a pushed screen and kept the tab header, which
 * left the edge swipe as the only way out.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "./AppText";

interface ScreenHeaderProps {
  title: string;
  theme: ThemeTokens;
  /** One trailing control or readout, vertically centred on the title. */
  right?: React.ReactNode;
  /** Set on a pushed screen: shows "‹ Back" above the title. */
  onBack?: () => void;
}

export function ScreenHeader({
  title,
  theme,
  right,
  onBack,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + space.sm,
          borderBottomColor: theme.hairline,
        },
      ]}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={styles.back}
        >
          <AppText variant="label" color={theme.muted}>
            ‹ Back
          </AppText>
        </Pressable>
      ) : null}
      <View style={styles.titleRow}>
        <AppText
          variant="display"
          color={theme.ink}
          accessibilityRole="header"
          numberOfLines={1}
          style={styles.title}
        >
          {title}
        </AppText>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: space.screen,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  title: { flex: 1 },
});
