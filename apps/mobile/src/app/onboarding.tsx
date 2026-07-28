/**
 * Onboarding (ADR-0011): welcome → privacy → diagnostic → first tasks
 * → notification ask → done.
 *
 * The diagnostic is mandatory — there is no usable app without a
 * snapshot — but it runs as the normal `/diagnostic` route rather than
 * a copy of it, so there is only ever one diagnostic to maintain.
 * Returning from it is detected by the snapshot appearing, not by a
 * callback, which also makes the step self-skipping when onboarding is
 * re-run later against data that already exists.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionPrescreen } from "../components/notifications/PermissionPrescreen";
import { AddTaskModal } from "../components/plan/AddTaskModal";
import { AppText } from "../components/ui/AppText";
import { Backdrop, constellation, hueWash } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import {
  completeOnboarding,
  loadOnboardingStep,
  saveOnboardingStep,
  type OnboardingStep,
} from "../db/onboarding";
import { addTask, loadPlan, type PlanData, type PlanUnit } from "../db/tasks";
import { getTheme } from "../theme/colors";
import { radius, space } from "../theme/tokens";

/** How many units the first-tasks step offers. ADR-0011 decision 3. */
const STARTER_UNITS = 3;

export default function OnboardingScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<OnboardingStep | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [addingUnit, setAddingUnit] = useState<PlanUnit | null>(null);

  useEffect(() => {
    void loadOnboardingStep().then(setStep);
  }, []);

  const go = useCallback((next: OnboardingStep) => {
    setStep(next);
    void saveOnboardingStep(next);
  }, []);

  /* The diagnostic writes a snapshot and pops back here. This must be
   * a *focus* effect, not a mount effect: this screen stays mounted
   * while `/diagnostic` is pushed on top of it, so nothing re-runs on
   * return unless it is keyed to focus. Checking for the snapshot
   * rather than taking a callback also makes the step self-skipping
   * when onboarding is re-run against existing data. */
  useFocusEffect(
    useCallback(() => {
      if (step !== "diagnostic" && step !== "tasks") return;
      let cancelled = false;
      void loadPlan().then((p) => {
        if (cancelled) return;
        setPlan(p);
        if (step === "diagnostic" && p.hasSnapshot) go("tasks");
        if (step === "tasks" && !p.hasSnapshot) go("diagnostic");
      });
      return () => {
        cancelled = true;
      };
    }, [step, go]),
  );

  const reloadPlan = useCallback(async () => setPlan(await loadPlan()), []);

  const finish = async () => {
    await completeOnboarding();
    router.replace("/");
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

  if (step === "welcome") {
    return (
      <View style={screen}>
        <Backdrop circles={constellation(theme.areas)} />
        <View style={[styles.body, pad]}>
          <View style={styles.copy}>
            <AppText variant="display" color={theme.ink}>
              Glide
            </AppText>
            <AppText color={theme.ink} style={styles.lead}>
              Most planners start with your tasks. Glide starts with your
              life — six areas, eighteen parts — and works out the tasks
              from there.
            </AppText>
            <AppText color={theme.muted} style={styles.lead}>
              You'll rank what matters to you. That becomes a daily
              checklist worth 100 points.
            </AppText>
          </View>
          <Button label="Next" onPress={() => go("privacy")} theme={theme} />
        </View>
      </View>
    );
  }

  if (step === "privacy") {
    return (
      <View style={screen}>
        <Backdrop circles={hueWash(theme.accent)} />
        <View style={[styles.body, pad]}>
          <View style={styles.copy}>
            <AppText variant="display" color={theme.ink}>
              Yours alone
            </AppText>
            <AppText color={theme.ink} style={styles.lead}>
              Everything you write — ratings, journals, photos — stays on
              this device. There's no account and no server, and none of
              it is uploaded anywhere.
            </AppText>
            <AppText color={theme.muted} style={styles.lead}>
              You can export an encrypted backup whenever you like, from
              Settings.
            </AppText>
          </View>
          <Button label="Start" onPress={() => go("diagnostic")} theme={theme} />
        </View>
      </View>
    );
  }

  if (step === "diagnostic") {
    return (
      <View style={screen}>
        <Backdrop circles={constellation(theme.areas)} />
        <View style={[styles.body, pad]}>
          <View style={styles.copy}>
            <AppText variant="display" color={theme.ink}>
              The diagnostic
            </AppText>
            <AppText color={theme.ink} style={styles.lead}>
              Rank each part of your life against the rest — what needs
              your attention most, and where you're most satisfied.
            </AppText>
            <AppText color={theme.muted} style={styles.lead}>
              About five minutes. Everything else in Glide is built from
              it, so this comes first.
            </AppText>
          </View>
          <Button
            label="Begin"
            onPress={() => router.push("/diagnostic")}
            theme={theme}
          />
        </View>
      </View>
    );
  }

  if (step === "tasks") {
    const top = (plan?.areas ?? [])
      .flatMap((a) => a.units)
      .filter((u) => u.includeInScoring && u.weight !== null)
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, STARTER_UNITS);

    const allUnits = (plan?.areas ?? [])
      .flatMap((a) => a.units)
      .filter((u) => u.includeInScoring)
      .map((u) => ({ id: u.id, name: u.name, areaId: u.areaId }));

    return (
      <View style={screen}>
        <Backdrop circles={constellation(theme.areas, { faint: true })} />
        <ScrollView contentContainerStyle={[styles.scroll, pad]}>
          <AppText variant="display" color={theme.ink}>
            Where to start
          </AppText>
          <AppText color={theme.ink} style={styles.lead}>
            Your ranking gave these three the biggest share of your daily
            points. Add a task to each — something small and repeatable.
          </AppText>

          {plan === null ? (
            <ActivityIndicator color={theme.muted} style={styles.loading} />
          ) : (
            top.map((unit) => (
              <View
                key={unit.id}
                style={[styles.unitCard, { borderColor: theme.hairline }]}
              >
                <View style={styles.unitHeader}>
                  <View
                    style={[
                      styles.areaDot,
                      { backgroundColor: theme.areas[unit.areaId] ?? theme.muted },
                    ]}
                  />
                  <AppText variant="headline" color={theme.ink} style={styles.grow}>
                    {unit.name}
                  </AppText>
                  <AppText variant="label" color={theme.muted} tabular>
                    {unit.weight} pts
                  </AppText>
                </View>

                {unit.tasks.length > 0 ? (
                  unit.tasks.map((t) => (
                    <AppText key={t.id} color={theme.muted} style={styles.taskLine}>
                      {t.title}
                    </AppText>
                  ))
                ) : (
                  <Button
                    label="Add a task"
                    variant="secondary"
                    onPress={() => setAddingUnit(unit)}
                    theme={theme}
                  />
                )}
              </View>
            ))
          )}

          <View style={styles.actions}>
            <Button label="Continue" onPress={() => go("notify")} theme={theme} />
            <AppText variant="caption" color={theme.muted} style={styles.footnote}>
              You can add, change, or remove tasks any time from Plan.
            </AppText>
          </View>
        </ScrollView>

        {addingUnit ? (
          <AddTaskModal
            visible
            onClose={() => setAddingUnit(null)}
            existingTasks={addingUnit.tasks.map((t) => ({
              id: t.id,
              title: t.title,
            }))}
            units={allUnits}
            homeUnitId={addingUnit.id}
            areaColors={theme.areas}
            accent={theme.accent}
            theme={theme}
            onCommit={async (title, timesPerWeek, rank, unitIds) => {
              await addTask(unitIds, title, timesPerWeek, rank);
              await reloadPlan();
            }}
          />
        ) : null}
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

  // done
  return (
    <View style={screen}>
      <Backdrop circles={constellation(theme.areas)} />
      <View style={[styles.body, pad]}>
        <View style={styles.copy}>
          <AppText variant="display" color={theme.ink}>
            You're set
          </AppText>
          <AppText color={theme.ink} style={styles.lead}>
            Your checklist is waiting on Today. Scores are guidelines, not
            judgments — they're there to show you where your attention is
            going, nothing more.
          </AppText>
          {/* ADR-0008: exactly one neutral mention, framed as
           *  availability. Reads the same for every user, always. */}
          <AppText variant="caption" color={theme.muted} style={styles.lead}>
            Support resources are in Settings, any time.
          </AppText>
        </View>
        <Button label="Open Glide" onPress={() => void finish()} theme={theme} />
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
  scroll: { paddingHorizontal: space.screen, gap: space.md },
  loading: { marginTop: space.xxl },
  unitCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  unitHeader: { flexDirection: "row", alignItems: "center", gap: space.sm + 2 },
  areaDot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
  taskLine: { marginTop: space.xs },
  actions: { marginTop: space.lg, gap: space.sm },
  footnote: { textAlign: "center" },
});
