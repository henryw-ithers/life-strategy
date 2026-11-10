/**
 * Onboarding (ADR-0045 as amended by ADR-0048): a few short pages on
 * what the app is for and how it works, then where to start. **It
 * explains and fills nothing in** (Henry, 2026-11-02): no templates, no
 * starter tasks, no hours set for you.
 *
 * 1. Welcome, with the privacy line (ADR-0011 §4).
 * 2. Tiers: what matters most decides what each day is worth.
 * 3. A day out of 100: planned work, the rest, and scores as a guide.
 * 4. Your day: its parts, ticking whenever suits you, moving anything
 *    (windows are set aside for launch, ADR-0051).
 * 5. Where to start: your units on Life, then a few tasks.
 * 6. The daily reminder, asked before the system asks (ADR-0010), and
 *    the one line about Support resources (ADR-0008).
 *
 * Then Life, to sort your units, or Home if you already have. Each page
 * is one example and a line or two (an example beats an explanation).
 * The page you're on is stored, so quitting resumes where you left.
 *
 * Displayed copy carries no em dashes (ADR-0011 action item 5).
 */
import { router, type Href } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, useColorScheme, View } from "react-native";

import { OnboardingPage } from "../components/onboarding/OnboardingPage";
import { AppText } from "../components/ui/AppText";
import { constellation } from "../components/ui/Backdrop";
import { LoadFailure, useScreenLoad } from "../components/ui/ScreenLoad";
import { completeOnboarding, loadOnboardingStep, saveOnboardingStep, type OnboardingStep } from "../db/onboarding";
import { hasPriorities } from "../db/priorities";
import { hasAskedNotificationPermission } from "../db/settings";
import { nextStep, previousStep } from "../lib/onboardingFlow";
import { recordProblem } from "../lib/problemLog";
import { askForNudge, declineNudge } from "../notifications/dailyNudge";
import { getTheme, type ThemeTokens } from "../theme/colors";
import { cardStyle } from "../theme/surfaces";
import { radius, space } from "../theme/tokens";

export default function OnboardingScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");

  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [askedNudge, setAskedNudge] = useState(false);
  const [busy, setBusy] = useState(false);

  const go = useCallback((next: OnboardingStep) => {
    setStep(next);
    void saveOnboardingStep(next).catch((e: unknown) => recordProblem(e, "save"));
  }, []);

  const load = useCallback(async () => {
    const [stored, asked] = await Promise.all([loadOnboardingStep(), hasAskedNotificationPermission()]);
    setAskedNudge(asked);
    // Only the first load sets the step; after that this screen owns it.
    setStep((s) => s ?? stored);
  }, []);
  const { error, retry } = useScreenLoad(load);

  /** One action at a time: a ref checked and set in the same tap. */
  const running = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      recordProblem(e, "save");
      // About the app, never the person (as `saveThen` says it).
      Alert.alert(
        "That didn’t work",
        "Nothing else changed. Try again, and if it keeps happening, the problem log in Settings has the details.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  /** Where to start: Life to sort your units, or Home once you have. */
  const complete = async () => {
    await completeOnboarding();
    router.replace(((await hasPriorities()) ? "/" : "/goals") as Href);
  };

  /** The reminder's answer, then on. A failed ask still finishes: the
   *  reminder is in Settings either way. */
  const remind = (yes: boolean) =>
    run(async () => {
      try {
        if (yes) await askForNudge();
        else await declineNudge();
      } catch (e) {
        recordProblem(e, "save");
      }
      await complete();
    });

  const next = () => step && go(nextStep(step));
  const back = () => step && go(previousStep(step));

  if (error) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.canvas }]}>
        <LoadFailure error={error} onRetry={retry} theme={theme} />
      </View>
    );
  }
  if (step === null) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.canvas }]}>
        <ActivityIndicator color={theme.muted} />
      </View>
    );
  }

  if (step === "tiers") {
    return (
      <OnboardingPage theme={theme} step="tiers" action="Next" onPress={next} onBack={back}>
        <AppText variant="display" color={theme.ink}>
          What matters most?
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          Sort 18 parts of your life into tiers. The higher a part sits, the more of each day it’s worth.
        </AppText>
        <TiersExample theme={theme} />
      </OnboardingPage>
    );
  }

  if (step === "day") {
    return (
      <OnboardingPage theme={theme} step="day" action="Next" onPress={next} onBack={back}>
        <AppText variant="display" color={theme.ink}>
          A day out of 100
        </AppText>
        <View style={[cardStyle(theme), styles.example, styles.split]}>
          <Figure value="90" label="the work you planned" theme={theme} />
          <AppText variant="title" color={theme.muted}>
            +
          </AppText>
          <Figure value="10" label="anything you didn’t plan" theme={theme} />
        </View>
        <AppText color={theme.ink} style={styles.lead}>
          On most days, doing what you planned scores 90. A score is a guide, never a verdict, and it’s only yours.
        </AppText>
      </OnboardingPage>
    );
  }

  if (step === "time") {
    return (
      <OnboardingPage theme={theme} step="time" action="Next" onPress={next} onBack={back}>
        <AppText variant="display" color={theme.ink}>
          Your day, in parts
        </AppText>
        <PartExample theme={theme} />
        <AppText color={theme.ink} style={styles.lead}>
          Tasks sit in the morning, afternoon or evening, and events at their times. Tick things off whenever suits you, even all at once at night. Hold any task to move it.
        </AppText>
      </OnboardingPage>
    );
  }

  if (step === "start") {
    return (
      <OnboardingPage theme={theme} step="start" action="Next" onPress={next} onBack={back}>
        <AppText variant="display" color={theme.ink}>
          Where to start
        </AppText>
        <View style={[cardStyle(theme), styles.example]}>
          <StepLine n={1} text="On Life, drag your units into tiers." theme={theme} />
          <StepLine n={2} text="Add a few tasks to the ones on top." theme={theme} />
        </View>
        <AppText color={theme.muted} style={styles.lead}>
          Rough is fine. Everything can change later.
        </AppText>
      </OnboardingPage>
    );
  }

  if (step === "notify" || step === "done") {
    return (
      <OnboardingPage
        theme={theme}
        step="notify"
        action={askedNudge ? "Done" : "Turn on"}
        onPress={() => (askedNudge ? void run(complete) : void remind(true))}
        onSkip={askedNudge ? undefined : () => void remind(false)}
        onBack={back}
        busy={busy}
        circles={constellation(theme.areas)}
      >
        <AppText variant="display" color={theme.ink}>
          A daily reminder?
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          {askedNudge
            ? "The daily reminder is in Settings, whenever you want to change it."
            : "One nudge a day, at a time you choose, and only when today still needs you. It never says what’s on your list. Your phone will ask next."}
        </AppText>
        {/* ADR-0008: exactly one neutral mention, framed as
            availability. Reads the same for every user, always. */}
        <AppText variant="caption" color={theme.muted} style={styles.lead}>
          Support resources are in Settings, whenever you want them.
        </AppText>
      </OnboardingPage>
    );
  }

  return (
    <OnboardingPage theme={theme} step="welcome" action="Get started" onPress={next} circles={constellation(theme.areas)}>
      <AppText variant="display" color={theme.ink}>
        Life Strategy
      </AppText>
      <AppText color={theme.ink} style={styles.lead}>
        Plan your week around what matters to you.
      </AppText>
      <AppText color={theme.muted} style={styles.lead}>
        Everything you enter stays on this phone. No account, no server, nothing uploaded.
      </AppText>
    </OnboardingPage>
  );
}

/** Four tiers, each a little less of the day: an example, not a rule. */
function TiersExample({ theme }: { theme: ThemeTokens }) {
  const tiers = [
    { label: "Top", share: 1, example: "Exercise & fitness" },
    { label: "Important", share: 0.62, example: "Friendship" },
    { label: "Background", share: 0.38, example: "Living space" },
    { label: "Not now", share: 0, example: "Adventure" },
  ];
  return (
    <View style={[cardStyle(theme), styles.example]} accessible accessibilityLabel="Example: Top, Important, Background, each worth less of the day, and Not now, out of the plan.">
      {tiers.map((t) => (
        <View key={t.label} style={styles.tierRow}>
          <AppText variant="caption" color={theme.muted} style={styles.tierLabel}>
            {t.label}
          </AppText>
          <View style={styles.tierBody}>
            <AppText variant="caption" color={theme.ink} numberOfLines={1}>
              {t.example}
            </AppText>
            <View style={[styles.track, { backgroundColor: theme.fill }]}>
              <View style={[styles.bar, { width: `${t.share * 100}%`, backgroundColor: theme.accent }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function Figure({ value, label, theme }: { value: string; label: string; theme: ThemeTokens }) {
  return (
    <View style={styles.figure}>
      <AppText variant="numeral" color={theme.ink} tabular>
        {value}
      </AppText>
      <AppText variant="caption" color={theme.muted} style={styles.centered}>
        {label}
      </AppText>
    </View>
  );
}

/** A part of the day as Today draws one: two tasks, one ticked. */
function PartExample({ theme }: { theme: ThemeTokens }) {
  const rows = [
    { title: "Run", done: true },
    { title: "Read for 30 minutes", done: false },
  ];
  return (
    <View style={[cardStyle(theme), styles.example]} accessible accessibilityLabel="Example: the morning, with two tasks, one ticked.">
      <AppText variant="label" color={theme.ink}>
        Morning
      </AppText>
      {rows.map((r) => (
        <View key={r.title} style={styles.taskRow}>
          <View
            style={[
              styles.check,
              { borderColor: theme.accent, backgroundColor: r.done ? theme.accent : "transparent" },
            ]}
          />
          <AppText color={r.done ? theme.muted : theme.ink}>{r.title}</AppText>
        </View>
      ))}
    </View>
  );
}

function StepLine({ n, text, theme }: { n: number; text: string; theme: ThemeTokens }) {
  return (
    <View style={styles.stepLine}>
      <View style={[styles.stepNumber, { backgroundColor: theme.fill }]}>
        <AppText variant="caption" color={theme.ink} tabular>
          {n}
        </AppText>
      </View>
      <AppText color={theme.ink} style={styles.grow}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  lead: { maxWidth: 340 },
  grow: { flex: 1 },
  centered: { textAlign: "center" },
  example: { padding: space.lg, gap: space.md },
  split: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  figure: { alignItems: "center", gap: space.xs, flex: 1 },
  tierRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  tierLabel: { width: 84 },
  tierBody: { flex: 1, gap: space.xs },
  track: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  bar: { height: 6, borderRadius: radius.pill },
  taskRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 36 },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  stepLine: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepNumber: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
});
