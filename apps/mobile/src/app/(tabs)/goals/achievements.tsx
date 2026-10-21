/**
 * Life → Achievements (ADR-0047 §7): every achievement, earned and
 * locked. Everything first, then each commitment, then each area with
 * its units and their tasks. A row shows a subject's marks, one per
 * series: filled in its rank's colour when earned, a grey outline when
 * not. Tap a row for each series' ranks, when they were earned, and
 * what's next.
 *
 * Progress is shown, never announced (§5): a run that ended simply
 * counts again from where it is. Nothing here grades a day.
 */
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import { achievementSections, type AchievementSection, type SubjectRow } from "../../../components/achievements/achievementGroups";
import { Medal, StreakFlame } from "../../../components/achievements/Medal";
import { AppText } from "../../../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../../../components/ui/Backdrop";
import { Group, GroupDivider } from "../../../components/ui/Group";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { loadAchievements } from "../../../db/achievements";
import { earnedLine, nextLine, RANK_LABEL, SERIES_LABEL } from "../../../lib/achievementCopy";
import { getTheme, type ThemeTokens } from "../../../theme/colors";
import { space } from "../../../theme/tokens";

export default function AchievementsScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [sections, setSections] = useState<AchievementSection[] | null>(null);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  /** Only the latest load lands. */
  const turn = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++turn.current;
    const items = await loadAchievements();
    if (mine === turn.current) setSections(achievementSections(items));
  }, []);
  const { error, retry } = useScreenLoad(reload);

  const toggle = (key: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ScrollView style={styles.root} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
      <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
      {error ? (
        <LoadFailure error={error} onRetry={retry} theme={theme} />
      ) : sections === null ? (
        <ActivityIndicator color={theme.muted} style={styles.loading} />
      ) : (
        <>
          <AppText variant="caption" color={theme.muted}>
            Earned from what you do. Nothing to set up, and nothing earned is taken back.
          </AppText>
          {sections.map((s) => (
            <Group key={s.key} theme={theme} title={s.title} flush>
              {s.rows.map((row, i) => (
                <View key={row.key}>
                  {i > 0 ? <GroupDivider theme={theme} /> : null}
                  <Row row={row} open={open.has(row.key)} onToggle={() => toggle(row.key)} theme={theme} />
                </View>
              ))}
            </Group>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function streakText(streak: NonNullable<SubjectRow["streak"]>): string {
  return `${streak.length} ${streak.per === "day" ? "days" : "weeks"} in a row`;
}

function Row({
  row,
  open,
  onToggle,
  theme,
}: {
  row: SubjectRow;
  open: boolean;
  onToggle: () => void;
  theme: ThemeTokens;
}) {
  const label = [
    row.name,
    row.top ? `${RANK_LABEL[row.top]} earned` : "Nothing earned yet",
    row.streak ? streakText(row.streak) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={open ? "Hides each achievement" : "Shows each achievement"}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.row, row.nested && styles.nested, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View style={styles.grow}>
          <AppText color={theme.ink} numberOfLines={1}>
            {row.name}
          </AppText>
          {row.streak ? (
            <View style={styles.streak}>
              <StreakFlame theme={theme} />
              <AppText variant="caption" color={theme.muted}>
                {streakText(row.streak)}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.medals}>
          {row.items.map((item) => (
            <Medal
              key={item.series}
              rank={item.earned.at(-1)?.rank ?? null}
              run={item.run}
              theme={theme}
              size={18}
            />
          ))}
        </View>
      </Pressable>
      {open ? (
        <View style={[styles.detail, row.nested && styles.nested]}>
          {row.items.map((item) => {
            const top = item.earned.at(-1)?.rank ?? null;
            const earned = earnedLine(item.earned);
            const next = nextLine(item);
            return (
              <View key={item.series} style={styles.series} accessible>
                <View style={styles.seriesHead}>
                  <Medal rank={top} run={item.run} theme={theme} size={16} />
                  <AppText variant="label" color={theme.ink}>
                    {SERIES_LABEL[item.series]}
                    {top ? ` · ${RANK_LABEL[top]}` : ""}
                  </AppText>
                </View>
                {earned ? (
                  <AppText variant="caption" color={theme.muted}>
                    {earned}
                  </AppText>
                ) : null}
                {next ? (
                  <AppText variant="caption" color={theme.muted}>
                    {next}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { marginTop: space.xxl },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl, gap: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  nested: { paddingLeft: space.lg + space.lg },
  grow: { flex: 1, gap: space.xs },
  streak: { flexDirection: "row", alignItems: "center", gap: space.xs },
  medals: { flexDirection: "row", gap: space.xs },
  detail: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md },
  series: { gap: 2 },
  seriesHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
