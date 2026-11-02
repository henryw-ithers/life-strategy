/**
 * Drag and drop on Home (ADR-0048): hold a task, move it into another
 * window or part of the day, or up and down inside its own; let go and
 * it's there. Hold it and let go without moving and you get its menu
 * instead, as in Reminders.
 *
 * **Why lift-and-drop, not a list that reflows under the finger.** Home
 * is cards, folded windows, events and gaps between the rows, so no row
 * sits at a position you could compute from its index (the reason the
 * old `SectionedChecklist` needed every row one height). Here the row
 * lifts into a copy that follows the finger, a line shows where it will
 * land, and on drop the day re-renders with Home's own layout animation
 * moving everything into place. Rows and sections are measured once,
 * when the drag starts, and corrected for scrolling after that.
 *
 * Gesture callbacks are worklets; everything they call back into is a
 * stable function reading the latest state through refs, because a
 * gesture rebuilt mid-drag drops the drag.
 */
import * as Haptics from "expo-haptics";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import type { ThemeTokens } from "../../theme/colors";
import { radius } from "../../theme/tokens";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a drop would land: a section, and a place in its rows. */
export interface DropTarget {
  sectionKey: string;
  /** Among the section's rows without the one being moved. */
  index: number;
}

interface SectionEntry {
  node: View | null;
  rowIds: readonly string[];
}

interface DragContext {
  registerSection: (key: string, entry: SectionEntry | null) => void;
  registerRow: (id: string, node: View | null, onHold?: () => void) => void;
  start: (id: string, sectionKey: string) => void;
  move: (absoluteY: number) => void;
  finish: (distance: number) => void;
  cancel: () => void;
  ghostTop: SharedValue<number>;
  activeId: string | null;
  overKey: string | null;
}

const Context = createContext<DragContext | null>(null);

/** Moved less than this before letting go: a hold, not a drag. */
const HOLD_SLOP = 8;
/** How close to the top or bottom edge starts scrolling, and how fast. */
const EDGE = 90;
const SCROLL_STEP = 9;

const measure = (node: View | null): Promise<Rect | null> =>
  new Promise((resolve) => {
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });

export interface DayDragProps {
  children: ReactNode;
  /** A row was dropped somewhere new. */
  onDrop: (taskId: string, fromKey: string, to: DropTarget) => void;
  /** While a row is held, so the page can stop scrolling under it. */
  onDraggingChange: (dragging: boolean) => void;
  /** The lifted copy of a row. */
  renderGhost: (taskId: string) => ReactNode;
  /** The page's scroll, so a drag near an edge can move it. */
  scroll: { y: () => number; to: (y: number) => void } | null;
  theme: ThemeTokens;
}

export function DayDrag({ children, onDrop, onDraggingChange, renderGhost, scroll, theme }: DayDragProps) {
  const { height: screenHeight } = useWindowDimensions();
  const sections = useRef(new Map<string, SectionEntry>());
  const rows = useRef(new Map<string, View | null>());
  const holds = useRef(new Map<string, () => void>());
  const root = useRef<View>(null);
  const ghostTop = useSharedValue(0);
  const [active, setActive] = useState<{ id: string; from: string; rect: Rect; rootX: number; rootY: number } | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [line, setLine] = useState<number | null>(null);

  // What the drag measured when it began, and what it's over now.
  const drag = useRef<{
    id: string;
    from: string;
    scroll0: number;
    sections: { key: string; rect: Rect; rows: { id: string; rect: Rect }[] }[];
    lastY: number;
    target: DropTarget | null;
  } | null>(null);
  const auto = useRef<ReturnType<typeof setInterval> | null>(null);
  const latest = useRef({ onDrop, onDraggingChange, scroll, screenHeight });
  useLayoutEffect(() => {
    latest.current = { onDrop, onDraggingChange, scroll, screenHeight };
  });

  const registerSection = useCallback((key: string, entry: SectionEntry | null) => {
    if (entry) sections.current.set(key, entry);
    else sections.current.delete(key);
  }, []);
  const registerRow = useCallback((id: string, node: View | null, onHold?: () => void) => {
    if (node) rows.current.set(id, node);
    else rows.current.delete(id);
    if (node && onHold) holds.current.set(id, onHold);
    else holds.current.delete(id);
  }, []);

  /** The target under `y`, and where its line goes, from the rects
   *  measured at the start, shifted by what's scrolled since. */
  const locate = useCallback((y: number) => {
    const d = drag.current;
    if (!d) return;
    const shift = (latest.current.scroll?.y() ?? d.scroll0) - d.scroll0;
    const top = (r: Rect) => r.y - shift;
    let best: (typeof d.sections)[number] | null = null;
    let bestGap = Infinity;
    for (const s of d.sections) {
      const t = top(s.rect);
      const gap = y < t ? t - y : y > t + s.rect.height ? y - t - s.rect.height : 0;
      if (gap < bestGap) {
        bestGap = gap;
        best = s;
      }
    }
    if (!best) return;
    const others = best.rows.filter((r) => r.id !== d.id);
    let index = others.findIndex((r) => y < top(r.rect) + r.rect.height / 2);
    if (index === -1) index = others.length;
    const next = { sectionKey: best.key, index };
    const at =
      others.length === 0
        ? null
        : index < others.length
          ? top(others[index]!.rect)
          : top(others[others.length - 1]!.rect) + others[others.length - 1]!.rect.height;
    if (d.target?.sectionKey !== next.sectionKey || d.target.index !== next.index) {
      d.target = next;
      setTarget(next);
      void Haptics.selectionAsync();
    }
    setLine(at);
  }, []);

  const stopAuto = () => {
    if (auto.current) clearInterval(auto.current);
    auto.current = null;
  };

  const start = useCallback(
    (id: string, from: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      latest.current.onDraggingChange(true);
      void (async () => {
        const [rootRect, rowRect] = await Promise.all([measure(root.current), measure(rows.current.get(id) ?? null)]);
        const measured = await Promise.all(
          [...sections.current.entries()].map(async ([key, s]) => ({
            key,
            rect: await measure(s.node),
            rows: (
              await Promise.all(
                s.rowIds.map(async (rowId) => ({ id: rowId, rect: await measure(rows.current.get(rowId) ?? null) })),
              )
            ).filter((r): r is { id: string; rect: Rect } => r.rect !== null),
          })),
        );
        if (!rootRect || !rowRect) return;
        drag.current = {
          id,
          from,
          scroll0: latest.current.scroll?.y() ?? 0,
          sections: measured.filter((s): s is typeof s & { rect: Rect } => s.rect !== null),
          lastY: rowRect.y + rowRect.height / 2,
          target: null,
        };
        setActive({ id, from, rect: rowRect, rootX: rootRect.x, rootY: rootRect.y });
      })();
    },
    [],
  );

  const move = useCallback(
    (y: number) => {
      const d = drag.current;
      if (!d) return;
      d.lastY = y;
      locate(y);
      // Near an edge, the page scrolls under the finger.
      const { scroll: s, screenHeight: h } = latest.current;
      const dir = y < EDGE ? -1 : y > h - EDGE ? 1 : 0;
      if (dir === 0 || !s) return stopAuto();
      if (auto.current) return;
      auto.current = setInterval(() => {
        const now = drag.current;
        if (!now) return stopAuto();
        s.to(Math.max(0, s.y() + dir * SCROLL_STEP));
        locate(now.lastY);
      }, 16);
    },
    [locate],
  );

  const reset = useCallback(() => {
    stopAuto();
    drag.current = null;
    setActive(null);
    setTarget(null);
    setLine(null);
    latest.current.onDraggingChange(false);
  }, []);

  const finish = useCallback(
    (distance: number) => {
      const d = drag.current;
      const moved = distance >= HOLD_SLOP;
      // Held and let go where it was: the row's menu.
      if (d && !moved) {
        const hold = holds.current.get(d.id);
        reset();
        hold?.();
        return;
      }
      if (d && moved && d.target) {
        const { id, from, target: to } = d;
        // Put back where it was: nothing to save.
        const own = d.sections.find((s) => s.key === from)?.rows.map((r) => r.id) ?? [];
        const stayed = to.sectionKey === from && own.indexOf(id) === to.index;
        if (!stayed) latest.current.onDrop(id, from, to);
      }
      reset();
    },
    [reset],
  );

  useEffect(() => stopAuto, []);

  const value = useMemo<DragContext>(
    () => ({
      registerSection,
      registerRow,
      start,
      move,
      finish,
      cancel: reset,
      ghostTop,
      activeId: active?.id ?? null,
      overKey: target?.sectionKey ?? null,
    }),
    [registerSection, registerRow, start, move, finish, reset, ghostTop, active?.id, target?.sectionKey],
  );

  // The lifted copy grows a touch, unless Reduce Motion is on.
  const reduce = useReducedMotion();
  const lift = reduce ? 1 : 1.02;
  const ghostStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ghostTop.value - (active?.rootY ?? 0) }, { scale: lift }],
  }));

  return (
    <Context.Provider value={value}>
      <View ref={root} style={styles.root} collapsable={false}>
        {children}
        {active ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {line !== null ? (
              <View
                style={[
                  styles.line,
                  {
                    top: line - active.rootY - 1,
                    left: active.rect.x - active.rootX,
                    width: active.rect.width,
                    backgroundColor: theme.accent,
                  },
                ]}
              />
            ) : null}
            <Animated.View
              style={[
                styles.ghost,
                {
                  left: active.rect.x - active.rootX,
                  width: active.rect.width,
                  backgroundColor: theme.surface,
                  borderColor: theme.accent,
                },
                ghostStyle,
              ]}
            >
              {renderGhost(active.id)}
            </Animated.View>
          </View>
        ) : null}
      </View>
    </Context.Provider>
  );
}

/** A section a row can be dropped in: whether a drag is over it, so it
 *  draws itself as the target, and the ref callback for its view. */
export function useDropTarget(key: string, rowIds: readonly string[]): [over: boolean, attach: (node: View | null) => void] {
  const ctx = useContext(Context);
  const [node, attach] = useState<View | null>(null);
  const register = ctx?.registerSection;
  const ids = rowIds.join("|");
  useEffect(() => {
    if (!register) return;
    register(key, { node, rowIds: ids === "" ? [] : ids.split("|") });
    return () => register(key, null);
  }, [register, key, node, ids]);
  return [ctx?.overKey === key, attach];
}

/**
 * A row you can hold and drag. Holding without moving runs `onHold`
 * (the row's menu); a quick tap still reaches the row underneath.
 */
export function DragRow({
  id,
  sectionKey,
  enabled,
  onHold,
  children,
}: {
  id: string;
  sectionKey: string;
  enabled: boolean;
  onHold?: () => void;
  children: ReactNode;
}) {
  const ctx = useContext(Context);
  const grab = useSharedValue(0);
  const [node, attach] = useState<View | null>(null);
  const register = ctx?.registerRow;
  useEffect(() => {
    if (!register || !node) return;
    register(id, node, onHold);
    return () => register(id, null);
  }, [register, id, node, onHold]);

  const begin = ctx?.start;
  const step = ctx?.move;
  const end = ctx?.finish;
  const cancel = ctx?.cancel;
  const ghostTop = ctx?.ghostTop;

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled && ctx !== null)
        .activateAfterLongPress(350)
        .onStart((e) => {
          "worklet";
          grab.set(e.y);
          ghostTop?.set(e.absoluteY - e.y);
          if (begin) runOnJS(begin)(id, sectionKey);
        })
        .onUpdate((e) => {
          "worklet";
          ghostTop?.set(e.absoluteY - grab.value);
          if (step) runOnJS(step)(e.absoluteY);
        })
        .onEnd((e) => {
          "worklet";
          if (end) runOnJS(end)(Math.hypot(e.translationX, e.translationY));
        })
        .onFinalize((_e, success) => {
          "worklet";
          if (!success && cancel) runOnJS(cancel)();
        }),
    [enabled, ctx, grab, ghostTop, begin, step, end, cancel, id, sectionKey],
  );

  const lifted = ctx?.activeId === id;
  return (
    <GestureDetector gesture={pan}>
      <View
        ref={attach}
        collapsable={false}
        style={lifted ? styles.lifted : null}
      >
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  line: { position: "absolute", height: 2, borderRadius: 1 },
  ghost: {
    position: "absolute",
    top: 0,
    borderRadius: radius.md,
    // An accent edge rather than a shadow: DESIGN.md keeps shadows out
    // of the app, and the outline matches the section it's over.
    borderWidth: 1.5,
  },
  lifted: { opacity: 0.3 },
});
