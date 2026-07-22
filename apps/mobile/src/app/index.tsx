/**
 * Today — the daily checklist, the app's home (replaces the scaffold).
 * A checklist and a number: today's derived tasks, a grade that only
 * climbs while you watch it, and the day's life-log. Day navigation
 * spans the ADR-0004 edit window; "today" is just the selected day.
 * The date header expands the current month (calendar phase, early).
 */
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { LinearTransition, useReducedMotion } from "react-native-reanimated";

import { ActivitySheet, type ExistingActivity } from "../components/today/ActivitySheet";
import { DayKindSheet } from "../components/today/DayKindSheet";
import { DayNumber } from "../components/today/DayNumber";
import { MonthGrid } from "../components/today/MonthGrid";
import { NoteSheet } from "../components/today/NoteSheet";
import { TaskRow } from "../components/today/TaskRow";
import { WeekStrip } from "../components/today/WeekStrip";
import { AppText } from "../components/ui/AppText";
import { Backdrop, constellation } from "../components/ui/Backdrop";
import { Button } from "../components/ui/Button";
import {
  addJournalEntry,
  addPhoto,
  currentLocalDate,
  deleteActivity,
  editWindowDays,
  loadDay,
  loadMonthGrades,
  logActivity,
  setDayKind,
  toggleCompletion,
  updateActivity,
  type DayData,
  type MonthDay,
  type TodayActivity,
  type TodayTask,
} from "../db/today";
import { spokenDate } from "../lib/format";
import { getTheme, type ThemeTokens } from "../theme/colors";
import { radius, space } from "../theme/tokens";

type SectionKey = "everyDay" | "thisWeek" | "doneWeek" | "completed";

export default function TodayScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  /** Null = follow today (so an overnight rollover moves with us);
   *  a date = the user navigated somewhere in the edit window. */
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<DayData | null>(null);
  const [monthGrades, setMonthGrades] = useState<Map<string, MonthDay>>(new Map());
  const [monthOpen, setMonthOpen] = useState(false);
  const [kindSheet, setKindSheet] = useState(false);
  const [activitySheet, setActivitySheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  const [editingActivity, setEditingActivity] = useState<TodayActivity | null>(null);
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    everyDay: false,
    thisWeek: false,
    doneWeek: false,
    completed: false,
  });
  const allDoneBefore = useRef(false);

  const reload = useCallback(async (date: string) => {
    const [next, grades] = await Promise.all([
      loadDay(date),
      loadMonthGrades(currentLocalDate()),
    ]);
    setDay(next);
    setMonthGrades(grades);
    return next;
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload(selected ?? currentLocalDate()).then((d) => {
        allDoneBefore.current =
          d.daily.length > 0 && d.daily.every((t) => t.completedToday);
      });
    }, [reload, selected]),
  );

  const select = (date: string) => {
    setSelected(date === currentLocalDate() ? null : date);
    void reload(date);
  };

  const onToggle = async (task: TodayTask) => {
    if (!day) return;
    void Haptics.selectionAsync();
    await toggleCompletion(task.id, day.date);
    const next = await reload(day.date);
    // The visual feedback is the climbing number; give screen readers
    // the same loop.
    AccessibilityInfo.announceForAccessibility(
      `${task.title} ${task.completedToday ? "unchecked" : "done"}. Day at ${Math.round(next.score.base ?? 0)}.`,
    );
    const allDone =
      next.daily.length > 0 && next.daily.every((t) => t.completedToday);
    if (allDone && !allDoneBefore.current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    allDoneBefore.current = allDone;
  };

  const pickPhoto = async () => {
    if (!day) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      await addPhoto(day.date, res.assets[0].uri);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await reload(day.date);
    }
  };

  const isToday = day?.date === day?.today;
  const dormant = day !== null && day.score.earned === 0;
  const layout = reduceMotion ? undefined : LinearTransition.duration(200);

  const hueFor = (t: TodayTask) => theme.areas[t.areaId] ?? theme.accent;

  // Presentation-level re-sort: anything done today lives in Completed.
  const allTasks = day ? [...day.daily, ...day.week, ...day.doneThisWeek] : [];
  const sections: {
    key: SectionKey;
    label: string;
    tasks: TodayTask[];
    pts: number;
  }[] = day
    ? [
        {
          key: "everyDay" as const,
          label: "Every day",
          tasks: day.daily.filter((t) => !t.completedToday),
          pts: day.daily
            .filter((t) => !t.completedToday)
            .reduce((a, t) => a + t.pointValue, 0),
        },
        {
          key: "thisWeek" as const,
          label: "This week",
          tasks: day.week.filter((t) => !t.completedToday),
          pts: day.week
            .filter((t) => !t.completedToday)
            .reduce((a, t) => a + t.pointValue, 0),
        },
        {
          key: "doneWeek" as const,
          label: "Done this week",
          tasks: day.doneThisWeek.filter((t) => !t.completedToday),
          pts: day.doneThisWeek
            .filter((t) => !t.completedToday)
            .reduce((a, t) => a + t.pointsIfCompletedNow, 0),
        },
        {
          key: "completed" as const,
          label: "Completed",
          tasks: allTasks.filter((t) => t.completedToday),
          pts: allTasks
            .filter((t) => t.completedToday)
            .reduce(
              (a, t) => a + (t.extraToday ? t.pointsIfCompletedNow : t.pointValue),
              0,
            ),
        },
      ].filter((s) => s.tasks.length > 0)
    : [];

  const closeActivitySheet = () => {
    setActivitySheet(false);
    setEditingActivity(null);
  };

  const existingForSheet: ExistingActivity | null = editingActivity
    ? {
        id: editingActivity.id,
        title: editingActivity.title,
        note: editingActivity.note,
        size: editingActivity.size,
        tagUnitIds: editingActivity.tags.map((t) => t.unitId),
      }
    : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        {day === null ? (
          <ActivityIndicator color={theme.muted} style={{ marginTop: space.xxxl }} />
        ) : (
          <>
            {/* ── Header ── */}
            <View style={styles.headerRow}>
              <Pressable
                onPress={() => setMonthOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={`${spokenDate(day.date)}. ${monthOpen ? "Hide" : "Show"} the month`}
                style={styles.headerText}
              >
                <AppText variant="display" color={theme.ink}>
                  {isToday ? "Today" : spokenDate(day.date).split(",")[0]}
                </AppText>
                <AppText variant="caption" color={theme.muted}>
                  {spokenDate(day.date)}
                  {day.finalized ? " · sealed" : ""} {monthOpen ? "▴" : "▾"}
                </AppText>
              </Pressable>
              <View style={styles.headerRight}>
                {day.kind === "rest" ? (
                  <AppText variant="title" color={theme.muted}>
                    Rest
                  </AppText>
                ) : (
                  <DayNumber
                    key={day.date}
                    base={day.score.base}
                    dormant={dormant && day.kind === "normal"}
                    theme={theme}
                    reduceMotion={reduceMotion}
                  />
                )}
                {day.editable ? (
                  <Pressable
                    onPress={() => setKindSheet(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Change what kind of day this is"
                    style={({ pressed }) => [styles.kindButton, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <AppText variant="headline" color={theme.muted}>
                      ⋯
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* ── Day record actions (journal is edit-window exempt) ── */}
            {day.date <= day.today ? (
              <View style={styles.recordButtons}>
                <Pressable
                  onPress={() => setNoteSheet(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                >
                  <AppText variant="label" color={theme.accent}>
                    + Note
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => void pickPhoto()}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
                >
                  <AppText variant="label" color={theme.accent}>
                    + Photo
                  </AppText>
                </Pressable>
              </View>
            ) : null}

            {/* ── Month / week navigation ── */}
            {monthOpen ? (
              <Animated.View layout={layout} style={styles.strip}>
                <MonthGrid
                  month={day.today}
                  grades={monthGrades}
                  selected={day.date}
                  today={day.today}
                  onSelect={select}
                  theme={theme}
                />
              </Animated.View>
            ) : (
              <Animated.View layout={layout} style={styles.strip}>
                <WeekStrip
                  days={editWindowDays(day.today)}
                  selected={day.date}
                  today={day.today}
                  onSelect={select}
                  theme={theme}
                />
              </Animated.View>
            )}

            {day.finalized ? (
              <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
                This week is sealed — days settle for good a few days after
                they end. Notes and photos stay open.
              </AppText>
            ) : null}

            {day.kind === "rest" ? (
              <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
                Nothing counts today; anything you do still logs.
              </AppText>
            ) : null}

            {/* ── The day's record: ahead of tasks on past days, where
                the log leads; below them on today, where doing leads. ── */}
            {!isToday ? <DayRecord day={day} theme={theme} /> : null}

            {/* ── Body ── */}
            {!day.hasSnapshot ? (
              <View style={styles.empty}>
                <AppText color={theme.ink} style={styles.centerText}>
                  Your day starts with a plan. Rate what matters first, and
                  the checklist builds itself.
                </AppText>
                <Button
                  label="Run the diagnostic"
                  onPress={() => router.push("/diagnostic" as Href)}
                  theme={theme}
                />
              </View>
            ) : !day.hasTasks ? (
              <View style={styles.empty}>
                <AppText color={theme.ink} style={styles.centerText}>
                  Your daily budget is set — now give it something to do.
                </AppText>
                <Button
                  label="Plan your tasks"
                  onPress={() => router.push("/plan" as Href)}
                  theme={theme}
                />
              </View>
            ) : day.kind === "special" ? (
              <View style={styles.special}>
                <AppText variant="title" color={theme.ink}>
                  {day.title ?? "A special day"}
                </AppText>
                <AppText variant="caption" color={theme.muted}>
                  {day.satisfactionRating !== null
                    ? `Rated ${day.satisfactionRating} of 10`
                    : "Tasks are off. When it's over, rate how it was."}
                </AppText>
                {day.editable ? (
                  <Button
                    label={day.satisfactionRating === null ? "Rate the day" : "Edit the day"}
                    variant="secondary"
                    onPress={() => setKindSheet(true)}
                    theme={theme}
                  />
                ) : null}
              </View>
            ) : (
              sections.map((s) => (
                <Animated.View
                  key={s.key}
                  layout={layout}
                  style={[styles.band, { borderTopColor: theme.hairline }]}
                >
                  <Pressable
                    onPress={() =>
                      setCollapsed((prev) => ({ ...prev, [s.key]: !prev[s.key] }))
                    }
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !collapsed[s.key] }}
                    accessibilityLabel={`${s.label}, ${s.pts} points`}
                    style={styles.sectionHeader}
                  >
                    <AppText variant="caption" color={theme.muted}>
                      {s.label} {collapsed[s.key] ? "▸" : "▾"}
                    </AppText>
                    <AppText variant="caption" color={theme.muted} tabular>
                      {s.pts} pts
                    </AppText>
                  </Pressable>
                  {!collapsed[s.key]
                    ? s.tasks.map((t) => (
                        <Animated.View key={t.id} layout={layout}>
                          <TaskRow
                            task={t}
                            hue={hueFor(t)}
                            disabled={!day.editable}
                            onToggle={() => void onToggle(t)}
                            theme={theme}
                            reduceMotion={reduceMotion}
                          />
                        </Animated.View>
                      ))
                    : null}
                </Animated.View>
              ))
            )}

            {/* ── Activities ── */}
            {day.hasSnapshot && day.hasTasks ? (
              <Animated.View
                layout={layout}
                style={[styles.band, { borderTopColor: theme.hairline }]}
              >
                {day.activities.length > 0 ? (
                  <AppText variant="caption" color={theme.muted}>
                    Logged
                  </AppText>
                ) : null}
                {day.activities.map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    dayKind={day.kind}
                    disabled={!day.editable}
                    onPress={() => {
                      setEditingActivity(a);
                      setActivitySheet(true);
                    }}
                    theme={theme}
                  />
                ))}
                {day.editable ? (
                  <Pressable
                    onPress={() => {
                      setEditingActivity(null);
                      setActivitySheet(true);
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.logButton, { opacity: pressed ? 0.5 : 1 }]}
                  >
                    <AppText variant="label" color={theme.accent}>
                      + Log an activity
                    </AppText>
                  </Pressable>
                ) : null}
              </Animated.View>
            ) : null}

            {/* ── Today's record sits below the checklist (feedback,
                without pushing today's tasks down). ── */}
            {isToday ? <DayRecord day={day} theme={theme} /> : null}

            {/* ── Footer ── */}
            <View style={[styles.footer, { borderTopColor: theme.hairline }]}>
              <View style={styles.footerLinks}>
                <Pressable
                  onPress={() => router.push("/plan" as Href)}
                  accessibilityRole="button"
                  style={styles.footerLink}
                >
                  <AppText variant="label" color={theme.muted}>
                    Plan
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/goals" as Href)}
                  accessibilityRole="button"
                  style={styles.footerLink}
                >
                  <AppText variant="label" color={theme.muted}>
                    Goals
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/diagnostic" as Href)}
                  accessibilityRole="button"
                  style={styles.footerLink}
                >
                  <AppText variant="label" color={theme.muted}>
                    Diagnostic
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/portfolio" as Href)}
                  accessibilityRole="button"
                  style={styles.footerLink}
                >
                  <AppText variant="label" color={theme.muted}>
                    Portfolio
                  </AppText>
                </Pressable>
              </View>
              <AppText variant="footnote" color={theme.muted}>
                Grades are guidelines, not judgments.
              </AppText>
            </View>
          </>
        )}
      </ScrollView>

      {day ? (
        <>
          <NoteSheet
            visible={noteSheet}
            dayLabel={isToday ? "today" : spokenDate(day.date).split(",")[0] ?? day.date}
            theme={theme}
            onClose={() => setNoteSheet(false)}
            onCommit={(body) => {
              void addJournalEntry(day.date, body).then(() => reload(day.date));
            }}
          />
          <DayKindSheet
            visible={kindSheet}
            dayLabel={isToday ? "today" : spokenDate(day.date).split(",")[0] ?? day.date}
            kind={day.kind}
            title={day.title}
            satisfactionRating={day.satisfactionRating}
            theme={theme}
            reduceMotion={reduceMotion}
            onClose={() => setKindSheet(false)}
            onCommit={(kind, opts) => {
              void setDayKind(day.date, kind, opts).then(() => reload(day.date));
            }}
          />
          <ActivitySheet
            visible={activitySheet}
            dayKind={day.kind}
            units={day.units}
            existing={existingForSheet}
            theme={theme}
            onClose={closeActivitySheet}
            onCommit={(title, note, size, unitIds) => {
              const write = existingForSheet
                ? updateActivity(existingForSheet.id, day.date, title, note, size, unitIds)
                : logActivity(day.date, title, note, size, unitIds);
              void write.then(() => reload(day.date));
            }}
            onDelete={
              existingForSheet
                ? () => {
                    void deleteActivity(existingForSheet.id, day.date).then(() =>
                      reload(day.date),
                    );
                  }
                : undefined
            }
          />
        </>
      ) : null}
    </View>
  );
}

/** The day's journal notes and photos. Rendered before the checklist
 *  on past days (the log leads) and after it on today (feedback).
 *  Tapping a photo opens it full-screen; tap again to close. */
function DayRecord({ day, theme }: { day: DayData; theme: ThemeTokens }) {
  const [viewing, setViewing] = useState<string | null>(null);
  if (day.journal.length === 0 && day.photos.length === 0) return null;
  return (
    <View style={[styles.band, { borderTopColor: theme.hairline }]}>
      <AppText variant="caption" color={theme.muted}>
        {day.date === day.today ? "Today's notes" : "From this day"}
      </AppText>
      {day.photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.photoRow}>
            {day.photos.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setViewing(p.uri)}
                accessibilityRole="imagebutton"
                accessibilityLabel={p.caption ?? "Photo from this day. Opens full screen."}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Image
                  source={{ uri: p.uri }}
                  style={styles.photoThumb}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
      {day.journal.map((j) => (
        <AppText key={j.id} color={theme.ink}>
          {j.body}
        </AppText>
      ))}

      <Modal
        visible={viewing !== null}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <Pressable
          style={styles.photoViewer}
          onPress={() => setViewing(null)}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          {viewing ? (
            <Image
              source={{ uri: viewing }}
              style={styles.photoFull}
              contentFit="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function ActivityRow({
  activity,
  dayKind,
  disabled,
  onPress,
  theme,
}: {
  activity: TodayActivity;
  dayKind: DayData["kind"];
  disabled: boolean;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}${
        activity.creditedPoints > 0 ? `, ${activity.creditedPoints} points` : ""
      }. Opens to edit.`}
      style={({ pressed }) => [styles.activityRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.tagDots}>
        {(activity.tags.length > 0 ? activity.tags : [null]).map((tag, i) => (
          <View
            key={tag ? tag.unitId : `plain-${i}`}
            style={[
              styles.tagDot,
              {
                backgroundColor: tag
                  ? theme.areas[tag.areaId] ?? theme.muted
                  : theme.hairline,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.activityText}>
        <AppText color={theme.ink} numberOfLines={1}>
          {activity.title}
        </AppText>
        {activity.note ? (
          <AppText variant="footnote" color={theme.muted} numberOfLines={1}>
            {activity.note}
          </AppText>
        ) : null}
      </View>
      {activity.creditedPoints > 0 && dayKind === "normal" ? (
        <AppText variant="footnote" color={theme.accent} tabular>
          +{activity.creditedPoints}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  container: { paddingHorizontal: space.screen },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  headerRight: { alignItems: "flex-end", gap: space.xs },
  kindButton: { minWidth: 44, minHeight: 32, alignItems: "flex-end" },
  recordButtons: {
    flexDirection: "row",
    gap: space.xl,
    marginTop: space.sm,
    minHeight: 32,
    alignItems: "center",
  },
  photoRow: { flexDirection: "row", gap: space.sm },
  photoThumb: { width: 110, height: 110, borderRadius: radius.lg },
  photoViewer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoFull: { width: "100%", height: "100%" },
  strip: { marginTop: space.lg },
  stateNote: { marginTop: space.md },
  empty: { gap: space.lg, marginTop: space.xxl },
  centerText: { textAlign: "center" },
  special: { gap: space.sm, marginTop: space.xl },
  band: {
    marginTop: space.lg,
    paddingTop: space.md,
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 32,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
  },
  tagDots: { flexDirection: "row", gap: 3 },
  tagDot: { width: 8, height: 8, borderRadius: 4 },
  activityText: { flex: 1, gap: 1 },
  logButton: { minHeight: 44, justifyContent: "center" },
  footer: {
    marginTop: space.xl,
    paddingTop: space.lg,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerLinks: { flexDirection: "row", gap: space.xl },
  footerLink: { minHeight: 44, justifyContent: "center" },
});
