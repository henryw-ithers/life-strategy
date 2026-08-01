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
import { Stack, usePathname, type ErrorBoundaryProps } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  useColorScheme,
  View,
  type ErrorUtils as RNErrorUtils,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import migrations from "../../drizzle/migrations";
import { AppText } from "../components/ui/AppText";
import { Button } from "../components/ui/Button";
import { db, openDatabase } from "../db/client";
import { runDataMigrations } from "../db/migrations";
import { syncTaxonomy } from "../db/seed";
import { noteRoute, recordProblem } from "../lib/problemLog";
import { getTheme } from "../theme/colors";
import { space } from "../theme/tokens";

/**
 * Everything React never sees — uncaught async rejections, errors in
 * timers, native callbacks (ADR-0013 decision 4).
 *
 * Installed at module scope so it is in place before the first render,
 * which is when the riskiest work in the app happens. It **always**
 * delegates to the handler it replaced: this layer observes, it does
 * not swallow, so the dev-time red screen still appears and a release
 * build's fatality is unchanged.
 *
 * The flag makes installation idempotent. Fast Refresh re-runs this
 * module, and without it each reload would wrap the previous wrapper —
 * one crash, one log entry per reload since the app started.
 */
const globalScope = globalThis as {
  ErrorUtils?: RNErrorUtils;
  __glideProblemHandlerInstalled?: boolean;
};
if (globalScope.ErrorUtils && !globalScope.__glideProblemHandlerInstalled) {
  globalScope.__glideProblemHandlerInstalled = true;
  const previous = globalScope.ErrorUtils.getGlobalHandler();
  globalScope.ErrorUtils.setGlobalHandler((error, isFatal) => {
    recordProblem(error, "fatal");
    previous(error, isFatal);
  });
}

/**
 * Connection gate. Native has a database the moment this module loads,
 * but web cannot open one synchronously at all — SQLite lives in a Web
 * Worker there, and the connection arrives a bundle-load later (see
 * [client.web.ts](../db/client.web.ts)).
 *
 * It is a separate component from the gate below rather than another
 * piece of state inside it because `useMigrations` reads `db` from an
 * effect that runs once on mount and never retries. Mounting that gate
 * only after the connection exists is what makes the ordering a fact
 * rather than a race.
 */
export default function RootLayout() {
  const [opened, setOpened] = useState(false);
  const [openError, setOpenError] = useState<Error | null>(null);

  useEffect(() => {
    let live = true;
    openDatabase()
      .then(() => {
        if (live) setOpened(true);
      })
      .catch((e: unknown) => {
        if (live) setOpenError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      live = false;
    };
  }, []);

  if (openError) return <StartupFailure error={openError} />;
  // Splash screen stays visible while the connection opens.
  if (!opened) return null;

  return <MigrationGate />;
}

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
function MigrationGate() {
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
  if (fatal) return <StartupFailure error={fatal} />;

  // Splash screen stays visible while migrations, seed, and fonts run.
  // A font that fails to load is deliberately *not* fatal: the system
  // face is a perfectly readable fallback, and refusing to open the
  // app over a typeface would be the wrong trade.
  if (!success || !seeded || (!fontsLoaded && !fontError)) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <RouteWitness />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}

/**
 * The one screen shown when startup cannot finish — the connection, the
 * migrations, or the seed. All three fail the same way from the user's
 * side (the app has no data to show) and read the same way in copy, so
 * they share one dead end rather than three.
 */
function StartupFailure({ error }: { error: Error }) {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");

  // Recorded once per distinct failure, not once per render — this
  // screen re-renders on theme changes and has no other exit.
  const recorded = useRef<Error | null>(null);
  useEffect(() => {
    if (recorded.current === error) return;
    recorded.current = error;
    recordProblem(error, "startup");
  }, [error]);

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
        {error.message}
      </AppText>
    </View>
  );
}

/**
 * Keeps the problem log's idea of "where the user was" current.
 *
 * Its own component rather than a `usePathname()` in `RootLayout`,
 * because the hook re-renders its owner on every navigation and the
 * gate above owns the migration and font state. Renders nothing.
 */
function RouteWitness() {
  const pathname = usePathname();
  useEffect(() => {
    noteRoute(pathname);
  }, [pathname]);
  return null;
}

/**
 * Expo Router picks this export up and wraps every route below this
 * layout in it (ADR-0013 decision 4), so a render error becomes a
 * screen the user can leave rather than a blank one.
 *
 * Copy follows docs/design/copy-guide.md: the app broke, not the user,
 * and it says so once. The message is shown because it is occasionally
 * the whole answer, and the tester reading it back is the fastest
 * triage path there is.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");

  // Effect, not render body: recording is a side effect, and under the
  // React Compiler a write during render is exactly what it's allowed
  // to move.
  useEffect(() => {
    recordProblem(error, "render");
  }, [error]);

  return (
    <View style={[styles.center, { backgroundColor: theme.canvas }]}>
      <AppText variant="title" color={theme.ink}>
        This screen ran into a problem
      </AppText>
      <AppText color={theme.muted} style={styles.errorBody}>
        Your data is untouched. Nothing was being saved. Try again, and if
        it keeps happening, Settings › Problem log has the details.
      </AppText>
      <AppText variant="footnote" color={theme.muted} style={styles.errorBody}>
        {error.message}
      </AppText>
      <View style={styles.retry}>
        <Button
          label="Try again"
          variant="secondary"
          onPress={() => void retry()}
          theme={theme}
        />
      </View>
    </View>
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
  retry: { marginTop: space.lg },
});
