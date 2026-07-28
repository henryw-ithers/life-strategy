/**
 * Drag-to-reorder list. Rows are absolutely positioned by their index,
 * so committing a new order to React state lands every row exactly
 * where the drag already put it — no reflow, no flicker.
 *
 * Two gestures, two targets, no overlap: the row body taps to open its
 * detail, the handle drags to reorder. That split is what lets the
 * detail affordance be the whole row instead of a button per row —
 * seventeen bordered glyphs is chrome the list doesn't need, and a
 * 48pt handle beside a full-width tap target reads faster than two
 * small controls competing at the same edge.
 *
 * All drag state lives here rather than in the rows, because the drag
 * is driven by a single frame loop: a finger held still near an edge
 * has to keep scrolling, and `onUpdate` only fires when the finger
 * actually moves. One loop reading one set of shared values also keeps
 * seventeen rows from each running their own.
 *
 * Drag is unusable with a screen reader, so every row also exposes
 * move-up/move-down accessibility actions that do the same work.
 */
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useScrollOffset,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "./AppText";

export interface ReorderableItem {
  id: string;
  label: string;
  /** Group colour, shown as the leading dot. */
  accent?: string;
  /** Set false when `onPressItem` has nothing to show for this row. */
  hasDetail?: boolean;
}

const ROW_HEIGHT = 64;
const ROW_GAP = space.sm;
const SLOT = ROW_HEIGHT + ROW_GAP;

/** Rows sit inset from the scroll edges so a lifted row's shadow has
 *  somewhere to fall instead of being clipped by the viewport. */
const INSET = 3;

/** Auto-scroll: how close to a viewport edge a held row must get
 *  before the list follows, and how fast it goes once it does.
 *
 *  Speed ramps with depth into the zone rather than switching on at
 *  full rate — at the boundary it's a crawl you can hold steady in,
 *  and only the last few points of travel reach `SCROLL_MAX`
 *  (px/frame, so ~240 px/s at 60fps). A flat rate here made the list
 *  bolt the instant you crossed the threshold. */
const EDGE = 72;
const SCROLL_MAX = 4;
/** Floor so entering the zone does something immediately. */
const SCROLL_MIN_FACTOR = 0.2;

/** Settle motion: firm enough that a row reads as snapping into a
 *  slot, with no overshoot — bounce is banned for good reason. */
const SETTLE = { damping: 26, stiffness: 320, mass: 0.7 } as const;

interface ReorderableListProps {
  /** Current order; index 0 is rank 1. */
  items: ReorderableItem[];
  /** Fires on drop (and on an accessibility move) with the new order. */
  onReorder: (orderedIds: string[]) => void;
  /** Tapping a row's body. Omit and rows aren't tappable. */
  onPressItem?: (item: ReorderableItem) => void;
  /** Completes "Opens …" for the row's accessibility hint. */
  detailHint?: string;
  theme: ThemeTokens;
}

export function ReorderableList({
  items,
  onReorder,
  onPressItem,
  detailHint,
  theme,
}: ReorderableListProps) {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const [viewportHeight, setViewportHeight] = useState(0);
  /** Mirrors `draggingId` on the JS side purely to freeze scrolling. */
  const [dragging, setDragging] = useState(false);

  /** id -> slot index. The visual source of truth while dragging. */
  const positions = useSharedValue<Record<string, number>>(
    Object.fromEntries(items.map((item, i) => [item.id, i])),
  );
  const draggingId = useSharedValue<string | null>(null);
  /** Where the dragged row sits, in content space. */
  const dragTop = useSharedValue(0);
  const startTop = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const translation = useSharedValue(0);
  /** 0 resting, 1 lifted. Drives the shadow. */
  const lift = useSharedValue(0);
  /** Which row `lift` belongs to. Shared values are shared — without
   *  this every row would wear the shadow of whichever row is held.
   *  Kept after the drop so the fade-out lands on the right row. */
  const liftedId = useSharedValue<string | null>(null);

  // Re-seed when the caller hands us a different order (an
  // accessibility move commits without remounting). In an effect, not
  // in the render body: writing a shared value during render isn't
  // guaranteed to land, which strands `positions` on exactly the long
  // lists where it matters. Committing a drag produces the identical
  // mapping, so this is a no-op on that path and never flickers.
  const key = items.map((i) => i.id).join("|");
  useEffect(() => {
    positions.value = Object.fromEntries(items.map((item, i) => [item.id, i]));
    // `key` is the order; `items` identity churns every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const count = items.length;
  const contentHeight = count * SLOT - ROW_GAP + INSET * 2;
  const maxScroll = Math.max(0, contentHeight - viewportHeight);

  const commit = (next: Record<string, number>) => {
    const ordered = [...items].sort((a, b) => next[a.id]! - next[b.id]!);
    onReorder(ordered.map((i) => i.id));
  };

  const tick = () => {
    void Haptics.selectionAsync();
  };

  const moveBy = (id: string, delta: number) => {
    const current = items.findIndex((i) => i.id === id);
    const target = current + delta;
    if (current < 0 || target < 0 || target >= count) return;
    tick();
    const next = [...items];
    const [moved] = next.splice(current, 1);
    next.splice(target, 0, moved!);
    onReorder(next.map((i) => i.id));
  };

  /**
   * The drag loop. Runs every frame; does nothing unless a row is
   * held. Recomputing `dragTop` here rather than in `onUpdate` is what
   * lets a stationary finger keep auto-scrolling, and keeps the row
   * pinned under the thumb while the list moves beneath it.
   */
  useFrameCallback(() => {
    "worklet";
    const id = draggingId.value;
    if (id === null) return;

    if (maxScroll > 0) {
      const onScreen = dragTop.value - scrollOffset.value;
      const fromTop = onScreen;
      const fromBottom = viewportHeight - ROW_HEIGHT - onScreen;
      // Depth into the edge zone, 0 at the boundary to 1 at the very
      // edge — the ramp is what makes this controllable.
      const ramp = (gap: number) => {
        const depth = Math.min(1, Math.max(0, (EDGE - gap) / EDGE));
        return SCROLL_MAX * (SCROLL_MIN_FACTOR + (1 - SCROLL_MIN_FACTOR) * depth);
      };

      let delta = 0;
      if (fromTop < EDGE && scrollOffset.value > 0) delta = -ramp(fromTop);
      else if (fromBottom < EDGE && scrollOffset.value < maxScroll) {
        delta = ramp(fromBottom);
      }

      if (delta !== 0) {
        const next = Math.min(maxScroll, Math.max(0, scrollOffset.value + delta));
        scrollTo(scrollRef, 0, next, false);
      }
    }

    // Content space, so the row tracks the finger even as the list
    // scrolls underneath it.
    dragTop.value =
      startTop.value + translation.value + (scrollOffset.value - startScroll.value);

    const target = Math.max(
      0,
      Math.min(count - 1, Math.round((dragTop.value - INSET) / SLOT)),
    );
    const current = positions.value[id] ?? 0;
    if (target !== current) {
      // Shift whatever occupies the target slot back into the one this
      // row is vacating; everything else stays put.
      const next = { ...positions.value };
      for (const [otherId, slot] of Object.entries(next)) {
        if (otherId === id) continue;
        if (current < target && slot > current && slot <= target) next[otherId] = slot - 1;
        else if (current > target && slot >= target && slot < current)
          next[otherId] = slot + 1;
      }
      next[id] = target;
      positions.value = next;
      runOnJS(tick)(); // one detent, one tick
    }
  });

  const contentStyle = useMemo(
    () => ({ height: contentHeight }),
    [contentHeight],
  );

  return (
    <Animated.ScrollView
      ref={scrollRef}
      onLayout={(e) => setViewportHeight(e.nativeEvent.layout.height)}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      // While a row is held, the list must not also respond to the
      // finger — the frame loop owns scrolling for the duration.
      scrollEnabled={!dragging}
    >
      {items.map((item, index) => (
        <Row
          key={item.id}
          item={item}
          index={index}
          count={count}
          positions={positions}
          draggingId={draggingId}
          dragTop={dragTop}
          startTop={startTop}
          startScroll={startScroll}
          translation={translation}
          lift={lift}
          liftedId={liftedId}
          scrollOffset={scrollOffset}
          onSetDragging={setDragging}
          onCommit={commit}
          onMoveBy={moveBy}
          onTick={tick}
          onPressItem={onPressItem}
          detailHint={detailHint}
          theme={theme}
        />
      ))}
    </Animated.ScrollView>
  );
}

interface RowProps {
  item: ReorderableItem;
  index: number;
  count: number;
  positions: SharedValue<Record<string, number>>;
  draggingId: SharedValue<string | null>;
  dragTop: SharedValue<number>;
  startTop: SharedValue<number>;
  startScroll: SharedValue<number>;
  translation: SharedValue<number>;
  lift: SharedValue<number>;
  liftedId: SharedValue<string | null>;
  scrollOffset: SharedValue<number>;
  onSetDragging: (v: boolean) => void;
  onCommit: (next: Record<string, number>) => void;
  onMoveBy: (id: string, delta: number) => void;
  onTick: () => void;
  onPressItem?: (item: ReorderableItem) => void;
  detailHint?: string;
  theme: ThemeTokens;
}

function Row({
  item,
  index,
  count,
  positions,
  draggingId,
  dragTop,
  startTop,
  startScroll,
  translation,
  lift,
  liftedId,
  scrollOffset,
  onSetDragging,
  onCommit,
  onMoveBy,
  onTick,
  onPressItem,
  detailHint,
  theme,
}: RowProps) {
  const reduceMotion = useReducedMotion();

  const pan = Gesture.Pan()
    // Claim the gesture immediately on the handle rather than waiting
    // for a directional threshold, so the scroll view never gets first
    // refusal on a drag that started here.
    .activeOffsetY([-1, 1])
    .shouldCancelWhenOutside(false)
    .onStart(() => {
      draggingId.value = item.id;
      startTop.value = (positions.value[item.id] ?? index) * SLOT + INSET;
      dragTop.value = startTop.value;
      startScroll.value = scrollOffset.value;
      translation.value = 0;
      liftedId.value = item.id;
      lift.value = withTiming(1, { duration: 140 });
      runOnJS(onSetDragging)(true);
      runOnJS(onTick)();
    })
    .onUpdate((e) => {
      translation.value = e.translationY;
    })
    .onFinalize(() => {
      if (draggingId.value !== item.id) return;
      draggingId.value = null;
      lift.value = withTiming(0, { duration: 160 });
      runOnJS(onSetDragging)(false);
      runOnJS(onCommit)(positions.value);
    });

  const animated = useAnimatedStyle(() => {
    const isDragging = draggingId.value === item.id;
    // Fall back to render order: a row can paint for one frame before
    // a re-seed reaches the shared value, and NaN would blank it.
    const slot = positions.value[item.id] ?? index;
    const resting = slot * SLOT + INSET;
    const top = isDragging
      ? dragTop.value
      : reduceMotion
        ? resting
        : withSpring(resting, SETTLE);
    return {
      // No scale on lift: the row is full-bleed inside a clipping
      // scroll view, so growing it shaves the rounded corners off.
      // The shadow carries the lift on its own.
      transform: [{ translateY: top }],
      zIndex: isDragging ? 2 : 1,
      shadowOpacity: liftedId.value === item.id ? lift.value * 0.08 : 0,
      elevation: liftedId.value === item.id ? lift.value * 4 : 0,
    };
  });

  const rank = index + 1;
  const tappable = onPressItem !== undefined && item.hasDetail !== false;

  return (
    <Animated.View
      style={[
        styles.row,
        animated,
        { backgroundColor: theme.surface, borderColor: theme.hairline },
      ]}
    >
      <Pressable
        onPress={tappable ? () => onPressItem!(item) : undefined}
        disabled={!tappable}
        accessibilityRole={tappable ? "button" : undefined}
        accessibilityLabel={`${item.label}, rank ${rank} of ${count}`}
        accessibilityHint={tappable && detailHint ? `Opens ${detailHint}` : undefined}
        accessibilityActions={[
          { name: "moveUp", label: "Move up" },
          { name: "moveDown", label: "Move down" },
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "moveUp") onMoveBy(item.id, -1);
          if (e.nativeEvent.actionName === "moveDown") onMoveBy(item.id, 1);
        }}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.6 : 1 }]}
      >
        <AppText variant="caption" color={theme.muted} tabular style={styles.rank}>
          {rank}
        </AppText>
        {item.accent ? (
          <View style={[styles.dot, { backgroundColor: item.accent }]} />
        ) : null}
        <AppText variant="headline" color={theme.ink} numberOfLines={2} style={styles.label}>
          {item.label}
        </AppText>
      </Pressable>
      <GestureDetector gesture={pan}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.handle}
        >
          <View style={[styles.grip, { backgroundColor: theme.hairline }]} />
          <View style={[styles.grip, { backgroundColor: theme.hairline }]} />
          <View style={[styles.grip, { backgroundColor: theme.hairline }]} />
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: INSET,
    right: INSET,
    height: ROW_HEIGHT,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    // Sheet shadow (DESIGN.md §4), faded in only while lifted.
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    height: "100%",
  },
  rank: { minWidth: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1 },
  handle: {
    width: 48,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  grip: { width: 18, height: 1.5, borderRadius: 1 },
});
