/**
 * Priorities (ADR-0041; spec §5.4.1): drag the 18 parts of your life
 * into four tiers, Top, Important, Background and Not now. Order inside
 * a tier fine-tunes it. Each unit shows its recommended weight, and a
 * weight you set sits beside it.
 *
 * One list with the tier headers as fixed rows (`board.ts`), so a drag
 * past a header moves a unit into that tier. VoiceOver gets Move up,
 * Move down and Move to tier on every unit.
 *
 * Nothing saves until Done, which writes one snapshot (ADR-0041 §5).
 * Moving units with tasks into Not now asks first, since their tasks
 * are paused. Afterwards, any weight you set whose recommended value
 * moved is offered back to you, to keep or reset.
 *
 * Also the first-run screen: `/diagnostic` opens this, and a first run
 * starts with every unit in Important (Henry, 2026-10-19).
 */
import { router, Stack } from "expo-router";
import { useNavigation, usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";

import { TIERS, type Tier } from "@glide/scoring";

import {
  boardRows,
  headerTier,
  moveToTier,
  placementFromRows,
} from "../../components/priorities/board";
import { WeightSheet } from "../../components/priorities/WeightSheet";
import { AppText } from "../../components/ui/AppText";
import { constellation, ScrollBackdrop } from "../../components/ui/Backdrop";
import { ReorderableList, type ReorderableItem } from "../../components/ui/ReorderableList";
import { LoadFailure, useScreenLoad } from "../../components/ui/ScreenLoad";
import { useRetained } from "../../hooks/useRetained";
import {
  clearOverrides,
  loadPriorities,
  savePriorities,
  type OverrideReview,
  type Placement,
  type PriorityBoard,
} from "../../db/priorities";
import { boardWeights } from "../../db/tierRules";
import { getTheme, type ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";

const TIER_LABEL: Record<Tier, string> = {
  top: "Top",
  important: "Important",
  background: "Background",
  notNow: "Not now",
};

/** "Exercise", "Exercise and Sleep", "Exercise, Sleep and Money". */
function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Ask before pausing tasks (spec §5.4.1). Resolves true to go ahead. */
function confirmNotNow(units: { name: string; taskCount: number }[]): Promise<boolean> {
  const tasks = units.reduce((a, u) => a + u.taskCount, 0);
  const one = units.length === 1;
  return new Promise((resolve) => {
    Alert.alert(
      `Move ${listNames(units.map((u) => u.name))} to Not now?`,
      `${one ? "Its" : "Their"} ${tasks} ${tasks === 1 ? "task" : "tasks"} will be paused. ${
        tasks === 1 ? "It comes" : "They come"
      } back if you move ${one ? "it" : "them"} up again.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Pause tasks and move", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Keep or reset a weight you set whose recommended value moved. */
function reviewOverride(r: OverrideReview): Promise<"keep" | "reset"> {
  return new Promise((resolve) => {
    Alert.alert(
      `${r.name}'s recommended weight changed`,
      `You set ${r.override}. The recommended weight is now ${r.recommendedNow}, was ${r.recommendedBefore}.`,
      [
        { text: "Keep mine", style: "cancel", onPress: () => resolve("keep") },
        { text: `Use ${r.recommendedNow}`, onPress: () => resolve("reset") },
      ],
      { cancelable: true, onDismiss: () => resolve("keep") },
    );
  });
}

export default function PrioritiesScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");

  const [board, setBoard] = useState<PriorityBoard | null>(null);
  const [placement, setPlacement] = useState<Placement[]>([]);
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingShown, editingGone] = useRetained(editing);
  /** Set once Done has saved, so leaving isn't asked about. */
  const [saved, setSaved] = useState(false);
  const navigation = useNavigation();

  const load = useCallback(async () => {
    const next = await loadPriorities();
    setBoard(next);
    setPlacement(next.units.map((u) => ({ unitId: u.unitId, tier: u.tier })));
    setOverrides(
      new Map(next.units.flatMap((u) => (u.override === null ? [] : [[u.unitId, u.override]]))),
    );
    setDirty(false);
  }, []);
  const { error, retry } = useScreenLoad(load);

  const live = useMemo(() => boardWeights(placement, overrides), [placement, overrides]);
  const unitById = useMemo(
    () => new Map((board?.units ?? []).map((u) => [u.unitId, u])),
    [board],
  );

  // A first run has nothing saved yet, so Done always saves it.
  const unsaved = dirty || board?.firstRun === true;
  usePreventRemove(unsaved && !saved && !saving, ({ data }) => {
    Alert.alert("Discard your changes?", "Your tiers won't be saved.", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  // Leave once the save has re-rendered with nothing left to protect.
  useEffect(() => {
    if (saved) router.back();
  }, [saved]);

  const change = (next: Placement[]) => {
    setPlacement(next);
    setDirty(true);
  };

  const setOverride = (unitId: string, value: number | null) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      if (value === null) next.delete(unitId);
      else next.set(unitId, value);
      return next;
    });
    setDirty(true);
  };

  const done = async () => {
    if (!board || saving) return;
    if (live.problem) {
      Alert.alert("Priorities can't be saved yet", live.problem);
      return;
    }
    const pausing = placement
      .filter((p) => p.tier === "notNow" && unitById.get(p.unitId)?.tier !== "notNow")
      .map((p) => unitById.get(p.unitId)!)
      .filter((u) => u.taskCount > 0);
    if (pausing.length > 0 && !(await confirmNotNow(pausing))) return;
    setSaving(true);
    try {
      const planned = new Map(
        [...overrides].filter(([id]) => placement.find((p) => p.unitId === id)?.tier !== "notNow"),
      );
      const { review } = await savePriorities(placement, planned);
      const reset: string[] = [];
      for (const r of review) {
        if ((await reviewOverride(r)) === "reset") reset.push(r.unitId);
      }
      await clearOverrides(reset);
      setSaved(true);
    } catch (e) {
      Alert.alert("Priorities weren't saved", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const doneButton = (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Button
        variant="done"
        disabled={!board || saving || dragging}
        onPress={() => void done()}
      >
        Done
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );

  if (error || !board) {
    return (
      <View style={styles.root}>
        <ScrollView
          style={styles.body}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.container}
        >
          <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
          {error ? (
            <LoadFailure error={error} onRetry={retry} theme={theme} />
          ) : (
            <ActivityIndicator color={theme.muted} style={styles.loading} />
          )}
        </ScrollView>
      </View>
    );
  }

  /** A header's line: what each unit in the tier is roughly worth. */
  const headerDetail = (tier: Tier): string => {
    if (tier === "notNow") return "0% · holds no tasks";
    const ws = placement
      .filter((p) => p.tier === tier)
      .map((p) => live.recommended.get(p.unitId) ?? 0);
    if (ws.length === 0) return "";
    return `about ${Math.round(ws.reduce((a, b) => a + b, 0) / ws.length)}% each`;
  };

  const items: ReorderableItem[] = boardRows(placement).map((id) => {
    const tier = headerTier(id);
    if (tier) {
      const detail = headerDetail(tier);
      return {
        id,
        label: TIER_LABEL[tier],
        fixed: true,
        accessibilityLabel: detail ? `${TIER_LABEL[tier]}, ${detail}` : `${TIER_LABEL[tier]}, empty`,
      };
    }
    const u = unitById.get(id)!;
    const here = placement.find((p) => p.unitId === id)!.tier;
    const weight = live.weights.get(id) ?? live.recommended.get(id) ?? 0;
    const own = here === "notNow" ? undefined : overrides.get(id);
    const recommended = live.recommended.get(id) ?? 0;
    return {
      id,
      label: u.name,
      accent: theme.areas[u.areaId] ?? theme.muted,
      hasDetail: here !== "notNow",
      accessibilityLabel:
        here === "notNow"
          ? `${u.name}, Not now`
          : own !== undefined
            ? `${u.name}, ${TIER_LABEL[here]}, your weight ${own}, recommended ${recommended}`
            : `${u.name}, ${TIER_LABEL[here]}, weight ${weight}`,
      actions: TIERS.filter((t) => t !== here).map((t) => ({
        name: `tier:${t}`,
        label: `Move to ${TIER_LABEL[t]}`,
      })),
    };
  });

  const editingUnit = editingShown ? unitById.get(editingShown) : undefined;

  return (
    <View style={styles.root}>
      {doneButton}
      <ScrollView
        style={styles.body}
        scrollEnabled={!dragging}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        <AppText color={theme.ink} style={styles.lead}>
          Drag your units into tiers. Order inside a tier fine-tunes it.
        </AppText>
        {board.firstRun ? (
          <AppText variant="caption" color={theme.muted} style={styles.lead}>
            Rough is fine. You can change it any time.
          </AppText>
        ) : null}
        {live.problem || board.problem ? (
          <AppText variant="footnote" color={theme.muted} style={styles.lead}>
            {live.problem ?? board.problem}
          </AppText>
        ) : null}

        <ReorderableList
          items={items}
          scrollable={false}
          rowHeight={52}
          onDragStateChange={setDragging}
          onReorder={(ids) => change(placementFromRows(ids))}
          onPressItem={(item) => setEditing(item.id)}
          detailHint="your own weight for it"
          onItemAction={(item, name) => {
            const tier = headerTier(name);
            if (tier) change(moveToTier(placement, item.id, tier));
          }}
          theme={theme}
          renderItem={(item) => {
            const tier = headerTier(item.id);
            if (tier) return <TierHeader label={TIER_LABEL[tier]} detail={headerDetail(tier)} theme={theme} />;
            const here = placement.find((p) => p.unitId === item.id)!.tier;
            const own = here === "notNow" ? undefined : overrides.get(item.id);
            return (
              <UnitRow
                name={item.label}
                accent={item.accent ?? theme.muted}
                weight={here === "notNow" ? null : (live.weights.get(item.id) ?? null)}
                own={own}
                recommended={live.recommended.get(item.id) ?? 0}
                theme={theme}
              />
            );
          }}
        />

        <AppText variant="footnote" color={theme.muted} style={styles.foot}>
          Weights are recommended from your tiers. Tap a unit to set your own. Not now is out of
          the plan: no weight and no tasks.
        </AppText>
      </ScrollView>

      {editingShown && editingUnit ? (
        <WeightSheet
          key={editingShown}
          visible={editing !== null}
          onDismissed={editingGone}
          unitName={editingUnit.name}
          recommended={live.recommended.get(editingShown) ?? 0}
          override={overrides.get(editingShown) ?? null}
          theme={theme}
          onSave={(value) => setOverride(editingShown, value)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </View>
  );
}

function TierHeader({ label, detail, theme }: { label: string; detail: string; theme: ThemeTokens }) {
  return (
    <View style={styles.header}>
      <AppText variant="caption" color={theme.muted} style={styles.headerLabel}>
        {label.toUpperCase()}
      </AppText>
      <AppText variant="caption" color={theme.muted} tabular>
        {detail}
      </AppText>
    </View>
  );
}

function UnitRow({
  name,
  accent,
  weight,
  own,
  recommended,
  theme,
}: {
  name: string;
  accent: string;
  weight: number | null;
  own: number | undefined;
  recommended: number;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <AppText color={theme.ink} style={styles.grow} numberOfLines={1}>
        {name}
      </AppText>
      {weight === null ? null : own !== undefined ? (
        <AppText variant="caption" color={theme.muted} tabular>
          <AppText color={theme.ink} tabular>
            {own}
          </AppText>
          {`  ·  ${recommended} recommended`}
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
  root: { flex: 1 },
  body: { flex: 1 },
  container: {
    paddingHorizontal: space.screen,
    paddingTop: space.md,
    paddingBottom: space.xxl,
  },
  loading: { marginTop: space.xxl },
  lead: { marginBottom: space.sm },
  foot: { marginTop: space.md },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: space.xs,
    flex: 1,
  },
  headerLabel: { letterSpacing: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grow: { flex: 1 },
});
