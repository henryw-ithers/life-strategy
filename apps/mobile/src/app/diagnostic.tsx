/**
 * The diagnostic flow (ADR-0005, ranked per the ADR-0003 amendment):
 * intro → rank the six areas by priority, then order all seventeen
 * units by priority → the same two passes for satisfaction → review →
 * transactional save → results with derived weights and the portfolio
 * graph on real data. See `buildSequence` for why the per-area unit
 * passes were dropped.
 *
 * Ranking (not absolute 1–10 dials) guarantees full-range spread every
 * time, regardless of how "important" everything subjectively feels —
 * `buildEntriesFromRanking` (db/diagnostic.ts) converts the finished
 * order back into the same importance/satisfaction numbers the
 * weight formula and portfolio graph have always consumed. The area
 * ranking seeds the unit list's opening order; the unit list is what
 * scores.
 */
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
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

import { RankGroup } from "../components/diagnostic/RankGroup";
import { ProgressDots } from "../components/diagnostic/ProgressDots";
import { UnitInfoSheet } from "../components/diagnostic/UnitInfoSheet";
import { PortfolioGraphView, type GraphSnapshot } from "../components/portfolio-graph";
import { Backdrop, constellation } from "../components/ui/Backdrop";
import { AppText } from "../components/ui/AppText";
import { Button } from "../components/ui/Button";
import { UNIT_INFO } from "../content/units";
import {
  buildEntriesFromRanking,
  loadDiagnosticAreas,
  loadDiagnosticDiff,
  loadWeightSummary,
  saveDiagnostic,
  suggestOverallOrder,
  type AreaWeightGroup,
  type DiagnosticArea,
  type DiagnosticAxis,
  type DiagnosticDiff,
} from "../db/diagnostic";
import { loadGraphSnapshots } from "../db/graph";
import { getTheme, type ThemeTokens } from "../theme/colors";
import { radius, space } from "../theme/tokens";

type Phase = "loading" | "intro" | "steps" | "saving" | "error" | "diff" | "results";

type Step =
  | { kind: "areas"; axis: DiagnosticAxis }
  | { kind: "final"; axis: DiagnosticAxis }
  | { kind: "review" };

/**
 * Coarse then fine, once per axis.
 *
 * Ranking each area's two or three units separately, then the areas,
 * then confirming the composition, meant seventeen steps to express
 * what the last screen could express directly — and the per-area
 * passes were the ones doing the least work, since a strict
 * area-primary composition can put a low unit of a top area above the
 * best unit of a lower one anyway. Ranking the areas now seeds the
 * order of the full unit list, and that list is where the answer is
 * actually given.
 *
 * Grouped by axis rather than by scope: all the "what matters"
 * thinking, then all the "how is it going" thinking. The unit list
 * opens ordered by the area ranking made immediately before it, so
 * the seed is legible instead of arriving two screens late.
 */
function buildSequence(): Step[] {
  return [
    { kind: "areas", axis: "priority" },
    { kind: "final", axis: "priority" },
    { kind: "areas", axis: "satisfaction" },
    { kind: "final", axis: "satisfaction" },
    { kind: "review" },
  ];
}

const AXIS_LABEL: Record<DiagnosticAxis, string> = {
  priority: "Priority",
  satisfaction: "Satisfaction",
};

const AREA_PROMPT: Record<DiagnosticAxis, string> = {
  priority: "Which area needs more attention right now?",
  satisfaction: "Which area are you more satisfied with overall?",
};

const FINAL_PROMPT: Record<DiagnosticAxis, string> = {
  priority: "Everything, in order of attention",
  satisfaction: "Everything, in order of satisfaction",
};

const FINAL_HEADING: Record<DiagnosticAxis, string> = {
  priority: "Your priorities",
  satisfaction: "Your satisfaction",
};

interface DiffRowProps {
  areaColor: string;
  name: string;
  primary: string;
  caption?: string;
  onPress?: () => void;
  theme: ThemeTokens;
}

/** One diff row — tappable only when there's somewhere useful to go
 *  (ADR-0005 §2: prompts appear only where the diagnostic moved
 *  things; everything else is just informational). */
function DiffRow({ areaColor, name, primary, caption, onPress, theme }: DiffRowProps) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [diffStyles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[diffStyles.dot, { backgroundColor: areaColor }]} />
      <AppText color={theme.ink} style={diffStyles.grow} numberOfLines={1}>
        {name}
      </AppText>
      {caption ? (
        <AppText variant="caption" color={theme.muted}>
          {caption}
        </AppText>
      ) : null}
      <AppText color={theme.ink} tabular>
        {primary}
      </AppText>
    </Pressable>
  );
}

const diffStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
    paddingVertical: space.xs,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
});

export default function DiagnosticFlow() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const navigation = useNavigation();

  const [phase, setPhase] = useState<Phase>("loading");
  const [areas, setAreas] = useState<DiagnosticArea[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [areaOrder, setAreaOrder] = useState<Partial<Record<DiagnosticAxis, string[]>>>(
    {},
  );
  const [results, setResults] = useState<{
    weights: AreaWeightGroup[];
    graph: GraphSnapshot[];
  } | null>(null);
  const [diff, setDiff] = useState<DiagnosticDiff | null>(null);
  /** The reviewed overall order per axis — set when the final step is
   *  first shown, then edited by dragging. Cleared whenever an upstream
   *  ranking changes, so going back and reordering an area produces a
   *  fresh suggestion rather than silently keeping a stale one. */
  const [finalOrder, setFinalOrder] = useState<
    Partial<Record<DiagnosticAxis, string[]>>
  >({});
  /** The unit whose guidelines sheet is open, if any — carrying its
   *  area hue so the sheet stays colour-coded now that steps aren't. */
  const [infoUnit, setInfoUnit] = useState<{
    id: string;
    name: string;
    accent: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const loadedAreas = await loadDiagnosticAreas();
      setAreas(loadedAreas);
      setPhase("intro");
    })();
  }, []);

  // A stray back-swipe must not destroy five minutes of reflection.
  usePreventRemove(phase === "steps" || phase === "saving", ({ data }) => {
    Alert.alert("Discard this diagnostic?", "Your rankings won't be saved.", [
      { text: "Keep ranking", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const sequence = useMemo(() => buildSequence(), []);

  /** One dot per ranking step; review shares the last one. */
  const dotIds = useMemo(
    () => sequence.filter((s) => s.kind !== "review").map((s) => `${s.kind}-${s.axis}`),
    [sequence],
  );
  const currentDotIndex = Math.min(stepIndex, dotIds.length - 1);
  /** Dragging is optional — the suggested order is already a valid
   *  answer — so a stage counts as done once it has been passed, not
   *  once something has been moved. */
  const dotCompleted = useMemo(
    () => dotIds.map((_, i) => i < currentDotIndex),
    [dotIds, currentDotIndex],
  );

  const goToStep = (next: number) => {
    setDirection(next >= stepIndex ? 1 : -1);
    setStepIndex(next);
  };

  const save = async () => {
    setPhase("saving");
    try {
      // No within-area pass any more — the reviewed unit order is the
      // ranking, and `finalOrder` is what scores.
      const entries = buildEntriesFromRanking(areas, {}, areaOrder, finalOrder);
      const snapshotId = await saveDiagnostic(entries);
      const [weights, graph, snapshotDiff] = await Promise.all([
        loadWeightSummary(snapshotId),
        loadGraphSnapshots(),
        loadDiagnosticDiff(snapshotId),
      ]);
      setResults({ weights, graph });
      const hasDiff =
        snapshotDiff !== null &&
        (snapshotDiff.moved.length > 0 ||
          snapshotDiff.excluded.length > 0 ||
          snapshotDiff.included.length > 0);
      if (hasDiff) {
        setDiff(snapshotDiff);
        setPhase("diff");
      } else {
        setPhase("results");
      }
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
            Rank each part of your life against the rest — what needs your
            attention most, and where you're most satisfied. No numbers, just
            comparisons.
          </AppText>
          <AppText variant="caption" color={theme.muted}>
            Six areas · about five minutes
          </AppText>
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
    const step = sequence[stepIndex]!;

    let heading: string;
    let content: React.ReactNode;

    /** Unit id -> its name and area, for the flattened list. */
    const unitById = new Map(
      areas.flatMap((a) =>
        a.units.map((u) => [u.id, { name: u.name, areaId: a.id }] as const),
      ),
    );

    // Any unit row opens its detail — "what does this actually mean?"
    // is a fair question wherever it's asked. A custom unit (the schema
    // allows them; no UI creates them yet) has nothing written, hence
    // `hasDetail`.
    const unitRow = (id: string) => {
      const u = unitById.get(id);
      return {
        id,
        label: u?.name ?? id,
        hasDetail: UNIT_INFO[id] !== undefined,
        accent: u ? theme.areas[u.areaId] : undefined,
      };
    };
    const openInfo = (item: { id: string; label: string }) =>
      setInfoUnit({
        id: item.id,
        name: item.label,
        accent:
          theme.areas[unitById.get(item.id)?.areaId ?? ""] ?? theme.accent,
      });
    const UNIT_HINT = "Tap a unit to read what it covers · drag the handle to reorder";
    const AREA_HINT = "Drag the handle to reorder";

    if (step.kind === "areas") {
      const order = areaOrder[step.axis] ?? areas.map((a) => a.id);
      heading = `Your areas — ${AXIS_LABEL[step.axis]}`;
      content = (
        <RankGroup
          key={`areas-${step.axis}`}
          items={order.map((id) => {
            const a = areas.find((x) => x.id === id)!;
            return { id: a.id, label: a.name, accent: theme.areas[a.id] };
          })}
          prompt={AREA_PROMPT[step.axis]}
          hint={AREA_HINT}
          theme={theme}
          onChange={(next) => {
            setAreaOrder((prev) => ({ ...prev, [step.axis]: next }));
            setFinalOrder((prev) => ({ ...prev, [step.axis]: undefined }));
          }}
        />
      );
    } else if (step.kind === "final") {
      // Opens ordered by the area ranking made on the previous screen,
      // units in taxonomy order within each. Every row wears its own
      // area's hue, which is the explanation for where it landed — and
      // the cue for whether a move you want is really a correction to
      // the area ranking one step back.
      const order =
        finalOrder[step.axis] ?? suggestOverallOrder(areas, {}, areaOrder, step.axis);
      heading = FINAL_HEADING[step.axis];
      content = (
        <RankGroup
          key={`final-${step.axis}`}
          items={order.map(unitRow)}
          prompt={FINAL_PROMPT[step.axis]}
          hint={UNIT_HINT}
          theme={theme}
          onPressItem={openInfo}
          detailHint="what this unit covers"
          onChange={(next) =>
            setFinalOrder((prev) => ({ ...prev, [step.axis]: next }))
          }
        />
      );
    } else {
      heading = "Ready";
      content = (
        <AppText color={theme.ink}>
          Every area is ranked. Save this snapshot to see your portfolio.
        </AppText>
      );
    }

    return (
      <View style={screen}>
        <Backdrop circles={constellation(theme.areas, { faint: true })} />
        <ProgressDots
          areaIds={dotIds}
          currentIndex={currentDotIndex}
          completed={dotCompleted}
          theme={theme}
        />
        {/* Ranking steps own their scrolling — the list auto-scrolls
            while dragging, which a wrapping ScrollView would fight. */}
        <Animated.View key={stepIndex} entering={entering} style={styles.step}>
          <View style={styles.stepInner}>
            <View style={styles.areaHeader}>
              <AppText variant="title" color={theme.ink}>
                {heading}
              </AppText>
            </View>
            <View style={{ height: space.md }} />
            {step.kind === "review" ? (
              <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView>
            ) : (
              content
            )}
          </View>
        </Animated.View>
        {/* Advance/save keep the app accent rather than the step's area
            hue. Three of the six light-theme hues put a white label
            under 4.5:1 as a button fill (amber worst, 3.16:1), and the
            area is already spoken for by the backdrop wash and the
            progress dots — recolouring the primary action per step was
            decoration paying an accessibility cost. */}
        <View style={[styles.footer, { borderTopColor: theme.hairline }, footerPad]}>
          {step.kind === "review" ? (
            <Button label="Save snapshot" onPress={save} theme={theme} />
          ) : (
            <Button
              label="Continue"
              onPress={() => goToStep(stepIndex + 1)}
              theme={theme}
            />
          )}
          <Button
            label="Back"
            variant="quiet"
            onPress={() =>
              stepIndex === 0 ? setPhase("intro") : goToStep(stepIndex - 1)
            }
            theme={theme}
          />
        </View>
        {infoUnit && UNIT_INFO[infoUnit.id] ? (
          <UnitInfoSheet
            visible
            onClose={() => setInfoUnit(null)}
            unitName={infoUnit.name}
            info={UNIT_INFO[infoUnit.id]!}
            accent={infoUnit.accent}
            theme={theme}
          />
        ) : null}
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
          Your rankings are still here. Try again.
        </AppText>
        <View style={{ height: space.sm }} />
        <Button label="Retry" onPress={save} theme={theme} />
      </View>
    );
  }

  if (phase === "diff") {
    const d = diff ?? { moved: [], excluded: [], included: [] };
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
            What moved
          </AppText>
          <AppText color={theme.muted} style={styles.resultsLead}>
            Since your last diagnostic. Nothing here needs action — carry
            everything over as-is if it looks right.
          </AppText>

          {d.excluded.length > 0 ? (
            <View style={[styles.weightGroup, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink} style={{ marginBottom: space.xs }}>
                Excluded from scoring
              </AppText>
              {d.excluded.map((row) => (
                <DiffRow
                  key={row.unitId}
                  areaColor={theme.areas[row.areaId] ?? theme.muted}
                  name={row.name}
                  primary="excluded"
                  caption={row.goalIds.length > 0 ? "pause its goal?" : undefined}
                  onPress={
                    row.goalIds.length === 1
                      ? () => router.push(`/goals/${row.goalIds[0]}` as Href)
                      : row.goalIds.length > 1
                        ? () => router.push("/goals" as Href)
                        : undefined
                  }
                  theme={theme}
                />
              ))}
            </View>
          ) : null}

          {d.moved.length > 0 ? (
            <View style={[styles.weightGroup, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink} style={{ marginBottom: space.xs }}>
                Weight moved
              </AppText>
              {d.moved.map((row) => (
                <DiffRow
                  key={row.unitId}
                  areaColor={theme.areas[row.areaId] ?? theme.muted}
                  name={row.name}
                  primary={`${row.oldWeight} → ${row.newWeight}`}
                  caption={row.suggestAddTask ? "add a task?" : undefined}
                  onPress={
                    row.suggestAddTask
                      ? () => router.push(`/plan/${row.unitId}` as Href)
                      : undefined
                  }
                  theme={theme}
                />
              ))}
            </View>
          ) : null}

          {d.included.length > 0 ? (
            <View style={[styles.weightGroup, { borderTopColor: theme.hairline }]}>
              <AppText variant="headline" color={theme.ink} style={{ marginBottom: space.xs }}>
                Back in scoring
              </AppText>
              {d.included.map((row) => (
                <DiffRow
                  key={row.unitId}
                  areaColor={theme.areas[row.areaId] ?? theme.muted}
                  name={row.name}
                  primary={`${row.newWeight}`}
                  caption={row.suggestAddTask ? "add a task?" : undefined}
                  onPress={
                    row.suggestAddTask
                      ? () => router.push(`/plan/${row.unitId}` as Href)
                      : undefined
                  }
                  theme={theme}
                />
              ))}
            </View>
          ) : null}

          <View style={{ height: space.xl }} />
          <Button label="Continue" onPress={() => setPhase("results")} theme={theme} />
        </ScrollView>
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
              <Pressable
                key={row.unitId}
                disabled={row.weight === null}
                onPress={() => router.push(`/plan/${row.unitId}` as Href)}
                accessibilityRole="button"
                accessibilityHint="Opens this unit's task plan"
                style={({ pressed }) => [styles.weightRow, { opacity: pressed ? 0.6 : 1 }]}
              >
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
              </Pressable>
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
  stepInner: { flex: 1, paddingBottom: space.lg },
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
