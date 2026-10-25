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
 * Nothing saves until Done, which writes one snapshot (ADR-0041 §5)
 * with no questions: Not now pauses a unit's tasks until it moves back
 * up, and a weight you set is kept (Henry, 2026-10-25).
 *
 * Also onboarding's Priorities step (ADR-0045), pushed over it. A first
 * run starts with every unit Unsorted, and Done waits until each is in
 * a tier: you sort them all yourself (Henry, 2026-10-21).
 */
import { router, Stack } from "expo-router";
import { useHeaderHeight, useNavigation, usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";

import { TIERS, type Tier } from "@glide/scoring";

import {
  boardRows,
  headerId,
  headerTier,
  inTiers,
  moveToTier,
  moveWithinTier,
  placementFromRows,
  sortedPlacement,
  type BoardUnit,
  type Slot,
} from "../../components/priorities/board";
import { TIER_LABEL, UnitSheet } from "../../components/priorities/UnitSheet";
import { AppText } from "../../components/ui/AppText";
import { InfoButton } from "../../components/ui/InfoButton";
import { constellation, ScrollBackdrop } from "../../components/ui/Backdrop";
import { ReorderableList, type ReorderableItem } from "../../components/ui/ReorderableList";
import { LoadFailure, useScreenLoad } from "../../components/ui/ScreenLoad";
import { useRetained } from "../../hooks/useRetained";
import {
  loadPriorities,
  savePriorities,
  type PriorityBoard,
} from "../../db/priorities";
import { boardWeights } from "../../db/tierRules";
import { getTheme, type ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";


/** What a section is called: a tier, or Unsorted on a first run. */
const SLOT_LABEL: Record<Slot, string> = { ...TIER_LABEL, unsorted: "Unsorted" };

/** Pick a tier for an unsorted unit (a tap, as the sheet would be for a
 *  sorted one). Resolves null if cancelled. */
function pickTier(name: string): Promise<Tier | null> {
  return new Promise((resolve) => {
    Alert.alert(
      `Where does ${name} go?`,
      undefined,
      [
        ...TIERS.map((t) => ({ text: TIER_LABEL[t], onPress: () => resolve(t) })),
        { text: "Cancel", style: "cancel" as const, onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

export default function PrioritiesScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");

  const [board, setBoard] = useState<PriorityBoard | null>(null);
  const [placement, setPlacement] = useState<BoardUnit[]>([]);
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingShown, editingGone] = useRetained(editing);
  /** Set once Done has saved, so leaving isn't asked about. */
  const [saved, setSaved] = useState(false);
  const navigation = useNavigation();
  /** Edits not yet saved. A ref as well as state, so a reload on focus
   *  (`useScreenLoad`) can't wipe them. */
  const edited = useRef(false);

  // The page scrolls, and a held row scrolls it (`parentScroll`): the
  // board is taller than the screen, and a drag from Top to Not now has
  // to reach both.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const offset = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    offset.set(e.contentOffset.y);
  });
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [listTop, setListTop] = useState(0);
  const topInset = useHeaderHeight();

  const load = useCallback(async () => {
    const next = await loadPriorities();
    if (edited.current) return;
    setBoard(next);
    setPlacement(
      next.units.map((u) => ({ unitId: u.unitId, tier: next.firstRun ? "unsorted" : u.tier })),
    );
    setOverrides(
      new Map(next.units.flatMap((u) => (u.override === null ? [] : [[u.unitId, u.override]]))),
    );
    setDirty(false);
  }, []);
  const { error, retry } = useScreenLoad(load);

  // While you sort, weights are worked out from the units in a tier.
  const live = useMemo(() => boardWeights(inTiers(placement), overrides), [placement, overrides]);
  const unsorted = placement.filter((p) => p.tier === "unsorted").length;
  const unitById = useMemo(
    () => new Map((board?.units ?? []).map((u) => [u.unitId, u])),
    [board],
  );

  // Until it has saved, leaving with changes asks first.
  usePreventRemove(dirty && !saved, ({ data }) => {
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
  // Reached by a link, a first run may have nothing beneath it.
  useEffect(() => {
    if (!saved) return;
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [saved]);

  const markEdited = () => {
    edited.current = true;
    setDirty(true);
  };

  const change = (next: BoardUnit[]) => {
    setPlacement(next);
    markEdited();
  };

  const setOverride = (unitId: string, value: number | null) => {
    // Your own weight equal to the recommended one is no override.
    const own = value === live.recommended.get(unitId) ? null : value;
    if ((overrides.get(unitId) ?? null) === own) return;
    setOverrides((prev) => {
      const next = new Map(prev);
      if (own === null) next.delete(unitId);
      else next.set(unitId, own);
      return next;
    });
    markEdited();
  };

  const done = async () => {
    if (!board || saving) return;
    const sorted = sortedPlacement(placement);
    if (sorted === null) {
      Alert.alert(
        "Sort every unit first",
        `${unsorted} still ${unsorted === 1 ? "needs" : "need"} a tier. Not now is a tier too.`,
      );
      return;
    }
    if (live.problem) {
      Alert.alert("Priorities can't be saved yet", live.problem);
      return;
    }
    // Done just saves (Henry, 2026-10-25): moving a unit to Not now
    // pauses its tasks, and moving it back up brings them back; a weight
    // you set is kept even when its recommended value moves.
    setSaving(true);
    try {
      const planned = new Map(
        [...overrides].filter(([id]) => placement.find((p) => p.unitId === id)?.tier !== "notNow"),
      );
      await savePriorities(sorted, planned);
    } catch (e) {
      setSaving(false);
      Alert.alert("Priorities weren't saved", e instanceof Error ? e.message : String(e));
      return;
    }
    edited.current = false;
    setSaving(false);
    setSaved(true);
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
        <Animated.ScrollView
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
        </Animated.ScrollView>
      </View>
    );
  }

  /** A header's line: what each unit in the tier is roughly worth. */
  const headerDetail = (tier: Slot): string => {
    if (tier === "unsorted") return `${unsorted} to sort`;
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
        label: SLOT_LABEL[tier],
        fixed: true,
        accessibilityLabel: detail ? `${SLOT_LABEL[tier]}, ${detail}` : `${SLOT_LABEL[tier]}, empty`,
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
      hasDetail: true,
      accessibilityLabel:
        here === "unsorted"
          ? `${u.name}, unsorted`
          : here === "notNow"
          ? `${u.name}, Not now`
          : own !== undefined
            ? `${u.name}, ${TIER_LABEL[here]}, your weight ${own}, recommended ${recommended}`
            : `${u.name}, ${TIER_LABEL[here]}, weight ${weight}`,
      actions: TIERS.filter((t) => t !== here).map((t) => ({
        name: headerId(t),
        label: `Move to ${TIER_LABEL[t]}`,
      })),
    };
  });

  const editingUnit = editingShown ? unitById.get(editingShown) : undefined;
  const editingSlot = placement.find((p) => p.unitId === editingShown)?.tier;
  const editingTier: Tier = editingSlot === undefined || editingSlot === "unsorted" ? "important" : editingSlot;

  return (
    <View style={styles.root}>
      {doneButton}
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContentHeight(h)}
        style={styles.body}
        scrollEnabled={!dragging}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        <View style={styles.leadRow}>
          <AppText color={theme.muted} style={styles.grow}>
            {board.firstRun ? "Drag each unit into a tier." : "Drag to reorder."}
          </AppText>
          <InfoButton
            title="Priorities"
            body="Top, Important and Background set each unit's share of the day, and order inside a tier fine-tunes it. Not now is out of the plan: no weight, no tasks. Tap a unit to set your own weight. Rough is fine; you can change it any time."
            theme={theme}
          />
        </View>
        {/* Not while you're still sorting: an empty plan is where a
            first run starts, not a problem yet. */}
        {(unsorted === 0 && live.problem) || board.problem ? (
          <AppText variant="footnote" color={theme.muted} style={styles.lead}>
            {(unsorted === 0 ? live.problem : null) ?? board.problem}
          </AppText>
        ) : null}

        <View onLayout={(e) => setListTop(e.nativeEvent.layout.y)}>
        <ReorderableList
          items={items}
          scrollable={false}
          parentScroll={{ ref: scrollRef, offset, viewportHeight, contentHeight, listTop, topInset }}
          rowHeight={52}
          onDragStateChange={setDragging}
          onReorder={(ids) => change(placementFromRows(ids))}
          onPressItem={(item) => {
            if (placement.find((p) => p.unitId === item.id)?.tier !== "unsorted") {
              setEditing(item.id);
              return;
            }
            void pickTier(item.label).then((tier) => {
              if (tier === null) return;
              change(moveToTier(placement, item.id, tier));
              AccessibilityInfo.announceForAccessibility(`${item.label} moved to ${TIER_LABEL[tier]}`);
            });
          }}
          detailHint="its tier and your own weight for it"
          onItemAction={(item, name) => {
            const tier = headerTier(name);
            if (!tier || tier === "unsorted") return;
            change(moveToTier(placement, item.id, tier));
            AccessibilityInfo.announceForAccessibility(`${item.label} moved to ${TIER_LABEL[tier]}`);
          }}
          theme={theme}
          renderItem={(item) => {
            const tier = headerTier(item.id);
            if (tier) return <TierHeader label={SLOT_LABEL[tier]} detail={headerDetail(tier)} theme={theme} />;
            const here = placement.find((p) => p.unitId === item.id)!.tier;
            const own = here === "notNow" || here === "unsorted" ? undefined : overrides.get(item.id);
            return (
              <UnitRow
                name={item.label}
                accent={item.accent ?? theme.muted}
                weight={
                  here === "notNow" || here === "unsorted"
                    ? null
                    : (live.weights.get(item.id) ?? live.recommended.get(item.id) ?? null)
                }
                own={own}
                recommended={live.recommended.get(item.id) ?? 0}
                theme={theme}
              />
            );
          }}
        />
        </View>
      </Animated.ScrollView>

      {editingShown && editingUnit ? (
        <UnitSheet
          key={editingShown}
          visible={editing !== null}
          onDismissed={editingGone}
          unitName={editingUnit.name}
          tier={editingTier}
          recommended={live.recommended.get(editingShown) ?? 0}
          override={overrides.get(editingShown) ?? null}
          canMoveUp={moveWithinTier(placement, editingShown, -1).some((p, i) => p !== placement[i])}
          canMoveDown={moveWithinTier(placement, editingShown, 1).some((p, i) => p !== placement[i])}
          theme={theme}
          onMove={(delta) => {
            change(moveWithinTier(placement, editingShown, delta));
            AccessibilityInfo.announceForAccessibility(
              `${editingUnit.name} moved ${delta < 0 ? "up" : "down"}`,
            );
          }}
          onSave={({ tier, override: own }) => {
            if (tier !== editingTier) change(moveToTier(placement, editingShown, tier));
            if (tier !== "notNow") setOverride(editingShown, own);
          }}
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
      {/* Your own weight, with the recommended one beside it as a
          small muted number (AGENTS.md: an override always shows it). */}
      {weight === null ? null : own !== undefined ? (
        <View style={styles.weights} accessible={false}>
          <AppText color={theme.ink} tabular>
            {own}
          </AppText>
          <AppText variant="footnote" color={theme.muted} tabular>
            {recommended}
          </AppText>
        </View>
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
  leadRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  headerLabel: { letterSpacing: 0.6 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  weights: { flexDirection: "row", alignItems: "baseline", gap: space.xs },
  grow: { flex: 1 },
});
