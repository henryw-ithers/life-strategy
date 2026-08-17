/**
 * Today — the daily checklist, the app's home (replaces the scaffold).
 * A checklist and a number: today's derived tasks, a grade that only
 * climbs while you watch it, and the day's life-log. Day navigation
 * spans the ADR-0004 edit window; "today" is just the selected day.
 * The date header expands the current month (calendar phase, early).
 */
import { specialDayBonus, weekStart, type PeriodGrade } from "@glide/scoring";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Redirect, router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

import { ActivitySheet, type ExistingActivity } from "../../components/today/ActivitySheet";
import { DayKindSheet } from "../../components/today/DayKindSheet";
import { DayNumber } from "../../components/today/DayNumber";
import { MonthGrid } from "../../components/today/MonthGrid";
import { NoteSheet } from "../../components/today/NoteSheet";
import { TaskRow } from "../../components/today/TaskRow";
import { WeekStrip } from "../../components/today/WeekStrip";
import {
  ANYTIME_LABEL,
  isPinnedOn,
  parseWeekdays,
  PART_OF_DAY_LABEL,
  PART_OF_DAY_ORDER,
  type PartOfDay,
} from "../../components/plan/planning";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, constellation } from "../../components/ui/Backdrop";
import { Button } from "../../components/ui/Button";
import { loadWeekGrade } from "../../db/grades";
import { isOnboardingComplete } from "../../db/onboarding";
import {
  addJournalEntry,
  addPhoto,
  currentLocalDate,
  deleteActivity,
  deleteJournalEntry,
  deletePhoto,
  editWindowDays,
  loadDay,
  loadCalendarGrades,
  logActivity,
  setDayKind,
  toggleCompletion,
  updateActivity,
  updateJournalEntry,
  type DayData,
  type MonthDay,
  type TodayActivity,
  type TodayTask,
} from "../../db/today";
import { spokenDate } from "../../lib/format";
import { syncDailyNudge } from "../../notifications/dailyNudge";
import { getTheme, SCRIM, type ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";

/**
 * The checklist groups two ways (ADR-0024 §3).
 *
 * **Frequency mode** — `everyDay` / `thisWeek` — is what ships today
 * and what a user with no part-of-day set still sees. **Day-shape
 * mode** — `morning` / `afternoon` / `evening` / `anytime` — replaces
 * those two the moment any task carries a part of day.
 *
 * ADR-0024 §3 claims a user who pins nothing "sees one Anytime list —
 * the current experience, unchanged." That was not true: today they
 * see two labelled sections carrying real information, and collapsing
 * both into one list would take that away from everyone on day one for
 * a feature they may never use. Keeping frequency mode as the untouched
 * default is what "invisible until used" actually means.
 *
 * `doneWeek` and `completed` are common to both and always sit last.
 */
type SectionKey =
  | "everyDay"
  | "thisWeek"
  | "morning"
  | "afternoon"
  | "evening"
  | "anytime"
  | "doneWeek"
  | "completed";

/** Everything off the daily surface, in the order the app's own
 *  hierarchy runs: strategy (plan, goals), then the periodic ritual
 *  (diagnostic, portfolio), then settings. */
export default function TodayScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  /** Null = follow today (so an overnight rollover moves with us);
   *  a date = the user navigated somewhere in the edit window. */
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<DayData | null>(null);
  const [weekGrade, setWeekGrade] = useState<PeriodGrade | null>(null);
  const [monthGrades, setMonthGrades] = useState<Map<string, MonthDay>>(new Map());
  const [monthOpen, setMonthOpen] = useState(false);
  /** Null = the month containing today. Set by the calendar's arrows;
   *  any past month is reachable now that days never lock. */
  const [viewMonth, setViewMonth] = useState<string | null>(null);
  const [kindSheet, setKindSheet] = useState(false);
  const [activitySheet, setActivitySheet] = useState(false);
  const [noteSheet, setNoteSheet] = useState(false);
  /** Set while the note sheet is rewriting an existing entry rather
   *  than writing a new one. */
  const [editingNote, setEditingNote] = useState<{ id: string; body: string } | null>(
    null,
  );
  const [editingActivity, setEditingActivity] = useState<TodayActivity | null>(null);
  const [collapsed, setCollapsed] = useState<Partial<Record<SectionKey, boolean>>>(
    {},
  );
  const allDoneBefore = useRef(false);
  /** null while unknown — the gate must not flash Today before it
   *  resolves (ADR-0011 decision 1). Reads fail open. */
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    void isOnboardingComplete().then(setOnboarded);
  }, []);

  const reload = useCallback(async (date: string, month?: string | null) => {
    const [next, grades, week] = await Promise.all([
      loadDay(date),
      loadCalendarGrades(currentLocalDate(), month ?? currentLocalDate()),
      loadWeekGrade(date),
    ]);
    setDay(next);
    setMonthGrades(grades);
    setWeekGrade(week);
    if (next.date === next.today) void syncDailyNudge(next);
    return next;
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload(selected ?? currentLocalDate(), viewMonth).then((d) => {
        allDoneBefore.current =
          d.daily.length > 0 && d.daily.every((t) => t.completedToday);
      });
    }, [reload, selected, viewMonth]),
  );

  const select = (date: string) => {
    setSelected(date === currentLocalDate() ? null : date);
    // Keep the browsed month — picking the 3rd of a month two years
    // back must not snap the calendar home.
    void reload(date, viewMonth);
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
  /** Notes and photos stay addable past the edit window (ADR-0002:
   *  grades finalize, memories don't) — only the future is off-limits. */
  const canRecord = day !== null && day.date <= day.today;
  const dormant = day !== null && day.score.earned === 0;
  const layout = reduceMotion ? undefined : LinearTransition.duration(200);

  const hueFor = (t: TodayTask) => theme.areas[t.areaId] ?? theme.accent;

  // Presentation-level re-sort: anything done today lives in Completed.
  const allTasks = day ? [...day.daily, ...day.week, ...day.doneThisWeek] : [];

  /** Day-shape mode switches on the first task to carry a part of day.
   *  Weekday pins alone don't trigger it — they order within a section
   *  rather than creating one. */
  const dayShaped = allTasks.some((t) => t.partOfDay !== null);

  /**
   * ADR-0024 §3's order: planned-today first, then flexible with runs
   * left, then the rest. Ties keep their incoming order, which is the
   * unit ranking, so the diagnostic still shows through.
   *
   * "The rest" is a task pinned to *other* days. It stays visible and
   * tappable — a plan is an intention, so doing Friday's run on
   * Tuesday is a perfect week and the row must never imply otherwise.
   */
  const planRank = (t: TodayTask): number => {
    const pins = parseWeekdays(t.plannedWeekdays);
    if (day && isPinnedOn(pins, day.date)) return 0;
    if (pins.length === 0) return 1;
    return 2;
  };
  const byPlan = (a: TodayTask, b: TodayTask) => planRank(a) - planRank(b);

  const openTasks = day
    ? [...day.daily, ...day.week].filter((t) => !t.completedToday)
    : [];

  const partSection = (part: PartOfDay | null) => {
    const tasks = openTasks.filter((t) => t.partOfDay === part).sort(byPlan);
    return {
      key: (part ?? "anytime") as SectionKey,
      label: part ? PART_OF_DAY_LABEL[part] : ANYTIME_LABEL,
      tasks,
      pts: tasks.reduce((a, t) => a + t.pointValue, 0),
    };
  };

  const sections: {
    key: SectionKey;
    label: string;
    tasks: TodayTask[];
    pts: number;
  }[] = day
    ? [
        ...(dayShaped
          ? // Explicit arrow rather than a bare reference: `map` passes
            // an index as the second argument, and a one-arg callback
            // used point-free is how that bites.
            [...PART_OF_DAY_ORDER.map((p) => partSection(p)), partSection(null)]
          : [
              {
                key: "everyDay" as const,
                label: "Every day",
                tasks: day.daily.filter((t) => !t.completedToday).sort(byPlan),
                pts: day.daily
                  .filter((t) => !t.completedToday)
                  .reduce((a, t) => a + t.pointValue, 0),
              },
              {
                key: "thisWeek" as const,
                label: "This week",
                tasks: day.week.filter((t) => !t.completedToday).sort(byPlan),
                pts: day.week
                  .filter((t) => !t.completedToday)
                  .reduce((a, t) => a + t.pointValue, 0),
              },
            ]),
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

  /** Adding to the day's record. Sits with the record itself rather
   *  than up beside the grade — these add notes and photos, and having
   *  them a screen away from what they add to cost the checklist the
   *  most valuable rows on the page. Rendered even when the record is
   *  empty, since that's when you most need the way in. */
  const recordActions = (
    <View style={styles.recordButtons}>
      <Pressable
        onPress={() => setNoteSheet(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Add a note to this day"
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
        accessibilityLabel="Add a photo to this day"
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
      >
        <AppText variant="label" color={theme.accent}>
          + Photo
        </AppText>
      </Pressable>
    </View>
  );

  const existingForSheet: ExistingActivity | null = editingActivity
    ? {
        id: editingActivity.id,
        title: editingActivity.title,
        note: editingActivity.note,
        size: editingActivity.size,
        tagUnitIds: editingActivity.tags.map((t) => t.unitId),
      }
    : null;

  // The onboarding gate (ADR-0011). Hooks above run unconditionally;
  // only the render is withheld. Splash covers the null case.
  if (onboarded === null) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={constellation(theme.areas, { faint: true })} />
      {day === null ? (
        <ActivityIndicator color={theme.muted} style={styles.loading} />
      ) : (
        <>
          {/* ── Fixed header ──
              The day's identity (date, grade) and its navigation. This
              is the one part of Home you always need in view, so it
              stays put and the checklist scrolls beneath it. */}
          <View
            style={[
              styles.header,
              { paddingTop: insets.top + space.sm, borderBottomColor: theme.hairline },
            ]}
          >
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
                  {day.finalized ? " · settled" : ""} {monthOpen ? "▴" : "▾"}
                </AppText>
              </Pressable>
              <View style={styles.headerRight}>
                {day.kind === "rest" ? (
                  <AppText variant="title" color={theme.muted}>
                    Day off
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

            {/* Days count once they're over (ADR-0004 §5 / periodDays),
                so today is not in this number yet — say so rather than
                let a completed task appear to do nothing.

                The day count is not decoration: an unrecorded day is no
                longer graded at all, so this average can stand on two
                days as easily as seven. Stating what it rests on is
                what keeps it honest. */}
            {weekGrade?.base !== null && weekGrade?.base !== undefined ? (
              <AppText variant="caption" color={theme.muted} style={styles.weekStat}>
                {weekStart(day.date) === weekStart(day.today)
                  ? `This week, through yesterday · ${weekGrade.base}%`
                  : `That week · ${weekGrade.base}%`}
                {weekGrade.gradedDays > 0
                  ? ` · ${weekGrade.gradedDays} ${
                      weekGrade.gradedDays === 1 ? "day" : "days"
                    }`
                  : ""}
              </AppText>
            ) : null}

            {/* ── Month / week navigation ── */}
            {monthOpen ? (
              <Animated.View layout={layout} style={styles.strip}>
                <MonthGrid
                  month={viewMonth ?? day.today}
                  onChangeMonth={(m) => {
                    setViewMonth(m);
                    void reload(day.date, m);
                  }}
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
                  grades={monthGrades}
                  selected={day.date}
                  today={day.today}
                  onSelect={select}
                  theme={theme}
                />
              </Animated.View>
            )}
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.container}>
            {day.finalized ? (
              <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
                This day has settled. You can still change it — editing it
                now will move the week and month it belongs to.
              </AppText>
            ) : null}

            {day.kind === "rest" ? (
              <AppText variant="caption" color={theme.muted} style={styles.stateNote}>
                Nothing counts today; anything you do still logs.
              </AppText>
            ) : null}

            {/* ── The day's record: ahead of tasks on past days, where
                the log leads; below them on today, where doing leads. ── */}
            {!isToday ? (
              <>
                <DayRecord
                  day={day}
                  theme={theme}
                  onEditNote={(note) => {
                    setEditingNote(note);
                    setNoteSheet(true);
                  }}
                  onDeleteNote={(id) => {
                    void deleteJournalEntry(id).then(() => reload(day.date));
                  }}
                  onDeletePhoto={(id) => {
                    void deletePhoto(id).then(() => reload(day.date));
                  }}
                />
                {canRecord ? recordActions : null}
              </>
            ) : null}

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
                  Your daily budget is set. Now give it something to do.
                </AppText>
                <Button
                  label="Plan your tasks"
                  onPress={() => router.push("/plan" as Href)}
                  theme={theme}
                />
              </View>
            ) : (
              <>
                {/* A special day keeps its checklist (ADR-0023 §3). The
                    story sits above the tasks rather than replacing
                    them: the rating tops the day up, it doesn't stand
                    in for the work. */}
                {day.kind === "special" ? (
                  <View style={styles.special}>
                    <AppText variant="title" color={theme.ink}>
                      {day.title ?? "A special day"}
                    </AppText>
                    <AppText variant="caption" color={theme.muted}>
                      {day.satisfactionRating !== null
                        ? `Rated ${day.satisfactionRating} of 10 · worth ${specialDayBonus(
                            day.satisfactionRating,
                          )} points`
                        : "When it's over, rate how it was."}
                    </AppText>
                    {day.editable ? (
                      <Button
                        label={
                          day.satisfactionRating === null ? "Rate the day" : "Edit the day"
                        }
                        variant="secondary"
                        onPress={() => setKindSheet(true)}
                        theme={theme}
                      />
                    ) : null}
                  </View>
                ) : null}

                {sections.map((s) => (
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
                ))}
              </>
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
            {isToday ? (
              <>
                <DayRecord
                  day={day}
                  theme={theme}
                  onEditNote={(note) => {
                    setEditingNote(note);
                    setNoteSheet(true);
                  }}
                  onDeleteNote={(id) => {
                    void deleteJournalEntry(id).then(() => reload(day.date));
                  }}
                  onDeletePhoto={(id) => {
                    void deletePhoto(id).then(() => reload(day.date));
                  }}
                />
                {canRecord ? recordActions : null}
              </>
            ) : null}

            {/* Takes up whatever's left so the footer sits at the
                bottom on a short day (an empty state, a rest day)
                instead of floating mid-screen above blank canvas. */}
            <View style={styles.spacer} />

            {/* ── Footer ──
                The destination chips that used to live here are now
                the tab bar; what remains is the line that has to stay
                next to the number, not next to the navigation. */}
            <View style={[styles.footer, { borderTopColor: theme.hairline }]}>
              <AppText variant="footnote" color={theme.muted}>
                Grades are guidelines, not judgments.
              </AppText>
            </View>
          </ScrollView>
        </>
      )}


      {day ? (
        <>
          {/* One sheet, both jobs: blank to add, seeded to rewrite.
              `editingNote` is what tells them apart. */}
          <NoteSheet
            visible={noteSheet}
            dayLabel={isToday ? "today" : spokenDate(day.date).split(",")[0] ?? day.date}
            initialBody={editingNote?.body}
            theme={theme}
            onClose={() => {
              setNoteSheet(false);
              setEditingNote(null);
            }}
            onCommit={(body) => {
              const write = editingNote
                ? updateJournalEntry(editingNote.id, body)
                : addJournalEntry(day.date, body);
              void write.then(() => reload(day.date));
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
/** What a long press opened the options for. */
type RecordTarget =
  | { kind: "note"; id: string; body: string }
  | { kind: "photo"; id: string };

function DayRecord({
  day,
  theme,
  onEditNote,
  onDeleteNote,
  onDeletePhoto,
}: {
  day: DayData;
  theme: ThemeTokens;
  onEditNote: (note: { id: string; body: string }) => void;
  onDeleteNote: (id: string) => void;
  onDeletePhoto: (id: string) => void;
}) {
  const [viewing, setViewing] = useState<string | null>(null);
  const [missingPhotos, setMissingPhotos] = useState<Set<string>>(new Set());
  /** Long-press target. Press-and-hold rather than a visible control
   *  per item: the record is meant to read as a record, and a row of
   *  edit/delete glyphs beside every note would make it read as a
   *  list of things to manage. */
  const [target, setTarget] = useState<RecordTarget | null>(null);
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
                onLongPress={() => {
                  void Haptics.selectionAsync();
                  setTarget({ kind: "photo", id: p.id });
                }}
                delayLongPress={350}
                accessibilityRole="imagebutton"
                accessibilityLabel={p.caption ?? "Photo from this day. Opens full screen."}
                accessibilityHint="Press and hold to delete"
                accessibilityActions={[{ name: "magicTap", label: "Delete photo" }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === "magicTap") onDeletePhoto(p.id);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Image
                  source={{ uri: p.uri }}
                  style={styles.photoThumb}
                  contentFit="cover"
                  // Backups are database-only for now (ADR-0002), so a
                  // restore onto a fresh device leaves these rows
                  // pointing at files that no longer exist. Say what
                  // happened instead of showing a broken frame.
                  placeholder={null}
                  onError={() => setMissingPhotos((m) => new Set(m).add(p.id))}
                />
                {missingPhotos.has(p.id) ? (
                  <View style={[styles.photoMissing, { borderColor: theme.hairline }]}>
                    <AppText variant="caption" color={theme.muted} style={styles.centerText}>
                      Photo not in this backup
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}
      {day.journal.map((j) => (
        <Pressable
          key={j.id}
          onLongPress={() => {
            void Haptics.selectionAsync();
            setTarget({ kind: "note", id: j.id, body: j.body });
          }}
          delayLongPress={350}
          accessibilityRole="button"
          accessibilityLabel={j.body}
          accessibilityHint="Press and hold to edit or delete this note"
          // Screen readers cannot long-press, so the same two actions
          // are exposed as accessibility actions.
          accessibilityActions={[
            { name: "activate", label: "Edit note" },
            { name: "magicTap", label: "Delete note" },
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === "activate") {
              onEditNote({ id: j.id, body: j.body });
            }
            if (e.nativeEvent.actionName === "magicTap") onDeleteNote(j.id);
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <AppText color={theme.ink}>{j.body}</AppText>
        </Pressable>
      ))}

      {/* Options for whatever was held. Deliberately a plain sheet
          rather than a destructive-action confirm: deleting one note
          is small and the alternative is a two-step flow on the most
          common case. */}
      <Modal
        visible={target !== null}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setTarget(null)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setTarget(null)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <View
            style={[
              styles.menuCard,
              { backgroundColor: theme.canvas, borderColor: theme.hairline },
            ]}
          >
            {target?.kind === "note" ? (
              <Pressable
                onPress={() => {
                  const t = target;
                  setTarget(null);
                  onEditNote({ id: t.id, body: t.body });
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
              >
                <AppText color={theme.ink}>Edit</AppText>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                const t = target;
                setTarget(null);
                if (!t) return;
                if (t.kind === "note") onDeleteNote(t.id);
                else onDeletePhoto(t.id);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
            >
              <AppText color={theme.danger}>Delete</AppText>
            </Pressable>
            <Pressable
              onPress={() => setTarget(null)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.5 : 1 }]}
            >
              <AppText color={theme.muted}>Cancel</AppText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
  loading: { marginTop: space.xxxl },
  /** Fixed above the scroll region; the strip's own top margin gives
   *  it room, so the header only pays for its bottom edge. */
  header: {
    paddingHorizontal: space.screen,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  /** Takes the space between the fixed header and the tab bar. */
  body: { flex: 1 },
  container: {
    paddingHorizontal: space.screen,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    flexGrow: 1,
  },
  spacer: { flexGrow: 1, minHeight: space.xl },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  headerRight: { alignItems: "flex-end", gap: space.xs },
  weekStat: { marginTop: space.xs },
  kindButton: { minWidth: 44, minHeight: 32, alignItems: "flex-end" },
  recordButtons: {
    flexDirection: "row",
    gap: space.xl,
    marginTop: space.md,
    minHeight: 44,
    alignItems: "center",
  },
  photoRow: { flexDirection: "row", gap: space.sm },
  photoThumb: { width: 110, height: 110, borderRadius: radius.lg },
  photoMissing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xs,
  },
  /** Centred card, and the backdrop is the dismiss target. */
  menuBackdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.screen,
  },
  menuCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.xs,
  },
  menuRow: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
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
    paddingTop: space.lg,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
