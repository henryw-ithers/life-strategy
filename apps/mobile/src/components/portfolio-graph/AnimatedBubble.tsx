import { Circle, Group } from "@shopify/react-native-skia";
import { useEffect } from "react";
import {
  Extrapolation,
  interpolate,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import type { UnitSeries } from "./series";

interface AnimatedBubbleProps {
  series: UnitSeries;
  inputRange: number[];
  /** Fractional snapshot index; driven by the scrubber/mode. */
  progress: SharedValue<number>;
  /** 0→1 mount settle; already 1 when reduced motion is on. */
  settle: SharedValue<number>;
  color: string;
  /** Selection/legend dimming target, 0.25–1. Animated internally. */
  dimTarget: number;
  selected: boolean;
  haloColor: string;
  reduceMotion: boolean;
}

/**
 * One unit's bubble. All position/size/opacity math runs as Reanimated
 * derived values feeding Skia props directly — the UI thread animates;
 * React never re-renders during a scrub.
 */
export function AnimatedBubble({
  series,
  inputRange,
  progress,
  settle,
  color,
  dimTarget,
  selected,
  haloColor,
  reduceMotion,
}: AnimatedBubbleProps) {
  const dim = useSharedValue(dimTarget);
  useEffect(() => {
    dim.value = withTiming(dimTarget, { duration: reduceMotion ? 0 : 160 });
  }, [dim, dimTarget, reduceMotion]);

  const cx = useDerivedValue(() =>
    interpolate(progress.value, inputRange, series.xs, Extrapolation.CLAMP),
  );
  const cy = useDerivedValue(() =>
    interpolate(progress.value, inputRange, series.ys, Extrapolation.CLAMP),
  );
  const r = useDerivedValue(
    () =>
      interpolate(progress.value, inputRange, series.rs, Extrapolation.CLAMP) *
      (0.6 + 0.4 * settle.value),
  );
  const presence = useDerivedValue(() =>
    interpolate(progress.value, inputRange, series.present, Extrapolation.CLAMP),
  );

  const fillOpacity = useDerivedValue(
    () =>
      presence.value * dim.value * settle.value * (series.excluded ? 0 : 0.72),
  );
  const rimOpacity = useDerivedValue(
    () => presence.value * dim.value * settle.value,
  );
  const haloR = useDerivedValue(() => r.value + 4);
  const haloOpacity = useDerivedValue(() =>
    selected ? presence.value * settle.value * 0.55 : 0,
  );

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={r} color={color} opacity={fillOpacity} />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        color={color}
        opacity={rimOpacity}
        style="stroke"
        strokeWidth={selected ? 2.5 : 1.25}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={haloR}
        color={haloColor}
        opacity={haloOpacity}
        style="stroke"
        strokeWidth={1}
      />
    </Group>
  );
}
