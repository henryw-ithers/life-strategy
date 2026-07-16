import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import migrations from "../../drizzle/migrations";
import { db } from "../db/client";
import { seedTaxonomy } from "../db/seed";

/**
 * Database gate: run pending migrations, then seed the default
 * taxonomy, before rendering any screen. Screens below this layout can
 * assume the database exists and is current.
 */
export default function RootLayout() {
  const { success, error: migrationError } = useMigrations(db, migrations);
  const [seeded, setSeeded] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (!success) return;
    seedTaxonomy(db)
      .then(() => setSeeded(true))
      .catch((e: unknown) =>
        setSeedError(e instanceof Error ? e : new Error(String(e))),
      );
  }, [success]);

  const fatal = migrationError ?? seedError;
  if (fatal) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Database setup failed</Text>
        <Text style={styles.errorBody}>{fatal.message}</Text>
      </View>
    );
  }

  // Splash screen stays visible while migrations/seed run.
  if (!success || !seeded) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  errorBody: { textAlign: "center" },
});
