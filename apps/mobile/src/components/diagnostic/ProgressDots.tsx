import { StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";

interface ProgressDotsProps {
  /** One hue per step, already resolved by the caller — an area's hue
   *  for the steps that belong to an area, the app accent otherwise.
   *  Resolving here meant looking every id up in `theme.areas` and
   *  silently falling back to grey for any step that wasn't an area. */
  hues: string[];
  currentIndex: number;
  /** Per step: its work is finished. */
  completed: boolean[];
  theme: ThemeTokens;
}

/** One dot per step, each wearing its step's hue as it completes. */
export function ProgressDots({
  hues,
  currentIndex,
  completed,
  theme,
}: ProgressDotsProps) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${currentIndex + 1} of ${hues.length}`}
    >
      {hues.map((hue, i) => {
        const isCurrent = i === currentIndex;
        const isDone = completed[i] === true;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              isDone
                ? { backgroundColor: hue }
                : { borderWidth: 1.5, borderColor: isCurrent ? hue : theme.hairline },
              isCurrent && styles.current,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 6,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  current: { transform: [{ scale: 1.35 }] },
});
