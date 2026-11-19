/**
 * Life → Achievements (ADR-0047 §7): what you've earned and started,
 * as shields, with every one a tap away (Henry, 2026-10-25; trimmed in
 * the pre-submission review, 2026-11-19). The badges for everything you
 * do sit in a grid at the top. Then each achievement your units,
 * areas and commitments can earn, named once, with every one's badge
 * for it in a row beneath, units in your priority order (ADR-0050).
 *
 * Tap any badge to open it over the screen (`BadgeSheet`): its shield,
 * how far along you are, and what every rank takes.
 *
 * Progress is shown, never announced (§5): a run that ended simply
 * counts again from where it is. Nothing here grades a day.
 */
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import { achievementSections, type AchievementSection, type SubjectRow } from "../../../components/achievements/achievementGroups";
import { BadgeSheet } from "../../../components/achievements/BadgeSheet";
import { StreakFlame } from "../../../components/achievements/Medal";
import { SERIES_ICON } from "../../../components/achievements/seriesIcons";
import { ShieldBadge } from "../../../components/achievements/ShieldBadge";
import { AppText } from "../../../components/ui/AppText";
import { Button } from "../../../components/ui/Button";
import { constellation, ScrollBackdrop } from "../../../components/ui/Backdrop";
import { Group, GroupDivider } from "../../../components/ui/Group";
import { InfoButton } from "../../../components/ui/InfoButton";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { loadAchievements, type AchievementItem } from "../../../db/achievements";
import { loadPriorities } from "../../../db/priorities";
import { useRetained } from "../../../hooks/useRetained";
import { RANK_LABEL, SERIES_LABEL } from "../../../lib/achievementCopy";
import { getTheme, type ThemeTokens } from "../../../theme/colors";
import { cardStyle } from "../../../theme/surfaces";
import { space } from "../../../theme/tokens";

export default function AchievementsScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [sections, setSections] = useState<AchievementSection[] | null>(null);
  const [open, setOpen] = useState<AchievementItem | null>(null);
  const [openShown, openGone] = useRetained(open);
  /** Every achievement, locked ones with nothing toward them included.
   *  Off by default: a first look was a wall of zeros (review, 2026-11-19). */
  const [showAll, setShowAll] = useState(false);

  /** Only the latest load lands. */
  const turn = useRef(0);
  const reload = useCallback(async () => {
    const mine = ++turn.current;
    const [items, priorities] = await Promise.all([loadAchievements(), loadPriorities()]);
    // Your units, Top first, so each row reads in your order.
    const order = new Map(priorities.units.map((u, i) => [u.unitId, i] as const));
    if (mine === turn.current) setSections(achievementSections(items, order));
  }, []);
  const { error, retry } = useScreenLoad(reload);

  const everything = sections?.[0]?.key === "all" ? sections[0] : null;
  const allBadges = everything ? byStanding(everything.rows.flatMap((r) => r.items)) : [];
  // What you hold and what you've started; on day one, the first few,
  // so the screen is never empty.
  const begun = allBadges.filter(started);
  const badges = showAll ? allBadges : begun.length > 0 ? begun : allBadges.slice(0, FIRST_LOOK);
  const rest = (sections?.filter((s) => s !== everything) ?? [])
    .map((s) => (showAll ? s : { ...s, rows: s.rows.filter((r) => r.items.some(started)) }))
    .filter((s) => s.rows.length > 0);
  const hidden =
    allBadges.length - badges.length +
    (sections ?? [])
      .filter((s) => s !== everything)
      .flatMap((s) => s.rows)
      .filter((r) => !r.items.some(started)).length;

  return (
    <>
      <ScrollView style={styles.root} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : sections === null ? (
          <ActivityIndicator color={theme.muted} style={styles.loading} />
        ) : (
          <>
            <View style={styles.leadRow}>
              <View style={styles.grow} />
              <InfoButton
                title="Achievements"
                body="Earned from what you do: nothing to set up, and nothing earned is ever taken back. Each has five ranks, Bronze to Diamond. Tap one to see what each rank takes."
                theme={theme}
              />
            </View>

            {badges.length > 0 ? (
              <View style={[cardStyle(theme), styles.grid]}>
                {badges.map((item) => (
                  <GridBadge key={item.series} item={item} theme={theme} onPress={() => setOpen(item)} />
                ))}
              </View>
            ) : null}

            {rest.map((s) => (
              <Group key={s.key} theme={theme} title={s.title} flush>
                {s.rows.map((row, i) => (
                  <View key={row.key}>
                    {i > 0 ? <GroupDivider theme={theme} /> : null}
                    <SubjectBadges row={row} theme={theme} onOpen={setOpen} />
                  </View>
                ))}
              </Group>
            ))}

            {showAll || hidden > 0 ? (
              <Button
                label={showAll ? "Show what you've started" : "Show every achievement"}
                variant="quiet"
                onPress={() => setShowAll((v) => !v)}
                theme={theme}
              />
            ) : null}
          </>
        )}
      </ScrollView>

      {openShown ? (
        <BadgeSheet
          item={openShown}
          visible={open !== null}
          onClose={() => setOpen(null)}
          onDismissed={openGone}
          theme={theme}
        />
      ) : null}
    </>
  );
}

/** How many badges a first look shows before anything has begun. */
const FIRST_LOOK = 6;

/** Earned, or with something toward it. */
function started(item: AchievementItem): boolean {
  return item.earned.length > 0 || (item.progress ?? 0) > 0;
}

/** Highest rank first, then nearest the next rank: what you hold and
 *  what's coming lead the grid. */
function byStanding(items: readonly AchievementItem[]): AchievementItem[] {
  const standing = (i: AchievementItem) =>
    i.earned.length + (i.next && i.progress !== null ? Math.min(1, i.progress / i.next.threshold) : 0);
  return [...items].sort((a, b) => standing(b) - standing(a));
}

/** "Gold", or how far along the first rank: "3 / 10". */
function badgeCaption(item: AchievementItem): string {
  const top = item.earned.at(-1)?.rank ?? null;
  if (top) return RANK_LABEL[top];
  if (item.next && item.progress !== null) return `${Math.min(item.progress, item.next.threshold)} / ${item.next.threshold}`;
  return "";
}

function GridBadge({ item, theme, onPress }: { item: AchievementItem; theme: ThemeTokens; onPress: () => void }) {
  const top = item.earned.at(-1)?.rank ?? null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${SERIES_LABEL[item.series]}, ${top ? `${RANK_LABEL[top]} earned` : "not earned yet"}`}
      accessibilityHint="Shows what each rank takes"
      style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.6 : 1 }]}
    >
      <ShieldBadge rank={top} icon={SERIES_ICON[item.series]} theme={theme} size={52} />
      <AppText variant="footnote" color={theme.ink} numberOfLines={2} style={styles.cellName}>
        {SERIES_LABEL[item.series]}
      </AppText>
      <AppText variant="footnote" color={theme.muted} tabular>
        {badgeCaption(item)}
      </AppText>
    </Pressable>
  );
}

function SubjectBadges({
  row,
  theme,
  onOpen,
}: {
  row: SubjectRow;
  theme: ThemeTokens;
  onOpen: (item: AchievementItem) => void;
}) {
  return (
    <View style={[styles.subject, row.nested && styles.nested]}>
      <View style={styles.subjectHead}>
        <AppText color={theme.ink} numberOfLines={1} style={styles.grow}>
          {row.name}
        </AppText>
        {row.streak ? (
          <View style={styles.streak} accessible accessibilityLabel={`${row.streak.length} ${row.streak.per === "day" ? "days" : "weeks"} in a row`}>
            <StreakFlame theme={theme} />
            <AppText variant="caption" color={theme.muted} tabular>
              {row.streak.length}
            </AppText>
          </View>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
        {row.items.map((item) => {
          const top = item.earned.at(-1)?.rank ?? null;
          return (
            <Pressable
              key={`${item.subjectKind}|${item.subjectId}|${item.series}`}
              onPress={() => onOpen(item)}
              accessibilityRole="button"
              accessibilityLabel={`${row.bySubject ? item.subjectName : row.name}, ${SERIES_LABEL[item.series]}, ${top ? `${RANK_LABEL[top]} earned` : "not earned yet"}`}
              style={({ pressed }) => [styles.mini, { opacity: pressed ? 0.6 : 1 }]}
            >
              <ShieldBadge rank={top} icon={SERIES_ICON[item.series]} theme={theme} size={36} />
              <AppText variant="footnote" color={theme.ink} numberOfLines={2} style={styles.miniName}>
                {row.bySubject ? item.subjectName : SERIES_LABEL[item.series]}
              </AppText>
              <AppText variant="footnote" color={theme.muted} tabular numberOfLines={1}>
                {badgeCaption(item)}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { marginTop: space.xxl },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl, gap: space.md },
  leadRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
  /** Three across an iPhone 15. */
  grid: { flexDirection: "row", flexWrap: "wrap", paddingVertical: space.md, paddingHorizontal: space.xs },
  cell: { width: "33.33%", alignItems: "center", gap: 2, paddingVertical: space.sm, paddingHorizontal: space.xs },
  cellName: { textAlign: "center", marginTop: space.xs },
  subject: { paddingVertical: space.md, gap: space.sm },
  nested: { paddingLeft: space.lg },
  subjectHead: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg },
  streak: { flexDirection: "row", alignItems: "center", gap: 2 },
  badgeRow: { gap: space.sm, paddingHorizontal: space.lg },
  /** Wide enough for a unit's name on two lines. */
  mini: { width: 84, alignItems: "center", gap: 2 },
  miniName: { textAlign: "center" },
});
