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
 * wheel is replaced by a line stating what the days come to rather than
 * sitting beside them offering a second answer to one question. The
 * block stays where it is either way — swapping its contents rather
 * than removing it keeps the two controls below from jumping under the
 * finger that just lit a chip.
 *
 * Multiple days are the point, not a power feature: three chips is
 * three times a week on those three days, and the research this ADR
 * rests on is about the stability of the cue, not the count.
 */
import { StyleSheet, View } from "react-native";

import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { formatFrequency } from "./frequency";
import { FrequencyPicker } from "./FrequencyPicker";
import { PartOfDayPicker } from "./PartOfDayPicker";
import { frequencyForWeekdays, type PartOfDay, type Weekday } from "./planning";
import { WeekdayPicker } from "./WeekdayPicker";

interface SchedulePickerProps {
  timesPerWeek: number;
  onTimesPerWeekChange: (times: number) => void;
  /** Empty is flexible — "any N days", the default and not a lesser
   *  state. Most of a plan is deliberately unpinned. */
  weekdays: Weekday[];
  onWeekdaysChange: (days: Weekday[]) => void;
  /** Null is *Anytime*, a value rather than a gap. */
  partOfDay: PartOfDay | null;
  onPartOfDayChange: (part: PartOfDay | null) => void;
  accent: string;
  theme: ThemeTokens;
}

export function SchedulePicker({
  timesPerWeek,
  onTimesPerWeekChange,
  weekdays,
  onWeekdaysChange,
  partOfDay,
  onPartOfDayChange,
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
      <View style={styles.block}>
        <AppText variant="caption" color={theme.muted}>
          How often
        </AppText>
        {pinned ? (
          // Stated rather than implied, so picking days never feels
          // like it lost the setting the wheel used to hold. Reads as
          // fact about the plan, never as a target to hit.
          <View style={styles.derived}>
            <AppText color={theme.ink}>{formatFrequency(effectiveTimes)}</AppText>
            <AppText variant="footnote" color={theme.muted}>
              Set by the days below.
            </AppText>
          </View>
        ) : (
          <FrequencyPicker
            value={timesPerWeek}
            onChange={onTimesPerWeekChange}
            accent={accent}
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
              back to the wheel once chips are lit. */}
          <AppText variant="footnote" color={theme.muted}>
            {pinned ? "Clear to pick a count instead" : "Any days"}
          </AppText>
        </View>
        <WeekdayPicker
          value={weekdays}
          onChange={onWeekdaysChange}
          accent={accent}
          theme={theme}
        />
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  /** The three questions as one unit: a rule above them, more air than
   *  the gap between fields, and its own internal rhythm. */
  group: {
    gap: space.lg,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  block: { gap: space.sm },
  /** Sits in the wheel's place, so the two blocks under it hold still
   *  when the chips take the frequency over. */
  derived: { gap: 2, minHeight: 44, justifyContent: "center" },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
});
