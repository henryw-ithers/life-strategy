/**
 * An hour of the day, set one hour at a time: "3:00 am" between − and +,
 * wrapping round midnight. For a value that is only ever a whole hour,
 * where a time wheel would offer minutes it can't keep.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space, weight } from "../../theme/tokens";
import { AppText } from "./AppText";

/** `14` → "2:00 pm". */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${h < 12 ? "am" : "pm"}`;
}

export function HourStepper({
  hour,
  onChange,
  theme,
}: {
  hour: number;
  onChange: (hour: number) => void;
  theme: ThemeTokens;
}) {
  const step = (by: number) => onChange((hour + by + 24) % 24);
  return (
    <View
      style={[styles.root, { backgroundColor: theme.fill }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Day starts at"
      accessibilityValue={{ text: hourLabel(hour) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      <Pressable onPress={() => step(-1)} hitSlop={8} style={styles.button}>
        <Ionicons name="remove" size={18} color={theme.ink} />
      </Pressable>
      <AppText color={theme.ink} style={styles.value}>
        {hourLabel(hour)}
      </AppText>
      <Pressable onPress={() => step(1)} hitSlop={8} style={styles.button}>
        <Ionicons name="add" size={18} color={theme.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.sm,
    paddingHorizontal: space.xs,
  },
  button: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  value: { minWidth: 72, textAlign: "center", fontVariant: ["tabular-nums"], fontWeight: weight.medium },
});
