/**
 * A month's review: how it scored, what it held, and where the
 * portfolio stood when you last looked at it.
 *
 * **One block, two homes** (2026-08-26). It leads each month in the Log,
 * and Portfolio shows the current month's copy above the ranking. Two
 * renderings of "how was this month" would drift apart within a release;
 * one component cannot.
 *
 * **This is also the only place the portfolio graph appears now.** It
 * used to sit on Portfolio as a permanent card, which put a history
 * chart on the screen you go to in order to change *today's* priorities
 * — a question it cannot answer. It belongs to a retrospective, so it
 * lives in one, and only for months that actually hold a diagnostic.
 *
 * The graph renders inline and inert. Tapping opens the full-size view,
 * which is where scrubbing between diagnostics belongs; a canvas inside
 * a scrolling list should not also be a gesture surface competing with
 * the scroll it sits in.
 */
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { PortfolioGraph, type GraphSnapshot } from "../portfolio-graph";
import type { LogMonth } from "../../db/log";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Chevron } from "../ui/Chevron";
import { Group } from "../ui/Group";

const GRAPH_SIZE = 132;

/** "2026-08" → "August 2026". Written out rather than abbreviated: this
 *  is a section title in a record, not a chart axis. */
export function monthName(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return `${date.toLocaleString(undefined, { month: "long" })} ${year}`;
}

export function MonthReview({
  month,
  snapshots,
  theme,
  /** Portfolio titles its copy "This month"; the Log's months are
   *  already titled by their own section, so it takes none. */
  title,
}: {
  month: LogMonth;
  snapshots: GraphSnapshot[];
  theme: ThemeTokens;
  title?: string;
}) {
  const { grade, totals, daysRecorded } = month;

  /** The diagnostic taken in this month, if there was one. The graph
   *  is parked on it rather than on the newest, so a month's review
   *  shows the portfolio *that month* had. */
  const index = useMemo(
    () => snapshots.findIndex((s) => s.month === month.month),
    [snapshots, month.month],
  );
  const at = index >= 0 ? index : -1;
  const progress = useSharedValue(Math.max(0, at));
  const settle = useSharedValue(1);

  const held = [
    totals.notes > 0 ? `${totals.notes} note${totals.notes === 1 ? "" : "s"}` : null,
    totals.photos > 0
      ? `${totals.photos} photo${totals.photos === 1 ? "" : "s"}`
      : null,
    totals.achievements > 0 ? `${totals.achievements} reached` : null,
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

      {at >= 0 ? (
        <Pressable
          onPress={() => router.push("/portfolio/graph")}
          accessibilityRole="button"
          accessibilityLabel={`Portfolio after the ${snapshots[at]?.label} diagnostic. Opens full size.`}
          style={({ pressed }) => [styles.graphRow, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View pointerEvents="none" style={styles.canvas}>
            <PortfolioGraph
              snapshots={snapshots}
              size={GRAPH_SIZE}
              mode="now"
              progress={progress}
              settle={settle}
              displayIndex={at}
              selectedUnitId={null}
              focusAreaId={null}
              onSelectUnit={() => {}}
              theme={theme}
              reduceMotion
              compareOldIndex={0}
            />
          </View>
          <View style={styles.graphText}>
            <AppText variant="headline" color={theme.ink}>
              Where things stood
            </AppText>
            <AppText variant="caption" color={theme.muted}>
              You ran the diagnostic this month.
            </AppText>
            <View style={styles.openRow}>
              <AppText variant="label" color={theme.accent}>
                Open
              </AppText>
              <Chevron color={theme.accent} theme={theme} size={15} />
            </View>
          </View>
        </Pressable>
      ) : null}
    </Group>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  grow: { flex: 1 },
  graphRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    marginTop: space.sm,
  },
  canvas: { width: GRAPH_SIZE, height: GRAPH_SIZE },
  graphText: { flex: 1, gap: 2 },
  openRow: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.xs },
});
