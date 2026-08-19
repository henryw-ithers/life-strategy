/**
 * Making a goal: what it is, and what would count as reaching it.
 *
 * **The target is asked here, not afterwards** — the same rule ADR-0024
 * set for tasks. This sheet used to take a title and a note and stop,
 * which made every goal a stub: the number that turns "get fitter" into
 * something the app can measure was set later, on the goal's own
 * screen, in a second sheet nobody had a reason to open. That is the
 * second-trip problem the task sheet was rebuilt to remove, and it bites
 * harder here, because a goal with no target cannot show progress,
 * cannot reach a milestone, and can never complete itself.
 *
 * It stays **optional**. Plenty of real goals are not numbers ("be a
 * better listener"), and forcing a figure onto them would make the
 * field a toll rather than a tool. Left blank, the goal behaves exactly
 * as goals did before.
 *
 * The unit sits beside the number rather than under its own label,
 * because "225 kg" is one thought and two labelled fields would make it
 * read as two.
 */
import { useState } from "react";
import {
  Modal,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

interface AddGoalModalProps {
  visible: boolean;
  onClose: () => void;
  accent: string;
  theme: ThemeTokens;
  /** `target` is null when the goal is not a number, which is allowed
   *  and common; `unit` is only meaningful beside one. */
  onCommit: (
    title: string,
    description: string | undefined,
    target: number | null,
    unit: string | null,
  ) => Promise<void>;
}

export function AddGoalModal({
  visible,
  onClose,
  accent,
  theme,
  onCommit,
}: AddGoalModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setTarget("");
    setUnit("");
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const commit = () => {
    if (title.trim().length === 0 || saving) return;
    setSaving(true);
    const committedTitle = title.trim();
    const committedDescription =
      description.trim().length > 0 ? description.trim() : undefined;
    // A target that is not a number is the same as no target: the
    // field is free text so "225" and "225kg" both arrive here, and
    // refusing the second would be pedantry about a field that is
    // optional in the first place.
    const parsed = Number.parseFloat(target.replace(",", "."));
    const committedTarget = Number.isFinite(parsed) ? parsed : null;
    const committedUnit =
      committedTarget !== null && unit.trim().length > 0 ? unit.trim() : null;
    close();
    void onCommit(
      committedTitle,
      committedDescription,
      committedTarget,
      committedUnit,
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <SheetFrame onClose={close} avoidsKeyboard>
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
            New goal
          </AppText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Bench 225 by June"
            accessibilityLabel="Goal"
            placeholderTextColor={theme.muted}
            autoFocus
            returnKeyType="next"
            style={[styles.input, { backgroundColor: theme.surface, color: theme.ink }]}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Notes (optional)"
            accessibilityLabel="Notes, optional"
            placeholderTextColor={theme.muted}
            multiline
            style={[
              styles.input,
              styles.description,
              { backgroundColor: theme.surface, color: theme.ink },
            ]}
          />

          {/* One row, because a target and its unit are one answer. The
              number takes the space it needs and the unit takes what is
              left: "225" and "kg" are not equally wide and should not be
              equally sized. */}
          <View style={styles.targetRow}>
            <TextInput
              value={target}
              onChangeText={setTarget}
              placeholder="Target"
              placeholderTextColor={theme.muted}
              keyboardType="decimal-pad"
              returnKeyType="done"
              accessibilityLabel="Target number, optional"
              style={[
                styles.input,
                styles.targetNumber,
                { backgroundColor: theme.surface, color: theme.ink },
              ]}
            />
            <TextInput
              value={unit}
              onChangeText={setUnit}
              placeholder="kg, books, km"
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              returnKeyType="done"
              accessibilityLabel="Unit for the target, optional"
              style={[
                styles.input,
                styles.targetUnit,
                { backgroundColor: theme.surface, color: theme.ink },
              ]}
            />
          </View>
          <Button
            label="Add goal"
            color={accent}
            disabled={title.trim().length === 0 || saving}
            onPress={commit}
            theme={theme}
          />
          <Button label="Cancel" variant="quiet" onPress={close} theme={theme} />
        </View>
      </SheetFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  targetRow: { flexDirection: "row", gap: space.sm },
  /** The number is the answer; the unit only qualifies it. */
  targetNumber: { flex: 2 },
  targetUnit: { flex: 3 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.sm + 2,
    gap: space.lg,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  description: { minHeight: 72, paddingTop: space.sm, textAlignVertical: "top" },
});
