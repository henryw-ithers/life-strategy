/**
 * The top of Today's list, under the native large title (which names the
 * day and folds as you scroll, Henry 2026-11-07): the date, which opens
 * the month, the day's grade and the week's number. Day type is in the
 * nav bar's ⋯ menu, so there's one ⋯, not two.
 */
import { weekStart, type PeriodGrade } from "@glide/scoring";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { type LinearTransition } from "react-native-reanimated";

import type { MonthDay } from "../../db/dayGrades";
import type { DayData } from "../../db/today";
import { spokenDate } from "../../lib/format";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Disclosure } from "../ui/Chevron";
import { DayNumber } from "./DayNumber";
import { MonthGrid } from "./MonthGrid";

export function TodayHeader({
  day,
  weekGrade,
  monthGrades,
  monthOpen,
  onToggleMonth,
  viewMonth,
  onChangeMonth,
  onSelect,
  onOpenScore,
  onStep,
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
  /** Tapping the number: how the day adds up. */
  onOpenScore: () => void;
  /** The day before or after: VoiceOver's way to swipe. */
  onStep: (days: number) => void;
  layout: LinearTransition | undefined;
  reduceMotion: boolean;
  theme: ThemeTokens;
}) {
  const dormant = day.score.earned === 0;

  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={onToggleMonth}
          accessibilityRole="button"
          accessibilityLabel={`${spokenDate(day.date)}. ${monthOpen ? "Hide" : "Show"} the month`}
          accessibilityActions={[
            { name: "decrement", label: "Previous day" },
            { name: "increment", label: "Next day" },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "increment") onStep(1);
            if (e.nativeEvent.actionName === "decrement") onStep(-1);
          }}
          style={styles.headerText}
        >
          <View style={styles.sectionLabel}>
            <AppText variant="body" color={theme.muted}>
              {spokenDate(day.date)}
              {day.finalized ? " · settled" : ""}
            </AppText>
            <Disclosure open={monthOpen} theme={theme} size={13} />
          </View>
        </Pressable>
        <View style={styles.headerRight}>
          {day.date > day.today ? null : day.kind === "rest" ? (
            <AppText variant="title" color={theme.muted}>
              Day off
            </AppText>
          ) : (
            <Pressable
              onPress={onOpenScore}
              // A settled day keeps only its total (`storedDayScore`), so
              // there's no breakdown to show.
              disabled={day.score.base === null || day.finalized || (dormant && day.kind === "normal")}
              accessibilityRole="button"
              accessibilityLabel={day.score.base !== null ? `Day grade ${day.score.base} percent` : undefined}
              accessibilityHint="Shows how the day adds up"
              hitSlop={8}
            >
              <DayNumber
                key={day.date}
                base={day.score.base}
                dormant={dormant && day.kind === "normal"}
                theme={theme}
                reduceMotion={reduceMotion}
              />
            </Pressable>
          )}
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
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  /** The list's own padding sets its sides. */
  header: { paddingBottom: space.md },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2, minHeight: 44, justifyContent: "center" },
  headerRight: { alignItems: "flex-end", gap: space.xs },
  /** Label and its disclosure travel together as one target. */
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 4 },
  weekStat: { marginTop: space.xs },
  strip: { marginTop: space.lg },
});
