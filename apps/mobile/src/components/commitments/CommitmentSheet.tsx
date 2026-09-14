/**
 * Making or renaming a commitment, or one of its sub-commitments.
 *
 * One sheet for both levels, because they are the same two questions
 * and a second sheet would be a second set of metrics to keep in step.
 * What changes is the copy and whether a share is asked for — a
 * sub-commitment has none, since sub-commitments price nothing
 * (ADR-0029 §1) and a control that stored an inert number would be
 * worse than no control.
 *
 * **The share is a weight, not a percentage**, and the sheet says so by
 * showing what it works out to. Relative shares that need not sum to
 * anything are the right model (ADR-0032 §3) and the wrong thing to put
 * raw in front of someone: "50" means nothing until you know the others
 * are 30 and 20.
 */
import { useState } from "react";
import { Modal, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

export type CommitmentSheetMode =
  | { kind: "commitment"; name?: string; share?: number }
  | { kind: "sub"; parentName: string; name?: string };

interface CommitmentSheetProps {
  visible: boolean;
  mode: CommitmentSheetMode;
  /** Other commitments' shares, for working out what this one claims. */
  otherShares?: number[];
  onClose: () => void;
  onSave: (input: { name: string; share?: number }) => void;
  theme: ThemeTokens;
}

export function CommitmentSheet({
  visible,
  mode,
  otherShares = [],
  onClose,
  onSave,
  theme,
}: CommitmentSheetProps) {
  const editing = mode.name !== undefined;
  const [name, setName] = useState(mode.name ?? "");
  const [share, setShare] = useState(
    mode.kind === "commitment" ? String(mode.share ?? 1) : "",
  );
  const insets = useSafeAreaInsets();

  const shareNum = Number(share);
  const shareValid = Number.isFinite(shareNum) && shareNum > 0;
  const total = otherShares.reduce((a, s) => a + s, 0) + (shareValid ? shareNum : 0);
  const percent =
    shareValid && total > 0 ? Math.round((shareNum / total) * 100) : null;

  const canSave = name.trim().length > 0 && (mode.kind === "sub" || shareValid);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SheetFrame onClose={onClose} avoidsKeyboard>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.canvas,
              paddingBottom: insets.bottom + space.lg,
            },
          ]}
        >
          <AppText variant="title" color={theme.ink}>
            {editing
              ? "Rename"
              : mode.kind === "commitment"
                ? "New commitment"
                : `Add to ${mode.parentName}`}
          </AppText>

          {!editing ? (
            <AppText variant="body" color={theme.muted}>
              {mode.kind === "commitment"
                ? "Something with a schedule that takes up part of your week — a course, a job, a club."
                : "A part of it that holds its own work — a class, a shift pattern, a team."}
            </AppText>
          ) : null}

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={
              mode.kind === "commitment" ? "School" : "COMP2521"
            }
            placeholderTextColor={theme.muted}
            autoFocus
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                color: theme.ink,
                ...typeScale.body,
              },
            ]}
            accessibilityLabel="Name"
          />

          {mode.kind === "commitment" ? (
            <View style={styles.shareBlock}>
              <View style={styles.shareRow}>
                <AppText variant="label" color={theme.ink} style={styles.grow}>
                  Weight
                </AppText>
                <TextInput
                  value={share}
                  onChangeText={setShare}
                  keyboardType="number-pad"
                  style={[
                    styles.shareInput,
                    {
                      backgroundColor: theme.surface,
                      color: theme.ink,
                      ...typeScale.headline,
                    },
                  ]}
                  accessibilityLabel="Weight"
                />
              </View>
              <AppText variant="caption" color={theme.muted}>
                {percent !== null
                  ? `Takes about ${percent}% of what commitments are worth. Weights are relative — it only matters how they compare.`
                  : "Weights are relative — it only matters how they compare to your other commitments."}
              </AppText>
            </View>
          ) : null}

          <Button
            label={editing ? "Save" : "Add"}
            onPress={() =>
              onSave({
                name: name.trim(),
                ...(mode.kind === "commitment" ? { share: shareNum } : {}),
              })
            }
            disabled={!canSave}
            theme={theme}
          />
        </View>
      </SheetFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.screen,
    paddingTop: space.xl,
    gap: space.md,
  },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
  },
  shareBlock: { gap: space.sm },
  shareRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  grow: { flex: 1 },
  shareInput: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    minWidth: 88,
    minHeight: 48,
    textAlign: "center",
  },
});
