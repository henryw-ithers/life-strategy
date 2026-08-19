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
 *
 * **Redesigned 2026-08-19: shown, not described.** Every screen was a
 * heading over three or four paragraphs, which is a slideshow of essays
 * and reads as one. Three of them now carry a picture that *is* the
 * explanation: the six areas as the six hues the rest of the app uses,
 * the 80/20 split as one bar cut to the real constants, and the loop as
 * three numbered steps. The prose that survived is the part a picture
 * cannot carry.
 *
 * The last screen can finally show a loop, because as of this release
 * the app can complete one. The diagnostic had no entry point outside
 * an empty state, so a user could be taught a cycle whose second half
 * did not exist.
 *
 * A progress track runs across the top. Six screens without one is a
 * corridor with no windows.
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

/**
 * The six Strategic Life Areas, in taxonomy order.
 *
 * Stated here rather than read from the database on purpose: this
 * screen renders before anything is loaded, and a list of six names
 * that changes only when the taxonomy changes is not worth an async
 * round trip and a spinner. `syncTaxonomy` owns the real rows; if these
 * ever disagree, that one wins and this is the thing to update.
 */
const AREAS: readonly { id: string; name: string }[] = [
  { id: "relationships", name: "Relationships" },
  { id: "physical-health", name: "Physical health" },
  { id: "mental-wellbeing", name: "Mental wellbeing" },
  { id: "work-money", name: "Work & money" },
  { id: "home-environment", name: "Wellness" },
  { id: "leisure-creativity", name: "Leisure & creativity" },
];

/** The screens with a progress dot. `diagnostic` is a waiting state and
 *  `notify` is a system prompt, so neither is a step you can be "on". */
const FLOW: readonly OnboardingStep[] = [
  "welcome",
  "method",
  "weights",
  "rhythm",
  "done",
];

/**
 * Where you are in the flow.
 *
 * Six screens without one is a corridor with no windows: people tap
 * through faster when they cannot see the end, which is the opposite of
 * what an explanation wants. Bars rather than dots because they carry
 * the sense of a track being filled, and the filled ones use the accent
 * so the row reads as progress rather than decoration.
 */
function Progress({ index, theme }: { index: number; theme: ThemeTokens }) {
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: FLOW.length, now: index + 1 }}
      accessibilityLabel={`Step ${index + 1} of ${FLOW.length}`}
    >
      {FLOW.map((step, i) => (
        <View
          key={step}
          style={[
            styles.progressBar,
            {
              backgroundColor: i <= index ? theme.accent : theme.hairline,
              flex: i === index ? 1.6 : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * The taxonomy, shown rather than described.
 *
 * This screen used to be four paragraphs explaining that life divides
 * into six areas and eighteen units. Six coloured rows say it in one
 * glance, and they say it in the app's own language: these are the
 * exact hues the checklist, the portfolio bubbles and every chip use
 * for the same six areas, so the first thing a person learns is the
 * colour system they will be reading from then on.
 */
function AreaBloom({ theme }: { theme: ThemeTokens }) {
  return (
    <View style={styles.areas}>
      {AREAS.map((area) => (
        <View key={area.id} style={styles.areaRow}>
          <View
            style={[
              styles.areaDot,
              { backgroundColor: theme.areas[area.id] ?? theme.muted },
            ]}
          />
          <AppText color={theme.ink}>{area.name}</AppText>
        </View>
      ))}
    </View>
  );
}

/**
 * The 80/20 split, as one bar.
 *
 * Four paragraphs of arithmetic became a shape you can read in a
 * second. The proportions are the real constants, so the picture cannot
 * drift from the scoring engine: if the bands are ever re-cut, this
 * re-cuts with them.
 */
function BandBar({ theme }: { theme: ThemeTokens }) {
  return (
    <View style={styles.band} accessible accessibilityLabel={`Routine ${ROUTINE_BAND} points, everything else ${VARIABLE_BAND} points`}>
      <View style={styles.bandTrack}>
        <View
          style={[
            styles.bandFill,
            { flex: ROUTINE_BAND, backgroundColor: theme.accent },
          ]}
        />
        <View
          style={[
            styles.bandFill,
            { flex: VARIABLE_BAND, backgroundColor: theme.hairline },
          ]}
        />
      </View>
      <View style={styles.bandLabels}>
        <AppText variant="caption" color={theme.accent}>
          {ROUTINE_BAND} · your daily habits
        </AppText>
        <AppText variant="caption" color={theme.muted}>
          {VARIABLE_BAND} · everything else
        </AppText>
      </View>
    </View>
  );
}

/**
 * The loop, on the last screen.
 *
 * Numbered because this genuinely is a sequence and the order carries
 * the meaning: the ranking is what makes the checklist, the checklist
 * is what the month is made of, and the checkpoint is what changes the
 * ranking. It is a cycle, and until this release the app could not
 * actually complete one — the diagnostic had no second entry point, so
 * only the middle step existed.
 */
function LoopSteps({ theme }: { theme: ThemeTokens }) {
  const steps: readonly { n: string; title: string; body: string }[] = [
    { n: "1", title: "Rank", body: "You did this. It sets what everything is worth." },
    { n: "2", title: "Do", body: "A daily checklist, drawn from that ranking." },
    { n: "3", title: "Check in", body: "Once a month, see how it went and re-rank if it has shifted." },
  ];
  return (
    <View style={styles.loop}>
      {steps.map((s) => (
        <View key={s.n} style={styles.loopRow}>
          <View style={[styles.loopMark, { borderColor: theme.accent }]}>
            <AppText variant="caption" color={theme.accent} tabular>
              {s.n}
            </AppText>
          </View>
          <View style={styles.loopText}>
            <AppText variant="label" color={theme.ink}>
              {s.title}
            </AppText>
            <AppText variant="caption" color={theme.muted}>
              {s.body}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}


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
      <Page
        theme={theme}
        pad={pad}
        step="method"
        action="Start ranking"
        onPress={() => void onStart()}
        busy={starting}
      >
        <AppText variant="display" color={theme.ink}>
          Six areas, eighteen parts
        </AppText>
        <AreaBloom theme={theme} />
        <AppText color={theme.ink} style={styles.lead}>
          You will see them two at a time. The question is never whether
          something matters. It is which of these two matters more to
          you, right now.
        </AppText>
        <AppText variant="caption" color={theme.muted} style={styles.lead}>
          About five minutes, once.
        </AppText>
      </Page>
    );
  }

  if (step === "weights") {
    const shown = ranked.slice(0, WEIGHTS_SHOWN);
    const rest = ranked.length - shown.length;
    return (
      <Page
        theme={theme}
        pad={pad}
        step="weights"
        action="Next"
        onPress={() => go("rhythm")}
      >
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
      <Page
        theme={theme}
        pad={pad}
        step="rhythm"
        action="Next"
        onPress={() => go("notify")}
      >
        <AppText variant="display" color={theme.ink}>
          Why 100 is hard
        </AppText>
        <BandBar theme={theme} />
        <AppText color={theme.ink} style={styles.lead}>
          Do every daily habit, every day, and you land around{" "}
          {ROUTINE_BAND}. The rest comes from what is not automatic: the
          weekly things, the one offs, the walk you were not planning to
          take.
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          So a 90 means you went past your routine. A score you can max
          out by getting through a normal day is not telling you
          anything.
        </AppText>
      </Page>
    );
  }

  if (step === "done") {
    return (
      <Page
        theme={theme}
        pad={pad}
        step="done"
        action="Add your first tasks"
        onPress={() => void finish()}
        circles={constellation(theme.areas)}
      >
        <AppText variant="display" color={theme.ink}>
          That is the loop
        </AppText>
        <LoopSteps theme={theme} />
        <AppText color={theme.muted} style={styles.lead}>
          Your daily score is a guideline. It shows where your attention
          went, nothing more.
        </AppText>
        {/* ADR-0008: exactly one neutral mention, framed as
         *  availability. Reads the same for every user, always. */}
        <AppText variant="caption" color={theme.muted} style={styles.lead}>
          Support resources are in Settings, under the gear on your Log,
          whenever you want them.
        </AppText>
      </Page>
    );
  }

  // welcome, and the waiting state behind /diagnostic
  return (
    <Page
      theme={theme}
      pad={pad}
      step="welcome"
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
  step,
  action,
  onPress,
  busy,
  circles,
  children,
}: {
  theme: ThemeTokens;
  pad: { paddingTop: number; paddingBottom: number };
  /** Drives the progress track. */
  step: OnboardingStep;
  action: string;
  onPress: () => void;
  busy?: boolean;
  circles?: React.ComponentProps<typeof Backdrop>["circles"];
  children: React.ReactNode;
}) {
  const index = FLOW.indexOf(step);

  return (
    <View style={[styles.screen, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={circles ?? hueWash(theme.accent)} />
      <View style={[styles.body, pad]}>
        {index >= 0 ? <Progress index={index} theme={theme} /> : null}
        <ScrollView
          style={styles.scroller}
          contentContainerStyle={styles.copy}
          showsVerticalScrollIndicator={false}
        >
          {/* Deliberately not an entrance animation.
              Reanimated's `entering` starts the view at opacity 0 and
              animates it up, so the content is *gated* on the animation
              running. It does not always run: a hidden tab, a headless
              renderer, or a paused compositor leaves the screen showing
              its button over an empty page. That happened here, and a
              blank onboarding screen is a far worse trade than a screen
              that simply appears. Motion on this flow lives in the
              progress track instead, which animates a property that
              cannot hide anything. */}
          <View style={styles.copyInner}>{children}</View>
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
  copy: { flexGrow: 1, justifyContent: "center" },
  copyInner: { gap: space.md },
  /** Sits above the copy, not inside the scroller: it belongs to the
   *  flow, not to the words. */
  progress: { flexDirection: "row", gap: 4, height: 3, marginBottom: space.xl },
  progressBar: { height: 3, borderRadius: 2 },
  areas: { gap: space.sm, paddingVertical: space.xs },
  areaRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  /** 10pt, the same pip the portfolio and the unit chips use. */
  areaDot: { width: 10, height: 10, borderRadius: 5 },
  band: { gap: space.sm, paddingVertical: space.xs },
  bandTrack: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 },
  bandFill: { height: 10 },
  bandLabels: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  loop: { gap: space.lg, paddingVertical: space.xs },
  loopRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  /** An outlined mark rather than a filled one: the numbers are a
   *  sequence, not three buttons. */
  loopMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loopText: { flex: 1, gap: 2 },
  lead: { maxWidth: 340 },
  weights: { gap: space.sm, paddingVertical: space.xs, maxWidth: 340 },
  weightRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  weightName: { flex: 1 },
});
