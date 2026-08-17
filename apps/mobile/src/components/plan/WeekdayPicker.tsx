/**
 * Which days a task happens on (ADR-0024 §1, phase 2).
 *
 * Picking days *is* setting the frequency — three chips lit is 3×/week
 * — so this replaces the wheel rather than sitting beside it. Two
 * inputs to one value is the contradiction the ADR exists to prevent.
 *
 * Clearing every chip returns the task to flexible ("any N days"),
 * which is the default and not a lesser state: most of a plan is
 * deliberately unpinned.
 */
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import {
  WEEKDAY_LETTER,
  WEEKDAY_NAME,
  WEEKDAY_ORDER,
  type Weekday,
} from "./planning";

interface WeekdayPickerProps {
  value: readonly Weekday[];
  onChange: (days: Weekday[]) => void;
  accent: string;
  theme: ThemeTokens;
}

export function WeekdayPicker({
  value,
  onChange,
  accent,
  theme,
}: WeekdayPickerProps) {
  const toggle = (day: Weekday) => {
    void Haptics.selectionAsync();
    onChange(
      value.includes(day) ? value.filter((d) => d !== day) : [...value, day],
    );
  };

  return (
    <View style={styles.row}>
      {WEEKDAY_ORDER.map((day, i) => {
        const on = value.includes(day);
        return (
          <Pressable
            key={day}
            onPress={() => toggle(day)}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            // The letter alone is ambiguous aloud — two Ss and two Ts.
            accessibilityLabel={WEEKDAY_NAME[day]}
            hitSlop={{ top: space.xs, bottom: space.xs }}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: on ? accent : theme.surface,
                borderColor: on ? accent : theme.hairline,
                opacity: pressed ? 0.65 : 1,
              },
              // Nudges the row's outer chips to the gutter without a
              // wrapper, so the seven stay evenly divided.
              i === 0 && styles.first,
              i === WEEKDAY_ORDER.length - 1 && styles.last,
            ]}
          >
            <AppText
              variant="label"
              color={on ? theme.onAccent : theme.muted}
              style={styles.letter}
            >
              {WEEKDAY_LETTER[day]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.xs },
  chip: {
    flex: 1,
    // 44 is the HIG floor for a tappable control, and these sit in a
    // row of seven where a miss costs the wrong day.
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  first: { marginLeft: 0 },
  last: { marginRight: 0 },
  letter: { lineHeight: 20 },
});
