/**
 * One of the day's tail sections — planned for other days, done this
 * week, completed. Collapsible, and not arrangeable: these are history
 * or another day's business, and dragging them into today would imply
 * they belong to it.
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { type LinearTransition } from "react-native-reanimated";

import type { TodayTask } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Disclosure } from "../ui/Chevron";
import type { DaySection } from "./daySections";

export function TailSection({
  section: s,
  collapsed,
  onToggleCollapsed,
  countOnly,
  renderRow,
  layout,
  theme,
}: {
  section: DaySection;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Its rows are not all loaded, so it states a count, not points. */
  countOnly: boolean;
  renderRow: (task: TodayTask) => ReactNode;
  layout: LinearTransition | undefined;
  theme: ThemeTokens;
}) {
  const showCount = s.count !== undefined && countOnly;
  const summary = showCount
    ? `${s.count} ${s.count === 1 ? "task" : "tasks"}`
    : `${s.pts} pts`;
  return (
    <Animated.View
      layout={layout}
      style={
        s.key === "doneWeek" || s.key === "completed"
          ? [styles.tail, { borderTopColor: theme.hairline }]
          : styles.period
      }
    >
      <Pressable
        onPress={onToggleCollapsed}
        accessibilityRole="button"
        accessibilityState={{ expanded: !collapsed }}
        accessibilityLabel={showCount ? `${s.label}, ${summary}` : `${s.label}, ${s.pts} points`}
        hitSlop={{ top: 6, bottom: 6 }}
        style={styles.header}
      >
        <View style={styles.label}>
          <AppText variant="caption" color={theme.muted}>
            {s.label}
          </AppText>
          <Disclosure open={!collapsed} theme={theme} size={13} />
        </View>
        <AppText variant="caption" color={theme.muted} tabular>
          {summary}
        </AppText>
      </Pressable>
      {collapsed
        ? null
        : s.tasks.map((t) => (
            <Animated.View key={t.id} layout={layout}>
              {renderRow(t)}
            </Animated.View>
          ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** A run of the day: label, then its rows. */
  period: { marginTop: space.lg, gap: space.xs },
  /** Done this week / Completed: the same block with a rule above it,
   *  and more air so the break reads before the line does. */
  tail: {
    marginTop: space.xl,
    paddingTop: space.md,
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 32,
  },
  /** Label and its disclosure travel together as one target. */
  label: { flexDirection: "row", alignItems: "center", gap: 4 },
});
