/**
 * Set your own weight for a unit (ADR-0041 §2). The recommended weight
 * stays on screen beside whatever you type (AGENTS.md: every override
 * shows the recommended value), and "Use recommended" clears it.
 *
 * Nothing is saved here: the board keeps the number, and Done on
 * Priorities saves it with everything else in one snapshot.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { NativeSheet } from "../ui/NativeSheet";
import { TextField } from "../ui/TextField";

interface WeightSheetProps {
  visible: boolean;
  unitName: string;
  recommended: number;
  override: number | null;
  theme: ThemeTokens;
  /** A whole number from 1 to 99, or null for the recommended weight. */
  onSave: (override: number | null) => void;
  onClose: () => void;
  onDismissed?: () => void;
}

/** The typed value as an override, or undefined when it isn't one. */
function parse(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return n >= 1 && n <= 99 ? n : undefined;
}

export function WeightSheet({
  visible,
  unitName,
  recommended,
  override,
  theme,
  onSave,
  onClose,
  onDismissed,
}: WeightSheetProps) {
  const [text, setText] = useState(override === null ? "" : String(override));
  const value = parse(text);
  const empty = text.trim() === "";

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      title={unitName}
      confirm={{
        label: "Save",
        disabled: !empty && value === undefined,
        onPress: () => {
          onSave(empty ? null : (value ?? null));
          onClose();
        },
      }}
    >
      <View style={styles.body}>
        <AppText color={theme.ink}>Recommended: {recommended}</AppText>
        <TextField
          theme={theme}
          value={text}
          onChangeText={setText}
          keyboardType="number-pad"
          placeholder={String(recommended)}
          accessibilityLabel={`Your weight for ${unitName}`}
          accessibilityHint={`Recommended is ${recommended}. Leave empty to use it.`}
          maxLength={2}
          autoFocus
        />
        <AppText variant="footnote" color={theme.muted}>
          {!empty && value === undefined
            ? "A whole number from 1 to 99."
            : "Your other units share what's left, so the plan still adds up to 100. This is a guideline, not a verdict."}
        </AppText>
        {override !== null ? (
          <Button
            variant="quiet"
            label="Use recommended"
            onPress={() => {
              onSave(null);
              onClose();
            }}
            theme={theme}
          />
        ) : null}
      </View>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
});
