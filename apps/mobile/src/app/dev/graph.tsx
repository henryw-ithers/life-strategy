/**
 * Dev spike route: exercises the real PortfolioGraph with fake
 * snapshot history. Never linked from production navigation.
 */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeFixtureSnapshots, PortfolioGraphView } from "../../components/portfolio-graph";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { getTheme, type ThemeName } from "../../theme/colors";
import { space } from "../../theme/tokens";

export default function GraphSpike() {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeName | null>(null);
  const themeName: ThemeName =
    override ?? (systemScheme === "dark" ? "dark" : "light");
  const theme = getTheme(themeName);
  const insets = useSafeAreaInsets();

  const snapshots = useMemo(() => makeFixtureSnapshots(), []);

  return (
    <ScrollView
      style={{ backgroundColor: theme.canvas }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + space.lg }]}
    >
      <AppText variant="display" color={theme.ink}>
        Portfolio graph
      </AppText>
      <AppText variant="caption" color={theme.muted}>
        Dev spike · fake data · 6 monthly snapshots
      </AppText>

      <View style={styles.toggleRow}>
        <Button
          label={themeName === "dark" ? "Switch to light" : "Switch to dark"}
          variant="secondary"
          onPress={() => setOverride(themeName === "dark" ? "light" : "dark")}
          theme={theme}
        />
      </View>

      <PortfolioGraphView snapshots={snapshots} theme={theme} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.screen,
    paddingBottom: space.xxxl,
    gap: space.md,
  },
  toggleRow: { flexDirection: "row" },
});
