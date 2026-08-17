/**
 * The tap-to-edit sheet: everything about one task in one place —
 * title, cadence, which units it serves, and delete.
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
import { formatFrequency } from "./frequency";
import { FrequencyPicker } from "./FrequencyPicker";
import { TASK_TITLE_COUNTER_AT, TASK_TITLE_MAX } from "./limits";
import { PartOfDayPicker } from "./PartOfDayPicker";
import {
  formatWeekdays,
  frequencyForWeekdays,
  parseWeekdays,
  type PartOfDay,
  type Weekday,
} from "./planning";
import { UnitPicker, type PickableUnit } from "./UnitPicker";
import { WeekdayPicker } from "./WeekdayPicker";

export interface EditableTask {
  id: string;
  title: string;
  description: string | null;
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
    description: string | null;
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
  const [description, setDescription] = useState(task.description ?? "");
  const [timesPerWeek, setTimesPerWeek] = useState(task.timesPerWeek);
  const [unitIds, setUnitIds] = useState<string[]>(task.unitIds);
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    parseWeekdays(task.plannedWeekdays),
  );
  const [partOfDay, setPartOfDay] = useState<PartOfDay | null>(task.partOfDay);

  /**
   * Pinned days *are* the frequency (ADR-0024 §Schema), so the wheel
   * retires while any chip is lit rather than sitting beside it
   * offering a second answer to the same question. It also keeps the
   * sheet from scrolling, which this component refuses to do — see the
   * header.
   */
  const pinned = weekdays.length > 0;
  const effectiveTimes = frequencyForWeekdays(weekdays, timesPerWeek);
  const storedWeekdays = formatWeekdays(weekdays);

  const dirty =
    title.trim() !== task.title ||
    description.trim() !== (task.description ?? "") ||
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
      description: description.trim() || null,
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
              returnKeyType="done"
              onSubmitEditing={save}
              accessibilityLabel="Task name"
              style={[styles.input, { backgroundColor: theme.surface, color: theme.ink }]}
            />
            {TASK_TITLE_MAX - title.length <= TASK_TITLE_COUNTER_AT ? (
              <AppText variant="footnote" color={theme.muted} style={styles.counter}>
                {TASK_TITLE_MAX - title.length} left
              </AppText>
            ) : null}
          </View>

          {/* What the task involves — the fine print behind the title, so
              ticking it means the same thing every time. Three lines and
              no more: the sheet must not start scrolling (see header). */}
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What does this involve? (optional)"
            placeholderTextColor={theme.muted}
            multiline
            numberOfLines={3}
            accessibilityLabel="What this task involves"
            style={[
              styles.input,
              styles.multiline,
              { backgroundColor: theme.surface, color: theme.ink },
            ]}
          />

          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <AppText variant="caption" color={theme.muted}>
                Which days
              </AppText>
              {/* The derived frequency, stated rather than implied, so
                  picking days never feels like it lost the setting the
                  wheel used to hold. Reads as fact, never as a target. */}
              <AppText variant="caption" color={theme.muted}>
                {pinned ? formatFrequency(effectiveTimes) : "Any days"}
              </AppText>
            </View>
            <WeekdayPicker
              value={weekdays}
              onChange={setWeekdays}
              accent={accent}
              theme={theme}
            />
          </View>

          {/* Flexible tasks still need a count; pinned ones already
              have one. Swapping rather than stacking is what keeps the
              sheet inside one screen. */}
          {!pinned ? (
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
          ) : null}

          <View style={styles.block}>
            <AppText variant="caption" color={theme.muted}>
              When in the day
            </AppText>
            <PartOfDayPicker
              value={partOfDay}
              onChange={setPartOfDay}
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
  /** Three lines of body text plus padding. `textAlignVertical` is the
   *  Android knob; iOS needs the explicit top padding, since a multiline
   *  TextInput there centres its first line against `minHeight`. */
  multiline: {
    minHeight: 88,
    paddingTop: space.md,
    paddingBottom: space.md,
    textAlignVertical: "top",
  },
  block: { gap: space.sm },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
});
