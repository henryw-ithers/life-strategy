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
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { PortfolioGraph, type GraphSnapshot } from "../../../components/portfolio-graph";
import { AppText } from "../../../components/ui/AppText";
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
import { radius, space } from "../../../theme/tokens";

const PREVIEW_SIZE = 168;

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

  const { error, retry } = useScreenLoad(load);

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
        {snapshots && snapshots.length > 0 ? (
          <GraphPreview snapshots={snapshots} theme={theme} />
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
      </ScrollView>
    </View>
  );
}

/** The graph, small and inert — a way in, not a control. */
function GraphPreview({
  snapshots,
  theme,
}: {
  snapshots: GraphSnapshot[];
  theme: ThemeTokens;
}) {
  // The graph reads its position from shared values even at rest; a
  // preview just parks them on the newest snapshot.
  const progress = useSharedValue(snapshots.length - 1);
  const settle = useSharedValue(1);

  return (
    <Pressable
      onPress={() => router.push("/portfolio/graph")}
      accessibilityRole="button"
      accessibilityLabel={`Portfolio graph, ${snapshots.length} ${
        snapshots.length === 1 ? "diagnostic" : "diagnostics"
      }. Opens full size.`}
      style={({ pressed }) => [styles.preview, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View pointerEvents="none" style={styles.previewCanvas}>
        <PortfolioGraph
          snapshots={snapshots}
          size={PREVIEW_SIZE}
          mode="now"
          progress={progress}
          settle={settle}
          displayIndex={snapshots.length - 1}
          selectedUnitId={null}
          focusAreaId={null}
          onSelectUnit={() => {}}
          theme={theme}
          reduceMotion
          compareOldIndex={0}
        />
      </View>
      <View style={styles.previewText}>
        <AppText variant="headline" color={theme.ink}>
          Your portfolio
        </AppText>
        <AppText variant="caption" color={theme.muted}>
          {snapshots.length === 1
            ? "One diagnostic so far"
            : `${snapshots.length} diagnostics · see what moved`}
        </AppText>
        <AppText variant="label" color={theme.accent}>
          Open ›
        </AppText>
      </View>
    </Pressable>
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
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    marginBottom: space.xl,
  },
  previewCanvas: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  previewText: { flex: 1, gap: space.xs },
  lead: { marginBottom: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
  rank: { minWidth: 20, textAlign: "right" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
});
