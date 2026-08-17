/**
 * Where in the day a task sits (ADR-0024 §1).
 *
 * Four segments, not a time picker. The app owns no clocks: a time
 * would drive nothing here — there are no per-task reminders and no
 * time-slot calendar — so it would buy ordering this already provides,
 * at the cost of PRODUCT.md's first anti-reference.
 *
 * *Anytime* is the rightmost segment and the default. It reads last
 * because the first three are chronological and "no preference" is not
 * a fourth time of day; it is the absence of one.
 *
 * Built from the app's own chip vocabulary rather than a system
 * segmented control — PRODUCT.md ships one custom design language, and
 * a platform control here would be the only one on the screen.
 */
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";

import { wash, type ThemeTokens } from "../../theme/colors";
import { radius } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { ANYTIME_LABEL, PART_OF_DAY_LABEL, PART_OF_DAY_ORDER, type PartOfDay } from "./planning";

interface PartOfDayPickerProps {
  /** Null is *Anytime* — a value, not a gap. */
  value: PartOfDay | null;
  onChange: (part: PartOfDay | null) => void;
  accent: string;
  theme: ThemeTokens;
}

const SEGMENTS: readonly (PartOfDay | null)[] = [...PART_OF_DAY_ORDER, null];

export function PartOfDayPicker({
  value,
  onChange,
  accent,
  theme,
}: PartOfDayPickerProps) {
  return (
    <View style={[styles.track, { backgroundColor: theme.surface }]}>
      {SEGMENTS.map((part) => {
        const on = part === value;
        const label = part ? PART_OF_DAY_LABEL[part] : ANYTIME_LABEL;
        return (
          <Pressable
            key={part ?? "anytime"}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(part);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
            style={({ pressed }) => [
              styles.segment,
              pressed && { opacity: 0.7 },
              // A wash plus a hairline, so the selected segment reads
              // as raised out of the groove without putting caption
              // text on a hue that can't carry it (see `wash`).
              on && {
                backgroundColor: wash(accent, theme),
                borderColor: accent,
                borderWidth: 1,
              },
            ]}
          >
            <AppText
              variant="caption"
              color={on ? theme.ink : theme.muted}
              numberOfLines={1}
              style={styles.label}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: radius.md,
    // The track's own inset, so a selected segment's fill sits inside
    // the groove rather than butting against its edge.
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    // 44 is the HIG floor for a tappable control.
    height: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  label: { lineHeight: 16 },
});
