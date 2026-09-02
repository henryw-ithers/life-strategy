/**
 * Portfolio: your priority order, and the ability to change it.
 *
 * This screen used to be the graph. The graph answers "how has this
 * moved," which is a monthly question; the order is the thing you might
 * want to adjust any week — and until now the only way to adjust it was
 * to re-run the whole diagnostic, re-ranking satisfaction you had no
 * reason to revisit. So the ranking took the page and the graph became
 * a preview that opens full-size.
 *
 * Re-ranking writes `unit_weight.override`, never a new snapshot — see
 * `db/ranking.ts` for why that distinction matters to the graph's
 * history and to ADR-0008's calibration series.
 */
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

import type { GraphSnapshot } from "../../../components/portfolio-graph";
import { AppText } from "../../../components/ui/AppText";
import { Group } from "../../../components/ui/Group";
import { MonthReview } from "../../../components/log/MonthReview";
import { loadMonthCheckpoint, type MonthCheckpoint } from "../../../db/log";
import { currentLocalDate } from "../../../db/today";
import { SettingsRow } from "../../../components/ui/SettingsRow";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { Backdrop, constellation } from "../../../components/ui/Backdrop";
import { Button } from "../../../components/ui/Button";
import { ReorderableList, type ReorderableItem } from "../../../components/ui/ReorderableList";
import { ScreenHeader } from "../../../components/ui/ScreenHeader";
import { loadGraphSnapshots } from "../../../db/graph";
import {
  applyPriorityOrder,
  loadRankingBoard,
  resetToDiagnostic,
  type RankingBoard,
} from "../../../db/ranking";
import { getTheme, type ThemeTokens } from "../../../theme/colors";
import { space } from "../../../theme/tokens";


export default function PortfolioScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");

  const [board, setBoard] = useState<RankingBoard | null | undefined>(undefined);
  const [snapshots, setSnapshots] = useState<GraphSnapshot[] | null>(null);
  /** The order on screen while a save is in flight, so rows don't snap
   *  back to the stored order for the length of the write. */
  const [pending, setPending] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [next, graph] = await Promise.all([
      loadRankingBoard(),
      loadGraphSnapshots(),
    ]);
    setBoard(next);
    setSnapshots(graph);
    setPending(null);
  }, []);

  const [checkpoint, setCheckpoint] = useState<MonthCheckpoint | null>(null);
  const { error, retry } = useScreenLoad(load);

  /* The month's own numbers, loaded beside the board rather than inside
   * it: a failure here should cost the checkpoint, not the whole screen. */
  useEffect(() => {
    let live = true;
    void loadMonthCheckpoint(currentLocalDate())
      .then((next) => {
        if (live) setCheckpoint(next);
      })
      .catch(() => {
        if (live) setCheckpoint(null);
      });
    return () => {
      live = false;
    };
  }, []);

  const order = pending ?? board?.order ?? [];

  /**
   * Commits on drop. There is no confirm step: a drag is already a
   * deliberate act, and the points beside each row move with it, so the
   * consequence is on screen rather than in a dialog.
   */
  const commit = async (next: string[]) => {
    if (!board || saving) return;
    setPending(next);
    setSaving(true);
    await applyPriorityOrder(board, next);
    await load();
    setSaving(false);
  };

  const reset = async () => {
    if (!board || saving) return;
    setSaving(true);
    await resetToDiagnostic(board);
    await load();
    setSaving(false);
  };

  if (error) {
    return (
      <View style={[styles.root, { backgroundColor: theme.canvas }]}>
        <Backdrop circles={constellation(theme.areas, { faint: true })} />
        <ScreenHeader title="Portfolio" theme={theme} />
        <LoadFailure error={error} onRetry={retry} theme={theme} />
      </View>
    );
  }

  if (board === undefined) {
    return (
      <View style={[styles.root, { backgroundColor: theme.canvas }]}>
        <Backdrop circles={constellation(theme.areas, { faint: true })} />
        <ScreenHeader title="Portfolio" theme={theme} />
        <ActivityIndicator color={theme.muted} style={styles.loading} />
      </View>
    );
  }

  if (board === null) {
    return (
      <View style={[styles.root, { backgroundColor: theme.canvas }]}>
        <Backdrop circles={constellation(theme.areas, { faint: true })} />
        <ScreenHeader title="Portfolio" theme={theme} />
        <View style={styles.empty}>
          <AppText color={theme.ink} style={styles.centerText}>
            Your portfolio starts with a diagnostic. Rank what matters, and
            the order lands here — ready to adjust whenever it shifts.
          </AppText>
          <Button
            label="Run the diagnostic"
            onPress={() => router.push("/diagnostic")}
            theme={theme}
          />
        </View>
      </View>
    );
  }

  const unitItems: ReorderableItem[] = order.map((id) => ({
    id,
    label: board.byId.get(id)?.name ?? id,
    accent: theme.areas[board.byId.get(id)?.areaId ?? ""] ?? theme.muted,
  }));

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <ScreenHeader title="Portfolio" theme={theme} />

      <ScrollView
        style={styles.body}
        scrollEnabled={!dragging}
        contentContainerStyle={styles.container}
      >
        {/* Summary before detail. This screen is where you re-gauge, so
            it opens on how the month went; the order you can change and
            the history behind it follow. It used to open on the graph,
            which is evidence rather than an answer. */}
        {/* One block, and the only place the portfolio graph appears.
            It used to be two: a month checkpoint, then a permanent graph
            card. The graph is a history chart, and this is the screen
            you come to in order to change *today's* priorities — a
            question it cannot answer. It belongs to a retrospective, so
            it lives in one, and the Log shows the same block for every
            month (2026-08-26). */}
        {checkpoint ? (
          <MonthReview
            month={checkpoint}
            snapshots={snapshots ?? []}
            theme={theme}
            title="This month"
          />
        ) : null}

        <AppText variant="caption" color={theme.muted} style={styles.lead}>
          Drag to change what deserves your attention. Points follow.
        </AppText>

        <ReorderableList
          items={unitItems}
          scrollable={false}
          onDragStateChange={setDragging}
          onReorder={(ids) => void commit(ids)}
          theme={theme}
          renderItem={(item, index) => (
            <RankRow
              rank={index + 1}
              name={item.label}
              accent={item.accent ?? theme.muted}
              weight={board.byId.get(item.id)?.weight ?? null}
              theme={theme}
            />
          )}
        />

        {board.reordered ? (
          <Button
            label="Back to the diagnostic's order"
            variant="quiet"
            disabled={saving}
            onPress={() => void reset()}
            theme={theme}
          />
        ) : null}

        {/* **The monthly loop's only entry point.** Every "Run the
            diagnostic" button in the app sat behind an empty state
            (`!hasSnapshot`), so once you finished your first one there
            was no way to run another anywhere — and the product's whole
            premise is a monthly diagnostic feeding a daily checklist.
            Half that loop was unreachable.

            It belongs on Portfolio because this is where its output
            lives: the weights it produces are the list above, and the
            graph beside it is the history it extends. */}
        <Group
          theme={theme}
          title="Monthly review"
          footnote="Your ratings drift as life does. Re-rank when the order above stops matching how things actually feel."
          flush
        >
          <SettingsRow
            label="Run the diagnostic again"
            detail="About five minutes. Your previous rankings are kept, and you will see what moved."
            onPress={() => router.push("/diagnostic")}
            theme={theme}
          />
        </Group>
      </ScrollView>
    </View>
  );
}



function RankRow({
  rank,
  name,
  accent,
  weight,
  theme,
}: {
  rank: number;
  name: string;
  accent: string;
  weight: number | null;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" color={theme.muted} tabular style={styles.rank}>
        {rank}
      </AppText>
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <AppText color={theme.ink} style={styles.grow} numberOfLines={1}>
        {name}
      </AppText>
      {weight === null ? (
        <AppText variant="caption" color={theme.muted}>
          not scored
        </AppText>
      ) : (
        <AppText color={theme.ink} tabular>
          {weight}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  body: { flex: 1 },
  container: {
    paddingHorizontal: space.screen,
    paddingTop: space.md,
    paddingBottom: space.xxl,
  },
  loading: { marginTop: space.xxl },
  empty: { gap: space.lg, marginTop: space.xxl, paddingHorizontal: space.screen },
  centerText: { textAlign: "center" },
  lead: { marginBottom: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
  rank: { minWidth: 20, textAlign: "right" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
});
