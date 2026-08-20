/**
 * A row of mutually exclusive choices, in the app's own segment style.
 *
 * `PartOfDayPicker` had this shape hand-built inside it, and adding two
 * more segmented choices to the schedule block — does this repeat or
 * happen once, and how big is it — would have made three copies of one
 * control. Same track, same 44pt segments, same wash-plus-Ink selection
 * the weekday chips and unit chips use, so a person meets one selection
 * language across the whole sheet.
 *
 * Selection is a **wash with an Ink label**, never a solid area hue
 * behind small text: four of the six hues fall under AA that way in
 * light theme (DESIGN.md, Colors).
 */
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";

import { wash, type ThemeTokens } from "../../theme/colors";
import { radius } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

export interface Segment<T> {
  value: T;
  label: string;
}

interface SegmentedProps<T> {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (next: T) => void;
  accent: string;
  theme: ThemeTokens;
  /** Announced before the segment's own label. */
  label: string;
}

export function Segmented<T extends string | null>({
  segments,
  value,
  onChange,
  accent,
  theme,
  label,
}: SegmentedProps<T>) {
  return (
    <View
      style={[styles.track, { backgroundColor: theme.surface }]}
      accessibilityRole="tablist"
      accessibilityLabel={label}
    >
      {segments.map((segment) => {
        const on = segment.value === value;
        return (
          <Pressable
            key={String(segment.value)}
            onPress={() => {
              if (on) return;
              void Haptics.selectionAsync();
              onChange(segment.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={segment.label}
            style={({ pressed }) => [
              styles.segment,
              {
                backgroundColor: on ? wash(accent, theme) : "transparent",
                borderColor: on ? accent : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText
              variant="caption"
              color={on ? theme.ink : theme.muted}
              numberOfLines={1}
            >
              {segment.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  /** 3 + 44 + 3 = 50pt, matching the frequency stepper above it. */
  track: { flexDirection: "row", borderRadius: radius.md, padding: 3, gap: 2 },
  segment: {
    flex: 1,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
});
