import { StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";

interface ProgressDotsProps {
  areaIds: string[];
  currentIndex: number;
  /** Per-area: all its units rated. */
  completed: boolean[];
  theme: ThemeTokens;
}

/** Six area dots, each wearing its area's hue as it completes. */
export function ProgressDots({
  areaIds,
  currentIndex,
  completed,
  theme,
}: ProgressDotsProps) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Area ${currentIndex + 1} of ${areaIds.length}`}
    >
      {areaIds.map((areaId, i) => {
        const hue = theme.areas[areaId] ?? theme.muted;
        const isCurrent = i === currentIndex;
        const isDone = completed[i] === true;
        return (
          <View
            key={areaId}
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
