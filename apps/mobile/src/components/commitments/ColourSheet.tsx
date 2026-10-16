/**
 * Choosing a colour for a commitment (ADR-0043 §4): the 12 palette
 * colours, plus Automatic, which goes back to the area's colour.
 *
 * Picking one saves and closes, like iOS's own colour choices for a
 * Reminders list: there's nothing else on the sheet to confirm. The
 * colour is presentation only and never changes a score (ADR-0021).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { PALETTE, PALETTE_KEYS, isPaletteKey, type PaletteKey } from "../../theme/palette";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";

interface ColourSheetProps {
  visible: boolean;
  /** The current palette key, or null for Automatic. */
  value: string | null;
  /** What Automatic gives, as shown now. */
  automaticHue: string;
  /** Whose colour Automatic borrows: "its area" for a commitment, the
   *  commitment's name for a sub-commitment. */
  automaticFrom: string;
  theme: ThemeTokens;
  /** Saves the choice. The sheet closes once it resolves. */
  onPick: (colour: PaletteKey | null) => Promise<void>;
  onClose: () => void;
  /** After it has finished closing (`NativeSheet`). */
  onDismissed?: () => void;
}

export function ColourSheet({
  visible,
  value,
  automaticHue,
  automaticFrom,
  theme,
  onPick,
  onClose,
  onDismissed,
}: ColourSheetProps) {
  const current = isPaletteKey(value) ? value : null;
  /** One save at a time: a second tap mid-save is ignored, so two
   *  writes can't race to be the last one. */
  const [saving, setSaving] = useState(false);
  const pick = async (colour: PaletteKey | null) => {
    if (saving) return;
    setSaving(true);
    try {
      await onPick(colour);
    } finally {
      setSaving(false);
    }
  };

  return (
    <NativeSheet onDismissed={onDismissed} visible={visible} onClose={onClose} title="Colour">
      <View style={styles.grid} accessibilityRole="radiogroup">
        <Swatch
          label="Automatic"
          hue={automaticHue}
          selected={current === null}
          onPress={() => void pick(null)}
          theme={theme}
        />
        {PALETTE_KEYS.map((key) => (
          <Swatch
            key={key}
            label={PALETTE[key].name}
            hue={PALETTE[key][theme.name]}
            selected={current === key}
            onPress={() => void pick(key)}
            theme={theme}
          />
        ))}
      </View>
      <AppText variant="footnote" color={theme.muted}>
        Automatic uses {automaticFrom}’s colour.
      </AppText>
    </NativeSheet>
  );
}

function Swatch({
  label,
  hue,
  selected,
  onPress,
  theme,
}: {
  label: string;
  hue: string;
  selected: boolean;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.swatch, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View
        style={[
          styles.ring,
          { borderColor: selected ? theme.ink : "transparent" },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: hue }]}>
          {selected ? (
            <Ionicons name="checkmark" size={20} color={theme.onAccent} importantForAccessibility="no" />
          ) : null}
        </View>
      </View>
      <AppText variant="footnote" color={theme.muted} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const DOT = 40;

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.md },
  swatch: { width: "20%", alignItems: "center", gap: space.xs, minHeight: 44 },
  ring: {
    width: DOT + 8,
    height: DOT + 8,
    borderRadius: (DOT + 8) / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
