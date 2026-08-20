/**
 * The three questions a one-off asks: how big, when you mean to do it,
 * and whether it has a deadline.
 *
 * **Only the size is required**, and it defaults. A one-off with no day
 * and no deadline is a legitimate and common thing — "sort out the
 * bike" — and it simply sits on the checklist until it is done. Forcing
 * a date onto it would make the app ask for a decision the person has
 * not made.
 *
 * **Size is safe here in a way it would not be on a recurring task.**
 * A repeating task with a self-declared size is a dial for inflating
 * your own score forever; a one-off is finite, and `computeDayScore`
 * caps what the variable band pays at 20 regardless. It is priced at
 * its share of the unit's own variable budget, so "big" is worth about
 * what a week of planned work in that part of life is worth.
 *
 * **The deadline never scolds.** It is shown, it is never coloured as
 * an alarm, and it takes nothing away when it passes — PRODUCT.md rules
 * out loss-aversion tricks, and a to-do that turns red is exactly that.
 * It exists so that letting something roll forward has a visible edge.
 */
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Segmented } from "./Segmented";

export type OneOffSize = "quick" | "normal" | "big";

interface OneOffPickerProps {
  size: OneOffSize;
  onSizeChange: (next: OneOffSize) => void;
  /** `YYYY-MM-DD`, or null for "no particular day". */
  date: string | null;
  onDateChange: (next: string | null) => void;
  due: string | null;
  onDueChange: (next: string | null) => void;
  accent: string;
  theme: ThemeTokens;
}

const SIZES = [
  { value: "quick" as const, label: "Quick" },
  { value: "normal" as const, label: "Normal" },
  { value: "big" as const, label: "Big" },
];

/** `YYYY-MM-DD` → "Tue 25 Aug". Local, never parsed through Date's
 *  timezone-shifting string constructor (ADR-0002). */
function pretty(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const at = new Date(y!, m! - 1, d!);
  return at.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function toLocalDate(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(
    at.getDate(),
  ).padStart(2, "0")}`;
}

export function OneOffPicker({
  size,
  onSizeChange,
  date,
  onDateChange,
  due,
  onDueChange,
  accent,
  theme,
}: OneOffPickerProps) {
  const [picking, setPicking] = useState<"date" | "due" | null>(null);

  return (
    <View style={styles.root}>
      <View style={styles.block}>
        <AppText variant="caption" color={theme.muted}>
          How big
        </AppText>
        <Segmented
          segments={SIZES}
          value={size}
          onChange={onSizeChange}
          accent={accent}
          theme={theme}
          label="How big"
        />
      </View>

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <AppText variant="caption" color={theme.muted}>
            When
          </AppText>
          <AppText variant="footnote" color={theme.muted}>
            Both optional
          </AppText>
        </View>

        <DateRow
          label="Do it on"
          empty="No particular day"
          value={date}
          onPress={() => setPicking("date")}
          onClear={() => onDateChange(null)}
          theme={theme}
        />
        <DateRow
          label="Due by"
          empty="No deadline"
          value={due}
          onPress={() => setPicking("due")}
          onClear={() => onDueChange(null)}
          theme={theme}
        />
      </View>

      {picking !== null ? (
        <DateTimePicker
          value={
            (picking === "date" ? date : due)
              ? new Date(`${picking === "date" ? date : due}T12:00:00`)
              : new Date()
          }
          mode="date"
          display="spinner"
          onChange={(_event, next) => {
            const which = picking;
            setPicking(null);
            if (!next || which === null) return;
            const local = toLocalDate(next);
            if (which === "date") onDateChange(local);
            else onDueChange(local);
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * One date, set or unset.
 *
 * The clear control only exists once there is something to clear, so an
 * untouched row is a single tap target rather than a control with a
 * dead button beside it.
 */
function DateRow({
  label,
  empty,
  value,
  onPress,
  onClear,
  theme,
}: {
  label: string;
  empty: string;
  value: string | null;
  onPress: () => void;
  onClear: () => void;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.dateRow}>
      <AppText color={theme.ink} style={styles.grow}>
        {label}
      </AppText>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}, ${pretty(value)}` : `${label}, ${empty}`}
        style={({ pressed }) => [
          styles.chip,
          { borderColor: theme.hairline, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <AppText variant="caption" color={value ? theme.ink : theme.muted}>
          {value ? pretty(value) : empty}
        </AppText>
      </Pressable>
      {value ? (
        <Pressable
          onPress={onClear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Clear ${label}`}
          style={({ pressed }) => [styles.clear, { opacity: pressed ? 0.5 : 1 }]}
        >
          <AppText variant="caption" color={theme.muted}>
            Clear
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  block: { gap: space.sm },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 44,
  },
  grow: { flex: 1 },
  chip: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  clear: { minHeight: 32, justifyContent: "center" },
});
