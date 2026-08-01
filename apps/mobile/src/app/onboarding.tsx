/**
 * Onboarding (ADR-0011, as amended): welcome → diagnostic → notification
 * ask → done, then the real Tasks screen.
 *
 * Four screens, down from six. Two came out because they were saying
 * things twice:
 *
 * - The privacy screen folded into the welcome. It is one sentence, and
 *   it belongs beside the reason to proceed rather than on a page of its
 *   own that costs a tap to leave.
 * - The screen that introduced the diagnostic is gone. `/diagnostic`
 *   opens with the same sentence and its own Begin button, so reaching
 *   the first question used to take two taps on two near-identical
 *   pages. The diagnostic's intro is now the only framing.
 *
 * The old first-tasks step is gone too. It showed a private, lesser copy
 * of the Tasks screen for the top three units; now onboarding hands the
 * user to the real one, which has all eighteen and a first-run state
 * that teaches it. Same reasoning as the diagnostic: run the real
 * screen, don't maintain a second version of it.
 *
 * `step === "diagnostic"` is a waiting state rather than a screen. It
 * means the diagnostic route is on top of us; a cold start there renders
 * the welcome again so nobody lands on a blank page.
 */
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionPrescreen } from "../components/notifications/PermissionPrescreen";
import { AppText } from "../components/ui/AppText";
import { Backdrop, constellation, hueWash } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import {
  completeOnboarding,
  loadOnboardingStep,
  saveOnboardingStep,
  type OnboardingStep,
} from "../db/onboarding";
import { hasAskedNotificationPermission } from "../db/settings";
import { loadPlan } from "../db/tasks";
import { getTheme } from "../theme/colors";
import { space } from "../theme/tokens";

export default function OnboardingScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [starting, setStarting] = useState(false);

  /** Set when we push `/diagnostic`, read when we come back. A ref, not
   *  state, so arming it cannot re-run the focus effect below and
   *  cancel the very push it is waiting on. */
  const awaitingDiagnostic = useRef(false);

  useEffect(() => {
    void loadOnboardingStep().then(setStep);
  }, []);

  const go = useCallback((next: OnboardingStep) => {
    setStep(next);
    void saveOnboardingStep(next);
  }, []);

  /* Coming back from the diagnostic. Deliberately keyed to the ref
   * rather than to `step`: this screen stays mounted under
   * `/diagnostic`, so the effect runs exactly once per return, and a
   * snapshot either landed or the user backed out. */
  useFocusEffect(
    useCallback(() => {
      if (!awaitingDiagnostic.current) return;
      let cancelled = false;
      void loadPlan().then((plan) => {
        if (cancelled) return;
        awaitingDiagnostic.current = false;
        go(plan.hasSnapshot ? "notify" : "welcome");
      });
      return () => {
        cancelled = true;
      };
    }, [go]),
  );

  /* ADR-0010: an in-app "no" is final until the user visits Settings.
   * Re-running onboarding must not ask a second time. */
  useEffect(() => {
    if (step !== "notify") return;
    void hasAskedNotificationPermission().then((asked) => {
      if (asked) go("done");
    });
  }, [step, go]);

  const onStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      // Re-running onboarding from Settings must not force a second
      // diagnostic (ADR-0011 decision 6) — the monthly ritual owns that.
      const plan = await loadPlan();
      if (plan.hasSnapshot) {
        go("notify");
        return;
      }
      awaitingDiagnostic.current = true;
      go("diagnostic");
      router.push("/diagnostic" as Href);
    } finally {
      setStarting(false);
    }
  };

  const finish = async () => {
    await completeOnboarding();
    // Tasks, not Today: the next useful act is building a plan, and
    // Today has nothing to show until one exists.
    router.replace("/plan" as Href);
  };

  const screen = [styles.screen, { backgroundColor: theme.canvas }];
  const pad = {
    paddingTop: insets.top + space.xl,
    paddingBottom: insets.bottom + space.lg,
  };

  if (step === null) {
    return (
      <View style={[screen, styles.center]}>
        <ActivityIndicator color={theme.muted} />
      </View>
    );
  }

  if (step === "notify") {
    return (
      <View style={screen}>
        <Backdrop circles={hueWash(theme.accent)} />
        <PermissionPrescreen visible onDone={() => go("done")} theme={theme} />
      </View>
    );
  }

  if (step === "done") {
    return (
      <View style={screen}>
        <Backdrop circles={constellation(theme.areas)} />
        <View style={[styles.body, pad]}>
          <View style={styles.copy}>
            <AppText variant="display" color={theme.ink}>
              Ranking done
            </AppText>
            <AppText color={theme.ink} style={styles.lead}>
              Next, add a few tasks. Something small and repeatable, for
              the parts of your life that earned the most points.
            </AppText>
            <AppText color={theme.muted} style={styles.lead}>
              Your daily score out of 100 is a guideline. It shows where
              your attention went, nothing more.
            </AppText>
            {/* ADR-0008: exactly one neutral mention, framed as
             *  availability. Reads the same for every user, always. */}
            <AppText variant="caption" color={theme.muted} style={styles.lead}>
              Support resources are in Settings whenever you want them.
            </AppText>
          </View>
          <Button
            label="Add your first tasks"
            onPress={() => void finish()}
            theme={theme}
          />
        </View>
      </View>
    );
  }

  // welcome, and the waiting state behind /diagnostic
  return (
    <View style={screen}>
      <Backdrop circles={constellation(theme.areas)} />
      <View style={[styles.body, pad]}>
        <View style={styles.copy}>
          <AppText variant="display" color={theme.ink}>
            Glide
          </AppText>
          <AppText color={theme.ink} style={styles.lead}>
            Most planners begin with a to-do list. Glide begins with your
            life: six areas, eighteen parts of it.
          </AppText>
          <AppText color={theme.ink} style={styles.lead}>
            You rank what matters to you. Your daily checklist comes from
            that ranking, and it's worth 100 points.
          </AppText>
          <AppText color={theme.muted} style={styles.lead}>
            Everything you enter stays on this phone. No account, no
            server, nothing uploaded.
          </AppText>
        </View>
        <Button
          label="Start"
          onPress={() => void onStart()}
          disabled={starting}
          theme={theme}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, paddingHorizontal: space.screen, justifyContent: "space-between" },
  copy: { flex: 1, justifyContent: "center", gap: space.md },
  lead: { maxWidth: 340 },
});
