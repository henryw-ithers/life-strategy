import { Canvas, Line, vec } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

import type { ThemeTokens } from "../../theme/colors";
import { AnimatedBubble } from "./AnimatedBubble";
import { CompareOverlay } from "./CompareOverlay";
import { effortLabel, plotRect, ratingToX, ratingToY } from "./geometry";
import { buildSeries } from "./series";
import type { GraphMode, GraphSnapshot } from "./types";

interface PortfolioGraphProps {
  snapshots: GraphSnapshot[];
  /** Square canvas edge in layout points. */
  size: number;
  mode: GraphMode;
  progress: SharedValue<number>;
  settle: SharedValue<number>;
  /** JS-side snapshot index (rounded progress) for overlays/callout. */
  displayIndex: number;
  selectedUnitId: string | null;
  focusAreaId: string | null;
  onSelectUnit: (unitId: string | null) => void;
  theme: ThemeTokens;
  reduceMotion: boolean;
  compareOldIndex: number;
}

const FALLBACK_COLOR = "#888888";

export function PortfolioGraph({
  snapshots,
  size,
  mode,
  progress,
  settle,
  displayIndex,
  selectedUnitId,
  focusAreaId,
  onSelectUnit,
  theme,
  reduceMotion,
  compareOldIndex,
}: PortfolioGraphProps) {
  const plot = useMemo(() => plotRect(size), [size]);
  const { series, inputRange } = useMemo(
    () => buildSeries(snapshots, plot),
    [snapshots, plot],
  );

  const dimTarget = (unitId: string, areaId: string): number => {
    let dim = 1;
    if (focusAreaId && areaId !== focusAreaId) dim = Math.min(dim, 0.25);
    if (selectedUnitId && unitId !== selectedUnitId) dim = Math.min(dim, 0.35);
    return dim;
  };

  // Tap + screen-reader overlay: one invisible target per bubble at its
  // current snapshot position. Skia pixels are invisible to assistive
  // tech; these views are the graph's accessible surface.
  const overlayIndex = Math.min(displayIndex, inputRange.length - 1);
  const overlays = series
    .filter((s) => s.present[overlayIndex] === 1)
    .map((s) => ({
      unitId: s.unitId,
      areaId: s.areaId,
      name: s.name,
      x: s.xs[overlayIndex]!,
      y: s.ys[overlayIndex]!,
      r: s.rs[overlayIndex]!,
      point: s.points[overlayIndex],
      excluded: s.excluded,
    }))
    // Large bubbles first so small ones render on top and stay tappable.
    .sort((a, b) => b.r - a.r);

  const handleTap = (unitId: string) => {
    if (selectedUnitId !== unitId) {
      onSelectUnit(unitId);
      return;
    }
    // Tapping the selected bubble cycles to an overlapping neighbor,
    // or deselects when it stands alone.
    const self = overlays.find((o) => o.unitId === unitId);
    if (!self) return onSelectUnit(null);
    const neighbor = overlays
      .filter(
        (o) =>
          o.unitId !== unitId &&
          Math.hypot(o.x - self.x, o.y - self.y) < o.r + self.r,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - self.x, a.y - self.y) -
          Math.hypot(b.x - self.x, b.y - self.y),
      )[0];
    onSelectUnit(neighbor ? neighbor.unitId : null);
  };

  const midX = ratingToX(5.5, plot);
  const midY = ratingToY(5.5, plot);

  return (
    <View style={{ width: size, height: size }}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => onSelectUnit(null)}
        accessible={false}
      >
        <Canvas style={{ width: size, height: size }}>
          {/* Quadrant midlines — whisper-subtle */}
          <Line
            p1={vec(midX, plot.y)}
            p2={vec(midX, plot.y + plot.h)}
            color={theme.hairline}
            strokeWidth={1}
          />
          <Line
            p1={vec(plot.x, midY)}
            p2={vec(plot.x + plot.w, midY)}
            color={theme.hairline}
            strokeWidth={1}
          />

          {mode === "compare" && snapshots.length > 1 ? (
            <CompareOverlay
              series={series}
              oldIndex={compareOldIndex}
              newIndex={snapshots.length - 1}
              colorFor={(areaId) => theme.areas[areaId] ?? FALLBACK_COLOR}
              dimFor={(unitId) => {
                const s = series.find((x) => x.unitId === unitId);
                return s ? dimTarget(s.unitId, s.areaId) : 1;
              }}
            />
          ) : null}

          {series.map((s) => (
            <AnimatedBubble
              key={s.unitId}
              series={s}
              inputRange={inputRange}
              progress={progress}
              settle={settle}
              color={theme.areas[s.areaId] ?? FALLBACK_COLOR}
              dimTarget={dimTarget(s.unitId, s.areaId)}
              selected={selectedUnitId === s.unitId}
              haloColor={theme.ink}
              reduceMotion={reduceMotion}
            />
          ))}
        </Canvas>
      </Pressable>

      {overlays.map((o) => {
        const p = o.point;
        const label = p
          ? `${o.name}. Priority ${p.importance} of 10, satisfaction ${p.satisfaction} of 10, ${effortLabel(p.effort)}.${o.excluded ? " Not scored." : ""}`
          : o.name;
        return (
          <Pressable
            key={o.unitId}
            onPress={() => handleTap(o.unitId)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: selectedUnitId === o.unitId }}
            style={{
              position: "absolute",
              left: o.x - 22,
              top: o.y - 22,
              width: 44,
              height: 44,
              borderRadius: 22,
            }}
          />
        );
      })}
    </View>
  );
}
