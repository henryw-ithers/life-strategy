/**
 * Adding or editing an event — a window of time you attend: a class, a
 * shift, a practice, a doctor's visit (ADR-0038).
 *
 * **It looks different from the task sheet on purpose** (Henry,
 * 2026-10-02). A task asks how often and leaves the time optional,
 * because most work fits wherever it fits. An event asks *when*: the
 * days or the date come first, then a start and an end that are
 * required, then where. Size and part credit are not offered — an event
 * is the time you turned up for, and it is ticked whole.
 *
 * What is stopping a save is said in words under the button rather
 * than left as a greyed button that explains nothing.
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { eventProblem, type EventInput } from "../../db/events";
import { currentLocalDate } from "../../lib/calendar";
import { type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { DayField, TimeField } from "../ui/DateTimeField";
import { KeyboardScroll } from "../ui/KeyboardScroll";
import { NativeSheet } from "../ui/NativeSheet";
import { TextField } from "../ui/TextField";
import { parseWeekdays, type Weekday } from "./planning";
import { Segmented } from "./Segmented";
import { UnitPicker } from "./UnitPicker";
import type { PickableUnit } from "./UnitPicker";
import { WeekdayPicker } from "./WeekdayPicker";

export interface EventSheetValue {
  title: string;
  plannedWeekdays: string | null;
  oneOffDate: string | null;
  startMinute: number | null;
  endMinute: number | null;
  notes: string | null;
}

interface EventSheetProps {
  visible: boolean;
  /** Set when editing an existing event. */
  initial?: EventSheetValue;
  /** Where it is filed, for the subtitle — "COMP2521". */
  unitName?: string;
  /**
   * Offered only where the event's unit is still to be chosen — the
   * Tasks screen. A commitment's screen already knows.
   */
  unitChoice?: {
    units: PickableUnit[];
    value: string[];
    onChange: (next: string[]) => void;
    areaColors: Record<string, string>;
  };
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  /** After it has finished closing (`NativeSheet`). */
  onDismissed?: () => void;
  onSave: (input: EventInput) => void;
  /** Offered when editing. */
  onDelete?: () => void;
}

type Repeat = "weekly" | "once";

const REPEATS = [
  { value: "weekly" as const, label: "Every week" },
  { value: "once" as const, label: "One time" },
];

export function EventSheet({
  visible,
  initial,
  unitName,
  unitChoice,
  accent,
  theme,
  onClose,
  onDismissed,
  onSave,
  onDelete,
}: EventSheetProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [repeat, setRepeat] = useState<Repeat>(initial?.oneOffDate ? "once" : "weekly");
  const [days, setDays] = useState<Weekday[]>(parseWeekdays(initial?.plannedWeekdays));
  const [date, setDate] = useState<string | null>(initial?.oneOffDate ?? null);
  const [start, setStart] = useState<number | null>(initial?.startMinute ?? null);
  const [end, setEnd] = useState<number | null>(initial?.endMinute ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const input: EventInput = {
    title,
    weekdays: repeat === "weekly" ? days : [],
    date: repeat === "once" ? date : null,
    startMinute: start,
    endMinute: end,
    notes,
  };
  const problem =
    eventProblem(input) ??
    (unitChoice && unitChoice.value.length === 0 ? "Choose where it belongs." : null);

  /** Moving the start keeps the length, as every calendar does. A
   *  first start brings an hour-long end with it, unless an end was
   *  already chosen. */
  const pickStart = (m: number) => {
    setStart(m);
    if (start !== null && end !== null) setEnd(Math.min(1439, m + (end - start)));
    else if (end === null) setEnd(Math.min(1439, m + 60));
  };

  return (
    <NativeSheet onDismissed={onDismissed}
      visible={visible}
      onClose={onClose}
      size="large"
      title={initial ? "Edit event" : "New event"}
      confirm={{
        label: initial ? "Save" : "Add",
        onPress: () => onSave(input),
        disabled: problem !== null,
      }}
    >
      <KeyboardScroll style={styles.scroller} contentContainerStyle={styles.body}>
        <AppText variant="caption" color={theme.muted}>
          {unitName
            ? `A time you attend, in ${unitName}.`
            : "A time you attend — a class, a shift, an appointment."}
        </AppText>

        <TextField
          theme={theme}
          value={title}
          onChangeText={setTitle}
          placeholder="COMP2521 lecture"
          autoFocus={!initial}
          accessibilityLabel="Name"
          style={styles.input}
        />

        {/* When comes first: an event is defined by it. */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Segmented
            segments={REPEATS}
            value={repeat}
            onChange={setRepeat}
            accent={accent}
            theme={theme}
            label="Repeats"
          />
          {repeat === "weekly" ? (
            <WeekdayPicker value={days} onChange={setDays} accent={accent} theme={theme} />
          ) : (
            <PickRow
              label="Date"
              empty="Pick a day"
              onSet={() => setDate(currentLocalDate())}
              theme={theme}
            >
              {date !== null ? (
                <DayField date={date} onChange={setDate} label="Date" accent={accent} theme={theme} />
              ) : null}
            </PickRow>
          )}
          <PickRow
            label="Starts"
            empty="Pick a time"
            onSet={() => pickStart(9 * 60)}
            theme={theme}
          >
            {start !== null ? (
              <TimeField minutes={start} onChange={pickStart} label="Starts" accent={accent} theme={theme} />
            ) : null}
          </PickRow>
          <PickRow
            label="Ends"
            empty="Pick a time"
            onSet={() => setEnd(Math.min(1439, (start ?? 9 * 60) + 60))}
            theme={theme}
          >
            {end !== null ? (
              <TimeField minutes={end} onChange={setEnd} label="Ends" accent={accent} theme={theme} />
            ) : null}
          </PickRow>
        </View>

        <TextField
          theme={theme}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optional)"
          accessibilityLabel="Notes"
          multiline
        />

        {unitChoice ? (
          <UnitPicker
            units={unitChoice.units}
            value={unitChoice.value}
            onChange={unitChoice.onChange}
            theme={theme}
            areaColors={unitChoice.areaColors}
          />
        ) : null}
      </KeyboardScroll>
      {problem !== null ? (
        <AppText variant="caption" color={theme.muted} style={styles.center}>
          {problem}
        </AppText>
      ) : null}
      {onDelete ? (
        <Button label="Delete event" variant="quiet" onPress={onDelete} theme={theme} />
      ) : null}
    </NativeSheet>
  );
}

/**
 * One "label · picker" row. Until it is set, the picker's place holds a
 * prompt that sets it, because a picker can't show "not chosen yet" and
 * an event's times are never filled in for you.
 */
function PickRow({
  label,
  empty,
  onSet,
  theme,
  children,
}: {
  label: string;
  empty: string;
  onSet: () => void;
  theme: ThemeTokens;
  /** The picker, or null while unset. */
  children: React.ReactNode;
}) {
  const set = children !== null && children !== undefined;
  return (
    <View style={styles.row}>
      <AppText color={theme.ink} style={styles.grow}>
        {label}
      </AppText>
      {set ? (
        children
      ) : (
        <Pressable
          onPress={onSet}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${empty}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, minHeight: 44, justifyContent: "center" })}
        >
          <AppText color={theme.muted}>{empty}</AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Takes the rest of the full-height sheet, and scrolls in it. */
  scroller: { flex: 1 },
  body: { gap: space.md, paddingBottom: space.md },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
  },
  card: { borderRadius: radius.lg, padding: space.md, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md },
  grow: { flex: 1 },
  center: { textAlign: "center" },
});
