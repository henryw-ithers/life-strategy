/**
 * A day as Plan shows it (spec §5.3): its windows, events and named gaps
 * in time order, each window with its pins and suggestions, and the
 * day's own actions. One component for Plan's day and for a future day
 * on Home (spec §5.2), so the two can't drift apart.
 *
 * It owns its window sheets (times, Add from open, "Do N of these")
 * and their writes. The screen around it owns loading, the Undo bar,
 * the week strip and the + menu, whose Window item calls `addWindow`
 * through the ref.
 *
 * **Nothing here changes a score** but the hours (ADR-0039 §12), and
 * nothing warns about load (P3, ADR-0026 §3).
 */
import { addedWindowPieces, weekStart, type PinKind, type TimeRange } from "@glide/scoring";
import { router, type Href } from "expo-router";
import { useImperativeHandle, useState, type Ref } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import type { DayPlan } from "../../db/dayPlan";
import { addDayEdit } from "../../db/hours";
import {
  pinForDay,
  setPinKind,
  unpinForDay,
} from "../../db/pins";
import { copyLastWeeksEvents } from "../../db/tasks";
import type { TodayTask } from "../../db/today";
import type { UndoDelete } from "../../hooks/useUndoDelete";
import { useRetained } from "../../hooks/useRetained";
import { spokenDate } from "../../lib/format";
import type { ThemeTokens } from "../../theme/colors";
import { cardStyle } from "../../theme/surfaces";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { AddFromOpenSheet } from "./AddFromOpenSheet";
import { addableTo, dayHeading, spanLabel, timeline } from "./dayView";
import { WindowCard } from "./WindowCard";
import { WindowTimesSheet } from "./WindowTimesSheet";

const DAY_KIND_LABEL = { normal: "Normal", special: "Special day", rest: "Day off" } as const;

/** What a window sheet is about. A window is named by its start, not
 *  its place in the list, so a reload can't point an open sheet at a
 *  different window. */
type WindowSheet =
  | { kind: "times"; range?: TimeRange }
  | { kind: "add"; start: number };

export interface PlanDayViewHandle {
  /** The + menu's Window: open "Add a window" for this day. */
  addWindow: () => void;
  /** The ⋯ menu's Copy last week's events. */
  copyEvents: () => void;
}

interface PlanDayViewProps {
  ref?: Ref<PlanDayViewHandle>;
  day: DayPlan;
  today: string;
  /** Writes through the screen's save, which reloads after. */
  save: (write: () => Promise<unknown>) => Promise<unknown>;
  /** Reload without a write (after a sheet saved on its own). */
  reload: () => void;
  undo: UndoDelete;
  /** Day type, where the screen offers it; omitted, no link. */
  onDayType?: () => void;
  /** Home's compact form leaves out the heading and the starter-hours
   *  link, which its own header and Plan already cover. */
  compact?: boolean;
  theme: ThemeTokens;
}

/** A window's id among Undo's pending removals, for its day. */
export const windowKey = (date: string, r: TimeRange) => `win-${date}-${r.start}-${r.end}`;

export function PlanDayView({
  ref,
  day,
  today,
  save,
  reload,
  undo,
  onDayType,
  compact = false,
  theme,
}: PlanDayViewProps) {
  const date = day.day.date;
  const editable = date >= today;
  const dayLabel = date === today ? "today" : (spokenDate(date).split(",")[0] ?? date);
  const hueFor = (t: TodayTask) => theme.areas[t.areaId] ?? theme.accent;

  const [sheet, setSheet] = useState<WindowSheet | null>(null);
  const [sheetShown, sheetGone] = useRetained(sheet);
  /** A sheet opened afresh each time, so its draft is seeded anew. */
  const [opened, setOpened] = useState(0);
  const openSheet = (next: WindowSheet) => {
    setOpened((n) => n + 1);
    setSheet(next);
  };

  const windowAt = (index: number) => day.planned.windows[index];
  const indexAt = (start: number) => day.planned.windows.findIndex((w) => w.range.start === start);

  const pin = (taskId: string, index: number) => {
    const w = windowAt(index);
    const t = day.tasks.get(taskId);
    if (!w || !t) return;
    void save(() =>
      pinForDay(taskId, date, w.range.start, "window", {
        // Pinned after the week's runs are done: an extra run on
        // purpose (windows-and-pins §2.8). Life tasks only.
        extra: t.band === "doneThisWeek" && !t.commitment,
      }),
    );
  };
  const acceptAll = (index: number) => {
    const w = windowAt(index);
    if (!w) return;
    void save(async () => {
      for (const s of w.suggested) await pinForDay(s.taskId, date, w.range.start, "window");
    });
  };
  const unpin = (taskId: string) => void save(() => unpinForDay(taskId, date));
  const pinKind = (ruleId: string, kind: PinKind) => void save(() => setPinKind(ruleId, kind));

  const removeWindow = (range: TimeRange) =>
    undo.remove({
      id: windowKey(date, range),
      message: `Removed ${spanLabel(range)}`,
      run: () => addDayEdit(date, { kind: "remove", range }),
    });

  /** A problem to show in the sheet, or null once saved. */
  const saveTimes = async (range: TimeRange): Promise<string | null> => {
    const from = sheet?.kind === "times" ? sheet.range : undefined;
    // A window over an event is trimmed around it, and can come to
    // nothing (EC-53): say so and save nothing.
    const events = day.events.map((e) => ({ start: e.start, end: e.end }));
    if (addedWindowPieces(range, events).length === 0) {
      return "That time is taken up by an event, so there's no window left.";
    }
    try {
      await addDayEdit(date, from ? { kind: "change", from, to: range } : { kind: "add", range });
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
    setSheet(null);
    reload();
    return null;
  };


  const copyEvents = () => {
    void save(async () => {
      const added = await copyLastWeeksEvents(weekStart(date));
      Alert.alert(
        added === 0 ? "Nothing to copy" : "Copied",
        added === 0
          ? "Last week had no one-time events to bring forward, or they're already here."
          : `${added} ${added === 1 ? "event" : "events"} from last week, a week later. Change any times that moved.`,
      );
    });
  };

  useImperativeHandle(ref, () => ({ addWindow: () => openSheet({ kind: "times" }), copyEvents }));

  const items = timeline(day.hours, day.events);
  const visibleWindows = day.planned.windows.filter((w) => !undo.hidden.has(windowKey(date, w.range)));
  const openList = [
    ...day.planned.unplacedPins.map((p) => p.taskId),
    ...day.planned.later,
    ...day.planned.doesntFit,
  ];

  return (
    <View style={styles.day}>
      {!compact ? (
        <AppText variant="headline" color={theme.ink} accessibilityRole="header">
          {dayHeading(date, visibleWindows.length, day.freeMinutes)}
        </AppText>
      ) : null}
      {day.day.away ? (
        <AppText variant="caption" color={theme.muted}>
          Away{day.day.away.label ? ` · ${day.day.away.label}` : ""}. Nothing is planned.
        </AppText>
      ) : day.day.cleared ? (
        <AppText variant="caption" color={theme.muted}>
          Today&apos;s cleared. Its windows are set aside.
        </AppText>
      ) : day.hours.usingDefaults && !compact ? (
        <Pressable onPress={() => router.push("/hours" as Href)} accessibilityRole="button" style={styles.link}>
          <AppText variant="caption" color={theme.accent}>
            These are starter windows. Set your working hours ›
          </AppText>
        </Pressable>
      ) : null}

      {items.map((item) => {
        if (item.kind === "event") {
          const e = item.event;
          return (
            <View
              key={`e-${e.id}`}
              style={[styles.event, { borderLeftColor: theme.areas[e.areaId] ?? theme.accent }]}
              accessible
              accessibilityLabel={`${e.title}, ${spanLabel({ start: e.start, end: e.end })}${e.done ? ", attended" : ""}`}
            >
              <AppText variant="label" color={theme.ink} tabular>
                {spanLabel({ start: e.start, end: e.end })}
              </AppText>
              <AppText variant="body" color={theme.ink} style={styles.grow} numberOfLines={2}>
                {e.title}
              </AppText>
            </View>
          );
        }
        if (item.kind === "gap" || item.kind === "buffer") {
          const label = item.kind === "gap" ? item.name.toLowerCase() : `${item.range.end - item.range.start} min`;
          return (
            <AppText key={`${item.kind}-${item.range.start}`} variant="footnote" color={theme.muted} style={styles.gap}>
              · {label} ·
            </AppText>
          );
        }
        const w = day.planned.windows[item.index];
        if (!w || undo.hidden.has(windowKey(date, w.range))) return null;
        return (
          <WindowCard
            key={windowKey(date, w.range)}
            window={w}
            tasks={day.tasks}
            addable={addableTo(item.index, day.planned).length}
            editable={editable}
            isToday={date === today}
            hueFor={hueFor}
            theme={theme}
            onPin={(id) => pin(id, item.index)}
            onAcceptAll={() => acceptAll(item.index)}
            onUnpin={unpin}
            onPinKind={pinKind}
            onAddFromOpen={() => openSheet({ kind: "add", start: w.range.start })}
            onEditTimes={() => openSheet({ kind: "times", range: w.range })}
            onRemove={() => removeWindow(w.range)}
          />
        );
      })}

      {openList.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="caption" color={theme.muted} style={styles.sectionLabel}>
            Not in a window
          </AppText>
          <View style={[cardStyle(theme), styles.list]}>
            {openList.map((id, i) => {
              const t = day.tasks.get(id);
              return t ? (
                <View
                  key={id}
                  style={[
                    styles.openRow,
                    i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.hairline } : null,
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: hueFor(t) }]} />
                  <AppText variant="body" color={theme.ink} style={styles.grow} numberOfLines={1}>
                    {t.title}
                  </AppText>
                </View>
              ) : null;
            })}
          </View>
        </View>
      ) : null}

      {editable && !day.day.away ? (
        <Button variant="tonal" icon="add" label="Add window" onPress={() => openSheet({ kind: "times" })} theme={theme} />
      ) : null}

      <View style={styles.links}>
        {onDayType ? (
          <Pressable
            onPress={onDayType}
            accessibilityRole="button"
            accessibilityLabel={`Day type, ${DAY_KIND_LABEL[day.day.kind]}`}
            style={styles.link}
          >
            <AppText variant="caption" color={theme.accent}>
              Day type: {DAY_KIND_LABEL[day.day.kind]} ›
            </AppText>
          </Pressable>
        ) : null}
        {editable ? (
          <Pressable onPress={copyEvents} accessibilityRole="button" style={styles.link}>
            <AppText variant="caption" color={theme.accent}>
              Copy last week&apos;s events ›
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {sheetShown?.kind === "times" ? (
        <WindowTimesSheet
          key={`times-${opened}`}
          visible={sheet?.kind === "times"}
          onDismissed={sheetGone}
          initial={sheetShown.range}
          dayLabel={dayLabel}
          theme={theme}
          onClose={() => setSheet(null)}
          onSave={saveTimes}
        />
      ) : null}

      {sheetShown?.kind === "add" && indexAt(sheetShown.start) >= 0 ? (
        <AddFromOpenSheet
          key={`add-${opened}`}
          visible={sheet?.kind === "add"}
          onDismissed={sheetGone}
          windowLabel={spanLabel(day.planned.windows[indexAt(sheetShown.start)]!.range)}
          tasks={addableTo(indexAt(sheetShown.start), day.planned)
            .map((id) => day.tasks.get(id))
            .filter((t): t is TodayTask => t !== undefined)}
          hueFor={hueFor}
          theme={theme}
          onClose={() => setSheet(null)}
          date={date}
          windowStart={sheetShown.start}
          onPick={(t) => {
            setSheet(null);
            pin(t.id, indexAt(sheetShown.start));
          }}
          onAdded={reload}
        />
      ) : null}

    </View>
  );
}


const styles = StyleSheet.create({
  day: { gap: space.md },
  event: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 44,
    paddingLeft: space.md,
    borderLeftWidth: 3,
    borderRadius: radius.sm,
  },
  grow: { flex: 1 },
  gap: { textAlign: "center" },
  section: { gap: space.xs },
  sectionLabel: { paddingHorizontal: space.xs },
  list: { paddingHorizontal: space.lg },
  openRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: space.md },
  link: { minHeight: 44, justifyContent: "center" },
});
