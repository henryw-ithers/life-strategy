/**
 * Portfolio: the strategy layer's centerpiece on real snapshot data —
 * every diagnostic plotted as priority × satisfaction, with compare
 * trails and playback once history exists (ADR-0005).
 */
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PortfolioGraphView, type GraphSnapshot } from "../components/portfolio-graph";
import { AppText } from "../components/ui/AppText";
import { Backdrop, constellation } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import { loadGraphSnapshots } from "../db/graph";
import { getTheme } from "../theme/colors";
import { space } from "../theme/tokens";

export default function PortfolioScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const [snapshots, setSnapshots] = useState<GraphSnapshot[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      void loadGraphSnapshots().then(setSnapshots);
    }, []),
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          style={styles.back}
        >
          <AppText variant="label" color={theme.muted}>
            ‹ Back
          </AppText>
        </Pressable>

        <AppText variant="display" color={theme.ink}>
          Portfolio
        </AppText>
        <AppText color={theme.muted} style={styles.lead}>
          Every diagnostic, plotted. Watch what matters move.
        </AppText>

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
  container: { paddingHorizontal: space.screen },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  lead: { marginTop: space.xs, marginBottom: space.xl },
  empty: { gap: space.lg, marginTop: space.xxl },
});
