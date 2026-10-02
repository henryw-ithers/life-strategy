import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { MonthDay } from "../../db/dayGrades";
import { spokenDate } from "../../lib/format";
import { gradeColor, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

interface WeekStripProps {
  /** 14 days, last week's Sunday first (the edit window). */
  days: string[];
  /** Same map the month grid reads; must cover the whole window. */
  grades: Map<string, MonthDay>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  theme: ThemeTokens;
}

/** Sunday-first, matching `weekStart` (ADR-0004 §1 as amended). */
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Two swipeable weeks of day chips — the edit window as navigation.
 * Future days open the planner rather than the day: you cannot tick
 * tomorrow, but you can arrange it (ADR-0024 §4). They stay dimmed,
 * because a day you can only plan is not a day you can record.
 *
 * Carries the same grade chip as the month grid: the strip is the
 * default view, so leaving the score to the expanded calendar meant
 * the number was hidden exactly where people spend their time.
 */
export function WeekStrip({
  days,
  grades,
  selected,
  today,
  onSelect,
  theme,
}: WeekStripProps) {
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
                const day = grades.get(date);
                const isToday = date === today;
                const isSelected = date === selected;
                const isFuture = date > today;
                return (
                  <Pressable
                    key={date}
                    onPress={() => onSelect(date)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${spokenDate(date)}${isToday ? ", today" : ""}${
                      day?.grade != null ? `, ${day.grade} percent` : ""
                    }${day?.kind === "rest" ? ", day off" : ""}${isFuture ? ", plan this day" : ""}`}
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
                    {/* The slot takes the space left under the date and
                        centres its contents in it, so the grade sits
                        optically between the numeral and the chip's
                        bottom edge — and empty days hold the same
                        height, so chips don't jump between weeks. */}
                    <View style={styles.gradeSlot}>
                      {day?.kind === "rest" ? (
                        <View style={[styles.restDot, { backgroundColor: theme.muted }]} />
                      ) : day?.grade != null ? (
                        <View
                          style={[
                            styles.gradeChip,
                            {
                              borderColor: gradeColor(day.grade, theme),
                              backgroundColor: `${gradeColor(day.grade, theme)}14`,
                            },
                          ]}
                        >
                          {/* Numeral in ink — the ramp colors the chip,
                              never small text (ADR/DESIGN: mid-bands sit
                              under 4.5:1 at this size). */}
                          <AppText variant="footnote" color={theme.ink} tabular>
                            {day.grade}
                          </AppText>
                        </View>
                      ) : null}
                    </View>
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
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    // Letter and date pin to the top; `gradeSlot` claims the rest.
    justifyContent: "flex-start",
    paddingVertical: space.xs,
    gap: 1,
  },
  future: { opacity: 0.35 },
  gradeSlot: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  gradeChip: {
    minWidth: 30,
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 3,
  },
  restDot: { width: 5, height: 5, borderRadius: 2.5 },
});
