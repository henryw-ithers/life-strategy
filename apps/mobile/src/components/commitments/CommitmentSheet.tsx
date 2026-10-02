/**
 * Making or renaming a commitment, or one of its sub-commitments.
 *
 * One sheet for both levels, because they are the same two questions
 * and a second sheet would be a second set of metrics to keep in step.
 * What changes is the copy and whether a share is asked for — a
 * sub-commitment has none, since sub-commitments price nothing
 * (ADR-0035 §1) and a control that stored an inert number would be
 * worse than no control.
 *
 * **The share is a percentage, and the question changes with the
 * count** (Henry, 2026-10-02: the old free "weight" was "way too
 * vague"):
 *
 * - **The first commitment** is asked nothing. It is the only one, so
 *   it takes the whole commitment band.
 * - **A second or third** is asked one thing: what percent of the
 *   commitment points comes from it. The others are shown beside it,
 *   rescaled live into what is left with their proportions kept
 *   (`rebalanceShares`), so the answer is never a number in a vacuum.
 */
import { rebalanceShares } from "@glide/scoring";
import { useState } from "react";
import { Modal, StyleSheet, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

export type CommitmentSheetMode =
  | { kind: "commitment"; name?: string; percent?: number }
  | { kind: "sub"; parentName: string; name?: string };

interface CommitmentSheetProps {
  visible: boolean;
  mode: CommitmentSheetMode;
  /** The other live commitments and the percent each takes now. */
  others?: { id: string; name: string; percent: number }[];
  onClose: () => void;
  onSave: (input: { name: string; percent?: number; usesSubCommitments?: boolean }) => void;
  theme: ThemeTokens;
}

export function CommitmentSheet({
  visible,
  mode,
  others = [],
  onClose,
  onSave,
  theme,
}: CommitmentSheetProps) {
  const editing = mode.name !== undefined;
  const [name, setName] = useState(mode.name ?? "");
  /** Asked only when there is something to share the band with. */
  const asksPercent = mode.kind === "commitment" && others.length > 0;
  const [percentText, setPercentText] = useState(
    mode.kind === "commitment"
      ? String(mode.percent ?? Math.round(100 / (others.length + 1)))
      : "",
  );
  const insets = useSafeAreaInsets();

  const percentNum = Number(percentText);
  const percentValid =
    Number.isInteger(percentNum) && percentNum >= 1 && percentNum <= 99;
  /** The others as they would be after saving — kept in proportion. */
  const preview = percentValid
    ? rebalanceShares(
        others.map((o) => ({ id: o.id, share: o.percent })),
        percentNum,
      ).others
    : null;

  const canSave =
    name.trim().length > 0 && (!asksPercent || percentValid);
  /** Asked only when making a commitment; afterwards it is a switch on
   *  the commitment's own screen. */
  const [split, setSplit] = useState(false);

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
                : "A sub-commitment holds its own events and tasks — a class, a shift pattern, a team."}
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

          {mode.kind === "commitment" && !asksPercent ? (
            <AppText variant="caption" color={theme.muted}>
              Your only commitment, so it takes all of the commitment band.
              Add another and you’ll choose how they split it.
            </AppText>
          ) : null}

          {asksPercent ? (
            <View style={styles.shareBlock}>
              <View style={styles.shareRow}>
                <AppText variant="label" color={theme.ink} style={styles.grow}>
                  Share of commitment points
                </AppText>
                <TextInput
                  value={percentText}
                  onChangeText={(t) => setPercentText(t.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[
                    styles.shareInput,
                    {
                      backgroundColor: theme.surface,
                      color: theme.ink,
                      ...typeScale.headline,
                    },
                  ]}
                  accessibilityLabel="Percent of commitment points from this commitment"
                />
                <AppText variant="headline" color={theme.ink}>
                  %
                </AppText>
              </View>
              {/* The answer means something only beside the others, so
                  they are shown as they will be — live, in proportion. */}
              <View style={[styles.others, { borderColor: theme.hairline }]}>
                {others.map((o) => (
                  <View key={o.id} style={styles.otherRow}>
                    <AppText color={theme.muted} style={styles.grow} numberOfLines={1}>
                      {o.name}
                    </AppText>
                    <AppText color={theme.muted} tabular>
                      {preview
                        ? `${preview.find((p) => p.id === o.id)?.share ?? 0}%`
                        : `${o.percent}%`}
                    </AppText>
                  </View>
                ))}
              </View>
              <AppText variant="caption" color={theme.muted}>
                {percentValid
                  ? others.length === 1
                    ? "The other commitment takes the rest."
                    : "The others share the rest, keeping their proportions."
                  : "Choose a number from 1 to 99."}
              </AppText>
            </View>
          ) : null}

          {mode.kind === "commitment" && !editing ? (
            <View style={styles.shareRow}>
              <View style={styles.grow}>
                <AppText variant="label" color={theme.ink}>
                  Sub-commitments
                </AppText>
                <AppText variant="caption" color={theme.muted}>
                  Split it into classes, shifts or teams, each with its own
                  events and tasks. You can change this later.
                </AppText>
              </View>
              <Switch
                value={split}
                onValueChange={setSplit}
                accessibilityLabel="Sub-commitments"
              />
            </View>
          ) : null}

          <Button
            label={editing ? "Save" : "Add"}
            onPress={() =>
              onSave({
                name: name.trim(),
                ...(asksPercent ? { percent: percentNum } : {}),
                ...(mode.kind === "commitment" && !editing ? { usesSubCommitments: split } : {}),
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
  others: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
    gap: space.xs,
  },
  otherRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  shareInput: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    minWidth: 88,
    minHeight: 48,
    textAlign: "center",
  },
});
