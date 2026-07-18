import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

interface WeekStripProps {
  /** 14 days, last week's Monday first (the edit window). */
  days: string[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  theme: ThemeTokens;
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Two swipeable weeks of day chips — the edit window as navigation.
 * Future days are visible but disabled; the calendar grows from here.
 */
export function WeekStrip({ days, selected, today, onSelect, theme }: WeekStripProps) {
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const weeks = [days.slice(0, 7), days.slice(7, 14)];

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w !== width) {
          setWidth(w);
          // Land on the current week (page 2) once width is known.
          requestAnimationFrame(() =>
            scrollRef.current?.scrollTo({ x: w, animated: false }),
          );
        }
      }}
    >
      {width > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
        >
          {weeks.map((week, w) => (
            <View key={w} style={[styles.week, { width }]}>
              {week.map((date, i) => {
                const isToday = date === today;
                const isSelected = date === selected;
                const isFuture = date > today;
                return (
                  <Pressable
                    key={date}
                    onPress={() => onSelect(date)}
                    disabled={isFuture}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected, disabled: isFuture }}
                    accessibilityLabel={`${date}${isToday ? ", today" : ""}`}
                    style={[
                      styles.chip,
                      // Solid outline = today; broken outline = selected day.
                      isToday && { borderColor: theme.accent },
                      isSelected && !isToday && {
                        borderColor: theme.ink,
                        borderStyle: "dashed" as const,
                      },
                      isFuture && styles.future,
                    ]}
                  >
                    <AppText variant="footnote" color={theme.muted}>
                      {DAY_LETTERS[i] ?? ""}
                    </AppText>
                    <AppText variant="label" color={theme.ink} tabular>
                      {Number(date.slice(8, 10))}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  week: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chip: {
    width: 40,
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.xs,
    gap: 1,
  },
  future: { opacity: 0.35 },
});
