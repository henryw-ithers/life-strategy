/**
 * The day's checklist as one drag surface: reorder within a part of the
 * day, or drag a task into a different one (ADR-0024 §3).
 *
 * **Why this is not `ReorderableList`.** That component positions every
 * row at `index × rowHeight`, which is what makes its drag maths a
 * single round(). A day has four sections with headers between them, so
 * positions stop being a function of index alone — a row's y depends on
 * how many headers sit above it, which depends on which section it is
 * currently in, which is exactly what a cross-section drag changes.
 * Generalising the original would have put that walk inside the
 * component the Tasks screen depends on; this keeps that one uniform
 * and correct, and pays for the checklist's extra dimension here.
 *
 * The model is a **list of lists**: `string[][]`, one array of task ids
 * per section, held as a shared value and rewritten as the finger
 * moves. Both layout and drop resolution walk it the same way, so what
 * you see under your thumb and what gets committed cannot disagree.
 *
 * Empty sections are drop targets in their own right. That is the whole
 * point — "move this to the afternoon" is most useful precisely when
 * the afternoon is empty, which is also when there is no row to drop
 * beside.
 */
import * as Haptics from "expo-haptics";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import type { ThemeTokens } from "../../theme/colors";
import { locate, moveRow, topOfHeader, topOfRow } from "./checklistLayout";
import { radius, space } from "../../theme/tokens";

export interface ChecklistSection {
  key: string;
  /** Rows in display order. Empty sections still render and accept drops. */
  rowIds: string[];
}

/** Matches the tested layout module's `gap`; the module takes it as
 *  an argument so it can stay free of React Native imports. */
const METRICS = (headerHeights: number[], rowHeight: number) => ({
  headerHeights,
  rowHeight,
  gap: space.xs,
});

/** Firm, no overshoot — bounce is banned (DESIGN.md motion). */
const SETTLE = { damping: 26, stiffness: 320, mass: 0.7 } as const;
interface SectionedChecklistProps {
  sections: ChecklistSection[];
  rowHeight: number;
  /** Measured per section, since a header with a "Free" note and one
   *  with a points total are not always the same height. */
  headerHeights: number[];
  renderHeader: (sectionKey: string, index: number) => React.ReactNode;
  renderRow: (rowId: string) => React.ReactNode;
  /** Fires on drop when anything actually changed. */
  onMove: (rowId: string, toSectionKey: string, toIndex: number) => void;
  /** Move a row one place, for screen readers — drag is unusable there. */
  onNudge?: (rowId: string, direction: -1 | 1) => void;
  /** A parent that scrolls must freeze while a row is held. */
  onDragStateChange?: (dragging: boolean) => void;
  theme: ThemeTokens;
}

export function SectionedChecklist({
  sections,
  rowHeight,
  headerHeights,
  renderHeader,
  renderRow,
  onMove,
  onDragStateChange,
  theme,
}: SectionedChecklistProps) {
  const layout = useSharedValue<string[][]>(sections.map((s) => [...s.rowIds]));
  const heights = useSharedValue<number[]>(headerHeights);
  const draggingId = useSharedValue<string | null>(null);
  const dragTop = useSharedValue(0);
  const startTop = useSharedValue(0);
  const translation = useSharedValue(0);
  const lift = useSharedValue(0);
  const liftedId = useSharedValue<string | null>(null);

  // Re-seed when the caller hands us a different arrangement. In an
  // effect rather than the render body: writing a shared value during
  // render is not guaranteed to land.
  const signature = sections.map((s) => `${s.key}:${s.rowIds.join(",")}`).join("|");
  useEffect(() => {
    layout.value = sections.map((s) => [...s.rowIds]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  useEffect(() => {
    heights.value = headerHeights;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerHeights.join(",")]);

  const totalHeight = useMemo(
    () =>
      headerHeights.reduce((sum, h) => sum + h + space.xs, 0) +
      sections.reduce((sum, s) => sum + s.rowIds.length * (rowHeight + space.xs), 0),
    [headerHeights, sections, rowHeight],
  );

  const setDragState = (next: boolean) => {
    onDragStateChange?.(next);
  };

  const tick = () => {
    void Haptics.selectionAsync();
  };

  const commit = (rowId: string) => {
    const next = layout.value;
    for (let s = 0; s < next.length; s++) {
      const i = (next[s] ?? []).indexOf(rowId);
      if (i >= 0) {
        const section = sections[s];
        if (section) onMove(rowId, section.key, i);
        return;
      }
    }
  };

  return (
    <View style={{ height: totalHeight }}>
      {sections.map((section, s) => (
        <SectionHeader
          key={`h-${section.key}`}
          index={s}
          layout={layout}
          heights={heights}
          rowHeight={rowHeight}
        >
          {renderHeader(section.key, s)}
        </SectionHeader>
      ))}
      {sections.flatMap((section) =>
        section.rowIds.map((rowId) => (
          <ChecklistRow
            key={rowId}
            rowId={rowId}
            layout={layout}
            heights={heights}
            rowHeight={rowHeight}
            draggingId={draggingId}
            dragTop={dragTop}
            startTop={startTop}
            translation={translation}
            lift={lift}
            liftedId={liftedId}
            onSetDragging={setDragState}
            onCommit={commit}
            onTick={tick}
            theme={theme}
          >
            {renderRow(rowId)}
          </ChecklistRow>
        )),
      )}
    </View>
  );
}

function SectionHeader({
  index,
  layout,
  heights,
  rowHeight,
  children,
}: {
  index: number;
  layout: SharedValue<string[][]>;
  heights: SharedValue<number[]>;
  rowHeight: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: topOfHeader(layout.value, METRICS(heights.value, rowHeight), index) },
    ],
  }));
  return (
    <Animated.View style={[styles.absolute, style]} pointerEvents="box-none">
      {children}
    </Animated.View>
  );
}

function ChecklistRow({
  rowId,
  layout,
  heights,
  rowHeight,
  draggingId,
  dragTop,
  startTop,
  translation,
  lift,
  liftedId,
  onSetDragging,
  onCommit,
  onTick,
  theme,
  children,
}: {
  rowId: string;
  layout: SharedValue<string[][]>;
  heights: SharedValue<number[]>;
  rowHeight: number;
  draggingId: SharedValue<string | null>;
  dragTop: SharedValue<number>;
  startTop: SharedValue<number>;
  translation: SharedValue<number>;
  lift: SharedValue<number>;
  liftedId: SharedValue<string | null>;
  onSetDragging: (next: boolean) => void;
  onCommit: (rowId: string) => void;
  onTick: () => void;
  theme: ThemeTokens;
  children: React.ReactNode;
}) {
  const resting = useDerivedValue(() =>
    topOfRow(layout.value, METRICS(heights.value, rowHeight), rowId),
  );

  /**
   * Held rows track the finger exactly; everything else springs to its
   * new slot. Two paths, one value — the spring must not fight the
   * finger, and the finger must not skip the settle.
   */
  const style = useAnimatedStyle(() => {
    const held = draggingId.value === rowId;
    const y = held ? dragTop.value : withSpring(resting.value, SETTLE);
    const isLifted = liftedId.value === rowId;
    return {
      transform: [{ translateY: y }, { scale: isLifted ? 1 + lift.value * 0.02 : 1 }],
      zIndex: held ? 2 : 1,
      shadowOpacity: isLifted ? lift.value * 0.18 : 0,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      shadowColor: "#000000",
      elevation: isLifted ? lift.value * 6 : 0,
    };
  });

  const pan = Gesture.Pan()
    // A long press arms the drag, so a plain tap still ticks the task
    // off and a vertical swipe still scrolls the page.
    .activateAfterLongPress(220)
    .onStart(() => {
      "worklet";
      draggingId.value = rowId;
      liftedId.value = rowId;
      startTop.value = topOfRow(layout.value, METRICS(heights.value, rowHeight), rowId);
      dragTop.value = startTop.value;
      translation.value = 0;
      lift.value = withTiming(1, { duration: 140 });
      runOnJS(onSetDragging)(true);
      runOnJS(onTick)();
    })
    .onUpdate((e) => {
      "worklet";
      translation.value = e.translationY;
      dragTop.value = startTop.value + e.translationY;

      const target = locate(
        layout.value,
        METRICS(heights.value, rowHeight),
        dragTop.value,
      );
      const next = moveRow(layout.value, rowId, target);
      // Null means the target resolved to where it already is.
      if (next === null) return;
      layout.value = next;
      runOnJS(onTick)();
    })
    .onEnd(() => {
      "worklet";
      draggingId.value = null;
      lift.value = withTiming(0, { duration: 220 });
      runOnJS(onSetDragging)(false);
      runOnJS(onCommit)(rowId);
    });

  return (
    <Animated.View style={[styles.absolute, { height: rowHeight }, style]}>
      <GestureDetector gesture={pan}>
        <View style={[styles.rowBody, { backgroundColor: theme.canvas }]}>
          {children}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  absolute: { position: "absolute", left: 0, right: 0 },
  /** Opaque, so a lifted row never shows the rows it passes over. */
  rowBody: { flex: 1, justifyContent: "center", borderRadius: radius.sm },
});
