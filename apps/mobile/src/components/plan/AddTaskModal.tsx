/**
 * Task creation: what it is, which units it serves, how often, and
 * when. One sheet, one commit.
 *
 * **A bottom sheet since 2026-08-18**, where it used to be a centred
 * card. The card was chosen to keep the plan visible around a small
 * errand, and that reasoning held right up until the errand grew a
 * schedule: with five fields and a keyboard, a centred panel jumps —
 * `KeyboardAvoidingView` shortens the container and a centred child
 * re-centres in what is left, so focusing the name field threw the
 * whole sheet a couple of hundred points up the screen. It also
 * matches `TaskEditSheet`, so making a task and changing one are
 * visibly the same surface.
 *
 * **The keyboard overlays rather than displaces (2026-08-19).** Anchoring
 * to the bottom stopped the sheet jumping, but keeping the avoider
 * meant it still folded: the frame shortened and the scroller
 * concertinaed five fields into what was left. The sheet now holds
 * still and the keyboard covers the lower part of it.
 *
 * **The plan is made here, not afterwards** (ADR-0024 §1 as amended
 * 2026-08-17). The order is the order a person thinks in: what, how
 * often, which days, when in the day. Weekday pins and part of day used
 * to exist only in the edit sheet, so every task was born flexible and
 * planning it meant a second trip through a second surface — the
 * implementation intention the research is about was the one thing the
 * flow made optional.
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
 * the chosen unit's area hue colours what follows: the weekday chips,
 * the part-of-day segments, and the commit button. Choice first,
 * consequences after — the sheet reads downward.
 *
 * **The name field does not autofocus** (changed 2026-08-18). It did,
 * and that single prop was why half the sheet was unreachable: the
 * keyboard claims about 336pt on a 844pt phone, `KeyboardAvoidingView`
 * hands the sheet what is left, and 170pt of a 678pt sheet went under
 * the fold before the user had touched anything. Which days and when
 * in the day were both gone. Opening cold shows the whole form; the
 * keyboard now arrives when someone asks for it by tapping the field,
 * which is also the only moment scrolling past it is the right
 * behaviour.
 */
import { useState } from "react";
import {
  Keyboard,
  Modal,
  ScrollView,
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
import { TASK_TITLE_COUNTER_AT, TASK_TITLE_MAX } from "./limits";
import {
  formatWeekdays,
  frequencyForWeekdays,
  type PartOfDay,
  type Weekday,
} from "./planning";
import { SchedulePicker, type OneOffState } from "./SchedulePicker";
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
  /**
   * Set when the sheet is opened from inside one day (the planner).
   *
   * It forces a one-off dated to that day and hides the cadence switch:
   * you came to arrange Thursday, and a recurring task created from
   * there would silently change every Thursday. The full sheet on the
   * Tasks tab is where a repeating task gets made.
   */
  lockedOneOffDate?: string;
  theme: ThemeTokens;
  /** `unitIds[0]` is the home unit — where the task is listed.
   *  `plannedWeekdays` is `"1,3,5"` or null for flexible;
   *  `partOfDay` null is *Anytime*. */
  onCommit: (
    title: string,
    timesPerWeek: number,
    unitIds: string[],
    plannedWeekdays: string | null,
    partOfDay: PartOfDay | null,
    /** Non-null makes this a one-off; cadence and pins are ignored. */
    oneOff: OneOffState | null,
  ) => Promise<void> | void;
}

export function AddTaskModal({
  visible,
  onClose,
  units,
  homeUnitId,
  areaColors,
  lockedOneOffDate,
  theme,
  onCommit,
}: AddTaskModalProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [timesPerWeek, setTimesPerWeek] = useState(7);
  const [unitIds, setUnitIds] = useState<string[]>(
    homeUnitId ? [homeUnitId] : [],
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [partOfDay, setPartOfDay] = useState<PartOfDay | null>(null);
  /** Repeats by default: most of a plan recurs, and a one-off is the
   *  deliberate exception. */
  const [once, setOnce] = useState(lockedOneOffDate !== undefined);
  const [oneOff, setOneOff] = useState<OneOffState>({
    size: "normal",
    date: lockedOneOffDate ?? null,
    due: null,
  });
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
    setWeekdays([]);
    setPartOfDay(null);
    setOnce(lockedOneOffDate !== undefined);
    setOneOff({ size: "normal", date: lockedOneOffDate ?? null, due: null });
    setSaving(false);
    onClose();
  };

  /** Close immediately; the write and reload happen behind the sheet's
   *  exit — the interaction never waits on the database. */
  const commit = () => {
    if (!ready) return;
    setSaving(true);
    const committedTitle = title.trim();
    // Days picked *are* the frequency (ADR-0024 §Schema); the stepper's
    // value only survives when nothing is pinned.
    const committedTimes = frequencyForWeekdays(weekdays, timesPerWeek);
    const committedUnits = unitIds;
    // A one-off has no cadence and no weekday pins; carrying either
    // would leave contradictory rows behind if it were ever converted.
    const committedDays = once ? null : formatWeekdays(weekdays);
    const committedPart = partOfDay;
    const committedOneOff = once ? oneOff : null;
    close();
    void onCommit(
      committedTitle,
      committedTimes,
      committedUnits,
      committedDays,
      committedPart,
      committedOneOff,
    );
  };

  const remaining = TASK_TITLE_MAX - title.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      {/* No keyboard avoidance, deliberately. `behavior="padding"`
          shortens the frame, which makes the sheet fold: the scroller
          collapses and five fields concertina into whatever is left.
          The name field is the first thing in the sheet and the only
          thing that takes typing, so it is never behind the keyboard
          anyway — letting the keyboard sit over the lower half leaves
          the layout still and the field in view, which is what a person
          expects when they tap into a form. Return dismisses it. */}
      <SheetFrame onClose={close}>
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
            {lockedOneOffDate === undefined ? "New task" : "Add to this day"}
          </AppText>

          {/* Scrolls in its content area only, with the actions pinned
              below it — the same rule `TaskEditSheet` follows, and for
              the same reason: five fields no longer fit a short screen
              with the keyboard up, and cramming them would cost touch
              targets on a row of seven chips. */}
          <ScrollView
            style={styles.scroller}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.field}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. 30 minutes of movement"
              placeholderTextColor={theme.muted}
              maxLength={TASK_TITLE_MAX}
              // Return dismisses the keyboard; it does **not** commit.
              // It used to, back when the name and the unit were the
              // whole sheet — with the schedule below the fold, a
              // Return that files the task takes away the three
              // questions the user came here to answer, and does it at
              // the exact moment they were reaching for them.
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              accessibilityLabel="Task name"
              style={[
                styles.input,
                {
                  backgroundColor: theme.surface,
                  color: theme.ink,
                },
              ]}
            />
            {/* Silent until the cap is in sight — a counter on a
                five-word title is noise. */}
            {remaining <= TASK_TITLE_COUNTER_AT ? (
              <AppText variant="footnote" color={theme.muted} style={styles.counter}>
                {remaining} left
              </AppText>
            ) : null}
          </View>

          <UnitPicker
            units={units}
            value={unitIds}
            onChange={setUnitIds}
            theme={theme}
            areaColors={areaColors}
          />

          <SchedulePicker
            once={once}
            onOnceChange={setOnce}
            canChangeCadence={lockedOneOffDate === undefined}
            oneOff={oneOff}
            onOneOffChange={setOneOff}
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

          {/* Side by side: the card is short enough that stacking two
              full-width buttons would make the actions the tallest
              thing in it. */}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button label="Cancel" variant="quiet" onPress={close} theme={theme} />
            </View>
            <View style={styles.action}>
              <Button
                label="Add task"
                color={accent}
                disabled={!ready}
                onPress={commit}
                theme={theme}
              />
            </View>
          </View>
        </View>
      </SheetFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /**
   * A bottom sheet, not a centred dialog (changed 2026-08-18).
   *
   * Centred, the keyboard shoved the whole panel: `padding` shortens
   * the flex container and a centred child re-centres in what is
   * left, so the card leapt a couple of hundred points the moment the
   * field focused. Anchored to the bottom it rises by exactly the
   * keyboard's height and reads as resting on it — the platform norm,
   * and the same shape `TaskEditSheet` already had, so creating and
   * editing a task now look like one surface rather than two.
   */
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.sm + 2,
    gap: space.md,
    maxHeight: "88%",
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  scroller: { flexGrow: 0 },
  /** 12pt, against the 24pt `SchedulePicker` opens with. The name and
   *  the unit are one thought (what this is); the schedule is the
   *  other. Even 16s everywhere made five fields read as one list. */
  scrollBody: { gap: space.md, paddingTop: space.xs, paddingBottom: space.xs },
  field: { gap: space.xs },
  counter: { alignSelf: "flex-end" },
  input: {
    ...typeScale.body,
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: space.md },
  action: { flex: 1 },
});
