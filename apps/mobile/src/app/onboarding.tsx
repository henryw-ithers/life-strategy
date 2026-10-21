/**
 * Onboarding (ADR-0045, amending ADR-0011): seven short steps that end
 * in a working Home, in about three minutes.
 *
 * 1. Welcome, with the privacy line (ADR-0011 §4).
 * 2. Priorities: the tiers screen, pushed over this one. Required on a
 *    first run.
 * 3. Commitments: "Anything with set hours?" and up to three
 *    commitments with their events.
 * 4. Working hours: the hours editor, pushed, filled in from step 3.
 * 5. A few tasks: starters for each Top unit, tap to add.
 * 6. Your first week: Plan's week, live, and the one line on the score.
 * 7. The daily reminder, asked before the system asks (ADR-0010), and
 *    the one line about Support resources (ADR-0008). Then Home, which
 *    opens at the current window.
 *
 * Every step after Priorities can be skipped. Each writes as it goes,
 * and the step you're on is stored, so quitting resumes where you left.
 * Running it again from Settings opens at Priorities with your tiers,
 * deletes nothing, and lets you skip anything (ADR-0045 §2).
 *
 * Priorities and Hours are their own screens, pushed from here: they
 * save on Done and go back. Coming back, a save moves the flow on; a
 * screen backed out of leaves you on the step to try again or skip.
 *
 * Displayed copy carries no em dashes (ADR-0011 action item 5).
 */
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, useColorScheme, View } from "react-native";

import { CommitmentsStep } from "../components/onboarding/CommitmentsStep";
import { FirstWeekStep } from "../components/onboarding/FirstWeekStep";
import { OnboardingPage } from "../components/onboarding/OnboardingPage";
import { StarterTasksStep } from "../components/onboarding/StarterTasksStep";
import { AppText } from "../components/ui/AppText";
import { constellation } from "../components/ui/Backdrop";
import { LoadFailure, useScreenLoad } from "../components/ui/ScreenLoad";
import { loadHoursVersions } from "../db/hours";
import {
  completeOnboarding,
  loadOnboardingStep,
  loadOnboardingTemplate,
  saveOnboardingStep,
  saveOnboardingTemplate,
  type OnboardingStep,
} from "../db/onboarding";
import { latestPriorities } from "../db/priorities";
import {
  eventsDefaultOnce,
  hasAskedNotificationPermission,
  setEventsDefaultOnce,
} from "../db/settings";
import { loadPlan, type PlanData } from "../db/tasks";
import { canSkip, nextStep } from "../lib/onboardingFlow";
import { templateFor, type TemplateId } from "../lib/onboardingTemplates";
import { recordProblem } from "../lib/problemLog";
import { askForNudge, declineNudge } from "../notifications/dailyNudge";
import { getTheme } from "../theme/colors";

/** What a pushed screen looked like before it opened, to see a save. */
type Awaiting = { screen: "priorities" | "hours"; before: string | null };

/** The hours as stored, to compare before and after the editor. */
async function hoursFingerprint(): Promise<string> {
  return JSON.stringify(await loadHoursVersions());
}

export default function OnboardingScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");

  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [template, setTemplate] = useState<TemplateId | null>(null);
  const [askedNudge, setAskedNudge] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Set when Priorities or Hours is pushed, read when we come back. A
   *  ref, so arming it can't re-run the focus effect and cancel the
   *  push it's waiting on. */
  const awaiting = useRef<Awaiting | null>(null);

  const go = useCallback((next: OnboardingStep) => {
    setStep(next);
    void saveOnboardingStep(next).catch((e: unknown) =>
      recordProblem(e instanceof Error ? e : new Error(String(e)), "save"),
    );
  }, []);

  const load = useCallback(async () => {
    const [stored, nextPlan, storedTemplate, asked] = await Promise.all([
      loadOnboardingStep(),
      loadPlan(),
      loadOnboardingTemplate(),
      hasAskedNotificationPermission(),
    ]);
    setPlan(nextPlan);
    setTemplate(templateFor(storedTemplate)?.id ?? null);
    setAskedNudge(asked);
    // Only the first load sets the step; after that this screen owns it.
    setStep((s) => s ?? stored);
  }, []);
  const { error, retry, save } = useScreenLoad(load);

  /* Back from Priorities or Hours: a save moves on, backing out stays. */
  useFocusEffect(
    useCallback(() => {
      const waiting = awaiting.current;
      if (waiting === null) return;
      awaiting.current = null;
      let cancelled = false;
      const after =
        waiting.screen === "priorities" ? latestPriorities() : hoursFingerprint();
      void after
        .then((now) => {
          if (cancelled || now === waiting.before) return;
          go(waiting.screen === "priorities" ? "commitments" : "tasks");
        })
        .catch((e: unknown) => {
          // The step stays put, and Skip or a second try still work.
          recordProblem(e instanceof Error ? e : new Error(String(e)), "load");
        });
      return () => {
        cancelled = true;
      };
    }, [go]),
  );

  /** One action at a time. A ref, checked and set in the same tap, so
   *  two taps in one frame can't both get through; `busy` only greys
   *  the buttons. */
  const running = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      recordProblem(e instanceof Error ? e : new Error(String(e)), "save");
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

  const open = (screen: Awaiting["screen"]) =>
    run(async () => {
      const before = screen === "priorities" ? await latestPriorities() : await hoursFingerprint();
      awaiting.current = { screen, before };
      if (screen === "priorities") router.push("/priorities" as Href);
      else {
        // First hours save from today with no question. On a re-run,
        // with hours already set, the editor asks as it always does.
        const params = new URLSearchParams();
        if (before === "[]") params.set("setup", "1");
        if (template) params.set("template", template);
        router.push(`/hours?${params.toString()}` as Href);
      }
    });

  /** Picking a schedule: remembered for the hours step, and shift work
   *  makes new events one-time. Moving off shift work turns that back
   *  off; otherwise Settings' own choice is left alone. */
  const chooseTemplate = (id: TemplateId) => {
    setTemplate(id);
    void save(async () => {
      const was = await loadOnboardingTemplate();
      await saveOnboardingTemplate(id);
      const once = templateFor(id)?.eventsOnce === true;
      if (once || was === "shifts") {
        if ((await eventsDefaultOnce()) !== once) await setEventsDefaultOnce(once);
      }
    });
  };

  /** Home, at the current window (ADR-0045 §1 step 7). */
  const complete = async () => {
    await completeOnboarding();
    router.replace("/" as Href);
  };

  const finish = () => run(complete);

  /** The reminder's answer, then Home. A failed ask still finishes:
   *  the reminder is in Settings either way. */
  const remind = (yes: boolean) =>
    run(async () => {
      try {
        if (yes) await askForNudge();
        else await declineNudge();
      } catch (e) {
        recordProblem(e instanceof Error ? e : new Error(String(e)), "save");
      }
      await complete();
    });

  const hasSnapshot = plan?.hasSnapshot === true;
  const next = () => step && go(nextStep(step));

  if (error) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.canvas }]}>
        <LoadFailure error={error} onRetry={retry} theme={theme} />
      </View>
    );
  }

  if (step === null || plan === null) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.canvas }]}>
        <ActivityIndicator color={theme.muted} />
      </View>
    );
  }

  if (step === "priorities") {
    return (
      <OnboardingPage
        theme={theme}
        step="priorities"
        action={hasSnapshot ? "Look at your tiers" : "Sort your priorities"}
        onPress={() => void open("priorities")}
        onSkip={canSkip("priorities", hasSnapshot) ? next : undefined}
        busy={busy}
      >
        <AppText variant="display" color={theme.ink}>
          What matters most right now?
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          Drag the 18 parts of your life into four tiers: Top, Important,
          Background and Not now. Suggestions come from the top down.
        </AppText>
        <AppText color={theme.muted} style={styles.lead}>
          Rough is fine. You can change it any time. About 30 seconds.
        </AppText>
      </OnboardingPage>
    );
  }

  if (step === "commitments") {
    return (
      <OnboardingPage theme={theme} step="commitments" action="Next" onPress={next} top>
        <CommitmentsStep
          template={template}
          onTemplate={chooseTemplate}
          commitments={plan.commitments}
          save={save}
          reload={retry}
          theme={theme}
        />
      </OnboardingPage>
    );
  }

  if (step === "hours") {
    return (
      <OnboardingPage
        theme={theme}
        step="hours"
        action="Set your hours"
        onPress={() => void open("hours")}
        onSkip={next}
        busy={busy}
      >
        <AppText variant="display" color={theme.ink}>
          When are you free?
        </AppText>
        <AppText color={theme.ink} style={styles.lead}>
          Your working hours are when you can get things done. Events are
          taken out of them, and what’s left becomes the day’s windows.
        </AppText>
        <AppText color={theme.muted} style={styles.lead}>
          {template
            ? `Filled in for ${templateFor(template)?.label ?? "you"}. Change anything.`
            : "Set them like a sleep schedule: some days, some times."}
        </AppText>
      </OnboardingPage>
    );
  }

  if (step === "tasks") {
    return (
      <OnboardingPage theme={theme} step="tasks" action="Next" onPress={next} top>
        <StarterTasksStep plan={plan} save={save} theme={theme} />
      </OnboardingPage>
    );
  }

  if (step === "week") {
    return <FirstWeekStep theme={theme} onNext={next} />;
  }

  if (step === "notify" || step === "done") {
    return (
      <OnboardingPage
        theme={theme}
        step="notify"
        action={askedNudge ? "Done" : "Turn on"}
        onPress={() => (askedNudge ? void finish() : void remind(true))}
        onSkip={askedNudge ? undefined : () => void remind(false)}
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
        <AppText color={theme.muted} style={styles.lead}>
          Your daily score is a guideline. It shows where your attention
          went, nothing more.
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
    <OnboardingPage
      theme={theme}
      step="welcome"
      action="Get started"
      onPress={next}
      circles={constellation(theme.areas)}
    >
      <AppText variant="display" color={theme.ink}>
        Life Strategy
      </AppText>
      <AppText color={theme.ink} style={styles.lead}>
        Plan your week around what matters to you and the time you
        actually have.
      </AppText>
      <AppText color={theme.muted} style={styles.lead}>
        Everything you enter stays on this phone. No account, no server,
        nothing uploaded.
      </AppText>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  lead: { maxWidth: 340 },
});
