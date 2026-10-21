/**
 * Today's fixed header: the day's identity (date, grade), the week's
 * number, and its navigation — the one part of Home you always need in
 * view, so it stays put and the checklist scrolls beneath it.
 */
import { addDays, weekStart, type PeriodGrade } from "@glide/scoring";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { type LinearTransition } from "react-native-reanimated";

import type { MonthDay } from "../../db/dayGrades";
import type { DayData } from "../../db/today";
import { editWindowDays } from "../../lib/calendar";
import { spokenDate } from "../../lib/format";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Chevron, Disclosure } from "../ui/Chevron";
import { DayNumber } from "./DayNumber";
import { MonthGrid } from "./MonthGrid";
import { WeekStrip } from "./WeekStrip";

export function TodayHeader({
  day,
  weekGrade,
  monthGrades,
  monthOpen,
  onToggleMonth,
  viewMonth,
  onChangeMonth,
  onSelect,
  onOpenKind,
  topInset,
  layout,
  reduceMotion,
  theme,
}: {
  day: DayData;
  weekGrade: PeriodGrade | null;
  monthGrades: Map<string, MonthDay>;
  monthOpen: boolean;
  onToggleMonth: () => void;
  viewMonth: string | null;
  onChangeMonth: (month: string) => void;
  onSelect: (date: string) => void;
  onOpenKind: () => void;
  topInset: number;
  layout: LinearTransition | undefined;
  reduceMotion: boolean;
  theme: ThemeTokens;
}) {
  const isToday = day.date === day.today;
  const dormant = day.score.earned === 0;

  return (
    <View
      style={[
        styles.header,
        { paddingTop: topInset + space.sm, borderBottomColor: theme.hairline },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={onToggleMonth}
          accessibilityRole="button"
          accessibilityLabel={`${spokenDate(day.date)}. ${monthOpen ? "Hide" : "Show"} the month`}
          style={styles.headerText}
        >
          <AppText variant="display" color={theme.ink}>
            {isToday ? "Today" : spokenDate(day.date).split(",")[0]}
          </AppText>
          <View style={styles.sectionLabel}>
            <AppText variant="caption" color={theme.muted}>
              {spokenDate(day.date)}
              {day.finalized ? " · settled" : ""}
            </AppText>
            <Disclosure open={monthOpen} theme={theme} size={13} />
          </View>
        </Pressable>
        <View style={styles.headerRight}>
          {day.kind === "rest" ? (
            <AppText variant="title" color={theme.muted}>
              Day off
            </AppText>
          ) : (
            <DayNumber
              key={day.date}
              base={day.score.base}
              dormant={dormant && day.kind === "normal"}
              theme={theme}
              reduceMotion={reduceMotion}
            />
          )}
          {day.editable ? (
            <Pressable
              onPress={onOpenKind}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Change what kind of day this is"
              style={({ pressed }) => [styles.kindButton, { opacity: pressed ? 0.5 : 1 }]}
            >
              <AppText variant="headline" color={theme.muted}>
                ⋯
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Days count once they're over (ADR-0004 §5 / periodDays), so
          today is not in this number yet — say so rather than let a
          completed task appear to do nothing. The day count states what
          the average rests on, which is what keeps it honest. */}
      {weekGrade?.base !== null && weekGrade?.base !== undefined ? (
        <AppText variant="caption" color={theme.muted} style={styles.weekStat}>
          {weekStart(day.date) === weekStart(day.today)
            ? `This week, through yesterday · ${weekGrade.base}%`
            : `That week · ${weekGrade.base}%`}
          {weekGrade.gradedDays > 0
            ? ` · ${weekGrade.gradedDays} ${weekGrade.gradedDays === 1 ? "day" : "days"}`
            : ""}
        </AppText>
      ) : null}

      {/* ── Month / week navigation ── */}
      {monthOpen ? (
        <Animated.View layout={layout} style={styles.strip}>
          <MonthGrid
            month={viewMonth ?? day.today}
            onChangeMonth={onChangeMonth}
            grades={monthGrades}
            selected={day.date}
            today={day.today}
            onSelect={onSelect}
            theme={theme}
          />
        </Animated.View>
      ) : (
        <Animated.View layout={layout} style={styles.strip}>
          <WeekStrip
            days={editWindowDays(day.today)}
            grades={monthGrades}
            selected={day.date}
            today={day.today}
            onSelect={onSelect}
            theme={theme}
          />
        </Animated.View>
      )}

      {/* The planner's discoverable way in (ADR-0024 §4). Tapping a
          future day in the strip opens the same screen, but that is a
          gesture you have to already know about. It sits beside the
          days because it is about *which day*; right-aligned and quiet,
          so it never competes with the grade. */}
      {day.hasTasks ? (
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.navigate(`/plan?date=${addDays(day.today, 1)}` as Href)}
            accessibilityRole="button"
            accessibilityLabel="Plan ahead"
            hitSlop={8}
            style={({ pressed }) => [styles.planAhead, { opacity: pressed ? 0.5 : 1 }]}
          >
            <AppText variant="footnote" color={theme.accent}>
              Plan ahead
            </AppText>
            <Chevron color={theme.accent} theme={theme} size={13} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Fixed above the scroll region; the strip's own top margin gives it
   *  room, so the header only pays for its bottom edge. */
  header: {
    paddingHorizontal: space.screen,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  headerRight: { alignItems: "flex-end", gap: space.xs },
  /** Label and its disclosure travel together as one target. */
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 4 },
  weekStat: { marginTop: space.xs },
  kindButton: { minWidth: 44, minHeight: 32, alignItems: "flex-end" },
  strip: { marginTop: space.lg },
  /** The toggle and the planner share the row under the dates. */
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  /** Bounded so two words do not stretch to half the screen. */
  /** Right-aligned under the strip's last day, so it reads as "and
   *  beyond this". */
  planAhead: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 2,
    minHeight: 32,
  },
});
