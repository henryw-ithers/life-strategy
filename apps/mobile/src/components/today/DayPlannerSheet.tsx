/**
 * Look ahead at a day and arrange it (ADR-0024 §4, phase 3).
 *
 * Henry, 2026-08-18: *"on Monday, I can look ahead onto tuesday's
 * tasks, move around when I want to do them, and temporarily move
 * anytime tasks into a time of day that fits the day's schedule."*
 *
 * Everything here writes `planned_occurrence` and **only** that: a
 * placement moves a row for one date and leaves the task alone. That is
 * the whole point of planning ahead — Tuesday's arrangement is a
 * statement about Tuesday, not a change to what the task usually is.
 * The permanent version lives on the task's own edit sheet.
 *
 * **A plan is an intention, not an obligation** (§2). A placement that
 * goes unfulfilled lapses silently: nothing counts it, nothing derives
 * an adherence statistic from it, and the day it belonged to never
 * mentions it again. This sheet is the surface most able to violate
 * that, so it is the one that must not.
 *
 * Completion is deliberately absent. You cannot tick a future day's
 * task — `isEditable` refuses anything after today — and offering the
 * gesture would invite exactly the "get ahead" mechanic the grade is
 * built to ignore.
 */
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { TodayTask } from "../../db/today";
import {
  ANYTIME_LABEL,
  isDueOn,
  parseWeekdays,
  PART_OF_DAY_LABEL,
  PART_OF_DAY_ORDER,
  type PartOfDay,
} from "../plan/planning";
import { wash, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { SheetFrame } from "../ui/SheetFrame";

const SLOTS: readonly (PartOfDay | null)[] = [...PART_OF_DAY_ORDER, null];

interface DayPlannerSheetProps {
  visible: boolean;
  date: string;
  /** "Tuesday", for the heading and the placement copy. */
  dayLabel: string;
  /** Everything that would appear on that day, already loaded. */
  tasks: TodayTask[];
  areaColors: Record<string, string>;
  accent: string;
  theme: ThemeTokens;
  onClose: () => void;
  /** Null clears the placement and the task falls back to its own slot. */
  onPlace: (taskId: string, part: PartOfDay | null) => void;
  onAddTask: () => void;
}

export function DayPlannerSheet({
  visible,
  date,
  dayLabel,
  tasks,
  areaColors,
  accent,
  theme,
  onClose,
  onPlace,
  onAddTask,
}: DayPlannerSheetProps) {
  const insets = useSafeAreaInsets();

  /** Pinned to other weekdays: shown, but not as part of this day's
   *  shape — the same rule the daily checklist follows. */
  const elsewhere = (t: TodayTask) => {
    const pins = parseWeekdays(t.plannedWeekdays);
    return pins.length > 0 && !isDueOn(t, date);
  };
  const forThisDay = tasks.filter((t) => !elsewhere(t));
  const otherDays = tasks.filter(elsewhere);

  const inSlot = (part: PartOfDay | null) =>
    forThisDay
      .filter((t) => t.partOfDay === part)
      .sort((a, b) => (a.dayOrder ?? 1e9) - (b.dayOrder ?? 1e9));

  /** The next slot round the loop, so one tap walks a task through the
   *  day. A drag would be the richer gesture; this is the one that
   *  works on a sheet without rebuilding the reorder machinery. */
  const nextSlot = (part: PartOfDay | null): PartOfDay | null => {
    const i = SLOTS.indexOf(part);
    return SLOTS[(i + 1) % SLOTS.length] ?? null;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SheetFrame onClose={onClose}>
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
          Plan {dayLabel}
        </AppText>
        <AppText variant="caption" color={theme.muted}>
          Tap a task to move it through the day. Anything you arrange here
          applies to {dayLabel} only — it never changes the task itself.
        </AppText>

        <ScrollView
          style={styles.scroller}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {SLOTS.map((part) => {
            const rows = inSlot(part);
            const label = part ? PART_OF_DAY_LABEL[part] : ANYTIME_LABEL;
            return (
              <View key={part ?? "anytime"} style={styles.slot}>
                <AppText variant="caption" color={theme.muted}>
                  {label}
                </AppText>
                {rows.length === 0 ? (
                  <AppText variant="footnote" color={theme.muted}>
                    Nothing here yet.
                  </AppText>
                ) : (
                  rows.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => onPlace(t.id, nextSlot(t.partOfDay))}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.title}, in ${label}. Moves to ${
                        nextSlot(t.partOfDay)
                          ? PART_OF_DAY_LABEL[nextSlot(t.partOfDay)!]
                          : ANYTIME_LABEL
                      }.`}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          backgroundColor: pressed
                            ? wash(accent, theme)
                            : theme.surface,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.pip,
                          { backgroundColor: areaColors[t.areaId] ?? theme.accent },
                        ]}
                      />
                      <AppText color={theme.ink} style={styles.grow} numberOfLines={1}>
                        {t.title}
                      </AppText>
                      {/* Says this is a one-day arrangement, so a row
                          moved here never reads as a task you changed. */}
                      {t.placedToday ? (
                        <AppText variant="footnote" color={theme.muted}>
                          moved
                        </AppText>
                      ) : null}
                    </Pressable>
                  ))
                )}
              </View>
            );
          })}

          {otherDays.length > 0 ? (
            <View style={styles.slot}>
              <AppText variant="caption" color={theme.muted}>
                Planned for other days
              </AppText>
              {otherDays.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => onPlace(t.id, "morning")}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.title}, planned for another day. Brings it into ${dayLabel} morning.`}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? wash(accent, theme) : theme.surface },
                  ]}
                >
                  <View
                    style={[
                      styles.pip,
                      { backgroundColor: areaColors[t.areaId] ?? theme.accent },
                    ]}
                  />
                  <AppText color={theme.muted} style={styles.grow} numberOfLines={1}>
                    {t.title}
                  </AppText>
                  <AppText variant="footnote" color={theme.muted}>
                    bring in
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <Button
          label="Add a task"
          variant="secondary"
          onPress={onAddTask}
          theme={theme}
        />
        <Button label="Done" variant="quiet" onPress={onClose} theme={theme} />
      </View>
      </SheetFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.sm + 2,
    gap: space.sm,
    maxHeight: "90%",
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2 },
  scroller: { flexGrow: 0 },
  body: { gap: space.lg, paddingVertical: space.md },
  slot: { gap: space.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  pip: { width: 6, height: 6, borderRadius: 3 },
  grow: { flex: 1 },
});
