/**
 * Dev spike route: exercises the real PortfolioGraph with fake
 * snapshot history. Never linked from production navigation.
 */
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeFixtureSnapshots, PortfolioGraphView } from "../../components/portfolio-graph";
import { getTheme, type ThemeName } from "../../theme/colors";

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
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16 }]}
    >
      <Text style={[styles.title, { color: theme.ink }]}>Portfolio graph</Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Dev spike · fake data · 6 monthly snapshots
      </Text>

      <Pressable
        onPress={() => setOverride(themeName === "dark" ? "light" : "dark")}
        accessibilityRole="button"
        style={[styles.themeToggle, { borderColor: theme.hairline }]}
      >
        <Text style={{ color: theme.ink, fontSize: 14, fontWeight: "500" }}>
          {themeName === "dark" ? "Switch to light" : "Switch to dark"}
        </Text>
      </Pressable>

      <PortfolioGraphView snapshots={snapshots} theme={theme} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, gap: 12 },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: -8 },
  themeToggle: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
  },
});
