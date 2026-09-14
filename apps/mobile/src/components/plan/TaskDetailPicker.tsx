/**
 * The three things the app never asks for: a clock time, a size, and
 * whether the task pays part credit.
 *
 * **Collapsed until you open it, and it never opens itself.** ADR-0030
 * §2 makes the defaults load-bearing — `anytime`, part-of-day, no time,
 * no size — because they are now the only place the product's opinion
 * about granularity lives (PRODUCT.md principle 6). A block that
 * unfolded three extra questions in front of every new task would erase
 * that opinion without any decision being taken, so this is one row
 * until it is asked for.
 *
 * **But nothing set here is ever hidden.** The closed row states what
 * it holds — `09:00–10:30 · Big · Part credit` — so a person never has
 * to open a disclosure to find out whether they left something in it.
 * A collapsed control that conceals its own value is how settings go
 * stale.
 *
 * Times are integer minutes from local midnight, matching the column
 * and the window math; `formatMinutes` is the app's one time format.
 */
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatMinutes, type TaskSize } from "@glide/scoring";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Segmented } from "./Segmented";

export interface TaskDetail {
  /** Minutes from local midnight, or null for no clock time. */
  startMinute: number | null;
  endMinute: number | null;
  /** Null is unsized, a first-class state (ADR-0026 §1). */
  size: TaskSize | null;
  allowsPartial: boolean;
}

export const NO_DETAIL: TaskDetail = {
  startMinute: null,
  endMinute: null,
  size: null,
  allowsPartial: false,
};

const SIZES = [
  { value: "quick" as const, label: "Quick" },
  { value: "normal" as const, label: "Normal" },
  { value: "big" as const, label: "Big" },
  { value: null, label: "Unsized" },
];

const SIZE_LABEL: Record<TaskSize, string> = {
  quick: "Quick",
  normal: "Normal",
  big: "Big",
};

/** The shortest range the end picker will leave you with. */
const MIN_SPAN = 15;

/** What the closed row says it holds. Null when it holds nothing. */
export function detailSummary(d: TaskDetail): string | null {
  const parts = [
    d.startMinute !== null
      ? d.endMinute !== null
        ? `${formatMinutes(d.startMinute)}–${formatMinutes(d.endMinute)}`
        : formatMinutes(d.startMinute)
      : null,
    d.size !== null ? SIZE_LABEL[d.size] : null,
    d.allowsPartial ? "Part credit" : null,
  ].filter((x): x is string => x !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

interface TaskDetailPickerProps {
  value: TaskDetail;
  onChange: (next: TaskDetail) => void;
  /**
   * False for a one-off, which already answers "how big" in its own
   * block and prices itself from that answer. Two size controls in one
   * sheet would be two answers to one question.
   */
  showSize?: boolean;
  accent: string;
  theme: ThemeTokens;
}

export function TaskDetailPicker({
  value,
  onChange,
  showSize = true,
  accent,
  theme,
}: TaskDetailPickerProps) {
  const summary = detailSummary(value);
  // Opens showing what it already holds, so editing an existing time
  // is one tap rather than two. A new task's is always null, so this
  // never opens itself unasked.
  const [open, setOpen] = useState(summary !== null);
  const [picking, setPicking] = useState<"start" | "end" | null>(null);

  /** Moving the start drags the end with it, keeping the span — the
   *  behaviour every calendar has, and the one that does not quietly
   *  shorten a block you already sized. */
  const setStart = (m: number) => {
    const span =
      value.startMinute !== null && value.endMinute !== null
        ? value.endMinute - value.startMinute
        : null;
    onChange({
      ...value,
      startMinute: m,
      endMinute: span === null ? value.endMinute : Math.min(1439, m + span),
    });
  };

  const setEnd = (m: number) => {
    const floor = value.startMinute === null ? 0 : value.startMinute + MIN_SPAN;
    onChange({ ...value, endMinute: Math.min(1439, Math.max(m, floor)) });
  };

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          summary === null ? "Detail, nothing set" : `Detail, ${summary}`
        }
        accessibilityHint="A time, a size, and part credit"
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.6 : 1 }]}
      >
        <AppText variant="caption" color={theme.muted} style={styles.grow}>
          Detail
        </AppText>
        {!open && summary !== null ? (
          <AppText variant="caption" color={theme.ink} numberOfLines={1}>
            {summary}
          </AppText>
        ) : null}
        {!open && summary === null ? (
          <AppText variant="caption" color={theme.muted}>
            A time, a size, part credit
          </AppText>
        ) : null}
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.muted}
          importantForAccessibility="no"
        />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <ValueRow
            label="Starts"
            empty="No time"
            value={
              value.startMinute === null ? null : formatMinutes(value.startMinute)
            }
            onPress={() => setPicking("start")}
            // Clearing a start clears the end too: an end on its own is
            // not a block, and the grid would have nothing to draw.
            onClear={() =>
              onChange({ ...value, startMinute: null, endMinute: null })
            }
            theme={theme}
          />
          {value.startMinute !== null ? (
            <ValueRow
              label="Ends"
              empty="Open-ended"
              value={
                value.endMinute === null ? null : formatMinutes(value.endMinute)
              }
              onPress={() => setPicking("end")}
              onClear={() => onChange({ ...value, endMinute: null })}
              theme={theme}
            />
          ) : null}

          {showSize ? (
            <View style={styles.block}>
              <View style={styles.blockHeader}>
                <AppText variant="caption" color={theme.muted}>
                  How big
                </AppText>
                {/* Says what size is for, because the obvious guess —
                    that a bigger task is worth more — is wrong here
                    (ADR-0026 §2) and would be a disappointment found
                    out later. */}
                <AppText variant="footnote" color={theme.muted}>
                  Shapes your day, not your points
                </AppText>
              </View>
              <Segmented
                segments={SIZES}
                value={value.size}
                onChange={(size) => onChange({ ...value, size })}
                accent={accent}
                theme={theme}
                label="How big"
              />
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <View style={styles.grow}>
              <AppText color={theme.ink}>Part credit</AppText>
              <AppText variant="footnote" color={theme.muted}>
                Log a quarter, a half or three quarters of it and be paid
                for that much.
              </AppText>
            </View>
            <Switch
              value={value.allowsPartial}
              onValueChange={(allowsPartial) =>
                onChange({ ...value, allowsPartial })
              }
              trackColor={{ true: accent }}
              accessibilityLabel="Part credit"
            />
          </View>
        </View>
      ) : null}

      {picking !== null ? (
        <DateTimePicker
          value={minutesToDate(
            (picking === "start" ? value.startMinute : value.endMinute) ??
              defaultFor(picking, value),
          )}
          mode="time"
          display="spinner"
          minuteInterval={5}
          onChange={(_event, next) => {
            const which = picking;
            setPicking(null);
            if (!next || which === null) return;
            const m = next.getHours() * 60 + next.getMinutes();
            if (which === "start") setStart(m);
            else setEnd(m);
          }}
        />
      ) : null}
    </View>
  );
}

/** Where an unset picker opens: 9am for a start, half an hour past the
 *  start for an end, so neither lands on a value you must scroll away
 *  from before you can pick one. */
function defaultFor(which: "start" | "end", d: TaskDetail): number {
  if (which === "start") return 9 * 60;
  return Math.min(1439, (d.startMinute ?? 9 * 60) + 30);
}

function minutesToDate(minutes: number): Date {
  const at = new Date();
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return at;
}

/**
 * One value, set or unset — the same row `OneOffPicker` uses for its
 * dates, so a task's times and its dates are set the same way.
 */
function ValueRow({
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
    <View style={styles.valueRow}>
      <AppText color={theme.ink} style={styles.grow}>
        {label}
      </AppText>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value ?? empty}`}
        style={({ pressed }) => [
          styles.chip,
          { borderColor: theme.hairline, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <AppText variant="caption" color={value ? theme.ink : theme.muted} tabular>
          {value ?? empty}
        </AppText>
      </Pressable>
      {value !== null ? (
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
  root: { gap: space.sm },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 44,
  },
  body: { gap: space.md },
  block: { gap: space.sm },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 44,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
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
