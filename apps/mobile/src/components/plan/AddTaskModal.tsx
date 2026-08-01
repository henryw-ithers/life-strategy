/**
 * Task creation: what it is, which units it serves, how often. One
 * screenful, one commit.
 *
 * Two things used to sit between typing a task and having one. The
 * first was the unit: the sheet could only be opened from inside an
 * expanded unit, so capture began with navigation. It now also opens
 * from the top of the screen with nothing chosen, and the unit is a
 * chip row inside the sheet like any other field.
 *
 * The second was rank. A pairwise comparison ran before the task
 * existed — "which matters more right now?" — a good question asked at
 * the worst possible moment: mid-capture, about a task still being
 * worded, on every single add. It's gone. The task lands last in its
 * unit and the screen opens that unit with the row's drag handle under
 * your thumb, which is the same decision made where you can see what
 * you're comparing against.
 *
 * The unit chips sit directly under the title, above cadence, because
 * the chosen unit's area hue colours everything below them — the
 * frequency picker and the commit button. Choice first, consequences
 * after: the sheet reads downward.
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

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  /** Every scoreable unit; a task can serve more than one. */
  units: PickableUnit[];
  /**
   * The unit this was opened from, when it was opened from one. Absent
   * on the quick add at the top of the screen, where the sheet opens
   * with nothing chosen and the button waits for a chip.
   */
  homeUnitId?: string;
  areaColors: Record<string, string>;
  theme: ThemeTokens;
  /** `unitIds[0]` is the home unit — where the task is listed. */
  onCommit: (
    title: string,
    timesPerWeek: number,
    unitIds: string[],
  ) => Promise<void> | void;
}

export function AddTaskModal({
  visible,
  onClose,
  units,
  homeUnitId,
  areaColors,
  theme,
  onCommit,
}: AddTaskModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [timesPerWeek, setTimesPerWeek] = useState(7);
  const [unitIds, setUnitIds] = useState<string[]>(
    homeUnitId ? [homeUnitId] : [],
  );
  const [saving, setSaving] = useState(false);

  /** The home unit's area hue, or the app accent until one is picked —
   *  so the sheet takes the colour of the choice as it's made. */
  const home = unitIds[0];
  const accent =
    areaColors[units.find((u) => u.id === home)?.areaId ?? ""] ?? theme.accent;

  const ready = title.trim().length > 0 && unitIds.length > 0 && !saving;

  const close = () => {
    setTitle("");
    setTimesPerWeek(7);
    setUnitIds(homeUnitId ? [homeUnitId] : []);
    setSaving(false);
    onClose();
  };

  /** Close immediately; the write and reload happen behind the sheet's
   *  exit — the interaction never waits on the database. */
  const commit = () => {
    if (!ready) return;
    setSaving(true);
    const committedTitle = title.trim();
    const committedTimes = timesPerWeek;
    const committedUnits = unitIds;
    close();
    void onCommit(committedTitle, committedTimes, committedUnits);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={styles.backdrop}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Close"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
            New task
          </AppText>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 30 minutes of movement"
            placeholderTextColor={theme.muted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={commit}
            accessibilityLabel="Task name"
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                color: theme.ink,
              },
            ]}
          />

          <UnitPicker
            units={units}
            value={unitIds}
            onChange={setUnitIds}
            theme={theme}
            areaColors={areaColors}
          />

          <View style={styles.repeatBlock}>
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

          <Button
            label="Add task"
            color={accent}
            disabled={!ready}
            onPress={commit}
            theme={theme}
          />

          <Button label="Cancel" variant="quiet" onPress={close} theme={theme} />
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
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  repeatBlock: { gap: space.sm },
});
