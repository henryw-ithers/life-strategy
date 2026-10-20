/**
 * How long a repeating event runs (ADR-0040 §1; spec §5.8): "For N
 * weeks", "Until a date" or "No end". "For N weeks" is saved as a date
 * (`untilForWeeks`), counting the first partial week as week 1 (EC-21).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { addDays, untilForWeeks } from "@glide/scoring";
import { Pressable, StyleSheet, View } from "react-native";

import type { Bounds } from "../../db/seriesRules";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { DayField } from "../ui/DateTimeField";
import { Segmented } from "./Segmented";

export type RepeatLengthValue =
  | { mode: "weeks"; weeks: number }
  | { mode: "until"; until: string }
  | { mode: "none" };

export const MAX_WEEKS = 52;

const MODES = [
  { value: "weeks" as const, label: "For weeks" },
  { value: "until" as const, label: "Until a date" },
  { value: "none" as const, label: "No end" },
];

/**
 * The bounds a choice saves. `repeatFrom` is kept as it is, null for a
 * series that has always run; weeks are counted from `countFrom`, its
 * start or today. A chosen last day before `earliestEnd` (its start, and
 * never before yesterday: past days keep their plan) is moved to it.
 */
export function boundsFor(
  value: RepeatLengthValue,
  repeatFrom: string | null,
  countFrom: string,
  earliestEnd: string = countFrom,
): Bounds {
  switch (value.mode) {
    case "weeks":
      return { repeatFrom, repeatUntil: untilForWeeks(countFrom, value.weeks) };
    case "until":
      return { repeatFrom, repeatUntil: value.until < earliestEnd ? earliestEnd : value.until };
    case "none":
      return { repeatFrom, repeatUntil: null };
  }
}

export function RepeatLength({
  value,
  onChange,
  from,
  accent,
  theme,
}: {
  value: RepeatLengthValue;
  onChange: (next: RepeatLengthValue) => void;
  /** The earliest last day it can have. */
  from: string;
  accent: string;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.wrap}>
      <Segmented
        segments={MODES}
        value={value.mode}
        onChange={(mode) =>
          onChange(
            mode === "weeks"
              ? { mode, weeks: 12 }
              : mode === "until"
                ? { mode, until: addDays(from, 12 * 7 - 1) }
                : { mode },
          )
        }
        accent={accent}
        theme={theme}
        label="How long it repeats"
      />
      {value.mode === "weeks" ? (
        <View style={[styles.stepper, { backgroundColor: theme.surface }]}>
          <Step
            icon="remove"
            label="One week fewer"
            atEnd={value.weeks <= 1}
            onPress={() => onChange({ mode: "weeks", weeks: value.weeks - 1 })}
            theme={theme}
          />
          {/* One adjustable control for VoiceOver (swipe up or down), as
              iOS steppers are; the buttons either side stay for touch. */}
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Weeks"
            accessibilityValue={{ text: value.weeks === 1 ? "1 week" : `${value.weeks} weeks` }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(e) => {
              const next =
                e.nativeEvent.actionName === "increment" ? value.weeks + 1 : value.weeks - 1;
              if (next >= 1 && next <= MAX_WEEKS) onChange({ mode: "weeks", weeks: next });
            }}
            style={styles.count}
          >
            <AppText color={theme.ink} tabular style={styles.countText}>
              {value.weeks === 1 ? "1 week" : `${value.weeks} weeks`}
            </AppText>
          </View>
          <Step
            icon="add"
            label="One week more"
            atEnd={value.weeks >= MAX_WEEKS}
            onPress={() => onChange({ mode: "weeks", weeks: value.weeks + 1 })}
            theme={theme}
          />
        </View>
      ) : value.mode === "until" ? (
        <View style={styles.row}>
          <AppText color={theme.ink} style={styles.grow}>
            Last day
          </AppText>
          <DayField
            date={value.until < from ? from : value.until}
            onChange={(until) => onChange({ mode: "until", until })}
            label="Last day"
            accent={accent}
            theme={theme}
          />
        </View>
      ) : null}
    </View>
  );
}

function Step({
  icon,
  label,
  atEnd,
  onPress,
  theme,
}: {
  icon: "add" | "remove";
  label: string;
  atEnd: boolean;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={atEnd}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: atEnd }}
      style={({ pressed }) => [styles.step, { opacity: atEnd ? 0.4 : pressed ? 0.55 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={theme.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  stepper: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, padding: 3 },
  step: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  count: { flex: 1 },
  countText: { textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md },
  grow: { flex: 1 },
});
