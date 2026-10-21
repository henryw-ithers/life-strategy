/**
 * The Life tab: what am I working on, and does it match my priorities?
 * (spec §5.4). A list, and each row opens its own screen:
 *
 * - **Commitments**, with what each holds.
 * - **Your units** by tier, in your order, with Priorities beside the
 *   heading. Each has its task count and a bar of its share of the time
 *   you spent in the last 4 weeks: "Where your time went". The bar has
 *   **no target** (ADR-0041 §5); weights live on Priorities, so a bar
 *   can't read as falling short. Not now starts closed.
 *
 * Achievements open from the top (ADR-0047 §7), and each unit's row
 * carries its highest rank and a streak mark while a run is going.
 * Adding a task or event from the + menu happens on Plan (`openAdd`).
 */
import { addDays } from "@glide/scoring";
import { router, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useColorScheme, View } from "react-native";

import {
  CommitmentSheet,
  type CommitmentSheetMode,
} from "../../../components/commitments/CommitmentSheet";
import { CommitmentsList } from "../../../components/commitments/CommitmentsList";
import { Medal, StreakFlame } from "../../../components/achievements/Medal";
import { tierGroups, type TierGroup } from "../../../components/life/lifeRows";
import { openAdd, TabToolbar } from "../../../components/nav/TabToolbar";
import { AppText } from "../../../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import { Chevron } from "../../../components/ui/Chevron";
import { Group, GroupDivider } from "../../../components/ui/Group";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { badgesByUnit, highestRank, loadAchievements, type UnitBadge } from "../../../db/achievements";
import { loadCommitmentsScreen, type CommitmentsScreenData } from "../../../db/commitments";
import { createCommitment } from "../../../db/commitmentWrites";
import { loadPlan } from "../../../db/tasks";
import { loadWorkShares } from "../../../db/weeklyPass";
import { useRetained } from "../../../hooks/useRetained";
import { RANK_LABEL } from "../../../lib/achievementCopy";
import { currentLocalDate } from "../../../lib/calendar";
import { getTheme, type ThemeTokens } from "../../../theme/colors";
import { radius, space } from "../../../theme/tokens";

/** "The last 4 weeks", to today. */
const SHARE_DAYS = 28;

export default function LifeScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const [commitments, setCommitments] = useState<CommitmentsScreenData | null>(null);
  const [groups, setGroups] = useState<TierGroup[] | null>(null);
  const [hasPlan, setHasPlan] = useState(true);
  const [notNowOpen, setNotNowOpen] = useState(false);
  const [badges, setBadges] = useState<ReadonlyMap<string, UnitBadge>>(new Map());
  const [earned, setEarned] = useState<{ count: number; top: UnitBadge["rank"] }>({ count: 0, top: null });
  const [sheet, setSheet] = useState<CommitmentSheetMode | null>(null);
  const [sheetShown, sheetGone] = useRetained(sheet);

  const reload = useCallback(async () => {
    const today = currentLocalDate();
    const [nextCommitments, plan, shares, achievements] = await Promise.all([
      loadCommitmentsScreen(),
      loadPlan(),
      loadWorkShares(addDays(today, -(SHARE_DAYS - 1)), today),
      loadAchievements(),
    ]);
    setCommitments(nextCommitments);
    setBadges(badgesByUnit(achievements));
    setEarned({
      count: achievements.reduce((n, a) => n + a.earned.length, 0),
      top: highestRank(achievements),
    });
    setHasPlan(plan.hasSnapshot);
    setGroups(tierGroups(plan.areas.flatMap((a) => a.units), shares));
  }, []);
  const { error, retry } = useScreenLoad(reload);

  return (
    <View style={styles.root}>
      {/* The scroll view comes first, so the large title and the tab bar
          follow it; the backdrop goes inside it. */}
      <ScrollView
        style={styles.root}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : commitments === null || groups === null ? (
          <ActivityIndicator color={theme.muted} style={styles.loading} />
        ) : (
          <>
            <Group theme={theme} flush>
              <Pressable
                onPress={() => router.push("/goals/achievements" as Href)}
                accessibilityRole="button"
                accessibilityLabel={`Achievements, ${earned.count} earned`}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Medal rank={earned.top} run={false} theme={theme} />
                <AppText color={theme.ink} style={styles.grow}>
                  Achievements
                </AppText>
                <AppText variant="caption" color={theme.muted}>
                  {earned.count} earned
                </AppText>
                <Chevron color={theme.muted} theme={theme} size={13} />
              </Pressable>
            </Group>

            <AppText variant="headline" color={theme.ink} accessibilityRole="header" style={styles.heading}>
              Commitments
            </AppText>
            <CommitmentsList
              commitments={commitments.commitments}
              archived={commitments.archived}
              hue={theme.areas["work-money"] ?? theme.accent}
              theme={theme}
              onOpen={(id) => router.push(`/goals/commitment/${id}` as Href)}
            />
            {commitments.canAddMore ? (
              <Button
                variant="tonal"
                icon="add"
                label="Add a commitment"
                onPress={() => setSheet({ kind: "commitment" })}
                theme={theme}
              />
            ) : (
              // The cap says why rather than showing a dead control.
              <AppText variant="caption" color={theme.muted}>
                Three commitments is the most at once. Archive one to add another.
              </AppText>
            )}

            <View style={styles.unitsHeading}>
              <AppText variant="headline" color={theme.ink} accessibilityRole="header" style={styles.grow}>
                Your units
              </AppText>
              <Pressable
                onPress={() => router.push("/priorities" as Href)}
                accessibilityRole="button"
                style={styles.link}
              >
                <AppText variant="caption" color={theme.accent}>
                  Priorities ›
                </AppText>
              </Pressable>
            </View>
            {!hasPlan ? (
              <View style={styles.empty}>
                <AppText color={theme.ink}>
                  Your plan starts with your priorities. Sort what matters into tiers first.
                </AppText>
                <Button label="Set your priorities" onPress={() => router.push("/priorities" as Href)} theme={theme} />
              </View>
            ) : (
              <>
                <AppText variant="caption" color={theme.muted}>
                  Where your time went · last 4 weeks
                </AppText>
                {groups.map((g) =>
                  g.tier === "notNow" ? (
                    <View key={g.tier}>
                      <Pressable
                        onPress={() => setNotNowOpen((v) => !v)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: notNowOpen }}
                        style={styles.link}
                      >
                        <AppText variant="caption" color={theme.muted}>
                          {notNowOpen ? "▾" : "▸"} Not now ({g.units.length})
                        </AppText>
                      </Pressable>
                      {notNowOpen ? <UnitRows units={g.units} badges={badges} theme={theme} /> : null}
                    </View>
                  ) : (
                    <View key={g.tier}>
                      <AppText variant="caption" color={theme.muted} style={styles.tier}>
                        {g.label}
                      </AppText>
                      <UnitRows units={g.units} badges={badges} theme={theme} />
                    </View>
                  ),
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <TabToolbar
        onTask={() => openAdd("task")}
        onEvent={() => openAdd("event")}
        onLog={() => openAdd("activity")}
        settings
      />

      {sheetShown !== null ? (
        <CommitmentSheet
          visible={sheet !== null}
          onDismissed={sheetGone}
          mode={sheetShown}
          theme={theme}
          onClose={() => setSheet(null)}
          onSave={async ({ name, usesSubCommitments }) => {
            await createCommitment({ name, usesSubCommitments });
            setSheet(null);
            await reload();
          }}
        />
      ) : null}
    </View>
  );
}

function UnitRows({
  units,
  badges,
  theme,
}: {
  units: TierGroup["units"];
  badges: ReadonlyMap<string, UnitBadge>;
  theme: ThemeTokens;
}) {
  return (
    <Group theme={theme} flush>
      {units.map((u, i) => {
        const hue = theme.areas[u.areaId] ?? theme.accent;
        const pct = Math.round(u.share * 100);
        const badge = badges.get(u.id);
        const run = badge?.streak ?? null;
        return (
          <View key={u.id}>
            {i > 0 ? <GroupDivider theme={theme} /> : null}
            <Pressable
              onPress={() => router.push(`/goals/unit/${u.id}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={[
                u.name,
                `${u.tasks} ${u.tasks === 1 ? "task" : "tasks"}`,
                pct > 0 ? `${pct}% of your time` : null,
                badge?.rank ? `${RANK_LABEL[badge.rank]} earned` : null,
                run ? `${run.length} ${run.per === "day" ? "days" : "weeks"} in a row` : null,
              ]
                .filter(Boolean)
                .join(", ")}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View style={[styles.dot, { backgroundColor: hue }]} />
              <View style={styles.grow}>
                <AppText color={theme.ink} numberOfLines={1}>
                  {u.name}
                </AppText>
                {/* A share of your time, drawn against the largest. */}
                <View style={[styles.track, { backgroundColor: theme.hairline }]}>
                  <View style={[styles.fill, { width: `${u.bar * 100}%`, backgroundColor: hue }]} />
                </View>
              </View>
              {run ? (
                <View style={styles.streak}>
                  <StreakFlame theme={theme} />
                  <AppText variant="caption" color={theme.muted} tabular>
                    {run.length}
                  </AppText>
                </View>
              ) : null}
              {badge?.rank ? <Medal rank={badge.rank} run={false} theme={theme} size={16} /> : null}
              <AppText variant="caption" color={theme.muted}>
                {u.tasks} {u.tasks === 1 ? "task" : "tasks"}
              </AppText>
              <Chevron color={theme.muted} theme={theme} size={13} />
            </Pressable>
          </View>
        );
      })}
    </Group>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { marginTop: space.xxl },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl, gap: space.sm },
  heading: { paddingTop: space.lg },
  unitsHeading: { flexDirection: "row", alignItems: "center", paddingTop: space.lg },
  tier: { paddingTop: space.md, paddingBottom: space.xs },
  grow: { flex: 1, gap: space.xs },
  link: { minHeight: 44, justifyContent: "center" },
  empty: { gap: space.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  streak: { flexDirection: "row", alignItems: "center", gap: 2 },
  track: { height: 4, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 4, borderRadius: radius.pill },
});
