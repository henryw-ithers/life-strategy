import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
import { fonts, radius, space } from "../../theme/tokens";
import {
  formatFrequency,
  MAX_TIMES_PER_WEEK,
  MIN_TIMES_PER_WEEK,
} from "./frequency";

const ITEM_H = 40;
const VISIBLE = 3;
const WHEEL_H = ITEM_H * VISIBLE;
const VALUES = Array.from(
  { length: MAX_TIMES_PER_WEEK - MIN_TIMES_PER_WEEK + 1 },
  (_, i) => MIN_TIMES_PER_WEEK + i,
);

interface FrequencyPickerProps {
  /** Times per week, 1–7. */
  value: number;
  onChange: (timesPerWeek: number) => void;
  accent: string;
  theme: ThemeTokens;
}

/**
 * Vertical wheel for how often a task happens: once a week through
 * every day. Scroll-snap with haptic detents, tap-to-jump; each settle
 * applies immediately.
 */
export function FrequencyPicker({ value, onChange, accent, theme }: FrequencyPickerProps) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue((value - MIN_TIMES_PER_WEEK) * ITEM_H);
  const dragging = useSharedValue(false);

  const lastSent = useRef(value);
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      scrollRef.current?.scrollTo({
        y: (value - MIN_TIMES_PER_WEEK) * ITEM_H,
        animated: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const tick = () => {
    void Haptics.selectionAsync();
  };

  useAnimatedReaction(
    () => Math.round(scrollY.value / ITEM_H),
    (current, previous) => {
      if (dragging.value && previous !== null && current !== previous) {
        runOnJS(tick)();
      }
    },
  );

  const settle = (index: number) => {
    const next = VALUES[Math.min(VALUES.length - 1, Math.max(0, index))] ?? 7;
    lastSent.current = next;
    onChange(next);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
    onBeginDrag: () => {
      dragging.value = true;
    },
    onMomentumEnd: (e) => {
      dragging.value = false;
      runOnJS(settle)(Math.round(e.contentOffset.y / ITEM_H));
    },
  });

  const jumpTo = (times: number) => {
    lastSent.current = times;
    onChange(times);
    scrollRef.current?.scrollTo({
      y: (times - MIN_TIMES_PER_WEEK) * ITEM_H,
      animated: true,
    });
    void Haptics.selectionAsync();
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="How often"
      accessibilityValue={{ text: formatFrequency(value) }}
      accessibilityActions={[
        { name: "increment", label: "More often" },
        { name: "decrement", label: "Less often" },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment")
          jumpTo(Math.min(MAX_TIMES_PER_WEEK, value + 1));
        if (e.nativeEvent.actionName === "decrement")
          jumpTo(Math.max(MIN_TIMES_PER_WEEK, value - 1));
      }}
      style={[styles.wheel, { backgroundColor: theme.surface }]}
    >
      {/* Center detent window */}
      <View
        pointerEvents="none"
        style={[
          styles.indicator,
          { borderColor: accent, backgroundColor: `${accent}12` },
        ]}
      />
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        contentOffset={{ x: 0, y: (value - MIN_TIMES_PER_WEEK) * ITEM_H }}
        contentContainerStyle={{ paddingVertical: (WHEEL_H - ITEM_H) / 2 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        importantForAccessibility="no-hide-descendants"
      >
        {VALUES.map((times) => (
          <WheelRow
            key={times}
            times={times}
            scrollY={scrollY}
            ink={theme.ink}
            onPress={() => jumpTo(times)}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

function WheelRow({
  times,
  scrollY,
  ink,
  onPress,
}: {
  times: number;
  scrollY: SharedValue<number>;
  ink: string;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollY.value / ITEM_H - (times - MIN_TIMES_PER_WEEK));
    return {
      opacity: interpolate(distance, [0, 1, 2], [1, 0.4, 0.15], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(distance, [0, 1.5], [1, 0.88], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Animated.Text style={[styles.rowText, { color: ink }, style]}>
        {formatFrequency(times)}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wheel: {
    height: WHEEL_H,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  indicator: {
    position: "absolute",
    left: space.sm,
    right: space.sm,
    top: (WHEEL_H - ITEM_H) / 2,
    height: ITEM_H,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  row: {
    height: ITEM_H,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    // Size is tuned to the picker row rather than the scale; the
    // family still comes from tokens.
    fontSize: 16,
    fontFamily: fonts.semibold,
    letterSpacing: -0.2,
  },
});
