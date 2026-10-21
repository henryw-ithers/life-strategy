/**
 * A commitment's share of the day (ADR-0044 §3, spec §5.5): automatic,
 * worked out from its time each day, or a share you set, which applies
 * to every day it has work. The automatic share always shows beside
 * yours (AGENTS.md: every override displays the recommended value).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { COMMITMENT_BAND_MIN, shareLimit } from "@glide/scoring";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";

const STEP = 5;

interface ShareSheetProps {
  visible: boolean;
  name: string;
  setShare: number | null;
  /** "about 44% on Wednesdays", or null with no work ahead. */
  automatic: string | null;
  commitmentCount: number;
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  onDismissed?: () => void;
  onSave: (share: number | null) => void;
}

export function ShareSheet({
  visible,
  name,
  setShare,
  automatic,
  commitmentCount,
  accent,
  theme,
  onClose,
  onDismissed,
  onSave,
}: ShareSheetProps) {
  const max = shareLimit(Math.max(1, commitmentCount));
  const [own, setOwn] = useState(setShare !== null);
  const [value, setValue] = useState(setShare ?? 40);
  const clamped = Math.min(max, Math.max(COMMITMENT_BAND_MIN, value));

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      title="Share of your day"
      confirm={{ label: "Save", onPress: () => onSave(own ? clamped : null) }}
    >
      <AppText variant="caption" color={theme.muted}>
        {name}&apos;s work is scored from its own share of each day it has work on. Your other units share
        the rest.
      </AppText>

      <Option
        label="Automatic"
        detail={automatic ? `From its time each day: ${automatic}` : "From its time each day"}
        selected={!own}
        onPress={() => setOwn(false)}
        accent={accent}
        theme={theme}
      />
      <Option
        label="Set my own"
        detail={`Your share every day it has work, ${COMMITMENT_BAND_MIN}–${max}%. On a day another commitment has work too, they're scaled to fit together.`}
        selected={own}
        onPress={() => setOwn(true)}
        accent={accent}
        theme={theme}
      />

      {own ? (
        <View style={styles.stepper}>
          <Step icon="remove" label="Less" atEnd={clamped <= COMMITMENT_BAND_MIN} onPress={() => setValue(clamped - STEP)} theme={theme} />
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Your share"
            accessibilityValue={{ text: `${clamped} percent` }}
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(e) =>
              setValue(clamped + (e.nativeEvent.actionName === "increment" ? STEP : -STEP))
            }
            style={styles.value}
          >
            <AppText variant="title" color={theme.ink} tabular>
              {clamped}%
            </AppText>
            {automatic ? (
              <AppText variant="caption" color={theme.muted}>
                auto {automatic}
              </AppText>
            ) : null}
          </View>
          <Step icon="add" label="More" atEnd={clamped >= max} onPress={() => setValue(clamped + STEP)} theme={theme} />
        </View>
      ) : null}
    </NativeSheet>
  );
}

function Option({
  label,
  detail,
  selected,
  onPress,
  accent,
  theme,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  accent: string;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${detail}`}
      style={[styles.option, { borderColor: selected ? accent : theme.hairline }]}
    >
      <AppText variant="label" color={theme.ink}>
        {label}
      </AppText>
      <AppText variant="caption" color={theme.muted}>
        {detail}
      </AppText>
    </Pressable>
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
      <Ionicons name={icon} size={22} color={theme.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: { borderWidth: 1.5, borderRadius: radius.md, padding: space.md, gap: 2, minHeight: 44 },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  step: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  value: { flex: 1, alignItems: "center" },
});
