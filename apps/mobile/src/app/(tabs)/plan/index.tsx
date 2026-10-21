/**
 * The Plan tab: is my week set up? (spec §5.3). A week strip across the
 * top, Sunday to Saturday (ADR-0004 §1), and below it the chosen day:
 * its windows, events and named gaps in time order, each window filled
 * with its pins and live suggestions.
 *
 * Suggestions are worked out each time and never saved
 * (`loadDayPlan`); only what you pin is. **Nothing here changes a
 * score** but a "Do N of these" choice and the hours (ADR-0039 §12),
 * and there's no warning about load anywhere (P3, ADR-0026 §3).
 *
 * The units and their tasks moved to Life in Phase 8 (Henry,
 * 2026-10-20). This tab still opens the New task and New event sheets
 * from its + menu, and from another tab's (`openAdd`).
 */
import { addDays } from "@glide/scoring";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { openAdd, TabToolbar } from "../../../components/nav/TabToolbar";
import { AddTaskModal } from "../../../components/plan/AddTaskModal";
import { weekLabel } from "../../../components/plan/dayView";
import { EventSheet } from "../../../components/plan/EventSheet";
import { PlanDayView, type PlanDayViewHandle } from "../../../components/plan/PlanDayView";
import { PlanWeekStrip } from "../../../components/plan/PlanWeekStrip";
import { savedOrSaid, saveNewEvent } from "../../../components/plan/saveEvent";
import { pickableUnits } from "../../../components/plan/unitSelection";
import { DayKindSheet } from "../../../components/today/DayKindSheet";
import { constellation, ScrollBackdrop } from "../../../components/ui/Backdrop";
import { LoadFailure, useScreenLoad } from "../../../components/ui/ScreenLoad";
import { UndoBar } from "../../../components/ui/UndoBar";
import { setDayKind } from "../../../db/dayGrades";
import { loadDayPlan, loadWeek, type DayPlan, type WeekDay } from "../../../db/dayPlan";
import { addTask, loadPlan, type PlanData } from "../../../db/tasks";
import { useRetained } from "../../../hooks/useRetained";
import { useUndoDelete } from "../../../hooks/useUndoDelete";
import { currentLocalDate } from "../../../lib/calendar";
import { spokenDate } from "../../../lib/format";
import { getTheme } from "../../../theme/colors";
import { space } from "../../../theme/tokens";

export default function PlanScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const reduceMotion = useReducedMotion();
  const today = currentLocalDate();

  /** `date` opens a day (from Home, or a link); `add` asks for a sheet
   *  from another tab's + menu (`openAdd`). */
  const { date: dateParam, add: addParam } = useLocalSearchParams<{ date?: string; add?: string }>();
  const [selected, setSelected] = useState(dateParam ?? today);
  const [seenDate, setSeenDate] = useState(dateParam);
  if (dateParam !== seenDate) {
    setSeenDate(dateParam);
    if (dateParam) setSelected(dateParam);
  }

  const [loaded, setLoaded] = useState<DayPlan | null>(null);
  const [week, setWeek] = useState<WeekDay[] | null>(null);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [kindSheet, setKindSheet] = useState(false);
  const [adding, setAdding] = useState<"task" | "event" | null>(null);
  const [addingShown, addingGone] = useRetained(adding);
  const [eventUnits, setEventUnits] = useState<string[]>([]);

  /** Each load's turn: only the latest may land, so a slow load for a
   *  day you've moved on from can't overwrite the one you're looking at. */
  const loadTurn = useRef(0);
  const load = useCallback(async () => {
    const turn = ++loadTurn.current;
    const [nextDay, nextWeek, nextPlan] = await Promise.all([
      loadDayPlan(selected),
      loadWeek(selected),
      loadPlan(),
    ]);
    if (turn !== loadTurn.current) return;
    setLoaded(nextDay);
    setWeek(nextWeek);
    setPlan(nextPlan);
  }, [selected]);
  const { error, retry, save } = useScreenLoad(load);
  const undo = useUndoDelete(save);

  const allUnits = useMemo(() => pickableUnits(plan), [plan]);
  const canAdd = plan?.hasSnapshot === true && allUnits.length > 0;

  /** Another tab's + asked for a sheet. With no plan to file it under,
   *  Priorities comes first. */
  const [handledAdd, setHandledAdd] = useState<string | undefined>(undefined);
  if (addParam !== handledAdd && plan !== null) {
    setHandledAdd(addParam);
    if (canAdd && (addParam === "task" || addParam === "event")) setAdding(addParam);
  }
  // Navigation is a side effect, so it waits for the commit.
  useEffect(() => {
    if (!addParam || plan === null) return;
    router.setParams({ add: undefined });
    if (!canAdd) router.push("/priorities" as Href);
  }, [addParam, plan, canAdd]);
  // A day link is cleared once followed, so the same link works again.
  useEffect(() => {
    if (dateParam) router.setParams({ date: undefined });
  }, [dateParam]);
  const addHere = (what: "task" | "event") => {
    if (!canAdd) router.push("/priorities" as Href);
    else setAdding(what);
  };

  const date = selected;
  /** The day on screen is only ever the one chosen: until its load
   *  lands it shows as loading, and nothing writes to it. */
  const day = loaded !== null && loaded.day.date === selected ? loaded : null;
  const editable = day !== null && date >= today;
  const dayLabel = date === today ? "today" : (spokenDate(date).split(",")[0] ?? date);

  const goTo = (next: string) => {
    setSelected(next);
    void Haptics.selectionAsync();
  };

  const dayView = useRef<PlanDayViewHandle>(null);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.body}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
      >
        <ScrollBackdrop circles={constellation(theme.areas, { faint: true })} />
        {week ? (
          <PlanWeekStrip
            days={week}
            label={weekLabel(selected)}
            selected={selected}
            today={today}
            onSelect={goTo}
            onPrevWeek={() => goTo(addDays(selected, -7))}
            onNextWeek={() => goTo(addDays(selected, 7))}
            theme={theme}
          />
        ) : null}

        {error ? (
          <LoadFailure error={error} onRetry={retry} theme={theme} />
        ) : day === null ? (
          <ActivityIndicator color={theme.muted} style={styles.loading} />
        ) : (
          <PlanDayView
            ref={dayView}
            day={day}
            today={today}
            save={save}
            reload={retry}
            undo={undo}
            onDayType={date <= today ? () => setKindSheet(true) : undefined}
            theme={theme}
          />
        )}
      </ScrollView>

      <TabToolbar
        onTask={() => addHere("task")}
        onEvent={() => addHere("event")}
        onWindow={editable ? () => dayView.current?.addWindow() : undefined}
        onLog={() => openAdd("activity")}
        more={[
          { label: "Plan this week", icon: "list.bullet.clipboard", onPress: () => router.push("/weekly-pass" as Href) },
          { label: "Working hours", icon: "clock", onPress: () => router.push("/hours" as Href) },
          { label: "Copy last week's events", icon: "doc.on.doc", onPress: () => dayView.current?.copyEvents() },
          { label: "Time away", icon: "airplane", onPress: () => router.push("/away" as Href) },
        ]}
      />

      <UndoBar undo={undo} theme={theme} />

      {day && date <= today ? (
        <DayKindSheet
          visible={kindSheet}
          dayLabel={dayLabel}
          kind={day.day.kind}
          title={day.day.title}
          satisfactionRating={day.day.satisfactionRating}
          theme={theme}
          reduceMotion={reduceMotion}
          onClose={() => setKindSheet(false)}
          onCommit={(kind, opts) => {
            setKindSheet(false);
            void save(() => setDayKind(date, kind, opts));
          }}
        />
      ) : null}

      {addingShown === "task" ? (
        <AddTaskModal
          visible={adding === "task"}
          onDismissed={addingGone}
          onClose={() => setAdding(null)}
          units={allUnits}
          areaColors={theme.areas}
          theme={theme}
          onCommit={async (title, timesPerWeek, unitIds, plannedWeekdays, partOfDay, oneOff, detail) => {
            await save(() =>
              addTask(unitIds, title, timesPerWeek, plannedWeekdays, partOfDay, oneOff, detail),
            );
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      ) : null}

      {addingShown === "event" ? (
        <EventSheet
          visible={adding === "event"}
          onDismissed={addingGone}
          unitChoice={{
            units: allUnits,
            value: eventUnits,
            onChange: setEventUnits,
            areaColors: theme.areas,
          }}
          accent={theme.accent}
          theme={theme}
          onClose={() => setAdding(null)}
          onSave={async (input, bounds) => {
            const saved = await savedOrSaid(async () => {
              await saveNewEvent(eventUnits, input, bounds);
              return true;
            });
            if (!saved) return;
            setAdding(null);
            setEventUnits([]);
            retry();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl },
  loading: { marginTop: space.xxl },
});
