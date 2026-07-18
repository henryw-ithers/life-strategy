import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import type { ThemeTokens } from "../../theme/colors";
import { AppText } from "../ui/AppText";

interface DayNumberProps {
  /** The day's grade (may exceed 100), or null when nothing to show. */
  base: number | null;
  /** Dormant days render nothing: the number only exists once the day
   *  has something in it, so it only ever moves upward while watched. */
  dormant: boolean;
  theme: ThemeTokens;
  reduceMotion: boolean;
}

/** Ease-out count-up toward `target`; instant under reduced motion. */
function useCountUp(target: number, reduceMotion: boolean): number {
  const [shown, setShown] = useState(target);
  const raf = useRef<number | null>(null);
  const from = useRef(target);

  useEffect(() => {
    if (reduceMotion || target === from.current) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    const duration = 350;
    const tick = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(start + (target - start) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      from.current = target;
    };
  }, [target, reduceMotion]);

  return shown;
}

/** The day's number: dormant until the day has something in it, then
 *  a large tabular percentage that counts up as completions land. */
export function DayNumber({ base, dormant, theme, reduceMotion }: DayNumberProps) {
  const shown = useCountUp(base ?? 0, reduceMotion);
  if (dormant || base === null) return null;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(200)}
      style={styles.wrap}
      accessible
      accessibilityLabel={`Day grade ${base} percent`}
    >
      <AppText color={theme.ink} tabular style={styles.number}>
        {shown}
      </AppText>
      <AppText color={theme.muted} style={styles.percent}>
        %
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-start", gap: 2 },
  number: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "700",
    letterSpacing: -1,
  },
  percent: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "600",
    marginTop: 4,
  },
});
