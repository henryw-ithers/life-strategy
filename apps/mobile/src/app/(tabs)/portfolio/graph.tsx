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
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PortfolioGraphView, type GraphSnapshot } from "../../../components/portfolio-graph";
import { AppText } from "../../../components/ui/AppText";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { Backdrop, constellation } from "../../../components/ui/Backdrop";
import { loadGraphSnapshots } from "../../../db/graph";
import { getTheme } from "../../../theme/colors";
import { space } from "../../../theme/tokens";

export default function PortfolioGraphScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const [snapshots, setSnapshots] = useState<GraphSnapshot[] | null>(null);

  const load = useCallback(async () => {
    setSnapshots(await loadGraphSnapshots());
  }, []);
  const { error, retry } = useScreenLoad(load);

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={styles.back}
        >
          <AppText variant="label" color={theme.muted}>
            ‹ Portfolio
          </AppText>
        </Pressable>
        <AppText variant="display" color={theme.ink} accessibilityRole="header">
          Your portfolio
        </AppText>
      </View>

      <View style={styles.body}>
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
  header: { paddingHorizontal: space.screen, paddingBottom: space.md },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  body: { flex: 1, paddingHorizontal: space.screen },
  loading: { marginTop: space.xxl },
});
