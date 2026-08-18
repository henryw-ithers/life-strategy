/**
 * The tap-to-edit sheet: everything about one task in one place —
 * title, what it involves, which units it serves, when it happens, and
 * delete. It runs the same fields in the same order as `AddTaskModal`,
 * through the same `SchedulePicker`: creating a task and revising one
 * are the same act at different times, and a form that reorders itself
 * between them is a form you have to re-read.
 *
 * Rank isn't here. It moved to a grip on the row itself, where you can
 * see the order you're changing; a second way in from this sheet would
 * be the slower path to the same result.
 *
 * **Scrolls in its content area only; the actions stay pinned.**
 * This sheet used to refuse to scroll at all, on the grounds that a
 * sheet you scroll hides its own primary action. ADR-0024 added two
 * more controls (which days, when in the day) and the fields no longer
 * fit any phone — so the rule is honoured where it actually bites:
 * Save and Delete sit outside the scroller and are always reachable.
 * Cramming the fields instead would have cost touch-target sizes on a
 * row of seven chips, which is the worse trade.
 *
 * Edits apply on save, not on blur: cadence and units both recompute
 * point values across units, and doing that on every keystroke would
 * make the numbers flicker under the user's hands.
 */
import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { TASK_TITLE_COUNTER_AT, TASK_TITLE_MAX } from "./limits";
import {
  formatWeekdays,
  frequencyForWeekdays,
  parseWeekdays,
  type PartOfDay,
  type Weekday,
} from "./planning";
import { SchedulePicker } from "./SchedulePicker";
import { UnitPicker, type PickableUnit } from "./UnitPicker";

export interface EditableTask {
  id: string;
  title: string;
  timesPerWeek: number;
  unitIds: string[];
  /** `"1,3,5"`, or null for flexible (ADR-0024). */
  plannedWeekdays: string | null;
  /** Null is *Anytime*. */
  partOfDay: PartOfDay | null;
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
    plannedWeekdays: string | null;
    partOfDay: PartOfDay | null;
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
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    parseWeekdays(task.plannedWeekdays),
  );
  const [partOfDay, setPartOfDay] = useState<PartOfDay | null>(task.partOfDay);

  /** Pinned days *are* the frequency (ADR-0024 §Schema) — the wheel
   *  retires while any chip is lit, inside `SchedulePicker`. */
  const effectiveTimes = frequencyForWeekdays(weekdays, timesPerWeek);
  const storedWeekdays = formatWeekdays(weekdays);

  const dirty =
    title.trim() !== task.title ||
    effectiveTimes !== task.timesPerWeek ||
    unitIds.join("|") !== task.unitIds.join("|") ||
    storedWeekdays !== task.plannedWeekdays ||
    partOfDay !== task.partOfDay;

  /** A task has to be listed somewhere, so an empty unit row can't be
   *  saved — the picker lets you clear the last chip on the way to
   *  choosing a different one, and this is where that lands. */
  const savable = title.trim().length > 0 && unitIds.length > 0;

  const save = () => {
    if (!savable) return;
    onSave({
      title: title.trim(),
      timesPerWeek: effectiveTimes,
      unitIds,
      plannedWeekdays: storedWeekdays,
      partOfDay,
    });
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

          <AppText variant="title" color={theme.ink} style={styles.heading}>
            Edit task
          </AppText>

          <ScrollView
            style={styles.scroller}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            // The frequency wheel is a nested scroller; without this
            // the sheet steals its drag on Android.
            nestedScrollEnabled
          >
          <View style={styles.field}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Task name"
              placeholderTextColor={theme.muted}
              maxLength={TASK_TITLE_MAX}
              // Dismisses the keyboard rather than saving and closing:
              // the schedule sits below this field, and a Return that
              // ends the sheet ends it before the user reaches what
              // they most likely opened it for.
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              accessibilityLabel="Task name"
              style={[styles.input, { backgroundColor: theme.surface, color: theme.ink }]}
            />
            {TASK_TITLE_MAX - title.length <= TASK_TITLE_COUNTER_AT ? (
              <AppText variant="footnote" color={theme.muted} style={styles.counter}>
                {TASK_TITLE_MAX - title.length} left
              </AppText>
            ) : null}
          </View>


          {/* Units before the schedule, matching the add sheet. The two
              used to run in opposite orders — units last here, first
              there — which made the same five fields a different form
              depending on how you arrived at them. Identity first, plan
              second, in both. */}
          <UnitPicker
            units={units}
            value={unitIds}
            onChange={setUnitIds}
            theme={theme}
            areaColors={areaColors}
          />

          <SchedulePicker
            timesPerWeek={timesPerWeek}
            onTimesPerWeekChange={setTimesPerWeek}
            weekdays={weekdays}
            onWeekdaysChange={setWeekdays}
            partOfDay={partOfDay}
            onPartOfDayChange={setPartOfDay}
            accent={accent}
            theme={theme}
          />
          </ScrollView>

          <Button
            label={dirty ? "Save changes" : "Done"}
            color={accent}
            disabled={!savable}
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
    // Leaves the top of the screen showing so the sheet still reads as
    // a sheet rather than a takeover, and gives the scroller a bound.
    maxHeight: "88%",
  },
  heading: { marginBottom: -space.xs },
  scroller: { flexGrow: 0 },
  /** The gap the sheet used to own for these children; it now belongs
   *  to the scroller so the pinned actions keep their own spacing. */
  scrollBody: { gap: space.lg, paddingTop: space.xs, paddingBottom: space.xs },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  field: { gap: space.xs },
  counter: { alignSelf: "flex-end" },
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
});
