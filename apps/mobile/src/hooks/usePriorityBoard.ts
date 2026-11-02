/**
 * Your priorities, editable in place on Life (ADR-0041 as amended by
 * ADR-0048): drag a unit between tiers or within one, or set its tier
 * and your own weight from its menu, and it saves straight away. There
 * is no Done. Saves made on the same day fold into that day's snapshot,
 * so the history keeps one set of priorities a day.
 *
 * - **A first run** starts every unit Unsorted (Henry, 2026-10-21), and
 *   nothing saves until each one has a tier.
 * - **Moving a unit to Not now** asks first when it holds tasks: they
 *   pause until it moves back up (ADR-0041 §3).
 * - A move that would leave the plan unable to save (every unit in Not
 *   now) is refused with why, and the board stays as it was.
 */
import { TIERS, type Tier } from "@glide/scoring";
import { useCallback, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import { inTiers, moveTo, sortedPlacement, type BoardUnit, type Slot } from "../components/priorities/board";
import { TIER_LABEL } from "../components/priorities/UnitSheet";
import { loadPriorities, savePriorities, type PriorityBoard } from "../db/priorities";
import { boardWeights } from "../db/tierRules";
import { recordProblem } from "../lib/problemLog";

export function usePriorityBoard(onSaved: () => void) {
  const [board, setBoard] = useState<PriorityBoard | null>(null);
  const [placement, setPlacement] = useState<BoardUnit[]>([]);
  const [overrides, setOverrides] = useState<ReadonlyMap<string, number>>(new Map());
  /** A first run's sorting, kept while units are still Unsorted, so a
   *  reload can't put them back. */
  const sorting = useRef(false);

  const reload = useCallback(async () => {
    const next = await loadPriorities();
    setBoard(next);
    if (sorting.current) return;
    setPlacement(next.units.map((u) => ({ unitId: u.unitId, tier: next.firstRun ? "unsorted" : u.tier })));
    setOverrides(new Map(next.units.flatMap((u) => (u.override === null ? [] : [[u.unitId, u.override] as const]))));
  }, []);

  const live = useMemo(() => boardWeights(inTiers(placement), overrides), [placement, overrides]);
  const unsorted = placement.filter((p) => p.tier === "unsorted").length;

  const commit = async (next: BoardUnit[], nextOverrides: ReadonlyMap<string, number>) => {
    const before = { placement, overrides };
    setPlacement(next);
    setOverrides(nextOverrides);
    const sorted = sortedPlacement(next);
    if (sorted === null) {
      // Still sorting a first run: kept here until every unit has a tier.
      sorting.current = true;
      return;
    }
    // Not now holds no weight, so a weight set there isn't kept.
    const kept = new Map([...nextOverrides].filter(([id]) => next.find((p) => p.unitId === id)?.tier !== "notNow"));
    const problem = boardWeights(sorted, kept).problem;
    if (problem) {
      setPlacement(before.placement);
      setOverrides(before.overrides);
      Alert.alert("That can't be saved", problem);
      return;
    }
    try {
      await savePriorities(sorted, kept, { sameDay: true });
      sorting.current = false;
      onSaved();
    } catch (e) {
      recordProblem(e, "save");
      setPlacement(before.placement);
      setOverrides(before.overrides);
      Alert.alert("Your priorities weren't saved", e instanceof Error ? e.message : String(e));
    }
  };

  /** Ask before Not now pauses a unit's tasks; then run `go`. */
  const confirmNotNow = (unitId: string, to: Slot, go: () => void) => {
    const from = placement.find((p) => p.unitId === unitId)?.tier;
    const unit = board?.units.find((u) => u.unitId === unitId);
    if (to !== "notNow" || from === "notNow" || from === "unsorted" || !unit || unit.taskCount === 0) {
      go();
      return;
    }
    Alert.alert(
      `Move ${unit.name} to Not now?`,
      `Its ${unit.taskCount === 1 ? "task pauses" : `${unit.taskCount} tasks pause`} until it moves back up.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Move", onPress: go },
      ],
    );
  };

  /** A drop: into `slot` at `index` among the units already there. */
  const move = (unitId: string, slot: Slot, index: number) =>
    confirmNotNow(unitId, slot, () => void commit(moveTo(placement, unitId, slot, index), overrides));

  /** From the unit's menu or sheet: to the end of a tier. */
  const moveToEnd = (unitId: string, tier: Tier) => {
    const count = placement.filter((p) => p.tier === tier && p.unitId !== unitId).length;
    move(unitId, tier, count);
  };

  /** From the unit's sheet: its tier and your own weight, saved together. */
  const setUnit = (unitId: string, tier: Tier, value: number | null) => {
    const here = placement.find((p) => p.unitId === unitId)?.tier;
    const next =
      here === tier
        ? placement
        : moveTo(placement, unitId, tier, placement.filter((p) => p.tier === tier && p.unitId !== unitId).length);
    const own = tier === "notNow" || value === live.recommended.get(unitId) ? null : value;
    const nextOverrides = new Map(overrides);
    if (own === null) nextOverrides.delete(unitId);
    else nextOverrides.set(unitId, own);
    confirmNotNow(unitId, tier, () => void commit(next, nextOverrides));
  };

  /** Your own weight, or null for the recommended one. */
  const setOverride = (unitId: string, value: number | null) => {
    const own = value === live.recommended.get(unitId) ? null : value;
    const next = new Map(overrides);
    if (own === null) next.delete(unitId);
    else next.set(unitId, own);
    void commit(placement, next);
  };

  /** The sections Life shows, top first: Unsorted while a first run has
   *  any, then every tier, empty or not, so each can take a drop. */
  const slots: Slot[] = [...(unsorted > 0 ? (["unsorted"] as const) : []), ...TIERS];

  return { board, placement, overrides, live, unsorted, slots, reload, move, moveToEnd, setOverride, setUnit };
}

export const SLOT_LABEL: Record<Slot, string> = { ...TIER_LABEL, unsorted: "Unsorted" };
