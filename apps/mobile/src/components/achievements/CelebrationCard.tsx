/**
 * "You earned…": the short card on Home when an achievement lands
 * (ADR-0047 §6). Shown once; Done puts it away and See all opens the
 * list. Only ever about what was earned.
 */
import { RANKS, seriesById } from "@glide/scoring";
import { StyleSheet, View } from "react-native";

import type { EarnedAchievement } from "../../db/achievements";
import { achievementTitle } from "../../lib/achievementCopy";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Group } from "../ui/Group";
import { Medal } from "./Medal";

/** The most listed at once; the rest are counted. */
const SHOWN = 3;

export function CelebrationCard({
  earned,
  onDone,
  onSeeAll,
  theme,
}: {
  earned: readonly EarnedAchievement[];
  onDone: () => void;
  onSeeAll: () => void;
  theme: ThemeTokens;
}) {
  // Highest first: the best news leads.
  const shown = [...earned].sort((a, b) => RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank)).slice(0, SHOWN);
  const more = earned.length - shown.length;
  return (
    <Group theme={theme}>
      <View accessible accessibilityRole="summary" style={styles.list}>
        <AppText variant="headline" color={theme.ink}>
          {earned.length === 1 ? "You earned an achievement" : `You earned ${earned.length} achievements`}
        </AppText>
        {shown.map((a) => (
          <View key={a.id} style={styles.line}>
            <Medal rank={a.rank} run={seriesById(a.series).run} theme={theme} size={18} />
            <AppText color={theme.ink} style={styles.grow}>
              {achievementTitle(a)}
            </AppText>
          </View>
        ))}
        {more > 0 ? (
          <AppText variant="caption" color={theme.muted}>
            and {more} more
          </AppText>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button label="See all" variant="tonal" onPress={onSeeAll} theme={theme} />
        <Button label="Done" variant="quiet" onPress={onDone} theme={theme} />
      </View>
    </Group>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
  actions: { flexDirection: "row", gap: space.sm, paddingTop: space.md },
});
