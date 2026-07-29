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
 * The title is Title, not Display: at 22px it still reads as the page
 * name, and the 6px it gives back is permanent screen real estate on
 * every scroll position rather than something you recover by scrolling.
 */
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "./AppText";

interface ScreenHeaderProps {
  title: string;
  theme: ThemeTokens;
  /** One trailing control or readout, vertically centred on the title. */
  right?: React.ReactNode;
}

export function ScreenHeader({ title, theme, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + space.sm, borderBottomColor: theme.hairline },
      ]}
    >
      <AppText
        variant="title"
        color={theme.ink}
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.title}
      >
        {title}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.screen,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1 },
});
