/**
 * Making or renaming a commitment, or one of its sub-commitments.
 *
 * One sheet for both levels, because they are the same questions and a
 * second sheet would be a second set of metrics to keep in step.
 *
 * **No share is asked for** (formula v11). A commitment's share of a
 * day comes from that day: its events and scheduled tasks over your
 * working hours (ADR-0044). A share set by hand lives on the
 * commitment's own screen (`ShareSheet`).
 */
import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { NativeSheet } from "../ui/NativeSheet";
import { TextField } from "../ui/TextField";

export type CommitmentSheetMode =
  | { kind: "commitment"; name?: string }
  | { kind: "sub"; parentName: string; name?: string };

interface CommitmentSheetProps {
  visible: boolean;
  mode: CommitmentSheetMode;
  onClose: () => void;
  /** After it has finished closing (`NativeSheet`). */
  onDismissed?: () => void;
  onSave: (input: { name: string; usesSubCommitments?: boolean }) => void;
  /** Offer the Sub-commitments switch on a new commitment. Onboarding
   *  leaves it off: sub-commitments come later, from Life. */
  askSplit?: boolean;
  theme: ThemeTokens;
}

export function CommitmentSheet({
  visible,
  mode,
  onClose,
  onDismissed,
  onSave,
  askSplit = true,
  theme,
}: CommitmentSheetProps) {
  const editing = mode.name !== undefined;
  const [name, setName] = useState(mode.name ?? "");
  const canSave = name.trim().length > 0;
  /** Asked only when making a commitment; afterwards it is a switch on
   *  the commitment's own screen. */
  const [split, setSplit] = useState(false);

  return (
    <NativeSheet onDismissed={onDismissed}
      visible={visible}
      onClose={onClose}
      size="large"
      scroll
      title={
        editing
          ? "Rename"
          : mode.kind === "commitment"
            ? "New commitment"
            : `Add to ${mode.parentName}`
      }
      confirm={{
        label: editing ? "Save" : "Add",
        disabled: !canSave,
        onPress: () =>
          onSave({
            name: name.trim(),
            ...(mode.kind === "commitment" && !editing && askSplit ? { usesSubCommitments: split } : {}),
          }),
      }}
    >
      <TextField
        theme={theme}
        value={name}
        onChangeText={setName}
        placeholder={
          mode.kind === "commitment" ? "School, Work, a club…" : "COMP2521"
        }
        autoFocus
        style={styles.input}
        accessibilityLabel="Name"
      />


      {mode.kind === "commitment" && !editing && askSplit ? (
        <View style={styles.shareRow}>
          <View style={styles.grow}>
            <AppText variant="label" color={theme.ink}>
              Sub-commitments
            </AppText>
            <AppText variant="caption" color={theme.muted}>
              Classes, shifts or teams. You can change this later.
            </AppText>
          </View>
          <Switch
            value={split}
            onValueChange={setSplit}
            accessibilityLabel="Sub-commitments"
          />
        </View>
      ) : null}
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
  },
  shareRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  grow: { flex: 1 },
});
