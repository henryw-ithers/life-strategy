/**
 * One achievement, opened over the screen (Henry, 2026-10-25): its
 * shield at the rank you hold, where you are toward the next, and every
 * rank with what it takes, earned ones with the day they were earned.
 *
 * Progress is shown plainly and never announced (ADR-0047 §5): a run
 * that ended just shows the run going now. Nothing here grades a day.
 */
import { RANKS, seriesById } from "@glide/scoring";
import { StyleSheet, View } from "react-native";

import type { AchievementItem } from "../../db/achievements";
import { earnedDate, RANK_LABEL, SERIES_LABEL, thresholdLabel } from "../../lib/achievementCopy";
import type { ThemeTokens } from "../../theme/colors";
import { cardStyle } from "../../theme/surfaces";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";
import { SERIES_ICON } from "./seriesIcons";
import { ShieldBadge } from "./ShieldBadge";

export function BadgeSheet({
  item,
  visible,
  onClose,
  onDismissed,
  theme,
}: {
  item: AchievementItem;
  visible: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  theme: ThemeTokens;
}) {
  const { thresholds } = seriesById(item.series);
  const top = item.earned.at(-1)?.rank ?? null;
  const name = SERIES_LABEL[item.series];
  const toward = item.next && item.progress !== null ? Math.min(item.progress, item.next.threshold) : null;
  return (
    <NativeSheet visible={visible} onClose={onClose} onDismissed={onDismissed} dismiss="done" title={name} size="large" scroll>
      <View style={styles.hero}>
        <ShieldBadge rank={top} icon={SERIES_ICON[item.series]} theme={theme} size={112} />
        {item.subjectName ? (
          <AppText variant="label" color={theme.ink}>
            {item.subjectName}
          </AppText>
        ) : null}
        <AppText variant="caption" color={theme.muted}>
          {top ? `${RANK_LABEL[top]} earned` : "Not earned yet"}
        </AppText>
        {item.next && toward !== null ? (
          <View style={styles.progress} accessible accessibilityLabel={`${toward} of ${item.next.threshold} toward ${RANK_LABEL[item.next.rank]}`}>
            <View style={[styles.track, { backgroundColor: theme.fill }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${(toward / item.next.threshold) * 100}%`, backgroundColor: theme.accent },
                ]}
              />
            </View>
            <AppText variant="caption" color={theme.muted} tabular>
              {toward.toLocaleString("en")} / {item.next.threshold.toLocaleString("en")} toward{" "}
              {RANK_LABEL[item.next.rank]}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={[cardStyle(theme), styles.ladder]}>
        {RANKS.map((rank, i) => {
          const earned = item.earned.find((e) => e.rank === rank);
          return (
            <View
              key={rank}
              style={[
                styles.rung,
                i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline } : null,
              ]}
              accessible
              accessibilityLabel={`${RANK_LABEL[rank]}, ${thresholdLabel(item.series, thresholds[i]!)}${
                earned ? `, earned ${earnedDate(earned.earnedOn)}` : ""
              }`}
            >
              <ShieldBadge rank={earned ? rank : null} icon={SERIES_ICON[item.series]} theme={theme} size={34} />
              <View style={styles.grow}>
                <AppText variant="label" color={theme.ink}>
                  {RANK_LABEL[rank]}
                </AppText>
                <AppText variant="caption" color={theme.muted}>
                  {thresholdLabel(item.series, thresholds[i]!)}
                </AppText>
              </View>
              {earned ? (
                <AppText variant="footnote" color={theme.muted}>
                  {earnedDate(earned.earnedOn)}
                </AppText>
              ) : null}
            </View>
          );
        })}
      </View>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: space.xs, paddingVertical: space.md },
  progress: { alignSelf: "stretch", gap: space.xs, alignItems: "center", marginTop: space.sm },
  track: { alignSelf: "stretch", height: 8, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.pill },
  ladder: { paddingHorizontal: space.lg, marginTop: space.md },
  rung: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60 },
  grow: { flex: 1, gap: 2 },
});
