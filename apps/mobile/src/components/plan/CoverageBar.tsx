/**
 * How much of your hundred is actually reachable, as one bar.
 *
 * **This is what the Tasks screen is for, drawn instead of described.**
 * ADR-0027 §2 makes coverage decide the ceiling: the routine band pays
 * `0.8 × w` per unit, and a unit with no daily task leaves its share
 * unearnable — nobody else receives it. So the most consequential fact
 * about a plan is *which parts of your life have a daily habit in
 * them*, and until now a person could only discover it by expanding
 * eighteen units and doing arithmetic. The number that answers it,
 * `dayCeiling`, had been written, tested, and called by nothing.
 *
 * Each filled segment is one area at its covered weight, in that area's
 * own hue — the same six colours the checklist, the portfolio bubbles
 * and every chip use, so the bar is legible without a legend. The
 * hairline remainder is weight you ranked and cannot currently earn.
 *
 * **Coverage means a *daily* task, not any task.** A unit whose only
 * work is weekly earns from the variable band and still leaves its
 * routine share on the table, which is exactly the distinction the bar
 * has to make visible; a version that counted any task would say a plan
 * was complete when it was not.
 *
 * No caption explains it. A mostly-filled bar reads as "most of my life
 * is covered" on sight, and the number to its right is the same
 * right-column grammar the area and unit rows below already use.
 */
import { dayCeiling, isRoutine } from "@glide/scoring";
import { StyleSheet, View } from "react-native";

import type { PlanArea } from "../../db/tasks";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

/** Below this the segment is invisible but still nudges its neighbours,
 *  so it is dropped rather than drawn as a sliver. */
const MIN_VISIBLE_WEIGHT = 1;

export function CoverageBar({
  areas,
  theme,
}: {
  areas: PlanArea[];
  theme: ThemeTokens;
}) {
  const units = areas.flatMap((a) =>
    a.units.map((u) => ({ ...u, areaId: a.id })),
  );
  const scored = units.filter((u) => u.includeInScoring && u.weight !== null);
  if (scored.length === 0) return null;

  /** A unit counts as covered when it holds at least one daily task. */
  const isCovered = (u: (typeof scored)[number]) =>
    u.tasks.some((t) => isRoutine(t.timesPerWeek));

  const ceiling = dayCeiling(
    scored.map((u) => ({ unitId: u.id, weight: u.weight ?? 0 })),
    units.flatMap((u) =>
      u.tasks.map((t) => ({
        id: t.id,
        unitId: u.id,
        timesPerWeek: t.timesPerWeek,
        rankInUnit: t.rankInUnit,
      })),
    ),
  );

  const total = scored.reduce((sum, u) => sum + (u.weight ?? 0), 0);
  const covered = areas
    .map((area) => ({
      id: area.id,
      weight: scored
        .filter((u) => u.areaId === area.id && isCovered(u))
        .reduce((sum, u) => sum + (u.weight ?? 0), 0),
    }))
    .filter((a) => a.weight >= MIN_VISIBLE_WEIGHT);
  const uncovered = Math.max(0, total - covered.reduce((s, a) => s + a.weight, 0));

  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`${total - uncovered} of ${total} points covered by a daily task. Today can reach ${ceiling}.`}
    >
      <View style={styles.track}>
        {covered.map((area) => (
          <View
            key={area.id}
            style={[
              styles.fill,
              { flex: area.weight, backgroundColor: theme.areas[area.id] ?? theme.muted },
            ]}
          />
        ))}
        {uncovered > 0 ? (
          <View
            style={[styles.fill, { flex: uncovered, backgroundColor: theme.hairline }]}
          />
        ) : null}
      </View>
      <AppText variant="label" color={theme.ink} tabular>
        {ceiling}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.screen,
    paddingBottom: space.sm,
  },
  /** Sits at the same height as the onboarding band bar, which shows
   *  the other half of the same idea. */
  track: {
    flex: 1,
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    gap: 2,
  },
  fill: { height: 10 },
});
