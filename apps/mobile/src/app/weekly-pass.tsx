/**
 * The weekly pass (spec §5.3.2, ADR-0039 §11): about five minutes, in a
 * full-screen sheet, to set up the week. Finish works at any step.
 *
 * 0. **Still happy with your tiers?** On the month's first pass only,
 *    and optional: it opens Priorities, and skipping it changes nothing.
 * 1. **Last week.** Each unit's share of the time you spent, as a bar
 *    with no target; days and activities you flagged; how many things
 *    you logged. No missed counts, no share of the plan, no comparison
 *    with the week before (P15).
 * 2. **Anything different this week?** This week's events, each with a
 *    switch to turn it off for the week and a tap to edit it; then Copy
 *    last week's events, Change hours, Add an event and Time away.
 * 3. **Your windows.** One card per day left, with its windows and
 *    their suggestions to pin, accept or add to. Anything you don't pin
 *    is still suggested.
 *
 * **Skipping the pass is never mentioned** and nothing records it.
 */
import { isoWeekday, weekStart, type PinKind, type TimeRange } from "@glide/scoring";
import { router, Stack, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  useColorScheme,
  View,
} from "react-native";

import { AddFromOpenSheet } from "../components/plan/AddFromOpenSheet";
import { addableTo, dayHeading, spanLabel, timeline } from "../components/plan/dayView";
import { EventSheet } from "../components/plan/EventSheet";
import { savedOrSaid, saveEventEdit, CANCELLED, saveNewEvent } from "../components/plan/saveEvent";
import { pickableUnits } from "../components/plan/unitSelection";
import { WindowCard } from "../components/plan/WindowCard";
import { WindowTimesSheet } from "../components/plan/WindowTimesSheet";
import { WEEKDAY_NAME } from "../components/plan/planning";
import { saveDayWindow } from "../components/plan/saveWindow";
import { AppText } from "../components/ui/AppText";
import { Button } from "../components/ui/Button";
import { Group } from "../components/ui/Group";
import { InfoButton } from "../components/ui/InfoButton";
import { KeyboardScroll } from "../components/ui/KeyboardScroll";
import { LoadFailure, useScreenLoad } from "../components/ui/ScreenLoad";
import { UndoBar } from "../components/ui/UndoBar";
import { loadDayPlan, type DayPlan } from "../db/dayPlan";
import { addDayEdit } from "../db/hours";
import { pinForDay, setPinKind, unpinForDay } from "../db/pins";
import { copyLastWeeksEvents, loadPlan, type PlanData } from "../db/tasks";
import type { TodayTask } from "../db/today";
import {
  isOnThisWeek,
  loadLastWeek,
  loadWeekEvents,
  markTiersOffered,
  setEventOffThisWeek,
  tiersCheckDue,
  type LastWeek,
  type PassEvent,
  type WeekEvent,
} from "../db/weeklyPass";
import { daysLeft } from "../db/weeklyPassRules";
import { useRetained } from "../hooks/useRetained";
import { useUndoDelete } from "../hooks/useUndoDelete";
import { currentLocalDate } from "../lib/calendar";
import { recordProblem } from "../lib/problemLog";
import { spokenDate } from "../lib/format";
import { getTheme } from "../theme/colors";
import { cardStyle } from "../theme/surfaces";
import { radius, space } from "../theme/tokens";

type Step = "tiers" | "lastWeek" | "different" | "windows";

/** A window sheet on one day, named by the window's start. */
type DaySheet =
  | {
      kind: "add";
      date: string;
      start: number;
      /** Taken as it opens, so a reload can't change the list under it. */
      label: string;
      tasks: readonly TodayTask[];
    }
  | { kind: "times"; date: string };

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "Mon" and "26" for a `YYYY-MM-DD`, read from its parts (ADR-0002). */
function shortDay(localDate: string): { weekday: string; dayNum: string } {
  const [y, m, d] = localDate.split("-").map(Number);
  const weekday = WEEKDAY_SHORT[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
  return { weekday, dayNum: String(d) };
}

export default function WeeklyPassScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme === "dark" ? "dark" : "light");
  const today = currentLocalDate();

  const [steps, setSteps] = useState<Step[] | null>(null);
  const [step, setStep] = useState(0);
  /** The day step 3 shows; null until you pick one. */
  const [passDay, setPassDay] = useState<string | null>(null);
  const [last, setLast] = useState<LastWeek | null>(null);
  const [events, setEvents] = useState<WeekEvent[]>([]);
  const [days, setDays] = useState<DayPlan[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<PassEvent | "new" | null>(null);
  const [editingShown, editingGone] = useRetained(editing);
  const [eventUnits, setEventUnits] = useState<string[]>([]);
  const [sheet, setSheet] = useState<DaySheet | null>(null);
  const [sheetShown, sheetGone] = useRetained(sheet);
  const [opened, setOpened] = useState(0);

  /** Only the latest load lands: one started on coming back from
   *  another screen can't overwrite what a write has just reloaded. */
  const loadTurn = useRef(0);
  const load = useCallback(async () => {
    const turn = ++loadTurn.current;
    const dates = daysLeft(today);
    const [due, lastWeek, weekEvents, plans, nextPlan] = await Promise.all([
      tiersCheckDue(today),
      loadLastWeek(today),
      loadWeekEvents(today),
      Promise.all(dates.map((d) => loadDayPlan(d))),
      loadPlan(),
    ]);
    if (turn !== loadTurn.current) return;
    // The steps are set once, as the pass opens, and stay for it.
    setSteps((s) => s ?? [...(due ? (["tiers"] as const) : []), "lastWeek", "different", "windows"]);
    setLast(lastWeek);
    setEvents(weekEvents);
    setDays(plans);
    setPlan(nextPlan);
  }, [today]);
  const { error, retry, save } = useScreenLoad(load);

  // Offering the tiers marks this month's as offered. A failed write
  // only means they're offered again; it never blanks the pass.
  const offersTiers = steps?.[0] === "tiers";
  useEffect(() => {
    if (!offersTiers) return;
    void markTiersOffered(today).catch((e: unknown) =>
      recordProblem(e instanceof Error ? e : new Error(String(e)), "save"),
    );
  }, [offersTiers, today]);

  /** One write at a time: a second tap waits its turn rather than
   *  acting on a list the first is about to change. */
  const writing = useRef(false);
  const once = (write: () => Promise<unknown>) => {
    if (writing.current) return;
    writing.current = true;
    void save(write).finally(() => {
      writing.current = false;
    });
  };
  const undo = useUndoDelete(save);
  const allUnits = useMemo(() => pickableUnits(plan), [plan]);

  const finish = () => router.back();
  const at = steps === null ? 0 : Math.min(step, steps.length - 1);
  const current = steps?.[at] ?? null;
  const isLast = steps !== null && at === steps.length - 1;

  // ── Writes ───────────────────────────────────────────────────────

  const toggleEvent = (e: WeekEvent, on: boolean) => {
    setBusy((b) => new Set(b).add(e.event.id));
    void save(() => setEventOffThisWeek(e, !on)).finally(() =>
      setBusy((b) => {
        const next = new Set(b);
        next.delete(e.event.id);
        return next;
      }),
    );
  };

  const copyEvents = () =>
    void save(async () => {
      const added = await copyLastWeeksEvents(weekStart(today));
      Alert.alert(
        added === 0 ? "Nothing to copy" : "Copied",
        added === 0
          ? "Last week had no one-time events to bring forward, or they're already here."
          : `${added} ${added === 1 ? "event" : "events"} from last week, a week later. Change any times that moved.`,
      );
    });

  const dayOf = (date: string) => days.find((d) => d.day.date === date);
  const pin = (date: string, taskId: string, start: number) => {
    const t = dayOf(date)?.tasks.get(taskId);
    once(() =>
      pinForDay(taskId, date, start, "window", {
        extra: t !== undefined && t.band === "doneThisWeek" && !t.commitment,
      }),
    );
  };
  const acceptAll = (date: string, start: number) => {
    const w = dayOf(date)?.planned.windows.find((x) => x.range.start === start);
    if (!w) return;
    once(async () => {
      for (const s of w.suggested) await pinForDay(s.taskId, date, start, "window");
    });
  };
  const removeWindow = (date: string, range: TimeRange) =>
    undo.remove({
      id: `win-${date}-${range.start}-${range.end}`,
      message: `Removed ${spanLabel(range)}`,
      run: () => addDayEdit(date, { kind: "remove", range }),
    });
  const addWindow = async (date: string, range: TimeRange, weekly: boolean): Promise<string | null> => {
    const events = days.find((d) => d.day.date === date)?.events ?? [];
    const said = await saveDayWindow({
      date,
      range,
      weekly,
      events: events.map((e) => ({ start: e.start, end: e.end })),
    });
    if (said !== null) return said;
    setSheet(null);
    retry();
    return null;
  };

  // ── Steps ────────────────────────────────────────────────────────

  const hueFor = (t: TodayTask) => theme.areas[t.areaId] ?? theme.accent;

  const body = (() => {
    if (current === "tiers") {
      return (
        <View style={styles.stack}>
          <AppText variant="title" color={theme.ink} accessibilityRole="header">
            Still happy with your tiers?
          </AppText>
          <AppText color={theme.muted}>
            A new month is a good moment to look. Leaving them as they are is fine too.
          </AppText>
          <Button
            variant="tonal"
            label="Open Priorities"
            onPress={() => router.push("/priorities" as Href)}
            theme={theme}
          />
        </View>
      );
    }
    if (current === "lastWeek" && last) {
      return (
        <View style={styles.stack}>
          <AppText variant="title" color={theme.ink} accessibilityRole="header">
            Here&apos;s where last week went
          </AppText>
          {last.shares.length === 0 ? (
            <AppText color={theme.muted}>Nothing completed to show from last week.</AppText>
          ) : (
            <Group theme={theme}>
              <View style={styles.stack}>
                {last.shares.map((s) => {
                  const pct = Math.round(s.share * 100);
                  const hue = theme.areas[s.areaId] ?? theme.accent;
                  return (
                    <View
                      key={s.unitId}
                      accessible
                      accessibilityLabel={`${s.name}, ${pct}% of your time`}
                      style={styles.share}
                    >
                      <View style={styles.shareLine}>
                        <AppText variant="body" color={theme.ink} style={styles.grow}>
                          {s.name}
                        </AppText>
                        <AppText variant="caption" color={theme.muted} tabular>
                          {pct}%
                        </AppText>
                      </View>
                      {/* A share, never set against a target. */}
                      <View style={[styles.track, { backgroundColor: theme.hairline }]}>
                        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: hue }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Group>
          )}
          {last.flaggedDays.length > 0 || last.flaggedActivities.length > 0 ? (
            <Group theme={theme} title="Worth remembering">
              {last.flaggedDays.map((d) => (
                <AppText key={d} color={theme.ink} accessibilityLabel={`Flagged day, ${spokenDate(d)}`}>
                  ☆ {spokenDate(d)}
                </AppText>
              ))}
              {last.flaggedActivities.map((a) => (
                <AppText
                  key={`${a.date}-${a.title}`}
                  color={theme.ink}
                  accessibilityLabel={`Flagged, ${a.title}`}
                >
                  ☆ {a.title}
                </AppText>
              ))}
            </Group>
          ) : null}
          {last.activities > 0 ? (
            <AppText variant="caption" color={theme.muted}>
              You logged {last.activities} {last.activities === 1 ? "thing" : "things"}.
            </AppText>
          ) : null}
        </View>
      );
    }
    if (current === "different") {
      return (
        <View style={styles.stack}>
          <AppText variant="title" color={theme.ink} accessibilityRole="header">
            Anything different this week?
          </AppText>
          {events.length === 0 ? (
            <AppText color={theme.muted}>No events this week.</AppText>
          ) : (
            <Group theme={theme} title="This week's events">
              {events.map((e) => {
                const on = isOnThisWeek(e);
                const when = `${e.days.map((d) => spokenDate(d.date).split(",")[0]).join(", ")} · ${spanLabel({ start: e.event.startMinute ?? 0, end: e.event.endMinute ?? 0 })}`;
                return (
                  <View key={e.event.id} style={styles.eventRow}>
                    <Pressable
                      onPress={() => setEditing(e.event)}
                      accessibilityRole="button"
                      accessibilityLabel={`${e.event.title}, ${when}`}
                      accessibilityHint="Edits the event"
                      style={styles.grow}
                    >
                      <AppText color={on ? theme.ink : theme.muted}>{e.event.title}</AppText>
                      <AppText variant="footnote" color={theme.muted}>
                        {when}
                      </AppText>
                    </Pressable>
                    <Switch
                      value={on}
                      disabled={busy.has(e.event.id) || (!on && e.days.every((d) => d.skipId === null))}
                      onValueChange={(next) => toggleEvent(e, next)}
                      trackColor={{ true: theme.accent }}
                      accessibilityLabel={`${e.event.title} this week`}
                      accessibilityHint="Off skips it for the rest of this week"
                    />
                  </View>
                );
              })}
            </Group>
          )}
          <Group theme={theme} flush>
            <PassLink label="Copy last week's events" onPress={copyEvents} theme={theme} />
            <PassLink label="Change hours this week" onPress={() => router.push("/hours" as Href)} theme={theme} />
            <PassLink
              label="Add an event"
              onPress={() => {
                setEventUnits([]);
                setEditing("new");
              }}
              theme={theme}
            />
            <PassLink label="Time away" onPress={() => router.push("/away" as Href)} theme={theme} />
          </Group>
        </View>
      );
    }
    if (current === "windows") {
      // One day at a time, picked from a strip of the days left (Henry,
      // 2026-10-25: the long scroll of every day was "horrific").
      const live = (d: (typeof days)[number]) =>
        d.planned.windows.filter(
          (w) => !w.ended && !undo.hidden.has(`win-${d.day.date}-${w.range.start}-${w.range.end}`),
        );
      // Until you pick one, the first day that still has a window.
      const shown =
        days.find((d) => d.day.date === passDay) ?? days.find((d) => live(d).length > 0) ?? days[0];
      const date = shown?.day.date ?? today;
      // Held from the first look, so emptying that day doesn't move you.
      if (passDay === null && shown) setPassDay(shown.day.date);
      return (
        <View style={styles.stack}>
          <View style={styles.leadRow}>
            <AppText variant="title" color={theme.ink} accessibilityRole="header" style={styles.grow}>
              Your windows
            </AppText>
            <InfoButton
              title="Your windows"
              body="Pin what you want to keep in each window: tap a pin once to pin it there, twice to keep it until done. Anything you don't pin is still suggested."
              theme={theme}
            />
          </View>
          <View style={styles.dayStrip} accessibilityRole="tablist">
            {days.map((d) => {
              const on = d.day.date === date;
              const pins = live(d).reduce((n, w) => n + w.pinned.length, 0);
              const { weekday, dayNum } = shortDay(d.day.date);
              return (
                <Pressable
                  key={d.day.date}
                  onPress={() => setPassDay(d.day.date)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${spokenDate(d.day.date)}, ${pins} pinned`}
                  style={({ pressed }) => [
                    styles.dayChip,
                    on ? { backgroundColor: theme.accent } : cardStyle(theme),
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <AppText variant="footnote" color={on ? theme.onAccent : theme.muted}>
                    {weekday}
                  </AppText>
                  <AppText variant="headline" color={on ? theme.onAccent : theme.ink} tabular>
                    {dayNum}
                  </AppText>
                  <View
                    style={[
                      styles.pinDot,
                      { backgroundColor: pins > 0 ? (on ? theme.onAccent : theme.accent) : "transparent" },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>

          {shown ? (
            <>
              <AppText variant="headline" color={theme.ink} accessibilityRole="header">
                {dayHeading(date, live(shown).length, shown.freeMinutes)}
              </AppText>
              {live(shown).length === 0 ? (
                <AppText color={theme.muted}>No windows left on this day.</AppText>
              ) : null}
              {timeline(shown.hours, shown.events).map((item) => {
                if (item.kind !== "window") return null;
                const w = shown.planned.windows[item.index];
                if (!w || w.ended || undo.hidden.has(`win-${date}-${w.range.start}-${w.range.end}`)) return null;
                return (
                  <WindowCard
                    key={`${date}-${w.range.start}-${w.range.end}`}
                    window={w}
                    tasks={shown.tasks}
                    addable={addableTo(item.index, shown.planned).length}
                    editable
                    isToday={date === today}
                    hueFor={hueFor}
                    theme={theme}
                    onPin={(id) => pin(date, id, w.range.start)}
                    onAcceptAll={() => acceptAll(date, w.range.start)}
                    onUnpin={(id) => once(() => unpinForDay(id, date))}
                    onPinKind={(ruleId: string, kind: PinKind) => once(() => setPinKind(ruleId, kind))}
                    onAddFromOpen={() => {
                      setOpened((n) => n + 1);
                      setSheet({
                        kind: "add",
                        date,
                        start: w.range.start,
                        label: spanLabel(w.range),
                        tasks: addableTo(item.index, shown.planned)
                          .map((id) => shown.tasks.get(id))
                          .filter((t): t is TodayTask => t !== undefined),
                      });
                    }}
                    onRemove={() => removeWindow(date, w.range)}
                  />
                );
              })}
              {!shown.day.away ? (
                <Button
                  variant="tonal"
                  icon="add"
                  label="Add a window"
                  onPress={() => {
                    setOpened((n) => n + 1);
                    setSheet({ kind: "times", date });
                  }}
                  theme={theme}
                />
              ) : null}
            </>
          ) : null}
        </View>
      );
    }
    return null;
  })();

  return (
    <View style={[styles.root, { backgroundColor: theme.canvas }]}>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="done" onPress={finish}>
          Finish
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      {error ? (
        <LoadFailure error={error} onRetry={retry} theme={theme} />
      ) : steps === null ? (
        <ActivityIndicator color={theme.muted} style={styles.loading} />
      ) : (
        <>
          <KeyboardScroll
            style={styles.root}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.container}
          >
            <AppText variant="caption" color={theme.muted}>
              Step {step + 1} of {steps.length}
            </AppText>
            {body}
          </KeyboardScroll>
          <View style={[styles.footer, { borderTopColor: theme.hairline }]}>
            {step > 0 ? (
              <Button variant="secondary" label="Back" onPress={() => setStep(step - 1)} theme={theme} />
            ) : (
              <View />
            )}
            <Button
              label={isLast ? "Done" : current === "tiers" ? "Skip" : "Next"}
              onPress={() => (isLast ? finish() : setStep(step + 1))}
              theme={theme}
            />
          </View>
        </>
      )}

      <UndoBar undo={undo} theme={theme} />

      {sheetShown?.kind === "add" ? (
        <AddFromOpenSheet
          key={`add-${opened}`}
          visible={sheet?.kind === "add"}
          onDismissed={sheetGone}
          windowLabel={sheetShown.label}
          tasks={sheetShown.tasks}
          hueFor={hueFor}
          theme={theme}
          onClose={() => setSheet(null)}
          date={sheetShown.date}
          windowStart={sheetShown.start}
          onPick={(t) => {
            setSheet(null);
            pin(sheetShown.date, t.id, sheetShown.start);
          }}
          onAdded={retry}
        />
      ) : null}

      {sheetShown?.kind === "times" ? (
        <WindowTimesSheet
          key={`times-${opened}`}
          visible={sheet?.kind === "times"}
          onDismissed={sheetGone}
          dayLabel={sheetShown.date === today ? "today" : (spokenDate(sheetShown.date).split(",")[0] ?? sheetShown.date)}
          theme={theme}
          onClose={() => setSheet(null)}
          weekdayName={WEEKDAY_NAME[isoWeekday(sheetShown.date)]}
          onSave={(range, weekly) => addWindow(sheetShown.date, range, weekly)}
        />
      ) : null}

      {editingShown !== null ? (
        <EventSheet
          visible={editing !== null}
          onDismissed={editingGone}
          initial={
            editingShown === "new"
              ? undefined
              : {
                  title: editingShown.title,
                  plannedWeekdays: editingShown.plannedWeekdays,
                  oneOffDate: editingShown.oneOffDate,
                  startMinute: editingShown.startMinute,
                  endMinute: editingShown.endMinute,
                  notes: editingShown.notes,
                  repeatFrom: editingShown.repeatFrom,
                  repeatUntil: editingShown.repeatUntil,
                }
          }
          seriesId={editingShown === "new" ? undefined : editingShown.id}
          unitChoice={
            editingShown === "new"
              ? { units: allUnits, value: eventUnits, onChange: setEventUnits, areaColors: theme.areas }
              : undefined
          }
          accent={
            editingShown === "new" ? theme.accent : (theme.areas[editingShown.areaId] ?? theme.accent)
          }
          theme={theme}
          onClose={() => setEditing(null)}
          onSave={async (input, bounds) => {
            const target = editingShown;
            const saved = await savedOrSaid(async () => {
              if (target === "new") {
                return (await saveNewEvent(eventUnits, input, bounds)) !== CANCELLED;
              }
              return saveEventEdit(target, input, bounds);
            });
            if (!saved) return;
            setEditing(null);
            setEventUnits([]);
            retry();
          }}
        />
      ) : null}
    </View>
  );
}

function PassLink({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.5 : 1 }]}
    >
      <AppText color={theme.accent}>{label} ›</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { marginTop: space.xxl },
  container: { paddingHorizontal: space.screen, paddingBottom: space.xxl, gap: space.lg },
  stack: { gap: space.md },
  grow: { flex: 1 },
  leadRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dayStrip: { flexDirection: "row", gap: space.xs },
  /** Seven fit across an iPhone 15 (393pt) with the screen gutters. */
  dayChip: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    minHeight: 64,
  },
  pinDot: { width: 5, height: 5, borderRadius: 3 },
  share: { gap: space.xs },
  shareLine: { flexDirection: "row", alignItems: "center", gap: space.sm },
  track: { height: 6, borderRadius: radius.pill, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.pill },
  eventRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.lg },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.screen,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
