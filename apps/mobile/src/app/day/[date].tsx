/**
 * Planning a day ahead (ADR-0024 §4).
 *
 * Henry, 2026-08-18: *"on Monday, I can look ahead onto tuesday's
 * tasks, move around when I want to do them, and temporarily move
 * anytime tasks into a time of day that fits the day's schedule."*
 *
 * **A route, not a sheet (2026-08-20).** This was a bottom sheet
 * reached by a text link at the very bottom of Home, under the record
 * buttons, that said "Plan tomorrow" and could only ever mean tomorrow.
 * Three things were wrong with that and only one was cosmetic. The
 * sheet could not host a drag: a downward drag inside a bottom sheet is
 * ambiguous with the sheet's own dismiss gesture, so arranging by hand
 * fought the container. It had no room for date navigation. And the
 * link sat last on a scroll, which is where you put something you hope
 * nobody needs.
 *
 * **A placement here is about the date, not the task.** Dropping a row
 * into another slot writes a `planned_occurrence` and leaves the task
 * alone — that is the whole point of planning ahead. Tuesday's
 * arrangement is a statement about Tuesday, not a change to what the
 * task usually is. The permanent version lives on the task's own edit
 * sheet, and the drag here deliberately never asks "from now on?" the
 * way Home's does: on a future day, "just this day" is the only thing a
 * drag can mean.
 *
 * Row *order* is the exception, and deliberately so: `dayOrder` is one
 * standing order shared by every day (ADR-0024 §3), so a row arranged
 * here is arranged on Home too. See `onDrop`.
 *
 * **A plan is an intention, not an obligation** (§2). A placement that
 * goes unfulfilled lapses silently: nothing counts it, nothing derives
 * an adherence statistic from it, and the day never mentions it again.
 * This is the surface most able to violate that, so it is the one that
 * must not.
 *
 * Completion is absent by construction. `isEditable` refuses anything
 * after today, and offering the gesture would invite exactly the "get
 * ahead" mechanic the grade is built to ignore.
 */
import {
  addDays,
  planLoadHours,
  type Window as GridWindow,
} from "@glide/scoring";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddTaskModal } from "../../components/plan/AddTaskModal";
import {
  ANYTIME_LABEL,
  compareForDay,
  PART_OF_DAY_LABEL,
  PART_OF_DAY_ORDER,
  pinnedElsewhere,
  type PartOfDay,
} from "../../components/plan/planning";
import { DayGrid, windowKey } from "../../components/today/DayGrid";
import { formatLength } from "../../components/today/dayGridLayout";
import { WindowSheet } from "../../components/today/WindowSheet";
import { loadPools, type PoolOnDay } from "../../db/commitments";
import {
  createPool,
  deletePool,
  updatePool,
} from "../../db/commitmentWrites";
import {
  loadDayLayout,
  setDayLayout,
  type DayLayout,
} from "../../db/settings";
import { Segmented } from "../../components/plan/Segmented";
import { SectionedChecklist } from "../../components/today/SectionedChecklist";
import { AppText } from "../../components/ui/AppText";
import { Backdrop, hueWash } from "../../components/ui/Backdrop";
import { Button } from "../../components/ui/Button";
import { LoadFailure, useScreenLoad } from "../../components/ui/ScreenLoad";
import {
  addTask,
  loadPlan,
  reorderDayTasks,
  type PlanData,
} from "../../db/tasks";
import {
  currentLocalDate,
  isPlannable,
  loadDay,
  placeTaskForDay,
  type DayData,
  type TodayTask,
} from "../../db/today";
import { getTheme } from "../../theme/colors";
import { space } from "../../theme/tokens";

const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 44;

/** The four slots, in the order a day runs. Anytime last: it is where
 *  things live when you have not decided, so it reads as the remainder. */
const SLOTS: readonly (PartOfDay | "anytime")[] = [...PART_OF_DAY_ORDER, "anytime"];

/** "2 hours 15 minutes" — `formatLength` read aloud, since VoiceOver
 *  says "2h" as "2 h". */
function spokenLength(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 0 ? "" : `${h} ${h === 1 ? "hour" : "hours"}`;
  const mins = m === 0 ? "" : `${m} minutes`;
  return [hours, mins].filter(Boolean).join(" ");
}

/** Same two words as Home's, because it is the same choice. */
const LAYOUTS = [
  { value: "checklist" as const, label: "List" },
  { value: "grid" as const, label: "Hours" },
];

/** "2026-08-21" → "Thursday 21 August". Written out, because this screen
 *  is *about* the date and abbreviating it would bury the subject. */
function spoken(localDate: string): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const at = new Date(y!, m! - 1, d!);
  return at.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "Tomorrow" when it is, the weekday otherwise. A relative label is
 *  what a person actually holds in their head for the next few days. */
function relative(localDate: string, today: string): string | null {
  if (localDate === addDays(today, 1)) return "Tomorrow";
  const [y, m, d] = localDate.split("-").map(Number);
  const at = new Date(y!, m! - 1, d!);
  const within = localDate <= addDays(today, 6);
  return within ? at.toLocaleDateString(undefined, { weekday: "long" }) : null;
}

export default function PlanDayScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const insets = useSafeAreaInsets();
  /** Dynamic Type, so the grid's hours grow with its labels. */
  const { fontScale } = useWindowDimensions();
  const params = useLocalSearchParams<{ date?: string }>();

  const today = currentLocalDate();
  /**
   * The URL is not trusted. A deep link to a past date, or one past the
   * window, would otherwise render a planner for a day the arrows
   * cannot reach and the drag has no business writing to — placements
   * on a settled day change a record rather than a plan. Anything out
   * of range falls back to tomorrow, which is where this screen opens
   * anyway.
   */
  const requested = params.date;
  const [date, setDate] = useState(
    requested !== undefined && isPlannable(requested, today)
      ? requested
      : addDays(today, 1),
  );
  const [day, setDay] = useState<DayData | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  /** Shared with Home through `app_setting`, so the day reads the same
   *  way wherever you opened it from. Presentation only. */
  const [dayLayout, setDayLayoutState] = useState<DayLayout>("checklist");
  /** This day's pools, and the one being edited (ADR-0033 §2). */
  const [pools, setPools] = useState<PoolOnDay[]>([]);
  const [planning, setPlanning] = useState<{
    window: GridWindow;
    chosen: string[];
    plannedCount: number;
    poolId: string | null;
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async () => {
    const [nextDay, nextPlan, layout, nextPools] = await Promise.all([
      loadDay(date),
      loadPlan(),
      loadDayLayout(),
      loadPools(date),
    ]);
    setDay(nextDay);
    setPlan(nextPlan);
    setDayLayoutState(layout);
    setPools(nextPools);
  }, [date]);
  const { error, retry } = useScreenLoad(load);

  /** Everything that would show up on this day, still open. */
  const all: TodayTask[] = useMemo(
    () => (day ? [...day.daily, ...day.week] : []),
    [day],
  );

  /**
   * The day's own rows, and the ones pinned to other days.
   *
   * Without this split a task pinned to Monday sat in Friday's
   * Afternoon slot, indistinguishable from something actually due
   * Friday — so the one screen whose entire job is showing a day's
   * shape described the wrong shape. The checklist has always made
   * this split (ADR-0024 §3); the planner did not.
   */
  const tasks = useMemo(
    () => all.filter((t) => !pinnedElsewhere(t, date)),
    [all, date],
  );
  /**
   * About how much sized work the day holds (ADR-0026 §3), in minutes,
   * or null when nothing on it has a size.
   *
   * **Shown, never warned about.** No threshold, no colour, no
   * comparison against the free time the grid draws — "this is more
   * than your windows hold" is a verdict on the plan, and the version of
   * this that advises rather than informs was already rejected. It is
   * the same muted caption at two hours as at ten.
   *
   * Pools count at their planned count, not their member count, and
   * unsized work counts as nothing rather than as a guess. Rounded to a
   * quarter hour, because the sizes are rough and a figure like
   * "2h 20m" would claim a precision they do not have.
   *
   * Absent rather than "0m" when nothing is sized: unsized is a
   * first-class state (ADR-0026 §1), and a zero would read as a prompt
   * to go and size things, which nothing is allowed to be (ADR-0030 §2).
   */
  const loadMinutes = useMemo(() => {
    const hours = planLoadHours(tasks, pools);
    if (hours <= 0) return null;
    return Math.max(15, Math.round((hours * 60) / 15) * 15);
  }, [tasks, pools]);

  /** Whether the hours are worth offering — see Home's own note. */
  const showsGrid =
    dayLayout === "grid" ||
    tasks.some((t) => t.startMinute !== null && t.endMinute !== null);

  const elsewhere = useMemo(
    () =>
      all
        .filter((t) => pinnedElsewhere(t, date))
        .sort((a, b) => compareForDay(a, b, date)),
    [all, date],
  );

  const sections = useMemo(
    () =>
      SLOTS.map((slot) => ({
        key: slot,
        rowIds: tasks
          .filter((t) => (t.partOfDay ?? "anytime") === slot)
          .sort((a, b) => compareForDay(a, b, date))
          .map((t) => t.id),
      })),
    [tasks, date],
  );

  const canGoBack = date > addDays(today, 1);
  const canGoForward = isPlannable(addDays(date, 1), today);

  const step = (delta: 1 | -1) => {
    const next = addDays(date, delta);
    if (!isPlannable(next, today)) return;
    setDate(next);
    setDay(null);
  };

  /**
   * A row was dropped.
   *
   * Two different things get written, because a drag says two things
   * at once and ADR-0024 §3 settled them separately.
   *
   * **Which slot** is a statement about *this date*: it writes a
   * `planned_occurrence` and never touches the task. Unlike Home, this
   * never asks whether the move is permanent — on a future day "just
   * this day" is the only thing a drag can mean, and prompting would
   * turn arranging an evening into a decision about the rest of your
   * life.
   *
   * **Where in the slot** is the task's standing order (`dayOrder`),
   * persistent by Henry's call: *"if I put sunlight and supplements at
   * the start of my tasks I want it to stay there."* It is deliberately
   * one order shared by every day, so arranging a row here is the same
   * arrangement Home shows.
   *
   * A reorder inside one slot used to return early and write nothing,
   * so the row animated into place and snapped back on the next load.
   */
  const onDrop = (rowId: string, toSectionKey: string, toIndex: number) => {
    const moved = tasks.find((t) => t.id === rowId);
    if (!moved) return;
    const toPart: PartOfDay | null =
      toSectionKey === "anytime" ? null : (toSectionKey as PartOfDay);

    // That slot's order after the drop, for persistence.
    const ordered = tasks
      .filter((t) => t.id !== rowId && (t.partOfDay ?? "anytime") === toSectionKey)
      .sort((a, b) => compareForDay(a, b, date))
      .map((t) => t.id);
    ordered.splice(Math.min(toIndex, ordered.length), 0, rowId);

    const sameSlot = (moved.partOfDay ?? "anytime") === toSectionKey;
    void (async () => {
      if (!sameSlot) await placeTaskForDay(rowId, date, toPart);
      await reorderDayTasks(ordered);
      await load();
    })().catch(() => undefined);
  };

  const relativeLabel = relative(date, today);

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Backdrop circles={hueWash(theme.accent)} />

      {/* The date is the subject of this screen, so it is the title, and
          the two arrows sit beside it rather than in a separate strip:
          stepping a day is the primary navigation here, not a secondary
          control that deserves its own row. */}
      <View style={[styles.header, { paddingTop: insets.top + space.sm, borderBottomColor: theme.hairline }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="chevron-back" size={24} color={theme.ink} />
        </Pressable>

        <View style={styles.headerText}>
          <AppText variant="title" color={theme.ink} numberOfLines={1}>
            {relativeLabel ?? spoken(date).split(" ").slice(1).join(" ")}
          </AppText>
          <AppText variant="caption" color={theme.muted} numberOfLines={1}>
            {spoken(date)}
          </AppText>
        </View>

        <Pressable
          onPress={() => step(-1)}
          disabled={!canGoBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          accessibilityState={{ disabled: !canGoBack }}
          style={({ pressed }) => [
            styles.iconButton,
            { opacity: !canGoBack ? 0.3 : pressed ? 0.5 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={20} color={theme.muted} />
        </Pressable>
        <Pressable
          onPress={() => step(1)}
          disabled={!canGoForward}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next day"
          accessibilityState={{ disabled: !canGoForward }}
          style={({ pressed }) => [
            styles.iconButton,
            { opacity: !canGoForward ? 0.3 : pressed ? 0.5 : 1 },
          ]}
        >
          <Ionicons name="chevron-forward" size={20} color={theme.muted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.body}
        scrollEnabled={!dragging}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + space.xxxl },
        ]}
      >
        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : day === null ? null : tasks.length === 0 && elsewhere.length === 0 ? (
          <View style={styles.empty}>
            <AppText color={theme.ink} style={styles.emptyText}>
              Nothing is due on this day yet.
            </AppText>
            <AppText variant="caption" color={theme.muted} style={styles.emptyText}>
              Add something for it below, or arrange it once your plan has
              tasks that land here.
            </AppText>
          </View>
        ) : tasks.length === 0 ? null : (
          <>
            {/* Only once there is an hour to draw, and always once you
                are in the grid — a view you can enter and not leave is
                a trap. */}
            {showsGrid || loadMinutes !== null ? (
              <View style={styles.topRow}>
                {showsGrid ? (
                  <View style={styles.layoutToggle}>
                    <Segmented
                      segments={LAYOUTS}
                      value={dayLayout}
                      onChange={(next) => {
                        setDayLayoutState(next);
                        void setDayLayout(next);
                      }}
                      accent={theme.accent}
                      theme={theme}
                      label="How to show the day"
                    />
                  </View>
                ) : null}
                {/* A readout, not a control: plain muted text with
                    nothing about it that invites a tap. "Of sized work"
                    names its own scope, so a day with unsized tasks is
                    not misreported as lighter than it is. */}
                {loadMinutes !== null ? (
                  <AppText
                    variant="caption"
                    color={theme.muted}
                    tabular
                    style={styles.load}
                    accessibilityLabel={`About ${spokenLength(loadMinutes)} of work, counting tasks with a size`}
                  >
                    About {formatLength(loadMinutes)} of sized work
                  </AppText>
                ) : null}
              </View>
            ) : null}

            <AppText variant="caption" color={theme.muted} style={styles.lead}>
              {dayLayout === "grid"
                ? "Timed work sits on the hours. Switch to List to move anything."
                : `Hold a task to move it. This changes ${relativeLabel?.toLowerCase() ?? "this day"} only.`}
            </AppText>

            {dayLayout === "grid" ? (
              <DayGrid
                tasks={tasks}
                hueFor={(t) => theme.areas[t.areaId] ?? theme.accent}
                theme={theme}
                fontScale={fontScale}
                // This screen is never today — the strip on Home owns
                // that — so there is no "now" to point at.
                nowMinute={null}
                onPress={() => undefined}
                pooledByWindow={
                  new Map(pools.map((p) => [windowKey(p), p.taskIds]))
                }
                // Planning ahead is this screen's entire job, so a
                // window here is always a way in.
                onPlanWindow={(w) => {
                  const existing = pools.find(
                    (p) => windowKey(p) === windowKey(w),
                  );
                  setPlanning({
                    window: w,
                    chosen: existing?.taskIds ?? [],
                    plannedCount: existing?.plannedCount ?? 1,
                    poolId: existing?.id ?? null,
                  });
                }}
              />
            ) : (
            <SectionedChecklist
              sections={sections}
              rowHeight={ROW_HEIGHT}
              headerHeights={SLOTS.map(() => HEADER_HEIGHT)}
              onDragStateChange={setDragging}
              onMove={onDrop}
              theme={theme}
              renderHeader={(key) => {
                const slot = sections.find((s) => s.key === key);
                return (
                  <View style={styles.slotHeader}>
                    <AppText variant="caption" color={theme.muted}>
                      {key === "anytime"
                        ? ANYTIME_LABEL
                        : PART_OF_DAY_LABEL[key as PartOfDay]}
                    </AppText>
                    {slot && slot.rowIds.length === 0 ? (
                      <AppText variant="caption" color={theme.muted}>
                        Free
                      </AppText>
                    ) : null}
                  </View>
                );
              }}
              renderRow={(rowId) => {
                const t = tasks.find((x) => x.id === rowId);
                if (!t) return null;
                return (
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.pip,
                        { backgroundColor: theme.areas[t.areaId] ?? theme.muted },
                      ]}
                    />
                    <AppText color={theme.ink} numberOfLines={1} style={styles.rowTitle}>
                      {t.title}
                    </AppText>
                    {t.oneOffSize ? (
                      <AppText variant="caption" color={theme.muted}>
                        once
                      </AppText>
                    ) : null}
                    <AppText variant="caption" color={theme.muted} tabular>
                      {t.pointValue}
                    </AppText>
                  </View>
                );
              }}
            />
            )}
          </>
        )}

        {/* Pinned to other days, so not part of this day's shape — but
            shown, because they are what the rest of the week is
            carrying and that is worth seeing while you plan. Not
            draggable on purpose: dropping one into a slot would write a
            placement that `pinnedElsewhere` then sorts straight back
            out of the slot on reload, which is a control that appears
            to work and does not. Moving one here is a change to the
            task, and the task's own sheet is where that lives. */}
        {elsewhere.length > 0 ? (
          <View style={styles.elsewhere}>
            <View
              style={[
                styles.slotHeader,
                styles.elsewhereHeader,
                { borderTopColor: theme.hairline },
              ]}
            >
              <AppText variant="caption" color={theme.muted}>
                Pinned to other days
              </AppText>
            </View>
            {elsewhere.map((t) => (
              <View key={t.id} style={[styles.row, styles.elsewhereRow]}>
                <View
                  style={[
                    styles.pip,
                    { backgroundColor: theme.areas[t.areaId] ?? theme.muted },
                  ]}
                />
                <AppText color={theme.muted} numberOfLines={1} style={styles.rowTitle}>
                  {t.title}
                </AppText>
                <AppText variant="caption" color={theme.muted} tabular>
                  {t.pointValue}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {/* Adding here always makes a one-off dated to this day. A
            recurring task created from inside one day would be a
            surprise: you came to arrange Thursday, not to change every
            Thursday. The full task sheet is a tab away for that. */}
        <View style={styles.addBar}>
          <Button
            variant="tonal"
            icon="add"
            label="Add something for this day"
            onPress={() => setAdding(true)}
            theme={theme}
          />
        </View>
      </ScrollView>

      {planning ? (
        <WindowSheet
          visible
          window={planning.window}
          candidates={tasks}
          chosen={planning.chosen}
          plannedCount={planning.plannedCount}
          hueFor={(t) => theme.areas[t.areaId] ?? theme.accent}
          accent={theme.accent}
          theme={theme}
          onToggle={(taskId) =>
            setPlanning((prev) =>
              prev === null
                ? prev
                : {
                    ...prev,
                    chosen: prev.chosen.includes(taskId)
                      ? prev.chosen.filter((id) => id !== taskId)
                      : [...prev.chosen, taskId],
                  },
            )
          }
          onPlannedCountChange={(plannedCount) =>
            setPlanning((prev) => (prev === null ? prev : { ...prev, plannedCount }))
          }
          onClose={() => setPlanning(null)}
          onSave={() => {
            const p = planning;
            setPlanning(null);
            void (async () => {
              if (p.poolId !== null) {
                await updatePool(p.poolId, {
                  taskIds: p.chosen,
                  plannedCount: p.plannedCount,
                });
              } else {
                await createPool({
                  localDate: date,
                  taskIds: p.chosen,
                  plannedCount: p.plannedCount,
                  afterTaskId: p.window.afterTaskId,
                  partOfDay: p.window.partOfDay,
                });
              }
              await load();
            })();
          }}
          onClear={
            planning.poolId === null
              ? undefined
              : () => {
                  const id = planning.poolId;
                  setPlanning(null);
                  if (id !== null) void deletePool(id).then(load);
                }
          }
        />
      ) : null}

      {adding && plan ? (
        <AddTaskModal
          visible
          onClose={() => setAdding(false)}
          units={plan.areas.flatMap((a) =>
            a.units.map((u) => ({ id: u.id, name: u.name, areaId: a.id })),
          )}
          areaColors={theme.areas}
          theme={theme}
          lockedOneOffDate={date}
          onCommit={async (
            title,
            timesPerWeek,
            unitIds,
            weekdays,
            part,
            oneOff,
            detail,
          ) => {
            await addTask(
              unitIds,
              title,
              timesPerWeek,
              weekdays,
              part,
              null,
              oneOff,
              detail,
            );
            await load();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.screen,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, gap: 1, marginLeft: space.xs },
  iconButton: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingTop: space.md },
  lead: { marginBottom: space.md, maxWidth: 340 },
  slotHeader: {
    height: HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  pip: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { flex: 1 },
  addBar: { marginTop: space.xl },
  elsewhere: { marginTop: space.xl },
  /** A rule, because this group is not a fourth part of the day — it is
   *  a different kind of thing and the break should say so. */
  elsewhereHeader: { borderTopWidth: StyleSheet.hairlineWidth },
  /** Quieter than a row you can arrange, because you cannot arrange it
   *  from here — the dimming is the affordance's absence, stated. */
  elsewhereRow: { minHeight: 44 },
  empty: { marginTop: space.xxl, gap: space.sm },
  /** Its own row above the lead line, since this screen's header is a
   *  full row of navigation already. */
  /** The toggle and the load share one row; either may be absent. */
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.md,
    marginBottom: space.sm,
  },
  layoutToggle: { flex: 1, maxWidth: 180, minWidth: 140 },
  load: { flexShrink: 1, textAlign: "right", marginLeft: "auto" },
  emptyText: { maxWidth: 340 },
});
