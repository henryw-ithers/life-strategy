/**
 * Onboarding (ADR-0011, as amended twice): welcome → method →
 * diagnostic → weights → rhythm → notification ask → done, then the
 * real Tasks screen.
 *
 * **Six screens, up from four (2026-08-18).** The 2026-07-30 amendment
 * cut this flow because a tester found it padded, and it was: what came
 * out was a Begin screen standing in front of another Begin screen, and
 * a private half-copy of the Tasks screen. Both were the same thing
 * said twice. Neither was an explanation of the method, because there
 * wasn't one. A user could finish the whole flow without ever being
 * told what a Strategic Life Unit is, why comparing two of them
 * produces a weight, or why their score behaves the way it does.
 *
 * So the shape of the fix is not "restore the deleted screens". It is:
 *
 * - **One screen before the diagnostic** (`method`), because five
 *   minutes of pairwise ranking is a lot to ask of someone who has not
 *   been told what it is for. It sits directly in front of the ask.
 * - **Two screens after it** (`weights`, `rhythm`), which is where the
 *   teaching actually lands. `weights` reads the snapshot the user just
 *   made and shows their own numbers; `rhythm` explains the 80/20 bands
 *   that decide what their score can reach. Explaining either one
 *   before the diagnostic would be explaining arithmetic about numbers
 *   that do not exist yet.
 *
 * That is the same bet the 2026-07-30 amendment made when it deleted
 * the first-tasks step and handed the user to the real Tasks screen:
 * the model teaches better against real values than against a diagram.
 *
 * The band figures are imported from `@glide/scoring`, not typed into
 * the copy, so the sentence "daily habits reach 80" cannot outlive the
 * constant it describes.
 *
 * `step === "diagnostic"` is a waiting state rather than a screen. It
 * means the diagnostic route is on top of us; a cold start there renders
 * the welcome again so nobody lands on a blank page.
 *
 * Displayed copy carries no em dashes (ADR-0011 action item 5): the
 * first tester read them as a machine's writing.
 */
import { ROUTINE_BAND, VARIABLE_BAND } from "@glide/scoring";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionPrescreen } from "../components/notifications/PermissionPrescreen";
import { AppText } from "../components/ui/AppText";
import { Backdrop, constellation, hueWash } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import { LoadFailure } from "../components/ui/ScreenLoad";
import {
  completeOnboarding,
  loadOnboardingStep,
  saveOnboardingStep,
  type OnboardingStep,
} from "../db/onboarding";
import { hasAskedNotificationPermission } from "../db/settings";
import { loadPlan, type PlanData } from "../db/tasks";
import { recordProblem } from "../lib/problemLog";
import { getTheme, type ThemeTokens } from "../theme/colors";
import { radius, space } from "../theme/tokens";

/** How many of the eighteen the `weights` screen names. Enough to show
 *  a spread between top and bottom without becoming a list to read. */
const WEIGHTS_SHOWN = 6;

export default function OnboardingScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [starting, setStarting] = useState(false);
  /** Onboarding stands between the user and the whole app, so a failed
   *  read here strands them completely. It gets a way out. */
  const [error, setError] = useState<Error | null>(null);
  /** Loaded once the diagnostic has produced a snapshot; the `weights`
   *  screen is the user's own ranking, not an example of one. */
  const [plan, setPlan] = useState<PlanData | null>(null);

  /** Set when we push `/diagnostic`, read when we come back. A ref, not
   *  state, so arming it cannot re-run the focus effect below and
   *  cancel the very push it is waiting on. */
  const awaitingDiagnostic = useRef(false);

  /** One funnel for every load in this screen: record it, then show it. */
  const fail = useCallback((thrown: unknown) => {
    const asError = thrown instanceof Error ? thrown : new Error(String(thrown));
    recordProblem(asError, "load");
    setError(asError);
  }, []);

  const loadStep = useCallback(() => {
    setError(null);
    void loadOnboardingStep().then(setStep).catch(fail);
  }, [fail]);

  useEffect(loadStep, [loadStep]);

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
      void loadPlan()
        .then((fresh) => {
          if (cancelled) return;
          awaitingDiagnostic.current = false;
          if (fresh.hasSnapshot) setPlan(fresh);
          go(fresh.hasSnapshot ? "weights" : "welcome");
        })
        .catch(fail);
      return () => {
        cancelled = true;
      };
    }, [go, fail]),
  );

  /* A cold start straight onto `weights` has no plan in memory: the
   * snapshot is on disk but this component was just mounted. */
  useEffect(() => {
    if (step !== "weights" || plan !== null) return;
    let cancelled = false;
    void loadPlan()
      .then((fresh) => {
        if (!cancelled) setPlan(fresh);
      })
      .catch(fail);
    return () => {
      cancelled = true;
    };
  }, [step, plan, fail]);

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
      setError(null);
      // Re-running onboarding from Settings must not force a second
      // diagnostic (ADR-0011 decision 6) the monthly ritual owns that.
      // It lands on `weights` rather than skipping to the notification
      // ask, because re-reading the explanation against real numbers is
      // most of why someone re-runs this.
      const existing = await loadPlan();
      if (existing.hasSnapshot) {
        setPlan(existing);
        go("weights");
        return;
      }
      awaitingDiagnostic.current = true;
      go("diagnostic");
      router.push("/diagnostic" as Href);
    } catch (thrown: unknown) {
      fail(thrown);
    } finally {
      setStarting(false);
    }
  };

  const finish = async () => {
    try {
      await completeOnboarding();
    } catch (thrown: unknown) {
      // Without this the button would simply stop working, with no
      // explanation and no way to leave onboarding.
      fail(thrown);
      return;
    }
    // Tasks, not Today: the next useful act is building a plan, and
    // Today has nothing to show until one exists.
    router.replace("/plan" as Href);
  };

  /** Every scoring unit the user ranked, heaviest first. */
  const ranked = useMemo(() => {
    if (plan === null) return [];
    return plan.areas
      .flatMap((area) => area.units.map((u) => ({ ...u, areaId: area.id })))
      .filter((u): u is typeof u & { weight: number } => u.weight !== null)
      .sort((a, b) => b.weight - a.weight);
  }, [plan]);

  const screen = [styles.screen, { backgroundColor: theme.canvas }];
  const pad = {
    paddingTop: insets.top + space.xl,
    paddingBottom: insets.bottom + space.lg,
  };

  if (error) {
    return (
      <View style={[screen, styles.center]}>
        <LoadFailure error={error} onRetry={loadStep} theme={theme} />
      </View>
    );
  }

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

  if (step === "method") {
    return (
      <Page theme={theme} pad={pad} action="Start ranking" onPress={() => void onStart()} busy={starting}>
        <AppText variant="display" color={theme.ink}>
          Eighteen parts
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          Sleep. Friendship. Money. Hobbies. Each one is a real part of
          being a person, and each one wants the same hours as the rest.
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          You will see them two at a time. The question is never whether
          something matters. It is which of these two matters more to
          you, right now.
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          Comparing two things is easier than scoring eighteen out of
          ten, and it gives an answer a rating scale cannot: an order,
          with real distances in it.
        </AppText>
        <AppText variant="caption" color={theme.muted} style={styles.lead}>
          About five minutes. You only do this once, then once a month if
          you want to.
        </AppText>
      </Page>
    );
  }

  if (step === "weights") {
    const shown = ranked.slice(0, WEIGHTS_SHOWN);
    const rest = ranked.length - shown.length;
    return (
      <Page theme={theme} pad={pad} action="Next" onPress={() => go("rhythm")}>
        <AppText variant="display" color={theme.ink}>
          Your 100 points
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          Your answers turned into a number for each part of your life.
          They add up to 100, because a day does.
        </AppText>
        {plan === null ? (
          <ActivityIndicator color={theme.muted} />
        ) : (
          <View style={styles.weights}>
            {shown.map((u) => (
              <View key={u.id} style={styles.weightRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: theme.areas[u.areaId] ?? theme.muted },
                  ]}
                />
                <AppText color={theme.ink} style={styles.weightName}>
                  {u.name}
                </AppText>
                <AppText color={theme.muted}>{u.weight}</AppText>
              </View>
            ))}
            {rest > 0 ? (
              <AppText variant="caption" color={theme.muted}>
                and {rest} more, down to the ones you ranked last.
              </AppText>
            ) : null}
          </View>
        )}
        <AppText color={theme.ink} style={styles.lead}>
          Tasks inherit those numbers. A task in a part of your life
          worth {shown[0]?.weight ?? 10} counts for more than one worth{" "}
          {shown[shown.length - 1]?.weight ?? 2}, without you setting a
          single priority by hand.
        </AppText>
      </Page>
    );
  }

  if (step === "rhythm") {
    return (
      <Page theme={theme} pad={pad} action="Next" onPress={() => go("notify")}>
        <AppText variant="display" color={theme.ink}>
          Why 100 is hard
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          Your daily habits can only reach {ROUTINE_BAND} of those points.
          Do every one of them, every day, and you land around there.
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          The other {VARIABLE_BAND} comes from what is not automatic: the
          weekly things, the one offs, the walk you were not planning to
          take.
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          So a 90 means you went past your routine. That is the point. A
          score you can max out by getting through a normal day is not
          telling you anything.
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          You can also say when a task happens: morning, afternoon,
          evening, or anytime. Deciding in advance is most of what makes
          it happen.
        </AppText>
      </Page>
    );
  }

  if (step === "done") {
    return (
      <Page
        theme={theme}
        pad={pad}
        action="Add your first tasks"
        onPress={() => void finish()}
        circles={constellation(theme.areas)}
      >
        <AppText variant="display" color={theme.ink}>
          That is the whole idea
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          Next, add a few tasks. Something small and repeatable, in the
          parts of your life that earned the most points.
        </AppText>
        <AppText color={theme.muted} style={styles.lead}>
          Your daily score is a guideline. It shows where your attention
          went, nothing more.
        </AppText>
        {/* ADR-0008: exactly one neutral mention, framed as
         *  availability. Reads the same for every user, always. */}
        <AppText variant="caption" color={theme.muted} style={styles.lead}>
          Support resources are in Settings whenever you want them.
        </AppText>
      </Page>
    );
  }

  // welcome, and the waiting state behind /diagnostic
  return (
    <Page
      theme={theme}
      pad={pad}
      action="How it works"
      onPress={() => go("method")}
      circles={constellation(theme.areas)}
    >
      <AppText variant="display" color={theme.ink}>
        Life Strategy
      </AppText>
      <AppText color={theme.ink} style={styles.lead}>
        Most planners begin with a to do list. This one begins with your
        life: six areas, eighteen parts of it.
      </AppText>
      <AppText color={theme.ink} style={styles.lead}>
        You rank what matters to you. Everything else in the app comes
        out of that ranking.
      </AppText>
      <AppText color={theme.muted} style={styles.lead}>
        Everything you enter stays on this phone. No account, no server,
        nothing uploaded.
      </AppText>
    </Page>
  );
}

/**
 * One onboarding screen: backdrop, copy, one action pinned at the
 * bottom.
 *
 * The copy scrolls when it does not fit and centres when it does, so
 * the longer screens added in 2026-08 stay whole on a small phone
 * without the short ones drifting to the top of the page.
 */
function Page({
  theme,
  pad,
  action,
  onPress,
  busy,
  circles,
  children,
}: {
  theme: ThemeTokens;
  pad: { paddingTop: number; paddingBottom: number };
  action: string;
  onPress: () => void;
  busy?: boolean;
  circles?: React.ComponentProps<typeof Backdrop>["circles"];
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={circles ?? hueWash(theme.accent)} />
      <View style={[styles.body, pad]}>
        <ScrollView
          style={styles.scroller}
          contentContainerStyle={styles.copy}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        <Button label={action} onPress={onPress} disabled={busy === true} theme={theme} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, paddingHorizontal: space.screen, justifyContent: "space-between" },
  scroller: { flex: 1 },
  /** `flexGrow` rather than `flex`, so short copy still centres while
   *  long copy is free to run past the fold and scroll. */
  copy: { flexGrow: 1, justifyContent: "center", gap: space.md },
  lead: { maxWidth: 340 },
  weights: { gap: space.sm, paddingVertical: space.xs, maxWidth: 340 },
  weightRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  weightName: { flex: 1 },
});
