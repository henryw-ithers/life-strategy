/**
 * The portfolio graph at full size, with its own controls — compare
 * trails, playback, scrubber (ADR-0005).
 *
 * It used to be the whole Portfolio tab. It is a detail screen now:
 * the graph answers "how has this moved," which is a monthly question,
 * while the tab's own job is the ranking you might adjust any week.
 * Its scrubber also wants the screen to itself — inside a scrolling
 * parent the two gestures compete.
 */
import { useHeaderHeight } from "expo-router/react-navigation";
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, useColorScheme, View } from "react-native";

import { PortfolioGraphView, type GraphSnapshot } from "../../components/portfolio-graph";
import { LoadFailure, useScreenLoad } from "../../components/ui/ScreenLoad";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { loadGraphSnapshots } from "../../db/graph";
import { getTheme } from "../../theme/colors";
import { space } from "../../theme/tokens";

export default function PortfolioGraphScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const headerHeight = useHeaderHeight();
  const headerInset = Platform.OS === "ios" ? headerHeight : 0;
  const [snapshots, setSnapshots] = useState<GraphSnapshot[] | null>(null);

  const load = useCallback(async () => {
    setSnapshots(await loadGraphSnapshots());
  }, []);
  const { error, retry } = useScreenLoad(load);

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      {/* No scroll view: the scrubber wants the screen to itself. So the
          title is a small one (root `_layout`), and the content starts
          below the transparent nav bar by itself. */}
      <View style={[styles.body, { paddingTop: headerInset + space.sm }]}>
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : snapshots === null ? (
          <ActivityIndicator color={theme.muted} style={styles.loading} />
        ) : (
          <PortfolioGraphView snapshots={snapshots} theme={theme} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  body: { flex: 1, paddingHorizontal: space.screen },
  loading: { marginTop: space.xxl },
});
