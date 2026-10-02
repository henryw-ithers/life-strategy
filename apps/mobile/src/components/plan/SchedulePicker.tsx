/**
 * How often, which days, when in the day — the three questions that
 * turn a task into a plan (ADR-0024 §1).
 *
 * One component, used by both the add dialog and the edit sheet, so
 * the two surfaces cannot drift into asking the same thing in two
 * orders. Creating a task and revising one are the same act at
 * different times, and a plan made in a different sequence than it is
 * later read is a plan you have to re-learn.
 *
 * The order is fixed and deliberate: **frequency, then days, then part
 * of day.** How often is the commitment; the days and the part of day
 * are where you put it. Asking for placement before the commitment
 * exists is asking about a thing that has no size yet.
 *
 * Picking days *is* setting the frequency (ADR-0024 §Schema), so the
 * stepper is replaced by a line stating what the days come to rather
 * than sitting beside them offering a second answer to one question.
 * The block stays where it is either way — swapping its contents
 * rather than removing it keeps the two controls below from jumping
 * under the finger that just lit a chip.
 *
 * Multiple days are the point, not a power feature: three chips is
 * three times a week on those three days, and the research this ADR
 * rests on is about the stability of the cue, not the count.
 *
 * **Repeats or once, first.** A one-off answers different questions —
 * how big, which day if any, due by when — so the block swaps rather
 * than growing. Putting the choice at the top means a person never
 * fills in a cadence for something that happens once.
 */
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { formatFrequency } from "./frequency";
import { FrequencyStepper } from "./FrequencyStepper";
import { OneOffPicker, type OneOffSize } from "./OneOffPicker";
import { Segmented } from "./Segmented";
import { PartOfDayPicker } from "./PartOfDayPicker";
import { frequencyForWeekdays, type PartOfDay, type Weekday } from "./planning";
import { TaskDetailPicker, type TaskDetail } from "./TaskDetailPicker";
import { WeekdayPicker } from "./WeekdayPicker";

interface SchedulePickerProps {
  /** `true` swaps the whole block for the one-off questions. */
  once: boolean;
  onOnceChange: (next: boolean) => void;
  /**
   * Whether the Repeats/Once switch is offered at all.
   *
   * False on the edit sheet. Converting a task that already has
   * completions would strand them — a recurring task turned one-off
   * reads as settled and disappears — so cadence is decided once, when
   * the task is made. Everything else about a one-off stays editable.
   */
  canChangeCadence?: boolean;
  oneOff: OneOffState;
  onOneOffChange: (next: OneOffState) => void;
  timesPerWeek: number;
  onTimesPerWeekChange: (times: number) => void;
  /** Empty is flexible — "any N days", the default and not a lesser
   *  state. Most of a plan is deliberately unpinned. */
  weekdays: Weekday[];
  onWeekdaysChange: (days: Weekday[]) => void;
  /** Null is *Anytime*, a value rather than a gap. */
  partOfDay: PartOfDay | null;
  onPartOfDayChange: (part: PartOfDay | null) => void;
  /** Which half of the fortnight a fortnightly task falls in. */
  fortnightOffset?: number;
  /** Omit and the switch-weeks control never shows. */
  onFortnightOffsetChange?: (offset: 0 | 1) => void;
  /** A clock time, a size, and part credit — all optional, all closed
   *  by default (ADR-0036 §2). */
  detail: TaskDetail;
  onDetailChange: (next: TaskDetail) => void;
  /**
   * The task is recurring commitment work, so its days are required
   * rather than optional (ADR-0033; `needsDays`). Changes what the
   * "Which days" line says, so the requirement is stated where it
   * applies instead of only as a disabled button further down.
   */
  daysRequired?: boolean;
  accent: string;
  theme: ThemeTokens;
}

export interface OneOffState {
  size: OneOffSize;
  date: string | null;
  due: string | null;
}

/** Two words, because the difference is the whole point. */
const CADENCE = [
  { value: "repeats" as const, label: "Repeats" },
  { value: "once" as const, label: "Once" },
];

export function SchedulePicker({
  once,
  onOnceChange,
  canChangeCadence = true,
  oneOff,
  onOneOffChange,
  timesPerWeek,
  onTimesPerWeekChange,
  weekdays,
  onWeekdaysChange,
  partOfDay,
  onPartOfDayChange,
  fortnightOffset = 0,
  onFortnightOffsetChange,
  detail,
  onDetailChange,
  daysRequired = false,
  accent,
  theme,
}: SchedulePickerProps) {
  const pinned = weekdays.length > 0;
  const effectiveTimes = frequencyForWeekdays(weekdays, timesPerWeek);

  return (
    /* One block, three questions. The trio used to sit as three
       siblings in the sheet's own stack, evenly spaced with the name
       and the unit, so five equal-weight fields read as a list of
       settings rather than as two questions and a plan. A rule above
       them and their own inner rhythm is what makes the sheet scan as
       *what it is*, then *when it happens*. */
    <View style={[styles.group, { borderTopColor: theme.hairline }]}>
      {canChangeCadence ? (
        <Segmented
          segments={CADENCE}
          value={once ? "once" : "repeats"}
          onChange={(next) => onOnceChange(next === "once")}
          accent={accent}
          theme={theme}
          label="Repeats or once"
        />
      ) : null}

      {once ? (
        <OneOffPicker
          size={oneOff.size}
          onSizeChange={(size) => onOneOffChange({ ...oneOff, size })}
          date={oneOff.date}
          onDateChange={(date) => onOneOffChange({ ...oneOff, date })}
          due={oneOff.due}
          onDueChange={(due) => onOneOffChange({ ...oneOff, due })}
          accent={accent}
          theme={theme}
        />
      ) : (
      <>
      <View style={styles.block}>
        <AppText variant="caption" color={theme.muted}>
          How often
        </AppText>
        {pinned ? (
          // Stated rather than implied, so picking days never feels
          // like it lost the setting the stepper used to hold. Reads as
          // fact about the plan, never as a target to hit.
          <View style={styles.derived}>
            <AppText color={theme.ink}>{formatFrequency(effectiveTimes)}</AppText>
            <AppText variant="footnote" color={theme.muted}>
              Set by the days below.
            </AppText>
          </View>
        ) : (
          <FrequencyStepper
            value={timesPerWeek}
            onChange={onTimesPerWeekChange}
            theme={theme}
          />
        )}
      </View>

      <View style={styles.block}>
        <View style={styles.blockHeader}>
          <AppText variant="caption" color={theme.muted}>
            Which days
          </AppText>
          {/* Says what "no chips" means, so flexible reads as a choice
              rather than as a field left blank, and says how to get
              back to the stepper once chips are lit. */}
          <AppText
            variant="footnote"
            // Ink, not muted, only while it is the thing standing
            // between you and Save — the one place the sheet asks.
            color={daysRequired && !pinned ? theme.ink : theme.muted}
          >
            {pinned
              ? daysRequired
                ? "Paid on these days"
                : "Clear to pick a count instead"
              : daysRequired
                ? "Pick the days it happens"
                : "Any days"}
          </AppText>
        </View>
        <WeekdayPicker
          value={weekdays}
          onChange={onWeekdaysChange}
          accent={accent}
          theme={theme}
        />

        {/* Only a fortnightly task pinned to a weekday has two possible
            answers to "which one" — every other cadence is due on every
            matching day, and the fortnight boundary is fixed so the
            date cannot decide it (ADR-0024 §1 as amended). */}
        {pinned && effectiveTimes === 0 && onFortnightOffsetChange ? (
          <Pressable
            onPress={() => onFortnightOffsetChange(fortnightOffset === 0 ? 1 : 0)}
            accessibilityRole="button"
            accessibilityLabel={
              fortnightOffset === 0
                ? "Happens this week. Switch to next week."
                : "Happens next week. Switch to this week."
            }
            style={({ pressed }) => [styles.flip, { opacity: pressed ? 0.5 : 1 }]}
          >
            <AppText variant="footnote" color={theme.muted}>
              {fortnightOffset === 0 ? "This week" : "Next week"} · switch
            </AppText>
          </Pressable>
        ) : null}
      </View>

      </>
      )}

      <View style={styles.block}>
        <AppText variant="caption" color={theme.muted}>
          When in the day
        </AppText>
        <PartOfDayPicker
          value={partOfDay}
          onChange={onPartOfDayChange}
          accent={accent}
          theme={theme}
        />
      </View>

      {/* Last, and closed. Part of day above it is the default and the
          answer most tasks will ever need; this is the step toward
          precision that is offered and never required (ADR-0036 §2).
          A one-off is not asked its size twice — it answered above. */}
      <TaskDetailPicker
        value={detail}
        onChange={onDetailChange}
        showSize={!once}
        accent={accent}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** The three questions as one unit: a rule above them, and visibly
   *  more air than the 12pt between the fields above, so the sheet
   *  reads as *what it is* and then *when it happens* rather than as
   *  five evenly spaced settings. */
  group: {
    gap: space.lg,
    paddingTop: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  block: { gap: space.sm },
  /** Sits under the chips it qualifies, quiet enough that a weekly
   *  task's row never looks like it is missing one. */
  flip: { minHeight: 32, justifyContent: "center" },
  /** Exactly the stepper's 50pt, so the two blocks below hold still
   *  when the chips take the frequency over. */
  derived: { gap: 2, minHeight: 50, justifyContent: "center" },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
});
