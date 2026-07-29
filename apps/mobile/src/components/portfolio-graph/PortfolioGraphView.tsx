import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { DEFAULT_TAXONOMY } from "../../db/taxonomy";
import type { ThemeTokens } from "../../theme/colors";
import { AppText } from "../ui/AppText";
import { Callout } from "./Callout";
import { Legend } from "./Legend";
import { ModeControl } from "./ModeControl";
import { PortfolioGraph } from "./PortfolioGraph";
import { Scrubber } from "./Scrubber";
import type { GraphMode, GraphSnapshot } from "./types";

interface PortfolioGraphViewProps {
  /** Oldest → newest. */
  snapshots: GraphSnapshot[];
  theme: ThemeTokens;
}

/**
 * The full portfolio-graph surface: callout, mode control, canvas,
 * scrubber, and legend, with all selection/mode state owned here.
 */
export function PortfolioGraphView({ snapshots, theme }: PortfolioGraphViewProps) {
  const count = snapshots.length;
  const latest = count - 1;

  const [mode, setMode] = useState<GraphMode>("now");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [focusAreaId, setFocusAreaId] = useState<string | null>(null);
  const [displayIndex, setDisplayIndex] = useState(latest);
  const [size, setSize] = useState(0);

  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(Math.max(0, latest));
  const settle = useSharedValue(1);

  // Gentle one-time settle-in; skipped entirely under reduced motion.
  useEffect(() => {
    if (reduceMotion) return;
    settle.value = 0;
    settle.value = withTiming(1, {
      duration: 450,
      easing: Easing.out(Easing.poly(4)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeMode = (next: GraphMode) => {
    setMode(next);
    if (next !== "playback") {
      progress.value = reduceMotion
        ? latest
        : withTiming(latest, { duration: 240, easing: Easing.out(Easing.quad) });
      setDisplayIndex(latest);
    }
  };

  const selectedPoint = selectedUnitId
    ? (snapshots[displayIndex]?.points.find((p) => p.unitId === selectedUnitId) ??
      null)
    : null;

  const compareOldIndex = Math.max(0, latest - 1);
  const hint =
    count === 1
      ? "Bubbles grow as you log."
      : mode === "compare"
        ? `Trails show movement since ${snapshots[compareOldIndex]?.label ?? "last time"}.`
        : mode === "playback"
          ? "Drag the timeline to move through time."
          : "Tap a bubble to see its unit.";

  const legendAreas = useMemo(
    () => DEFAULT_TAXONOMY.map((a) => ({ id: a.id, name: a.name })),
    [],
  );

  return (
    <View style={styles.wrap}>
      <Callout point={selectedPoint} hint={hint} theme={theme} />

      <ModeControl
        mode={mode}
        onChange={changeMode}
        historyAvailable={count > 1}
        theme={theme}
      />

      <View style={styles.metaRow}>
        <AppText variant="footnote" color={theme.muted}>Priority ↑</AppText>
        <AppText variant="footnote" color={theme.muted}>
          {snapshots[displayIndex]?.label ?? ""}
        </AppText>
      </View>

      <View onLayout={(e) => setSize(e.nativeEvent.layout.width)}>
        {size > 0 ? (
          <PortfolioGraph
            snapshots={snapshots}
            size={size}
            mode={mode}
            progress={progress}
            settle={settle}
            displayIndex={displayIndex}
            selectedUnitId={selectedUnitId}
            focusAreaId={focusAreaId}
            onSelectUnit={setSelectedUnitId}
            theme={theme}
            reduceMotion={reduceMotion}
            compareOldIndex={compareOldIndex}
          />
        ) : null}
      </View>

      <View style={styles.metaRowEnd}>
        <AppText variant="footnote" color={theme.muted}>Satisfaction →</AppText>
      </View>

      {mode === "playback" && count > 1 ? (
        <Scrubber
          progress={progress}
          count={count}
          onIndexChange={setDisplayIndex}
          displayIndex={displayIndex}
          labels={snapshots.map((s) => s.label)}
          theme={theme}
          reduceMotion={reduceMotion}
        />
      ) : null}

      <Legend
        areas={legendAreas}
        focusAreaId={focusAreaId}
        onToggle={setFocusAreaId}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  metaRowEnd: { flexDirection: "row", justifyContent: "flex-end" },
});
