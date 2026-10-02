import { Pressable, StyleSheet, View } from "react-native";

import type { MonthDay } from "../../db/dayGrades";
import { spokenDate } from "../../lib/format";
import { gradeColor, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Chevron } from "../ui/Chevron";

interface MonthGridProps {
  /** Any date inside the month to render (normally today). */
  month: string;
  grades: Map<string, MonthDay>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  /** Step to another month. Any past month is reachable — days no
   *  longer lock (ADR-0004 §3 as amended 2026-07-30), so the calendar
   *  must be able to reach every day it now allows editing. */
  onChangeMonth?: (month: string) => void;
  theme: ThemeTokens;
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n: number): string {
  return `${n}`.padStart(2, "0");
}

/** First of the month `delta` months from the one containing `month`. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1, 12));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
}

/**
 * The current month at a glance: day numerals with each day's score
 * written under them (life-log tints arrive with the full calendar
 * phase). Same chip language as the week strip.
 */
export function MonthGrid({
  month,
  grades,
  selected,
  today,
  onSelect,
  onChangeMonth,
  theme,
}: MonthGridProps) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y!, m!, 0, 12)).getUTCDate();
  // Sunday-first offset of the 1st (ADR-0004 §1 as amended).
  const leading = new Date(Date.UTC(y!, m! - 1, 1, 12)).getUTCDay();

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month.slice(0, 7)}-${pad2(i + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View accessibilityLabel={`Calendar for ${month.slice(0, 7)}`}>
      {onChangeMonth ? (
        <View style={styles.monthRow}>
          <Pressable
            onPress={() => onChangeMonth(shiftMonth(month, -1))}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            hitSlop={10}
            style={({ pressed }) => [styles.arrow, { opacity: pressed ? 0.5 : 1 }]}
          >
            <AppText variant="headline" color={theme.ink}>
              ‹
            </AppText>
          </Pressable>
          <AppText variant="label" color={theme.ink} style={styles.monthLabel}>
            {MONTHS[m! - 1]} {y}
          </AppText>
          <Pressable
            // There is nothing to log in the future, so forward stops
            // at the month containing today.
            disabled={month.slice(0, 7) >= today.slice(0, 7)}
            onPress={() => onChangeMonth(shiftMonth(month, 1))}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            accessibilityState={{ disabled: month.slice(0, 7) >= today.slice(0, 7) }}
            hitSlop={10}
            style={({ pressed }) => [
              styles.arrow,
              { opacity: month.slice(0, 7) >= today.slice(0, 7) ? 0.3 : pressed ? 0.5 : 1 },
            ]}
          >
            <Chevron color={theme.ink} theme={theme} size={18} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.headerRow}>
        {DAY_LETTERS.map((l, i) => (
          <AppText key={i} variant="footnote" color={theme.muted} style={styles.headCell}>
            {l}
          </AppText>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={styles.weekRow}>
          {cells.slice(w * 7, w * 7 + 7).map((date, i) => {
            if (date === null) return <View key={`b${i}`} style={styles.cell} />;
            const day = grades.get(date);
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
                accessibilityLabel={`${spokenDate(date)}${isToday ? ", today" : ""}${
                  day?.grade != null ? `, ${day.grade} percent` : ""
                }${day?.kind === "rest" ? ", day off" : ""}`}
                style={[
                  styles.cell,
                  // Solid outline = today; broken outline = selected day.
                  isToday && { borderColor: theme.accent },
                  isSelected && !isToday && {
                    borderColor: theme.ink,
                    borderStyle: "dashed" as const,
                  },
                  isFuture && styles.future,
                ]}
              >
                <AppText variant="label" color={theme.ink} tabular>
                  {Number(date.slice(8, 10))}
                </AppText>
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
                    {/* Numeral in ink — the ramp colors the chip, never
                        small text (mid-bands sit under 4.5:1). */}
                    <AppText variant="footnote" color={theme.ink} tabular>
                      {day.grade}
                    </AppText>
                  </View>
                ) : (
                  <View style={styles.blank} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
    marginBottom: space.xs,
  },
  arrow: {
    minWidth: 44,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: { flex: 1, textAlign: "center" },
  headerRow: { flexDirection: "row", marginBottom: space.xs },
  headCell: { flex: 1, textAlign: "center" },
  weekRow: { flexDirection: "row" },
  cell: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingVertical: 3,
  },
  future: { opacity: 0.35 },
  restDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
  blank: { height: 20 },
  gradeChip: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 3,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
