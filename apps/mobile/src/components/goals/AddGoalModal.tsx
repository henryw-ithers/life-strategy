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
 * cannot reach a finish line, and can never complete itself.
 *
 * It stays **optional**. Plenty of real goals are not numbers ("be a
 * better listener"), and forcing a figure onto them would make the
 * field a toll rather than a tool. Left blank, the goal behaves exactly
 * as goals did before.
 *
 * The unit sits beside the number rather than under its own label,
 * because "225 kg" is one thought and two labelled fields would make it
 * read as two.
 *
 * **Which part of life it belongs to is a field in here**, the same way
 * `AddTaskModal` takes it. It used to be decided by which of eighteen
 * "+" buttons you happened to tap, which meant the Goals screen had to
 * render all eighteen units — most of them empty — just to give every
 * one an add button. Moving the choice into the sheet let that screen
 * become a list of your actual goals.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { NativeSheet } from "../ui/NativeSheet";
import { TextField } from "../ui/TextField";
import { UnitPicker, type PickableUnit } from "../plan/UnitPicker";

interface AddGoalModalProps {
  visible: boolean;
  onClose: () => void;
  /** After it has finished closing (`NativeSheet`). */
  onDismissed?: () => void;
  theme: ThemeTokens;
  /** Every unit a goal can belong to. */
  units: PickableUnit[];
  areaColors: Record<string, string>;
  /** Preselected when the sheet was opened from a unit that already has
   *  goals; absent when opened from the top of the screen. */
  homeUnitId?: string;
  /** `target` is null when the goal is not a number, which is allowed
   *  and common; `unit` is only meaningful beside one. */
  onCommit: (
    unitId: string,
    title: string,
    description: string | undefined,
    target: number | null,
    unit: string | null,
  ) => Promise<void>;
}

export function AddGoalModal({
  visible,
  onClose,
  onDismissed,
  theme,
  units,
  areaColors,
  homeUnitId,
  onCommit,
}: AddGoalModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitIds, setUnitIds] = useState<string[]>(
    homeUnitId ? [homeUnitId] : [],
  );
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

  // No reset here: the sheet is mounted fresh for each open
  // (`useRetained`), and resetting while it slides away would show.
  const close = onClose;

  const commit = () => {
    if (title.trim().length === 0 || unitIds.length === 0 || saving) return;
    setSaving(true);
    const committedUnitId = unitIds[0]!;
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
      committedUnitId,
      committedTitle,
      committedDescription,
      committedTarget,
      committedUnit,
    );
  };

  return (
    <NativeSheet onDismissed={onDismissed}
      visible={visible}
      onClose={close}
      size="large"
      scroll
      title="New goal"
      confirm={{
        label: "Add",
        onPress: commit,
        disabled: title.trim().length === 0 || unitIds.length === 0 || saving,
      }}
    >
      <TextField
        theme={theme}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Bench 225 by June"
        accessibilityLabel="Goal"
        autoFocus
        returnKeyType="next"
        style={styles.input}
      />
      <TextField
        theme={theme}
        value={description}
        onChangeText={setDescription}
        placeholder="Notes (optional)"
        accessibilityLabel="Notes, optional"
        multiline
        style={[styles.input, styles.description]}
      />

      <UnitPicker
        units={units}
        value={unitIds}
        onChange={setUnitIds}
        theme={theme}
        areaColors={areaColors}
        max={1}
      />

      {/* One row, because a target and its unit are one answer. The
          number takes the space it needs and the unit takes what is
          left: "225" and "kg" are not equally wide and should not be
          equally sized. */}
      <View style={styles.targetRow}>
        <TextField
          theme={theme}
          value={target}
          onChangeText={setTarget}
          placeholder="Target"
          keyboardType="decimal-pad"
          returnKeyType="done"
          accessibilityLabel="Target number, optional"
          style={[styles.input, styles.targetNumber]}
        />
        <TextField
          theme={theme}
          value={unit}
          onChangeText={setUnit}
          placeholder="kg, books, km"
          autoCapitalize="none"
          returnKeyType="done"
          accessibilityLabel="Unit for the target, optional"
          style={[styles.input, styles.targetUnit]}
        />
      </View>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  targetRow: { flexDirection: "row", gap: space.sm },
  /** The number is the answer; the unit only qualifies it. */
  targetNumber: { flex: 2 },
  targetUnit: { flex: 3 },
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  description: { minHeight: 72, paddingTop: space.sm, textAlignVertical: "top" },
});
