/**
 * Portfolio: the strategy layer's centerpiece on real snapshot data —
 * every diagnostic plotted as priority × satisfaction, with compare
 * trails and playback once history exists (ADR-0005).
 */
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import { PortfolioGraphView, type GraphSnapshot } from "../../components/portfolio-graph";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { Button } from "../../components/ui/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { loadGraphSnapshots } from "../../db/graph";
import { getTheme } from "../../theme/colors";
import { space } from "../../theme/tokens";

export default function PortfolioScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [snapshots, setSnapshots] = useState<GraphSnapshot[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadGraphSnapshots().then(setSnapshots);
    }, []),
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <ScreenHeader title="Portfolio" theme={theme} />
      <ScrollView style={styles.body} contentContainerStyle={styles.container}>
        {snapshots === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxl }} />
        ) : snapshots.length === 0 ? (
          <View style={styles.empty}>
            <AppText color={theme.ink} style={{ textAlign: "center" }}>
              Your portfolio starts with a diagnostic. Rate what matters,
              and it lands here.
            </AppText>
            <Button
              label="Run the diagnostic"
              onPress={() => router.push("/diagnostic" as Href)}
              theme={theme}
            />
          </View>
        ) : (
          <>
            <PortfolioGraphView snapshots={snapshots} theme={theme} />
            <View style={{ height: space.xl }} />
            <Button
              label="Update your portfolio"
              variant="secondary"
              onPress={() => router.push("/diagnostic" as Href)}
              theme={theme}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  /** Takes the space between the fixed header and the tab bar; the
   *  graph scrolls inside it while both stay put. */
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingTop: space.lg, paddingBottom: space.xl },
  empty: { gap: space.lg, marginTop: space.xxl },
});
