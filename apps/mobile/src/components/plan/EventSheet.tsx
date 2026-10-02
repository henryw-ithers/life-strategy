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
import DateTimePicker from "@react-native-community/datetimepicker";
import { formatMinutes } from "@glide/scoring";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { eventProblem, type EventInput } from "../../db/events";
import { spokenDate } from "../../lib/format";
import { type ThemeTokens } from "../../theme/colors";
import { radius, space, type as typeScale } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";
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
  location: string | null;
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
  onSave,
  onDelete,
}: EventSheetProps) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [repeat, setRepeat] = useState<Repeat>(initial?.oneOffDate ? "once" : "weekly");
  const [days, setDays] = useState<Weekday[]>(parseWeekdays(initial?.plannedWeekdays));
  const [date, setDate] = useState<string | null>(initial?.oneOffDate ?? null);
  const [start, setStart] = useState<number | null>(initial?.startMinute ?? null);
  const [end, setEnd] = useState<number | null>(initial?.endMinute ?? null);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [picking, setPicking] = useState<"date" | "start" | "end" | null>(null);

  const input: EventInput = {
    title,
    weekdays: repeat === "weekly" ? days : [],
    date: repeat === "once" ? date : null,
    startMinute: start,
    endMinute: end,
    location,
    notes,
  };
  const problem =
    eventProblem(input) ??
    (unitChoice && unitChoice.value.length === 0 ? "Choose where it belongs." : null);

  /** Moving the start keeps the length, as every calendar does. */
  const pickStart = (m: number) => {
    const span = start !== null && end !== null ? end - start : 60;
    setStart(m);
    setEnd(Math.min(1439, m + span));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SheetFrame onClose={onClose} avoidsKeyboard>
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.canvas, paddingBottom: insets.bottom + space.lg },
          ]}
        >
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View>
              <AppText variant="title" color={theme.ink}>
                {initial ? "Edit event" : "New event"}
              </AppText>
              <AppText variant="caption" color={theme.muted}>
                {unitName
                  ? `A time you attend, in ${unitName}.`
                  : "A time you attend — a class, a shift, an appointment."}
              </AppText>
            </View>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="COMP2521 lecture"
              placeholderTextColor={theme.muted}
              autoFocus={!initial}
              accessibilityLabel="Name"
              style={[styles.input, { backgroundColor: theme.surface, color: theme.ink, ...typeScale.body }]}
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
                <TimeRow
                  label="Date"
                  value={date ? spokenDate(date) : null}
                  empty="Pick a day"
                  onPress={() => setPicking("date")}
                  theme={theme}
                />
              )}
              <TimeRow
                label="Starts"
                value={start !== null ? formatMinutes(start) : null}
                empty="Pick a time"
                onPress={() => setPicking("start")}
                theme={theme}
              />
              <TimeRow
                label="Ends"
                value={end !== null ? formatMinutes(end) : null}
                empty="Pick a time"
                onPress={() => setPicking("end")}
                theme={theme}
              />
            </View>

            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Location (optional)"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Location"
              style={[styles.input, { backgroundColor: theme.surface, color: theme.ink, ...typeScale.body }]}
            />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Notes"
              multiline
              style={[
                styles.input,
                styles.notes,
                { backgroundColor: theme.surface, color: theme.ink, ...typeScale.body },
              ]}
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
          </ScrollView>

          <Button
            label={initial ? "Save" : "Add event"}
            color={accent}
            disabled={problem !== null}
            onPress={() => onSave(input)}
            theme={theme}
          />
          {problem !== null ? (
            <AppText variant="caption" color={theme.muted} style={styles.center}>
              {problem}
            </AppText>
          ) : null}
          {onDelete ? (
            <Button label="Delete event" variant="quiet" onPress={onDelete} theme={theme} />
          ) : null}
          <Button label="Cancel" variant="quiet" onPress={onClose} theme={theme} />

          {picking !== null ? (
            <DateTimePicker
              value={
                picking === "date"
                  ? date
                    ? new Date(`${date}T12:00:00`)
                    : new Date()
                  : minutesToDate(
                      (picking === "start" ? start : end) ??
                        (picking === "start" ? 9 * 60 : (start ?? 9 * 60) + 60),
                    )
              }
              mode={picking === "date" ? "date" : "time"}
              display="spinner"
              minuteInterval={5}
              onChange={(_event, next) => {
                const which = picking;
                setPicking(null);
                if (!next || which === null) return;
                if (which === "date") {
                  setDate(toLocalDate(next));
                  return;
                }
                const m = next.getHours() * 60 + next.getMinutes();
                if (which === "start") pickStart(m);
                else setEnd(m);
              }}
            />
          ) : null}
        </View>
      </SheetFrame>
    </Modal>
  );
}

/** One "label · value" row that opens a picker. */
function TimeRow({
  label,
  value,
  empty,
  onPress,
  theme,
}: {
  label: string;
  value: string | null;
  empty: string;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value ?? empty}`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      <AppText color={theme.ink} style={styles.grow}>
        {label}
      </AppText>
      <AppText color={value ? theme.ink : theme.muted} tabular>
        {value ?? empty}
      </AppText>
    </Pressable>
  );
}

function minutesToDate(minutes: number): Date {
  const at = new Date();
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return at;
}

function toLocalDate(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(
    at.getDate(),
  ).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.screen,
    paddingTop: space.xl,
    gap: space.sm,
    maxHeight: "92%",
  },
  body: { gap: space.md, paddingBottom: space.md },
  input: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
  },
  notes: { minHeight: 88, textAlignVertical: "top" },
  card: { borderRadius: radius.lg, padding: space.md, gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.md },
  grow: { flex: 1 },
  center: { textAlign: "center" },
});
