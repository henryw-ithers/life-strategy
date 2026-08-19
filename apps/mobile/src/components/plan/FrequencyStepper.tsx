/**
 * How often a task happens: once every two weeks through every day.
 *
 * **A stepper since 2026-08-18**, where it used to be a scroll wheel.
 * The wheel stood 120pt tall to carry a single integer between 0 and
 * 7 — more than the name field and the unit row put together, and the
 * largest element in a sheet that asks five questions. It was the
 * reason the last two questions sat below the fold on every phone.
 *
 * A stepper is also the truer shape for the value. Frequency is a
 * magnitude you nudge, not a set you pick from, and the sheet's three
 * other controls are already chip rows: a fourth would have made four
 * different questions look like one question repeated.
 *
 * The track deliberately matches `PartOfDayPicker`'s — same 3pt inset,
 * same 44pt inner height, same radius and surface fill — so the two
 * controls in this block read as one family rather than two borrowed
 * widgets.
 *
 * No area hue here. The glyphs are inline actions, and DESIGN.md keeps
 * those on Ink or the brand teal: four of the six area hues are under
 * AA at this size in light theme. Colour arrives in this block through
 * the chips below, which carry it as a wash.
 */
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import {
  clampFrequency,
  formatFrequency,
  MAX_TIMES_PER_WEEK,
  MIN_TIMES_PER_WEEK,
  stepFrequency,
} from "./frequency";

interface FrequencyStepperProps {
  /** 0 is once a fortnight; 1 through 7 are times a week. */
  value: number;
  onChange: (timesPerWeek: number) => void;
  theme: ThemeTokens;
}

export function FrequencyStepper({
  value,
  onChange,
  theme,
}: FrequencyStepperProps) {
  const current = clampFrequency(value);

  const step = (direction: 1 | -1) => {
    const next = stepFrequency(current, direction);
    // At either end: no write, and no haptic either. A tick that
    // reports a change which did not happen is worse than silence.
    if (next === current) return;
    void Haptics.selectionAsync();
    onChange(next);
  };

  return (
    /* One adjustable control to a screen reader, not three nodes.
       `accessible` collapses the children, which is what a stepper
       should be: swipe up and down to change it, as the wheel was. */
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="How often"
      accessibilityValue={{ text: formatFrequency(current) }}
      accessibilityActions={[
        { name: "increment", label: "More often" },
        { name: "decrement", label: "Less often" },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment") step(1);
        if (e.nativeEvent.actionName === "decrement") step(-1);
      }}
      style={[styles.track, { backgroundColor: theme.surface }]}
    >
      <StepButton
        glyph="−"
        hint="Less often"
        atEnd={current === MIN_TIMES_PER_WEEK}
        onPress={() => step(-1)}
        theme={theme}
      />
      <AppText variant="label" color={theme.ink} style={styles.value}>
        {formatFrequency(current)}
      </AppText>
      <StepButton
        glyph="+"
        hint="More often"
        atEnd={current === MAX_TIMES_PER_WEEK}
        onPress={() => step(1)}
        theme={theme}
      />
    </View>
  );
}

/**
 * One end of the stepper.
 *
 * At the end of the range it dims and stops responding, rather than
 * disappearing: a control that loses half its shape at the extremes
 * makes the row jump under the finger still using it.
 */
function StepButton({
  glyph,
  hint,
  atEnd,
  onPress,
  theme,
}: {
  glyph: string;
  hint: string;
  atEnd: boolean;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={atEnd}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ disabled: atEnd }}
      style={({ pressed }) => [
        styles.step,
        // 0.4 is the system's disabled step for secondary controls;
        // 0.55 its pressed step for quiet ones (DESIGN.md, Buttons).
        { opacity: atEnd ? 0.4 : pressed ? 0.55 : 1 },
      ]}
    >
      <AppText variant="title" color={theme.ink} style={styles.glyph}>
        {glyph}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** 3 + 44 + 3 = 50pt, the same overall height as the part-of-day
   *  track it sits above. */
  track: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    padding: 3,
  },
  /** 44pt square: the HIG floor, and the reason the glyphs can be
   *  small without the targets being small. */
  step: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  value: { flex: 1, textAlign: "center" },
  /** The line box, not the glyph, decides the row height; pinning it
   *  keeps "+" and "−" on the same baseline as the value between them. */
  glyph: { lineHeight: 24 },
});
