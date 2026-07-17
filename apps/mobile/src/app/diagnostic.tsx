/**
 * The diagnostic flow (ADR-0005): intro → six area steps (each rating
 * its units on priority + satisfaction) → transactional save → results
 * with derived weights and the portfolio graph on real data.
 */
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, constellation, hueWash } from "../components/ui/Backdrop";
import { ProgressDots } from "../components/diagnostic/ProgressDots";
import { UnitRatingBlock } from "../components/diagnostic/UnitRatingBlock";
import { PortfolioGraphView, type GraphSnapshot } from "../components/portfolio-graph";
import { AppText } from "../components/ui/AppText";
import { Button } from "../components/ui/Button";
import {
  loadDiagnosticAreas,
  loadLatestRatings,
  loadWeightSummary,
  saveDiagnostic,
  type AreaWeightGroup,
  type DiagnosticArea,
  type RatingDraft,
} from "../db/diagnostic";
import { loadGraphSnapshots } from "../db/graph";
import { getTheme } from "../theme/colors";
import { radius, space } from "../theme/tokens";

type Phase = "loading" | "intro" | "steps" | "saving" | "error" | "results";

export default function DiagnosticFlow() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const navigation = useNavigation();

  const [phase, setPhase] = useState<Phase>("loading");
  const [areas, setAreas] = useState<DiagnosticArea[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RatingDraft>>({});
  const [prefilled, setPrefilled] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [results, setResults] = useState<{
    weights: AreaWeightGroup[];
    graph: GraphSnapshot[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [loadedAreas, previous] = await Promise.all([
        loadDiagnosticAreas(),
        loadLatestRatings(),
      ]);
      const initial: Record<string, RatingDraft> = {};
      for (const area of loadedAreas) {
        for (const unit of area.units) {
          const prev = previous[unit.id];
          initial[unit.id] = prev
            ? { importance: prev.importance, satisfaction: prev.satisfaction }
            : { importance: null, satisfaction: null };
        }
      }
      setAreas(loadedAreas);
      setDrafts(initial);
      setPrefilled(Object.keys(previous).length > 0);
      setPhase("intro");
    })();
  }, []);

  // A stray back-swipe must not destroy five minutes of reflection.
  usePreventRemove(phase === "steps" || phase === "saving", ({ data }) => {
    Alert.alert("Discard this diagnostic?", "Your ratings won't be saved.", [
      { text: "Keep rating", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const completedByArea = useMemo(
    () =>
      areas.map((area) =>
        area.units.every(
          (u) =>
            drafts[u.id]?.importance !== null &&
            drafts[u.id]?.satisfaction !== null,
        ),
      ),
    [areas, drafts],
  );

  const setRating = (
    unitId: string,
    field: "importance" | "satisfaction",
    value: number,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [unitId]: {
        ...(prev[unitId] ?? { importance: null, satisfaction: null }),
        [field]: value,
      },
    }));
  };

  const goToStep = (next: number) => {
    setDirection(next >= stepIndex ? 1 : -1);
    setStepIndex(next);
  };

  const save = async () => {
    setPhase("saving");
    try {
      const entries = areas.flatMap((area) =>
        area.units.map((u) => ({
          unitId: u.id,
          importance: drafts[u.id]!.importance!,
          satisfaction: drafts[u.id]!.satisfaction!,
          includeInScoring: u.includeInScoring,
        })),
      );
      const snapshotId = await saveDiagnostic(entries);
      const [weights, graph] = await Promise.all([
        loadWeightSummary(snapshotId),
        loadGraphSnapshots(),
      ]);
      setResults({ weights, graph });
      setPhase("results");
    } catch {
      setPhase("error");
    }
  };

  const entering = reduceMotion
    ? FadeIn.duration(0)
    : direction === 1
      ? SlideInRight.duration(220)
      : SlideInLeft.duration(220);

  const screen = [
    styles.screen,
    { backgroundColor: theme.canvas, paddingTop: insets.top + space.md },
  ];
  const footerPad = { paddingBottom: insets.bottom + space.lg };

  if (phase === "loading") {
    return (
      <View style={[screen, styles.center]}>
        <ActivityIndicator color={theme.muted} />
      </View>
    );
  }

  if (phase === "intro") {
    return (
      <View style={screen}>
        <Backdrop circles={constellation(theme.areas)} />
        <View style={styles.introBody}>
          <AppText variant="display" color={theme.ink}>
            Life diagnostic
          </AppText>
          <AppText color={theme.ink} style={styles.introCopy}>
            Rate each part of your life on two things: the priority it holds
            right now, and how satisfied you are with it.
          </AppText>
          <AppText variant="caption" color={theme.muted}>
            Six areas · about five minutes · 1 is low, 10 is high
          </AppText>
          {prefilled ? (
            <AppText variant="caption" color={theme.muted}>
              Your last ratings are filled in. Adjust what's changed.
            </AppText>
          ) : null}
        </View>
        <View style={[styles.footer, { borderTopColor: theme.hairline }, footerPad]}>
          <Button label="Begin" onPress={() => setPhase("steps")} theme={theme} />
          <Button
            label="Cancel"
            variant="quiet"
            onPress={() => router.back()}
            theme={theme}
          />
        </View>
      </View>
    );
  }

  if (phase === "steps") {
    const area = areas[stepIndex]!;
    const accent = theme.areas[area.id] ?? theme.ink;
    const stepDone = completedByArea[stepIndex] === true;
    const isLast = stepIndex === areas.length - 1;

    return (
      <View style={screen}>
        <Backdrop circles={hueWash(accent)} />
        <ProgressDots
          areaIds={areas.map((a) => a.id)}
          currentIndex={stepIndex}
          completed={completedByArea}
          theme={theme}
        />
        <Animated.View key={area.id} entering={entering} style={styles.step}>
          <ScrollView
            contentContainerStyle={styles.stepScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.areaHeader}>
              <AppText variant="title" color={theme.ink}>
                {area.name}
              </AppText>
              <AppText variant="caption" color={theme.muted} tabular>
                {stepIndex + 1} of {areas.length}
              </AppText>
            </View>
            <View style={{ height: space.md }} />
            {area.units.map((unit) => (
              <UnitRatingBlock
                key={unit.id}
                unit={unit}
                draft={drafts[unit.id] ?? { importance: null, satisfaction: null }}
                onChange={(field, value) => setRating(unit.id, field, value)}
                accent={accent}
                theme={theme}
                reduceMotion={reduceMotion}
              />
            ))}
          </ScrollView>
        </Animated.View>
        <View style={[styles.footer, { borderTopColor: theme.hairline }, footerPad]}>
          <Button
            label={isLast ? "Save snapshot" : "Next"}
            color={accent}
            disabled={!stepDone}
            onPress={() => (isLast ? save() : goToStep(stepIndex + 1))}
            theme={theme}
          />
          <Button
            label="Back"
            variant="quiet"
            onPress={() =>
              stepIndex === 0 ? setPhase("intro") : goToStep(stepIndex - 1)
            }
            theme={theme}
          />
        </View>
      </View>
    );
  }

  if (phase === "saving") {
    return (
      <View style={[screen, styles.center]}>
        <ActivityIndicator color={theme.muted} />
        <AppText color={theme.muted} style={{ marginTop: space.md }}>
          Saving your snapshot…
        </AppText>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={[screen, styles.center, { gap: space.md }]}>
        <AppText variant="title" color={theme.ink}>
          Couldn't save
        </AppText>
        <AppText color={theme.muted} style={{ textAlign: "center" }}>
          Your ratings are still here. Try again.
        </AppText>
        <View style={{ height: space.sm }} />
        <Button label="Retry" onPress={save} theme={theme} />
      </View>
    );
  }

  // results
  const grandTotal = results?.weights
    .flatMap((g) => g.rows)
    .reduce((sum, r) => sum + (r.weight ?? 0), 0);

  return (
    <View style={[styles.resultsRoot, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <ScrollView
        contentContainerStyle={[
          styles.resultsScroll,
          { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl },
        ]}
      >
      <AppText variant="display" color={theme.ink}>
        Your portfolio
      </AppText>
      <AppText color={theme.muted} style={styles.resultsLead}>
        Your daily budget is 100 points, split by the priorities you set.
        Units where satisfaction lags get a boost.
      </AppText>

      {results?.weights.map((group) => {
        const groupTotal = group.rows.reduce((sum, r) => sum + (r.weight ?? 0), 0);
        return (
          <View
            key={group.areaId}
            style={[styles.weightGroup, { borderTopColor: theme.hairline }]}
          >
            <View style={styles.weightHeader}>
              <View
                style={[
                  styles.areaDot,
                  { backgroundColor: theme.areas[group.areaId] ?? theme.muted },
                ]}
              />
              <AppText variant="headline" color={theme.ink} style={styles.grow}>
                {group.areaName}
              </AppText>
              <AppText variant="headline" color={theme.muted} tabular>
                {groupTotal}
              </AppText>
            </View>
            {group.rows.map((row) => (
              <View key={row.unitId} style={styles.weightRow}>
                <AppText
                  color={row.weight === null ? theme.muted : theme.ink}
                  style={styles.grow}
                  numberOfLines={1}
                >
                  {row.name}
                </AppText>
                {row.weight === null ? (
                  <AppText variant="caption" color={theme.muted}>
                    not scored
                  </AppText>
                ) : (
                  <AppText color={theme.ink} tabular>
                    {row.weight}
                  </AppText>
                )}
              </View>
            ))}
          </View>
        );
      })}

      <View style={[styles.totalRow, { borderTopColor: theme.hairline }]}>
        <AppText variant="headline" color={theme.ink}>
          Daily budget
        </AppText>
        <AppText variant="headline" color={theme.ink} tabular>
          {grandTotal} pts
        </AppText>
      </View>

      <View style={{ height: space.xl }} />
      {results ? (
        <PortfolioGraphView snapshots={results.graph} theme={theme} />
      ) : null}

        <View style={{ height: space.xl }} />
        <Button label="Done" onPress={() => router.back()} theme={theme} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space.screen, overflow: "hidden" },
  center: { alignItems: "center", justifyContent: "center" },
  introBody: { flex: 1, justifyContent: "center", gap: space.lg },
  introCopy: { maxWidth: 320 },
  step: { flex: 1 },
  stepScroll: { paddingBottom: space.xl },
  areaHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: space.lg,
  },
  footer: {
    gap: space.xs,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resultsRoot: { flex: 1, overflow: "hidden" },
  resultsScroll: { paddingHorizontal: space.screen },
  resultsLead: { marginTop: space.sm, marginBottom: space.xl, maxWidth: 340 },
  weightGroup: {
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  weightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm + 2,
    marginBottom: space.xs,
  },
  areaDot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xs + 1,
    paddingLeft: space.lg + 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
