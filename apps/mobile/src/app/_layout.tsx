/* Per-weight subpaths, not the package barrel. The barrel's index
 * requires all seven weights, and Metro bundles every `require`d asset
 * it can reach — importing it shipped ~290 kB of ExtraLight, Light and
 * ExtraBold the app never renders. */
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import migrations from "../../drizzle/migrations";
import { AppText } from "../components/ui/AppText";
import { db } from "../db/client";
import { runDataMigrations } from "../db/migrations";
import { syncTaxonomy } from "../db/seed";
import { getTheme } from "../theme/colors";
import { space } from "../theme/tokens";

/**
 * Database and font gate: run pending migrations, seed the default
 * taxonomy, and load the type family before rendering any screen.
 * Screens below this layout can assume the database exists, is
 * current, and that Manrope is available.
 *
 * Fonts belong in the same gate as the data: rendering a frame before
 * they resolve shows the whole app in the system face and then swaps
 * it, which is the flash of unstyled text — worse here than a slightly
 * longer splash, because every screen is type.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const { success, error: migrationError } = useMigrations(db, migrations);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (!success) return;
    // Taxonomy first: data fixups may reference units it seeds.
    syncTaxonomy(db)
      .then(runDataMigrations)
      .then(() => setSeeded(true))
      .catch((e: unknown) =>
        setSeedError(e instanceof Error ? e : new Error(String(e))),
      );
  }, [success]);

  const fatal = migrationError ?? seedError;
  if (fatal) {
    return (
      <View style={[styles.center, { backgroundColor: theme.canvas }]}>
        <AppText variant="title" color={theme.ink}>
          Couldn't open your data
        </AppText>
        <AppText color={theme.muted} style={styles.errorBody}>
          Nothing is lost. Closing and reopening the app usually fixes
          this.
        </AppText>
        <AppText variant="footnote" color={theme.muted} style={styles.errorBody}>
          {fatal.message}
        </AppText>
      </View>
    );
  }

  // Splash screen stays visible while migrations, seed, and fonts run.
  // A font that fails to load is deliberately *not* fatal: the system
  // face is a perfectly readable fallback, and refusing to open the
  // app over a typeface would be the wrong trade.
  if (!success || !seeded || (!fontsLoaded && !fontError)) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.sm,
  },
  errorBody: { textAlign: "center" },
});
