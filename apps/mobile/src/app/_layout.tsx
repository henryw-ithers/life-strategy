import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import migrations from "../../drizzle/migrations";
import { AppText } from "../components/ui/AppText";
import { db } from "../db/client";
import { syncTaxonomy } from "../db/seed";
import { getTheme } from "../theme/colors";
import { space } from "../theme/tokens";

/**
 * Database gate: run pending migrations, then seed the default
 * taxonomy, before rendering any screen. Screens below this layout can
 * assume the database exists and is current.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const { success, error: migrationError } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (!success) return;
    syncTaxonomy(db)
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

  // Splash screen stays visible while migrations/seed run.
  if (!success || !seeded) return null;

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
