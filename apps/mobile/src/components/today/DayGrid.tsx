/**
 * The day as hours: what is fixed, what is free, and what has no time.
 *
 * **Read-only for arrangement, and that is a decision.** Nothing here
 * drags. Dragging a block would say the thing moved, and the whole
 * point of a timed task is that its time is a fact about the day
 * rather than a preference about the list. Rearranging is what the
 * List view is for, and the toggle sits two taps away in the header.
 *
 * **Free time is shown, never filled.** A gap is drawn as an unfilled
 * band saying how long it is. No backwards planning, no auto
 * placement, no suggestion about what to put there — a planner that
 * fills your gaps for you is the project-management tool PRODUCT.md
 * names as an anti-reference.
 *
 * **Untimed work is not hidden.** A task with no clock time is the
 * default and not a lesser state (ADR-0030 §1), so it sits below the
 * grid as a row of chips rather than being dropped from the view or
 * quietly given a time. A day where nothing is timed draws the ruler
 * and puts everything there, which reads as an open day rather than a
 * broken screen.
 *
 * Blocks are a **wash with an Ink label**, never a solid hue behind
 * small text: four of the six area hues fall under AA that way in
 * light theme (DESIGN.md, Colors).
 */
import {
  formatMinutes,
  MIN_WINDOW_MINUTES,
  windowsFor,
  type Window,
} from "@glide/scoring";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { TodayTask } from "../../db/today";
import { wash, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import {
  clipWindows,
  formatLength,
  formatSpan,
  gridBounds,
  gridHeight,
  hourHeight,
  hourRows,
  placeBlocks,
  yOf,
} from "./dayGridLayout";

/** What the grid draws when nothing is timed: an ordinary waking day. */
const DEFAULT_SPAN = { start: 7 * 60, end: 22 * 60 };

/**
 * The shortest window the grid will draw, matching the scoring
 * package's own `MIN_WINDOW_MINUTES`. Anything shorter is buffer
 * rather than free time — fifteen minutes between two lectures across
 * campus is not time you have, and a band offering it would lie.
 */
const MIN_GAP = MIN_WINDOW_MINUTES;

/** The hour rail's width, so blocks and labels share one left edge. */
const RAIL = 46;

interface DayGridProps {
  tasks: TodayTask[];
  /** Area hue per task id. */
  hueFor: (task: TodayTask) => string;
  theme: ThemeTokens;
  /** The reader's Dynamic Type scale; hours grow with it. */
  fontScale: number;
  /** Minutes past midnight, or null on a day that is not today. */
  nowMinute: number | null;
  onPress: (task: TodayTask) => void;
  /**
   * Open a window's options (ADR-0033 §2). Omitted on a screen where
   * planning is not the job, and the bands then draw as plain labels
   * rather than as controls that do nothing.
   */
  onPlanWindow?: (window: Window, pooled: string[]) => void;
  /** Task ids already pooled, keyed by the window they were pooled in. */
  pooledByWindow?: Map<string, string[]>;
}

/** A window's identity: what it follows, or which part of day it is. */
export function windowKey(w: { afterTaskId: string | null; partOfDay: string | null }): string {
  return `${w.afterTaskId ?? ""}|${w.partOfDay ?? ""}`;
}

export function DayGrid({
  tasks,
  hueFor,
  theme,
  fontScale,
  nowMinute,
  onPress,
  onPlanWindow,
  pooledByWindow,
}: DayGridProps) {
  const timed = tasks.filter(
    (t) => t.startMinute !== null && t.endMinute !== null,
  );
  const untimed = tasks.filter(
    (t) => t.startMinute === null || t.endMinute === null,
  );

  const spans = timed.map((t) => ({
    taskId: t.id,
    startMinute: t.startMinute!,
    endMinute: t.endMinute!,
  }));
  const bounds = gridBounds(
    spans.map((s) => ({ start: s.startMinute, end: s.endMinute })),
    DEFAULT_SPAN,
  );
  const hourPx = hourHeight(fontScale);
  const height = gridHeight(bounds, hourPx);
  const placed = placeBlocks(spans, bounds, hourPx);
  const byId = new Map(timed.map((t) => [t.id, t]));

  // The scoring package's own windows, so what the grid draws and what
  // a pool is priced against cannot drift apart (ADR-0033 §1). On a day
  // with nothing timed those are morning / afternoon / evening, which
  // is the right answer and not a special case.
  const windows = clipWindows(windowsFor(spans), bounds, MIN_GAP);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={{ height: height + space.lg }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={{ height }}>
          {/* The rail. Hour lines run the full width so a block's
              position is readable against them rather than having to
              be judged from the label alone. */}
          {hourRows(bounds).map((h) => (
            <View
              key={h}
              style={[
                styles.hour,
                {
                  top: yOf(h * 60, bounds, hourPx),
                  borderTopColor: theme.hairline,
                },
              ]}
              importantForAccessibility="no-hide-descendants"
            >
              <AppText
                variant="footnote"
                color={theme.muted}
                style={styles.hourLabel}
                tabular
              >
                {formatMinutes(h * 60)}
              </AppText>
            </View>
          ))}

          {/* Everything with a position lives inside one container
              inset past the rail, so a block's percentage width
              divides the space it actually has rather than the whole
              screen. */}
          <View style={styles.lanes}>
            {/* Free time, under the blocks so a block always wins the
                pixel. Stated as a length — what you have, never what
                you ought to put in it. Tapping one opens the options
                for that window and nothing fills it on your behalf. */}
            {windows.map((w) => {
              const top = yOf(w.start, bounds, hourPx);
              const pooled = pooledByWindow?.get(windowKey(w)) ?? [];
              const length = formatLength(w.end - w.start);
              const said = pooled.length > 0
                ? `${pooled.length} ${pooled.length === 1 ? "option" : "options"}`
                : "Free";
              return (
                <Pressable
                  key={`${w.start}-${w.end}`}
                  onPress={
                    onPlanWindow ? () => onPlanWindow(w, pooled) : undefined
                  }
                  disabled={onPlanWindow === undefined}
                  accessibilityRole={onPlanWindow ? "button" : "text"}
                  accessibilityLabel={`${said}, ${length}, ${formatSpan(w.start, w.end, formatMinutes)}${
                    onPlanWindow ? ". Choose what might go here." : ""
                  }`}
                  style={({ pressed }) => [
                    styles.window,
                    {
                      top,
                      height: yOf(w.end, bounds, hourPx) - top,
                      borderColor: pooled.length > 0 ? theme.accent : theme.hairline,
                      borderStyle: pooled.length > 0 ? "solid" : "dashed",
                      opacity: pressed ? 0.5 : 1,
                    },
                  ]}
                >
                  <AppText
                    variant="footnote"
                    color={pooled.length > 0 ? theme.ink : theme.muted}
                    numberOfLines={1}
                  >
                    {said} · {length}
                  </AppText>
                </Pressable>
              );
            })}

            {placed.map((p) => {
              const t = byId.get(p.taskId);
              if (!t) return null;
              const hue = hueFor(t);
              const width = `${100 / p.columns}%` as const;
              const span = formatSpan(t.startMinute!, t.endMinute!, formatMinutes);
              return (
                <Pressable
                  key={p.taskId}
                  onPress={() => onPress(t)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.title}, ${span}${
                    t.completedToday || t.doneAheadOn !== null ? ", done" : ""
                  }`}
                  style={({ pressed }) => [
                    styles.block,
                    {
                      top: p.top,
                      height: p.height,
                      left: `${(100 / p.columns) * p.column}%`,
                      width,
                      backgroundColor: wash(hue, theme),
                      borderLeftColor: hue,
                      opacity: pressed ? 0.6 : t.completedToday || t.doneAheadOn !== null ? 0.55 : 1,
                    },
                  ]}
                >
                  <AppText
                    variant="label"
                    color={theme.ink}
                    numberOfLines={p.height >= 48 ? 2 : 1}
                  >
                    {t.title}
                  </AppText>
                  {/* Only where there is room for it. A second line
                      clipped mid-word is worse than no second line. */}
                  {p.height >= 48 ? (
                    <AppText variant="footnote" color={theme.muted} tabular>
                      {span}
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })}

            {/* Where you are. A line, not a marker that says anything
                about how the day is going. */}
            {nowMinute !== null &&
            nowMinute >= bounds.startHour * 60 &&
            nowMinute <= bounds.endHour * 60 ? (
              <View
                style={[
                  styles.now,
                  { top: yOf(nowMinute, bounds, hourPx), backgroundColor: theme.accent },
                ]}
                importantForAccessibility="no-hide-descendants"
              />
            ) : null}
          </View>
        </View>
      </ScrollView>

      {untimed.length > 0 ? (
        <View style={styles.untimed}>
          <AppText variant="caption" color={theme.muted}>
            No set time
          </AppText>
          <View style={styles.chips}>
            {untimed.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => onPress(t)}
                accessibilityRole="button"
                accessibilityLabel={`${t.title}${t.completedToday || t.doneAheadOn !== null ? ", done" : ""}`}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: theme.surface,
                    borderColor: hueFor(t),
                    opacity: pressed ? 0.6 : t.completedToday || t.doneAheadOn !== null ? 0.5 : 1,
                  },
                ]}
              >
                <AppText variant="caption" color={theme.ink} numberOfLines={1}>
                  {t.title}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  /** Bounded so the grid scrolls inside the page rather than making
   *  the page itself a mile long on a day that runs 6am to midnight. */
  scroller: { maxHeight: 460 },
  hour: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  hourLabel: { marginTop: -7, width: RAIL - space.sm },
  lanes: { position: "absolute", left: RAIL, right: 0, top: 0, bottom: 0 },
  window: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    paddingHorizontal: space.md,
    marginVertical: 2,
  },
  block: {
    position: "absolute",
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    justifyContent: "center",
    gap: 1,
  },
  now: { position: "absolute", left: 0, right: 0, height: 2 },
  untimed: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: 240,
  },
});
