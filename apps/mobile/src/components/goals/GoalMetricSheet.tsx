/**
 * Give a goal a number and a rough horizon (ADR-0015 §§1, 4).
 *
 * **A month chooser, never a date picker and never a time.** Month
 * granularity is structural rather than a matter of discipline: this
 * app plans roughly and owns no clocks (ADR-0024 §1), and a goal
 * deadline is the longest-horizon commitment in the product — the last
 * place precision earns its keep. With no day field to fill in, there
 * is nothing to be tempted by later.
 */
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MetricKind } from "@glide/scoring";
import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const KINDS: { kind: MetricKind; label: string; hint: string }[] = [
  {
    kind: "cumulative",
    label: "Adds up",
    hint: "Readings sum toward a total. 24 books, 100 hours.",
  },
  {
    kind: "target",
    label: "Reaches a number",
    hint: "You log where you are. 225 lb, 80 kg. Which way it goes is worked out from your first reading.",
  },
];

export interface MetricDraft {
  kind: MetricKind;
  unit: string;
  targetValue: number;
}

interface GoalMetricSheetProps {
  visible: boolean;
  metric: MetricDraft | null;
  /** `'YYYY-MM'`, or null for no deadline. */
  targetDate: string | null;
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  onSave: (metric: MetricDraft | null, targetDate: string | null) => void;
}

export function GoalMetricSheet({
  visible,
  metric,
  targetDate,
  accent,
  theme,
  onClose,
  onSave,
}: GoalMetricSheetProps) {
  const insets = useSafeAreaInsets();
  const thisYear = new Date().getFullYear();

  const [kind, setKind] = useState<MetricKind | null>(metric?.kind ?? null);
  const [unit, setUnit] = useState(metric?.unit ?? "");
  const [target, setTarget] = useState(
    metric ? String(metric.targetValue) : "",
  );
  const [year, setYear] = useState(
    targetDate ? Number(targetDate.slice(0, 4)) : thisYear,
  );
  const [month, setMonth] = useState<number | null>(
    targetDate ? Number(targetDate.slice(5, 7)) : null,
  );

  const targetNumber = Number(target);
  const metricValid =
    kind !== null && unit.trim().length > 0 && Number.isFinite(targetNumber);
  // A half-filled metric is the only unsavable state: no metric at all
  // is a legitimate goal (ADR-0015 §1's null kind), and so is a metric
  // with no deadline.
  const savable = kind === null || metricValid;

  const save = () => {
    if (!savable) return;
    onSave(
      kind === null
        ? null
        : { kind, unit: unit.trim(), targetValue: targetNumber },
      month === null ? null : `${year}-${String(month).padStart(2, "0")}`,
    );
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.canvas,
              borderColor: theme.hairline,
              paddingBottom: insets.bottom + space.lg,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.hairline }]} />
          <AppText variant="title" color={theme.ink}>
            Measure this goal
          </AppText>

          <ScrollView
            style={styles.scroller}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.block}>
              <AppText variant="caption" color={theme.muted}>
                How it's counted
              </AppText>
              {KINDS.map((k) => {
                const on = kind === k.kind;
                return (
                  <Pressable
                    key={k.kind}
                    onPress={() => setKind(on ? null : k.kind)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${k.label}. ${k.hint}`}
                    style={[
                      styles.kindRow,
                      {
                        backgroundColor: theme.surface,
                        borderColor: on ? accent : "transparent",
                      },
                    ]}
                  >
                    <AppText variant="label" color={on ? accent : theme.ink}>
                      {k.label}
                    </AppText>
                    <AppText variant="footnote" color={theme.muted}>
                      {k.hint}
                    </AppText>
                  </Pressable>
                );
              })}
              {kind !== null ? (
                <AppText variant="footnote" color={theme.muted}>
                  Tap again to remove the measure and keep this a plain goal.
                </AppText>
              ) : null}
            </View>

            {kind !== null ? (
              <View style={styles.block}>
                <AppText variant="caption" color={theme.muted}>
                  Target
                </AppText>
                <View style={styles.pair}>
                  <TextInput
                    value={target}
                    onChangeText={setTarget}
                    placeholder="24"
                    placeholderTextColor={theme.muted}
                    keyboardType="numeric"
                    accessibilityLabel="Target number"
                    style={[
                      styles.input,
                      styles.number,
                      { backgroundColor: theme.surface, color: theme.ink },
                    ]}
                  />
                  <TextInput
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="books"
                    placeholderTextColor={theme.muted}
                    autoCapitalize="none"
                    accessibilityLabel="What the number counts"
                    style={[
                      styles.input,
                      styles.flex,
                      { backgroundColor: theme.surface, color: theme.ink },
                    ]}
                  />
                </View>
              </View>
            ) : null}

            <View style={styles.block}>
              <View style={styles.head}>
                <AppText variant="caption" color={theme.muted}>
                  By when (optional)
                </AppText>
                {month !== null ? (
                  <Pressable
                    onPress={() => setMonth(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Clear the deadline"
                    hitSlop={8}
                  >
                    <AppText variant="caption" color={accent}>
                      Clear
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.yearRow}>
                {[thisYear, thisYear + 1, thisYear + 2].map((y) => {
                  const on = y === year;
                  return (
                    <Pressable
                      key={y}
                      onPress={() => setYear(y)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={String(y)}
                      style={[
                        styles.yearChip,
                        {
                          backgroundColor: on ? accent : theme.surface,
                          borderColor: on ? accent : theme.hairline,
                        },
                      ]}
                    >
                      <AppText variant="caption" color={on ? theme.onAccent : theme.ink} tabular>
                        {y}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.monthGrid}>
                {MONTHS.map((label, i) => {
                  const value = i + 1;
                  const on = month === value;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => setMonth(on ? null : value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${label} ${year}`}
                      style={[
                        styles.monthChip,
                        {
                          backgroundColor: on ? accent : theme.surface,
                          borderColor: on ? accent : "transparent",
                        },
                      ]}
                    >
                      <AppText variant="caption" color={on ? theme.onAccent : theme.ink}>
                        {label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              {/* A passed date changes nothing anywhere — no badge, no
                  colour, no prompt (ADR-0015 §4). Saying so up front is
                  what makes setting one safe. */}
              <AppText variant="footnote" color={theme.muted}>
                A month, not a day. Nothing happens if it passes — it comes up
                when you next review your goals.
              </AppText>
            </View>
          </ScrollView>

          <Button
            label="Save"
            color={accent}
            disabled={!savable}
            onPress={save}
            theme={theme}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: SCRIM },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.sm + 2,
    gap: space.lg,
    maxHeight: "88%",
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  scroller: { flexGrow: 0 },
  body: { gap: space.lg, paddingBottom: space.xs },
  block: { gap: space.sm },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  kindRow: {
    gap: 2,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  pair: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
  number: { width: 96 },
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  yearRow: { flexDirection: "row", gap: space.sm },
  yearChip: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  monthChip: {
    // Four across at any phone width, without a breakpoint.
    flexGrow: 1,
    flexBasis: "22%",
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
