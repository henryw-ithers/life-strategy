/**
 * The task form below the name (ADR-0024 §1, redesigned 2026-11-02):
 * how big, then repeats or once and which days, then when in the day,
 * then part credit. One component for the add and edit sheets, so the
 * two can't drift into asking the same things in two orders.
 *
 * Each question is asked **once**:
 *
 * - **Size** is one control (`SizePicker`, under the name), for a
 *   repeating task and a one-off alike. It was asked in two places.
 * - **Days** are one control: tap days to fix them, or leave them all
 *   off and say how many a week. Picking days *is* the count
 *   (ADR-0024 §Schema), so the two never offer different answers.
 * - **When in the day** is one control: Anytime, a part of the day, or
 *   a time. A part of the day and a clock time were two unlinked
 *   controls. Anytime is the default, and a time is never required
 *   (ADR-0036).
 *
 * Laid out as iOS inset groups, each with its label above it, so the
 * sheet scans as a few short questions rather than a list of settings.
 */
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { endFromClock, startFromClock } from "../../lib/calendar";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { TimeField, TimeFieldRow } from "../ui/DateTimeField";
import { AppText } from "../ui/AppText";
import { Group, GroupDivider } from "../ui/Group";
import { formatFrequency } from "./frequency";
import { FrequencyStepper } from "./FrequencyStepper";
import { OneOffPicker, type OneOffSize } from "./OneOffPicker";
import { Segmented } from "./Segmented";
import {
  frequencyForWeekdays,
  PART_OF_DAY_LABEL,
  PART_OF_DAY_ORDER,
  type PartOfDay,
  type Weekday,
} from "./planning";
import type { TaskDetail } from "./TaskDetailPicker";
import { WeekdayPicker } from "./WeekdayPicker";

export interface OneOffState {
  size: OneOffSize;
  date: string | null;
  due: string | null;
}

const SIZES = [
  { value: "quick" as const, label: "Quick" },
  { value: "normal" as const, label: "Normal" },
  { value: "big" as const, label: "Big" },
];

/** How big, under the name: about half an hour, an hour, two. */
export function SizePicker({
  value,
  onChange,
  accent,
  theme,
}: {
  value: OneOffSize;
  onChange: (size: OneOffSize) => void;
  accent: string;
  theme: ThemeTokens;
}) {
  return (
    <Segmented segments={SIZES} value={value} onChange={onChange} accent={accent} theme={theme} label="How big" />
  );
}

const CADENCE = [
  { value: "repeats" as const, label: "Repeats" },
  { value: "once" as const, label: "Once" },
];

interface SchedulePickerProps {
  once: boolean;
  onOnceChange: (next: boolean) => void;
  /** False on the edit sheet: a task with completions can't change
   *  between repeating and once without stranding them. */
  canChangeCadence?: boolean;
  oneOff: OneOffState;
  onOneOffChange: (next: OneOffState) => void;
  timesPerWeek: number;
  onTimesPerWeekChange: (times: number) => void;
  /** Empty is "any N days", the default and not a lesser state. */
  weekdays: Weekday[];
  onWeekdaysChange: (days: Weekday[]) => void;
  /** Null is Anytime, unless a time is set. */
  partOfDay: PartOfDay | null;
  onPartOfDayChange: (part: PartOfDay | null) => void;
  fortnightOffset?: number;
  /** Omit and the switch-weeks control never shows. */
  onFortnightOffsetChange?: (offset: 0 | 1) => void;
  /** Its time and part credit. Its size is `SizePicker`'s. */
  detail: TaskDetail;
  onDetailChange: (next: TaskDetail) => void;
  /** Recurring commitment work must name its days (ADR-0033). */
  daysRequired?: boolean;
  accent: string;
  theme: ThemeTokens;
}

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
  const times = frequencyForWeekdays(weekdays, timesPerWeek);
  const timed = detail.startMinute !== null;

  /** One choice for when in the day: a part, Anytime, or a time. */
  const pickWhen = (next: PartOfDay | "anytime" | "time") => {
    if (next === "time") {
      const start = detail.startMinute ?? startFromClock(9 * 60);
      onPartOfDayChange(null);
      onDetailChange({ ...detail, startMinute: start, endMinute: detail.endMinute ?? start + 30 });
      return;
    }
    onDetailChange({ ...detail, startMinute: null, endMinute: null });
    onPartOfDayChange(next === "anytime" ? null : next);
  };
  const when = timed ? "time" : (partOfDay ?? "anytime");

  return (
    <View style={styles.root}>
      <Group theme={theme} title={once ? "When it happens" : "Days"}>
        <View style={styles.stack}>
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
              date={oneOff.date}
              onDateChange={(date) => onOneOffChange({ ...oneOff, date })}
              due={oneOff.due}
              onDueChange={(due) => onOneOffChange({ ...oneOff, due })}
              accent={accent}
              theme={theme}
            />
          ) : (
            <>
              <WeekdayPicker value={weekdays} onChange={onWeekdaysChange} accent={accent} theme={theme} />
              {pinned ? (
                <View style={styles.daysLine}>
                  <AppText color={theme.ink} style={styles.grow}>
                    {formatFrequency(times)}
                  </AppText>
                  {!daysRequired ? (
                    <Pressable
                      onPress={() => onWeekdaysChange([])}
                      accessibilityRole="button"
                      accessibilityLabel="Clear the days, and say how many a week instead"
                      hitSlop={8}
                      style={styles.link}
                    >
                      <AppText variant="caption" color={accent}>
                        Any days instead
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              ) : daysRequired ? (
                <AppText variant="footnote" color={theme.ink}>
                  Pick the days it happens.
                </AppText>
              ) : (
                // No days picked: how many a week, any days. The stepper
                // says it in words ("3 days a week"), so it needs no label.
                <FrequencyStepper value={timesPerWeek} onChange={onTimesPerWeekChange} theme={theme} />
              )}
              {/* A fortnightly task on a weekday has two answers to
                  "which week" (ADR-0024 §1 as amended). */}
              {pinned && times === 0 && onFortnightOffsetChange ? (
                <Pressable
                  onPress={() => onFortnightOffsetChange(fortnightOffset === 0 ? 1 : 0)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    fortnightOffset === 0
                      ? "Happens this week. Switch to next week."
                      : "Happens next week. Switch to this week."
                  }
                  style={styles.link}
                >
                  <AppText variant="footnote" color={theme.muted}>
                    {fortnightOffset === 0 ? "This week" : "Next week"} · switch
                  </AppText>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </Group>

      <Group theme={theme} title="When in the day">
        <View style={styles.stack}>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="When in the day">
            {(["anytime", ...PART_OF_DAY_ORDER, "time"] as const).map((option) => {
              const on = when === option;
              const label =
                option === "anytime" ? "Anytime" : option === "time" ? "At a time" : PART_OF_DAY_LABEL[option];
              return (
                <Pressable
                  key={option}
                  onPress={() => pickWhen(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: on ? accent : theme.hairline,
                      backgroundColor: on ? theme.fill : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <AppText variant="caption" color={on ? theme.ink : theme.muted}>
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {timed ? (
            <View>
              <TimeFieldRow style={styles.timeRow}>
                <AppText color={theme.ink} style={styles.grow}>
                  Starts
                </AppText>
                <TimeField
                  minutes={detail.startMinute!}
                  onChange={(clock) => {
                    const start = startFromClock(clock);
                    const span = detail.endMinute !== null ? detail.endMinute - detail.startMinute! : null;
                    onDetailChange({ ...detail, startMinute: start, endMinute: span === null ? null : start + span });
                  }}
                  label="Starts"
                  accent={accent}
                  theme={theme}
                />
              </TimeFieldRow>
              <GroupDivider theme={theme} />
              <TimeFieldRow style={styles.timeRow}>
                <AppText color={theme.ink} style={styles.grow}>
                  Ends
                </AppText>
                {detail.endMinute !== null ? (
                  <TimeField
                    minutes={detail.endMinute}
                    onChange={(clock) =>
                      onDetailChange({
                        ...detail,
                        endMinute: Math.max(endFromClock(detail.startMinute!, clock), detail.startMinute! + 15),
                      })
                    }
                    label="Ends"
                    accent={accent}
                    theme={theme}
                  />
                ) : (
                  <Pressable
                    onPress={() => onDetailChange({ ...detail, endMinute: detail.startMinute! + 30 })}
                    accessibilityRole="button"
                    accessibilityLabel="Ends, open-ended. Set an end"
                    style={styles.link}
                  >
                    <AppText variant="caption" color={accent}>
                      Add an end
                    </AppText>
                  </Pressable>
                )}
              </TimeFieldRow>
            </View>
          ) : null}
        </View>
      </Group>

      <Group
        theme={theme}
        footnote="Tick part of it on a busy day, and it counts for the part you did."
      >
        <View style={styles.switchRow}>
          <AppText color={theme.ink} style={styles.grow}>
            Part credit
          </AppText>
          <Switch
            value={detail.allowsPartial}
            onValueChange={(allowsPartial) => onDetailChange({ ...detail, allowsPartial })}
            trackColor={{ false: theme.hairline, true: accent }}
            thumbColor={theme.canvas}
            accessibilityLabel="Part credit"
          />
        </View>
      </Group>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  stack: { gap: space.md },
  grow: { flex: 1 },
  daysLine: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  link: { minHeight: 44, justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
  },
  timeRow: { flexDirection: "row", alignItems: "center", minHeight: 48 },
  switchRow: { flexDirection: "row", alignItems: "center", minHeight: 44 },
});
