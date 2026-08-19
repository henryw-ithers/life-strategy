/**
 * What a screen does when its data will not load.
 *
 * Every tab screen followed the same shape — a `reload` callback, a
 * `useFocusEffect` that called it as `void reload()`, and a null check
 * that rendered a spinner until data arrived. None of them had a
 * `catch`. A failed read left the spinner up forever, or an empty
 * screen that looked like an empty *plan*, and said nothing. Eight
 * screens behaved that way: goals, goal detail, tasks, portfolio, the
 * graph, settings, onboarding and the dev graph.
 *
 * The hook and the view live in one file because they are one
 * contract: `useScreenLoad` owns the failure, `LoadFailure` is what the
 * screen renders when it has one, and splitting them would let a screen
 * adopt half the pattern.
 *
 * This is the screen-level counterpart to `StartupFailure` in the root
 * layout, and deliberately reads like it: the app broke, not the user;
 * nothing was lost; here is the way back. Copy follows
 * docs/design/copy-guide.md, which is also why it apologises once and
 * not three times.
 */
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { recordProblem } from "../../lib/problemLog";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";

interface ScreenLoad {
  /** Non-null once a load has failed; clears when a retry starts. */
  error: Error | null;
  /** Run the load again. Safe to hand straight to a button. */
  retry: () => void;
}

/**
 * Run `load` whenever the screen comes into focus, and keep whatever it
 * threw.
 *
 * `load` must be memoized by the caller (a `useCallback`), the same
 * requirement the `useFocusEffect` it replaces already had — an
 * unstable identity re-runs the load on every render.
 *
 * The failure is recorded as well as shown. The screen tells the user
 * something went wrong; the problem log tells whoever they send it to
 * *what* went wrong, which is the half that used to be missing.
 */
export function useScreenLoad(load: () => Promise<void>): ScreenLoad {
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(() => {
    setError(null);
    void load().catch((thrown: unknown) => {
      const asError =
        thrown instanceof Error ? thrown : new Error(String(thrown));
      recordProblem(asError, "load");
      setError(asError);
    });
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run]),
  );

  return { error, retry: run };
}

/**
 * The screen's dead end, with a way out of it.
 *
 * Sits inside the screen's own body rather than replacing the whole
 * route, so the header and the tab bar stay put and the user is not
 * stranded on a screen with no navigation.
 */
export function LoadFailure({
  error,
  onRetry,
  theme,
}: {
  error: Error;
  onRetry: () => void;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.root}>
      <AppText variant="title" color={theme.ink}>
        This screen couldn’t load
      </AppText>
      <AppText color={theme.muted} style={styles.body}>
        Nothing is lost. Try again, and if it keeps happening, Settings ›
        Problem log has the details.
      </AppText>
      {/* Shown because it is occasionally the whole answer, and a
          tester reading it back is the fastest triage there is. */}
      <AppText variant="footnote" color={theme.muted} style={styles.body}>
        {error.message}
      </AppText>
      <View style={styles.action}>
        <Button
          label="Try again"
          variant="secondary"
          onPress={onRetry}
          theme={theme}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.xxxl,
    paddingHorizontal: space.lg,
  },
  body: { textAlign: "center", maxWidth: 340 },
  action: { marginTop: space.lg },
});
