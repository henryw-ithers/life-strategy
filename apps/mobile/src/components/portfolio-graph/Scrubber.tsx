import * as Haptics from "expo-haptics";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import type { ThemeTokens } from "../../theme/colors";

const THUMB = 24;
const PAD = THUMB / 2;

interface ScrubberProps {
  progress: SharedValue<number>;
  count: number;
  /** Rounded index changed (fires with haptic detent). */
  onIndexChange: (index: number) => void;
  displayIndex: number;
  labels: string[];
  theme: ThemeTokens;
  reduceMotion: boolean;
}

/**
 * Playback scrubber: drag anywhere on the track; progress drives the
 * graph on the UI thread; releasing snaps to the nearest snapshot with
 * a soft detent haptic at each crossing.
 */
export function Scrubber({
  progress,
  count,
  onIndexChange,
  displayIndex,
  labels,
  theme,
  reduceMotion,
}: ScrubberProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackW = useSharedValue(0);
  const max = count - 1;

  const notifyDetent = (index: number) => {
    void Haptics.selectionAsync();
    onIndexChange(index);
  };

  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (previous !== null && current !== previous) {
        runOnJS(notifyDetent)(current);
      }
    },
  );

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      "worklet";
      if (trackW.value <= 0) return;
      const usable = trackW.value - PAD * 2;
      progress.value = Math.min(max, Math.max(0, ((e.x - PAD) / usable) * max));
    })
    .onUpdate((e) => {
      "worklet";
      if (trackW.value <= 0) return;
      const usable = trackW.value - PAD * 2;
      progress.value = Math.min(max, Math.max(0, ((e.x - PAD) / usable) * max));
    })
    .onFinalize(() => {
      "worklet";
      progress.value = withTiming(Math.round(progress.value), {
        duration: reduceMotion ? 0 : 180,
        easing: Easing.out(Easing.quad),
      });
    });

  const thumbStyle = useAnimatedStyle(() => {
    const usable = Math.max(1, trackW.value - PAD * 2);
    return {
      transform: [{ translateX: PAD + (progress.value / max) * usable - THUMB / 2 }],
    };
  });

  const setIndex = (index: number) => {
    const clamped = Math.min(max, Math.max(0, index));
    progress.value = withTiming(clamped, { duration: reduceMotion ? 0 : 180 });
  };

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.hitArea}
        onLayout={(e) => {
          setTrackWidth(e.nativeEvent.layout.width);
          trackW.value = e.nativeEvent.layout.width;
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Snapshot timeline"
        accessibilityValue={{ text: labels[displayIndex] ?? "" }}
        accessibilityActions={[
          { name: "increment", label: "Next snapshot" },
          { name: "decrement", label: "Previous snapshot" },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "increment") setIndex(displayIndex + 1);
          if (e.nativeEvent.actionName === "decrement") setIndex(displayIndex - 1);
        }}
      >
        <View style={[styles.track, { backgroundColor: theme.hairline }]} />
        {trackWidth > 0 &&
          labels.map((label, i) => (
            <View
              key={label}
              style={[
                styles.detent,
                {
                  backgroundColor: theme.muted,
                  left: PAD + (i / max) * (trackWidth - PAD * 2) - 2,
                },
              ]}
            />
          ))}
        <Animated.View
          style={[
            styles.thumb,
            { backgroundColor: theme.ink, borderColor: theme.canvas },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hitArea: { height: 48, justifyContent: "center" },
  track: { height: 3, borderRadius: 1.5 },
  detent: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    top: 22,
  },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    top: 12,
    left: 0,
  },
});
