/**
 * How much of your hundred has a daily habit in it, as one bar.
 *
 * **This is what the Tasks screen is for, drawn instead of described.**
 * Eighteen units is more than anyone holds in their head, and the most
 * consequential fact about a plan is *which parts of your life have a
 * daily habit in them* — a thing a person could otherwise only discover
 * by expanding every unit and doing arithmetic.
 *
 * **It stopped being arithmetic on 2026-08-26** (ADR-0028 §3). Under
 * ADR-0027 §2 an uncovered unit forfeited its `0.8 × w`, so this bar
 * carried `dayCeiling` — the literal maximum the day could pay — and a
 * half-covered plan was capped near half the points. That is withdrawn:
 * each band is now spent in full by the units holding its work, so the
 * ceiling is 100 for any plan with a daily task in it and the number
 * would be a constant.
 *
 * The bar stays anyway, because the advice it gives was always the good
 * part. It now reads as what it is: coverage, not a cap. A mostly-empty
 * bar means a plan that touches a corner of your life, which is worth
 * seeing and is nobody's business to penalise.
 *
 * Each filled segment is one area at its covered weight, in that area's
 * own hue — the same six colours the checklist, the portfolio bubbles
 * and every chip use, so the bar is legible without a legend. The
 * hairline remainder is weight you ranked and have no daily habit in.
 *
 * **Coverage means any task** since ADR-0029 §2. It used to mean a
 * *daily* task, because that was the only kind the routine band would
 * pay; cadence no longer decides what a band pays, so a unit with a
 * weekly commitment in it is a unit you are working on.
 *
 * No caption explains it. A mostly-filled bar reads as "most of my life
 * is covered" on sight, and the number to its right is the same
 * right-column grammar the area and unit rows below already use.
 *
 * **On a day with commitment work, the band leads the bar** (ADR-0032).
 * The band is that share of the whole day and the life units share
 * what is left, so drawing the 18 units at full width would overstate
 * them. The band is drawn first, at its size and in the commitments'
 * hue, and every area after it is scaled into the remainder. It is
 * always filled: it divides only among commitments with work today, so
 * none of it is stranded. Whether it applies comes from
 * `commitmentBandOn`, the same helper the grade uses; on a free day it
 * is zero and the bar is exactly main's.
 */
import {
  commitmentBandOn,
  unitCoverage,
  type CommitmentDay,
} from "@glide/scoring";
import { StyleSheet, View } from "react-native";

import type { PlanArea } from "../../db/tasks";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

/** Below this the segment is invisible but still nudges its neighbours,
 *  so it is dropped rather than drawn as a sliver. */
const MIN_VISIBLE_WEIGHT = 1;

/** The hue commitments are drawn in everywhere else. */
const COMMITMENT_AREA = "work-money";

export function CoverageBar({
  areas,
  day,
  theme,
}: {
  areas: PlanArea[];
  /** Today's commitment day, or null for an ordinary day. */
  day: CommitmentDay | null;
  theme: ThemeTokens;
}) {
  const units = areas.flatMap((a) =>
    a.units.map((u) => ({ ...u, areaId: a.id })),
  );
  const scored = units.filter((u) => u.includeInScoring && u.weight !== null);
  if (scored.length === 0) return null;

  /** A unit counts as covered when it holds any task at all. Cadence
   *  stopped deciding what a band pays (ADR-0029 §2), so a weekly
   *  commitment is a part of your life you are working on. */
  const isCovered = (u: (typeof scored)[number]) => u.tasks.length > 0;

  const { covered: coveredWeight, total } = unitCoverage(
    scored.map((u) => ({ unitId: u.id, weight: u.weight ?? 0 })),
    units.flatMap((u) =>
      u.tasks.map(() => ({ unitId: u.id })),
    ),
  );
  const covered = areas
    .map((area) => ({
      id: area.id,
      weight: scored
        .filter((u) => u.areaId === area.id && isCovered(u))
        .reduce((sum, u) => sum + (u.weight ?? 0), 0),
    }))
    .filter((a) => a.weight >= MIN_VISIBLE_WEIGHT);
  const uncovered = Math.max(0, total - covered.reduce((s, a) => s + a.weight, 0));

  const band = commitmentBandOn(day);
  /** What the band leaves the life units, as a multiplier. */
  const scale = (100 - band) / 100;
  const shown = band + Math.round(coveredWeight * scale);

  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={
        band > 0
          ? `Today has commitment work, so ${band} of today's points are your commitments. ${coveredWeight} of ${total} points of the rest have something planned in them.`
          : `${coveredWeight} of ${total} points have something planned in them.`
      }
    >
      <View style={styles.track}>
        {band > 0 ? (
          <View
            style={[
              styles.fill,
              { flex: band, backgroundColor: theme.areas[COMMITMENT_AREA] ?? theme.accent },
            ]}
          />
        ) : null}
        {covered.map((area) => (
          <View
            key={area.id}
            style={[
              styles.fill,
              { flex: area.weight * scale, backgroundColor: theme.areas[area.id] ?? theme.muted },
            ]}
          />
        ))}
        {uncovered > 0 ? (
          <View
            style={[styles.fill, { flex: uncovered * scale, backgroundColor: theme.hairline }]}
          />
        ) : null}
      </View>
      <AppText variant="label" color={theme.ink} tabular>
        {shown}
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
