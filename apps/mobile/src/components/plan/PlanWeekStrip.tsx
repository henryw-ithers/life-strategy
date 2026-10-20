/**
 * Plan's week strip (spec §5.3): Sunday to Saturday, the app's week
 * (ADR-0004 §1), today marked and the chosen day filled. A dot marks a
 * day with pins; a line under it marks a Special day, a day off or an
 * Away day. Swipe, or use ‹ ›, for other weeks.
 *
 * Nothing on it counts anything: no fill for how planned a day is, no
 * mark for a day that went unplanned (P15).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { SymbolView } from "expo-symbols";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Pressable, StyleSheet, View } from "react-native";
import { runOnJS } from "react-native-reanimated";

import type { DayMarker, WeekDay } from "../../db/dayPlan";
import { spokenDate } from "../../lib/format";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

const LETTER = ["S", "M", "T", "W", "T", "F", "S"] as const;

const MARKER_SAID: Record<Exclude<DayMarker, null>, string> = {
  special: "Special day",
  dayOff: "Day off",
  away: "Away",
};

interface PlanWeekStripProps {
  /** The week's seven days, Sunday first. */
  days: readonly WeekDay[];
  /** "Week of 18 Oct". */
  label: string;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  theme: ThemeTokens;
}

export function PlanWeekStrip({
  days,
  label,
  selected,
  today,
  onSelect,
  onPrevWeek,
  onNextWeek,
  theme,
}: PlanWeekStripProps) {
  // A horizontal swipe changes the week; vertical movement is left to
  // the page's scroll.
  const swipe = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX < -40) runOnJS(onNextWeek)();
      else if (e.translationX > 40) runOnJS(onPrevWeek)();
    });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={onPrevWeek}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          hitSlop={8}
          style={styles.arrow}
        >
          <SymbolView
            name="chevron.left"
            size={18}
            tintColor={theme.ink}
            fallback={<Ionicons name="chevron-back" size={18} color={theme.ink} />}
          />
        </Pressable>
        <AppText variant="label" color={theme.ink} accessibilityRole="header">
          {label}
        </AppText>
        <Pressable
          onPress={onNextWeek}
          accessibilityRole="button"
          accessibilityLabel="Next week"
          hitSlop={8}
          style={styles.arrow}
        >
          <SymbolView
            name="chevron.right"
            size={18}
            tintColor={theme.ink}
            fallback={<Ionicons name="chevron-forward" size={18} color={theme.ink} />}
          />
        </Pressable>
      </View>
      <GestureDetector gesture={swipe}>
        <View style={styles.days}>
          {days.map((d, i) => {
            const isSelected = d.date === selected;
            const isToday = d.date === today;
            const said = [
              spokenDate(d.date),
              isToday ? "today" : null,
              d.hasPins ? "has pins" : null,
              d.marker ? MARKER_SAID[d.marker] : null,
            ]
              .filter(Boolean)
              .join(", ");
            return (
              <Pressable
                key={d.date}
                onPress={() => onSelect(d.date)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={said}
                style={styles.day}
              >
                <AppText variant="footnote" color={theme.muted}>
                  {LETTER[i]}
                </AppText>
                <View
                  style={[
                    styles.number,
                    isSelected
                      ? { backgroundColor: theme.accent }
                      : isToday
                        ? { borderColor: theme.accent, borderWidth: 1.5 }
                        : null,
                  ]}
                >
                  <AppText
                    variant="label"
                    color={isSelected ? theme.onAccent : theme.ink}
                    tabular
                  >
                    {Number(d.date.slice(8))}
                  </AppText>
                </View>
                <View
                  style={[styles.dot, { backgroundColor: d.hasPins ? theme.muted : "transparent" }]}
                />
                <View
                  style={[
                    styles.line,
                    { backgroundColor: d.marker ? theme.accent : "transparent" },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm, paddingBottom: space.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  arrow: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  days: { flexDirection: "row", justifyContent: "space-between" },
  day: { flex: 1, alignItems: "center", gap: 3, minHeight: 44, paddingVertical: space.xs },
  number: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  line: { width: 18, height: 2, borderRadius: 1 },
});
