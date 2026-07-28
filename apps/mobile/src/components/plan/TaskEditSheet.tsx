/**
 * The tap-to-edit sheet: everything about one task in one place —
 * title, cadence, which units it serves, and delete.
 *
 * Rank isn't here. It moved to a grip on the row itself, where you can
 * see the order you're changing; a second way in from this sheet would
 * be the slower path to the same result.
 *
 * Short enough to fit without scrolling, deliberately. A sheet you
 * scroll hides its own primary action, and every control here is one
 * the user came to change.
 *
 * Edits apply on save, not on blur: cadence and units both recompute
 * point values across units, and doing that on every keystroke would
 * make the numbers flicker under the user's hands.
 */
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { FrequencyPicker } from "./FrequencyPicker";
import { UnitPicker, type PickableUnit } from "./UnitPicker";

export interface EditableTask {
  id: string;
  title: string;
  timesPerWeek: number;
  unitIds: string[];
}

interface TaskEditSheetProps {
  visible: boolean;
  task: EditableTask;
  units: PickableUnit[];
  areaColors: Record<string, string>;
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  onSave: (next: {
    title: string;
    timesPerWeek: number;
    unitIds: string[];
  }) => void;
  onDelete: () => void;
}

export function TaskEditSheet({
  visible,
  task,
  units,
  areaColors,
  accent,
  theme,
  onClose,
  onSave,
  onDelete,
}: TaskEditSheetProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(task.title);
  const [timesPerWeek, setTimesPerWeek] = useState(task.timesPerWeek);
  const [unitIds, setUnitIds] = useState<string[]>(task.unitIds);

  const dirty =
    title.trim() !== task.title ||
    timesPerWeek !== task.timesPerWeek ||
    unitIds.join("|") !== task.unitIds.join("|");

  const save = () => {
    if (title.trim().length === 0) return;
    onSave({ title: title.trim(), timesPerWeek, unitIds });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
            Edit task
          </AppText>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Task name"
            placeholderTextColor={theme.muted}
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel="Task name"
            style={[styles.input, { backgroundColor: theme.surface, color: theme.ink }]}
          />

          <View style={styles.block}>
            <AppText variant="caption" color={theme.muted}>
              How often
            </AppText>
            <FrequencyPicker
              value={timesPerWeek}
              onChange={setTimesPerWeek}
              accent={accent}
              theme={theme}
            />
          </View>

          <UnitPicker
            units={units}
            value={unitIds}
            onChange={setUnitIds}
            theme={theme}
            areaColors={areaColors}
          />

          <Button
            label={dirty ? "Save changes" : "Done"}
            color={accent}
            disabled={title.trim().length === 0}
            onPress={save}
            theme={theme}
          />
          <Button
            label="Delete task"
            variant="quiet"
            onPress={() => {
              onDelete();
              onClose();
            }}
            theme={theme}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: SCRIM },
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
  block: { gap: space.sm },
});
