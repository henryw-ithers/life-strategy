import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";

const ITEM_W = 44;
const DIAL_H = 56;
/** Seven copies of 1–10; the strip re-centers to the middle copy after
 *  every settle, so the dial loops endlessly in both directions. */
const COPIES = 7;
const MID = Math.floor(COPIES / 2) * 10;
const ITEMS = Array.from({ length: COPIES * 10 }, (_, i) => ({
  index: i,
  value: (i % 10) + 1,
}));

interface NumberDialProps {
  /** Row label, e.g. "Priority". */
  label: string;
  /** For accessibility: "Friendship — Priority". */
  a11yName: string;
  value: number | null;
  onChange: (value: number) => void;
  /** Area hue; colors the readout and center indicator once set. */
  accent: string;
  theme: ThemeTokens;
  reduceMotion: boolean;
}

/**
 * Endless number carousel: 1–10 looping scroll-snap on a surface
 * track, a haptic tick per detent, tap-to-jump, and an unset ("—")
 * state so first-time ratings carry no anchoring default. Digit scale
 * and opacity track scroll position on the UI thread.
 */
export function NumberDial({
  label,
  a11yName,
  value,
  onChange,
  accent,
  theme,
  reduceMotion,
}: NumberDialProps) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const startIndex = MID + (value ?? 5) - 1;
  const scrollX = useSharedValue(startIndex * ITEM_W);
  const dragging = useSharedValue(false);
  const [containerW, setContainerW] = useState(0);
  const touched = value !== null;

  // Position the strip on mount / external prefill without haptics.
  const lastSent = useRef<number | null>(value);
  useEffect(() => {
    if (value !== null && value !== lastSent.current) {
      lastSent.current = value;
      scrollRef.current?.scrollTo({
        x: (MID + value - 1) * ITEM_W,
        animated: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, containerW]);

  const tick = () => {
    void Haptics.selectionAsync();
  };

  useAnimatedReaction(
    () => Math.round(scrollX.value / ITEM_W),
    (current, previous) => {
      if (dragging.value && previous !== null && current !== previous) {
        runOnJS(tick)();
      }
    },
  );

  /** Commit the settled value, then silently re-center to the middle
   *  copy so the next spin has runway in both directions. */
  const settle = (index: number) => {
    const next = (index % 10) + 1;
    lastSent.current = next;
    onChange(next);
    const home = MID + next - 1;
    if (index !== home) {
      scrollRef.current?.scrollTo({ x: home * ITEM_W, animated: false });
    }
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
    onBeginDrag: () => {
      dragging.value = true;
    },
    onMomentumEnd: (e) => {
      dragging.value = false;
      const index = Math.min(
        ITEMS.length - 1,
        Math.max(0, Math.round(e.contentOffset.x / ITEM_W)),
      );
      runOnJS(settle)(index);
    },
  });

  /** Tap a digit: head for the nearest copy of that value. */
  const jumpTo = (next: number, fromIndex?: number) => {
    const current = fromIndex ?? Math.round(scrollX.value / ITEM_W);
    let best = MID + next - 1;
    let bestDist = Number.MAX_SAFE_INTEGER;
    for (let copy = 0; copy < COPIES; copy++) {
      const candidate = copy * 10 + next - 1;
      const dist = Math.abs(candidate - current);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    lastSent.current = next;
    onChange(next);
    scrollRef.current?.scrollTo({ x: best * ITEM_W, animated: !reduceMotion });
    if (reduceMotion) {
      // No momentum event will fire; re-center immediately.
      const home = MID + next - 1;
      if (best !== home) {
        scrollRef.current?.scrollTo({ x: home * ITEM_W, animated: false });
      }
    }
    void Haptics.selectionAsync();
  };

  const sidePad = Math.max(0, (containerW - ITEM_W) / 2);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={a11yName}
      accessibilityValue={{ text: touched ? `${value} of 10` : "not set" }}
      accessibilityActions={[
        { name: "increment", label: "Increase" },
        { name: "decrement", label: "Decrease" },
      ]}
      onAccessibilityAction={(e) => {
        const base = value ?? 5;
        if (e.nativeEvent.actionName === "increment")
          jumpTo(base === 10 ? 1 : base + 1);
        if (e.nativeEvent.actionName === "decrement")
          jumpTo(base === 1 ? 10 : base - 1);
      }}
    >
      <View style={styles.labelRow}>
        <Text style={[typeScale.caption, { color: theme.muted }]}>{label}</Text>
        <Text
          style={[styles.readout, { color: touched ? accent : theme.hairline }]}
        >
          {touched ? value : "—"}
        </Text>
      </View>

      <View
        style={[styles.dial, { backgroundColor: theme.surface }]}
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
        importantForAccessibility="no-hide-descendants"
      >
        {/* Center detent indicator */}
        <View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              left: sidePad - 4,
              borderColor: touched ? accent : theme.hairline,
              backgroundColor: touched ? `${accent}1a` : "transparent",
            },
          ]}
        />
        {containerW > 0 ? (
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={ITEM_W}
            decelerationRate="fast"
            contentOffset={{ x: startIndex * ITEM_W, y: 0 }}
            contentContainerStyle={{ paddingHorizontal: sidePad }}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {ITEMS.map((item) => (
              <DialDigit
                key={item.index}
                item={item}
                scrollX={scrollX}
                muted={theme.muted}
                ink={theme.ink}
                touched={touched}
                onPress={() => jumpTo(item.value, item.index)}
              />
            ))}
          </Animated.ScrollView>
        ) : null}
      </View>
    </View>
  );
}

function DialDigit({
  item,
  scrollX,
  muted,
  ink,
  touched,
  onPress,
}: {
  item: { index: number; value: number };
  scrollX: SharedValue<number>;
  muted: string;
  ink: string;
  touched: boolean;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value / ITEM_W - item.index);
    return {
      transform: [
        { scale: interpolate(distance, [0, 1.5], [1.25, 0.85], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(distance, [0, 2], [1, 0.35], Extrapolation.CLAMP),
    };
  });

  return (
    <Pressable onPress={onPress} style={styles.digitCell}>
      <Animated.Text
        style={[styles.digit, { color: touched ? ink : muted }, style]}
      >
        {item.value}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: space.xs,
  },
  readout: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
  },
  dial: {
    height: DIAL_H,
    justifyContent: "center",
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  indicator: {
    position: "absolute",
    width: ITEM_W + 8,
    height: DIAL_H - 12,
    top: 6,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  digitCell: {
    width: ITEM_W,
    height: DIAL_H,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontSize: 19,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
