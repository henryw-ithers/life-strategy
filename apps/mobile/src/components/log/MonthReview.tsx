/**
 * A month's review: how it scored and what it held. It leads each
 * month in the Log.
 *
 * The portfolio graph it used to show went with the diagnostic
 * (ADR-0041 §5); Life shows where your time went instead (Phase 10).
 */
import { StyleSheet, View } from "react-native";

import type { LogMonth } from "../../db/log";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Group } from "../ui/Group";

/** "2026-08" → "August 2026". Written out rather than abbreviated: this
 *  is a section title in a record, not a chart axis. */
export function monthName(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return `${date.toLocaleString(undefined, { month: "long" })} ${year}`;
}

export function MonthReview({
  month,
  theme,
  /** The Log's months are titled by their own section, so it takes
   *  none there. */
  title,
}: {
  month: LogMonth;
  theme: ThemeTokens;
  title?: string;
}) {
  const { grade, totals, daysRecorded, earned } = month;

  const held = [
    totals.notes > 0 ? `${totals.notes} note${totals.notes === 1 ? "" : "s"}` : null,
    totals.photos > 0
      ? `${totals.photos} photo${totals.photos === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  return (
    <Group theme={theme} title={title}>
      <View style={styles.head}>
        <AppText variant="title" color={theme.ink} tabular>
          {grade.base === null ? "—" : `${grade.base}`}
        </AppText>
        {/* The denominator is stated, and "all" is doing work:
            `gradedDays` counts every elapsed day of the month, including
            ones the app was never opened on. Without the word it reads
            as "days you showed up", which is the *other* number here. */}
        <AppText color={theme.muted} style={styles.grow}>
          {grade.gradedDays === 0
            ? "Nothing graded yet."
            : `out of 100, across all ${grade.gradedDays} day${
                grade.gradedDays === 1 ? "" : "s"
              }`}
        </AppText>
      </View>

      <AppText variant="caption" color={theme.muted}>
        {held.length > 0
          ? `You wrote something on ${daysRecorded} of them · ${held.join(" · ")}`
          : "Nothing written down this month."}
      </AppText>

      {/* What was earned, listed (ADR-0047 §7). Only ever a list of
          what happened: a month with none shows nothing. */}
      {earned.length > 0 ? (
        <View style={styles.earned} accessibilityRole="summary">
          <AppText variant="caption" color={theme.muted}>
            Earned this month
          </AppText>
          {earned.map((title, i) => (
            <AppText key={`${i}-${title}`} color={theme.ink}>
              {title}
            </AppText>
          ))}
        </View>
      ) : null}

    </Group>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  grow: { flex: 1 },
  earned: { gap: space.xs },
});
