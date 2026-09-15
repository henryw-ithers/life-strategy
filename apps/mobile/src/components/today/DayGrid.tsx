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
import { formatMinutes } from "@glide/scoring";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { TodayTask } from "../../db/today";
import { wash, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import {
  formatLength,
  formatSpan,
  freeGaps,
  gridBounds,
  gridHeight,
  hourHeight,
  hourRows,
  placeBlocks,
  yOf,
} from "./dayGridLayout";

/** What the grid draws when nothing is timed: an ordinary waking day. */
const DEFAULT_SPAN = { start: 7 * 60, end: 22 * 60 };

/** A gap worth naming. Shorter than this is turnaround, not free time. */
const MIN_GAP = 30;

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
}

export function DayGrid({
  tasks,
  hueFor,
  theme,
  fontScale,
  nowMinute,
  onPress,
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

  const gaps = freeGaps(spans, bounds, MIN_GAP);

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
                pixel. Stated as a length, never as an invitation. */}
            {gaps.map((g) => {
              const top = yOf(g.start, bounds, hourPx);
              return (
                <View
                  key={`${g.start}-${g.end}`}
                  style={[
                    styles.gap,
                    {
                      top,
                      height: yOf(g.end, bounds, hourPx) - top,
                      borderColor: theme.hairline,
                    },
                  ]}
                  accessible
                  accessibilityLabel={`Free, ${formatLength(g.end - g.start)}, ${formatSpan(g.start, g.end, formatMinutes)}`}
                >
                  <AppText variant="footnote" color={theme.muted}>
                    Free · {formatLength(g.end - g.start)}
                  </AppText>
              </View>
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
                    t.completedToday ? ", done" : ""
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
                      opacity: pressed ? 0.6 : t.completedToday ? 0.55 : 1,
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
                accessibilityLabel={`${t.title}${t.completedToday ? ", done" : ""}`}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: theme.surface,
                    borderColor: hueFor(t),
                    opacity: pressed ? 0.6 : t.completedToday ? 0.5 : 1,
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
  gap: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
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
