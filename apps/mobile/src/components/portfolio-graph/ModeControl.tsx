import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import type { GraphMode } from "./types";

const MODES: { key: GraphMode; label: string }[] = [
  { key: "now", label: "Now" },
  { key: "compare", label: "Compare" },
  { key: "playback", label: "Playback" },
];

interface ModeControlProps {
  mode: GraphMode;
  onChange: (mode: GraphMode) => void;
  /** Compare/playback need history; disabled with a single snapshot. */
  historyAvailable: boolean;
  theme: ThemeTokens;
}

export function ModeControl({
  mode,
  onChange,
  historyAvailable,
  theme,
}: ModeControlProps) {
  return (
    <View style={[styles.track, { backgroundColor: theme.surface }]}>
      {MODES.map(({ key, label }) => {
        const active = mode === key;
        const disabled = key !== "now" && !historyAvailable;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${label} view`}
            accessibilityState={{ selected: active, disabled }}
            style={[
              styles.segment,
              active && {
                backgroundColor: theme.canvas,
                borderColor: theme.hairline,
                borderWidth: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: active ? theme.ink : theme.muted },
                disabled && styles.disabled,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.4 },
});
