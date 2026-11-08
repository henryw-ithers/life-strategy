/**
 * Today on Home (spec §5.1, §4.6, ADR-0048): the day in time order,
 * its sections with the events, named gaps and timed tasks between
 * them, then Other open tasks, then what's done.
 *
 * - Sections are the day's windows, plus any part of the day no window
 *   touches; on a day with no windows, Morning, Afternoon, Evening,
 *   Night (when it holds something) and Anytime, each with its events
 *   at their times (ADR-0051, which sets windows aside for launch).
 *   **None disappears when its time is over** (`HomeWindow`).
 * - Hold a task and drag it into any section, or within one, to move
 *   it for today and set your order (`DayDrag`).
 * - Events sit at their times and are ticked like tasks; a long press
 *   skips one (ADR-0040 §2).
 * - **Done** is at the bottom, each tick under the window it was done
 *   in: hold one to say it was done in another.
 * - **Not on today** (Henry, 2026-11-07): work that belongs to another
 *   day, in three groups (earlier this week, with a deadline, later this
 *   week), each with Add to today. It starts closed, and loads later
 *   one-offs once opened (ADR-0037 §3).
 * - **Other open tasks**, on a day with windows: Doesn't fit today and
 *   More for today. It starts closed,
 *   and dropping a task there takes it out of its window for today.
 *
 * Every open task shows exactly once (EC-19).
 */
import { formatMinutes, type PlannedDay, type TimeRange } from "@glide/scoring";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { DayPlan } from "../../db/dayPlan";
import type { TodayTask } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { cardStyle } from "../../theme/surfaces";
import { space } from "../../theme/tokens";
import { spanLabel, timeline } from "../plan/dayView";
import { AppText } from "../ui/AppText";
import { ExpandChevron } from "../ui/ExpandChevron";
import { DragRow, useDropTarget } from "./DayDrag";
import { openIndex, situationLine, windowState, type WindowState } from "./homeDay";
import { doneGroups, NOT_ON_TODAY_LABEL, notOnToday, type HomeSection, type NotOnTodayGroup } from "./homeSections";
import { HomeSectionCard, type RowExtra } from "./HomeWindow";

export const windowId = (r: TimeRange) => `${r.start}-${r.end}`;

/** Where a drop takes a task out of its window for today. */
export const OTHERS_KEY = "others";

interface HomeTodayProps {
  plan: DayPlan;
  /** `plan.planned`, filled again with swaps and "Pull in another". */
  planned: PlannedDay;
  sections: readonly HomeSection[];
  now: number | null;
  /** Sections opened or closed by hand, by key. */
  expanded: Readonly<Record<string, boolean>>;
  onToggleSection: (key: string, open: boolean) => void;
  /** Open one-offs planned for later days, loaded once the list opens. */
  ahead: readonly TodayTask[] | null;
  othersOpen: boolean;
  onToggleOthers: () => void;
  renderRow: (task: TodayTask, extra: RowExtra) => React.ReactNode;
  holdFor: (task: TodayTask, windowStart: number | null) => (() => void) | undefined;
  canDrag: (task: TodayTask) => boolean;
  editable: boolean;
  onSwap: (windowStart: number, taskId: string) => void;
  onPullIn: (windowStart: number) => void;
  onAddFromOpen: (windowStart: number) => void;
  onEditTimes: (range: TimeRange) => void;
  onRemove: (range: TimeRange) => void;
  reduceMotion: boolean;
  theme: ThemeTokens;
  /** Which Not on today group a task is in, or null for today's own. */
  groupOf: (taskId: string) => NotOnTodayGroup | null;
  /** Add to today: put work from another day on today's list. */
  onAddToday: (task: TodayTask) => void;
}

/** Where a part of the day is, today: over, now, or still to come. */
function partState(range: TimeRange | null, now: number | null): WindowState {
  if (range === null || now === null) return "later";
  if (now >= range.end) return "past";
  return now >= range.start ? "open" : "later";
}

export function HomeToday({
  plan,
  planned,
  sections,
  now,
  expanded,
  onToggleSection,
  ahead,
  othersOpen,
  onToggleOthers,
  renderRow,
  holdFor,
  canDrag,
  editable,
  onSwap,
  onPullIn,
  onAddFromOpen,
  onEditTimes,
  onRemove,
  reduceMotion,
  groupOf,
  onAddToday,
  theme,
}: HomeTodayProps) {
  const [doneOpen, setDoneOpen] = useState(false);
  const tasks = plan.tasks;
  const ranges = planned.windows.map((w) => w.range);
  const open = openIndex(ranges, now);
  const line = situationLine(ranges, plan.hours.gaps, now);

  // With no windows, the parts of the day hold the events and timed
  // tasks (ADR-0051); with windows, they sit at their time between.
  const inParts = ranges.length === 0;
  const atTime = inParts
    ? []
    : planned.atTime
        .map((id) => tasks.get(id))
        .filter((t): t is TodayTask => t !== undefined && t.startMinute !== null);
  const items = [
    ...timeline({ ...plan.hours, windows: [] }, inParts ? [] : plan.events).map((item) => ({
      start: item.kind === "event" ? item.event.start : item.range.start,
      item,
    })),
    ...atTime.map((t) => ({ start: t.startMinute!, item: { kind: "atTime" as const, task: t } })),
    ...sections.map((section) => ({
      start: section.kind === "window" ? section.window.range.start : (section.range?.start ?? Infinity),
      item: { kind: "section" as const, section },
    })),
  ].sort((a, b) => a.start - b.start);

  // Later one-offs, loaded once the section opens, join its rows.
  const aheadById = new Map((ahead ?? []).filter((t) => !tasks.has(t.id)).map((t) => [t.id, t] as const));
  const taskOf = (id: string) => tasks.get(id) ?? aheadById.get(id);
  const notToday = notOnToday({ planned, group: groupOf, dayOrder: plan.dayOrder, aheadIds: [...aheadById.keys()] });
  const notTodayCount = notToday.reduce((n, g) => n + g.taskIds.length, 0);
  // On a day with windows, what no window holds; on one with none,
  // the parts of the day hold it.
  const later =
    planned.windows.length > 0 ? [...planned.unplacedPins.map((p) => p.taskId), ...planned.later] : [];
  const groups = [
    { key: "fit", label: "Doesn't fit today", ids: planned.doesntFit },
    { key: "more", label: "More for today", ids: later },
  ];
  const otherIds = [...planned.doesntFit, ...later];
  const otherCount = otherIds.length;
  const [overOthers, attachOthers] = useDropTarget(OTHERS_KEY, othersOpen ? otherIds : []);

  const done = doneGroups({
    done: (plan.input.done ?? []).map((d) => d.taskId),
    doneIn: plan.doneIn,
    windows: ranges,
  });
  const doneCount = done.reduce((n, g) => n + g.taskIds.length, 0);

  const stateOf = (s: HomeSection): WindowState =>
    s.kind === "window" ? windowState(s.index, open, ranges, now) : partState(s.range, now);
  const startsOpen = (s: HomeSection, state: WindowState) =>
    state === "open" ||
    (state === "past" ? s.rows.length > 0 : s.kind === "part" && s.rows.length + s.timed.length > 0);

  const otherRow = (id: string) => {
    const t = tasks.get(id);
    if (!t) return null;
    return (
      <DragRow key={id} id={id} sectionKey={OTHERS_KEY} enabled={editable && canDrag(t)} onHold={holdFor(t, null)}>
        {renderRow(t, { windowStart: null, dragged: true })}
      </DragRow>
    );
  };

  return (
    <View style={styles.root}>
      {line ? (
        <AppText variant="caption" color={theme.muted}>
          {line}
        </AppText>
      ) : null}

      {items.map(({ item }) => {
        if (item.kind === "event") {
          const t = tasks.get(item.event.id);
          return t ? <View key={`e-${t.id}`}>{renderRow(t, { windowStart: null, dragged: false })}</View> : null;
        }
        if (item.kind === "atTime") {
          return (
            <View key={`t-${item.task.id}`}>
              {renderRow(item.task, {
                reason: `At ${formatMinutes(item.task.startMinute!)}`,
                windowStart: null,
                dragged: false,
              })}
            </View>
          );
        }
        if (item.kind === "gap" || item.kind === "buffer") {
          return (
            <AppText
              key={`${item.kind}-${item.range.start}`}
              variant="footnote"
              color={theme.muted}
              style={styles.gap}
            >
              · {item.kind === "gap" ? item.name.toLowerCase() : `${item.range.end - item.range.start} min`} ·
            </AppText>
          );
        }
        if (item.kind !== "section") return null;
        const s = item.section;
        const state = stateOf(s);
        const isOpen = expanded[s.key] ?? startsOpen(s, state);
        const w = s.kind === "window" ? s.window.range : null;
        return (
          <HomeSectionCard
            key={s.key}
            section={s}
            state={state}
            expanded={isOpen}
            onToggleExpanded={() => onToggleSection(s.key, !isOpen)}
            now={now}
            tasks={tasks}
            renderRow={renderRow}
            holdFor={holdFor}
            canDrag={canDrag}
            onSwap={(taskId) => w && onSwap(w.start, taskId)}
            onPullIn={() => w && onPullIn(w.start)}
            onAddFromOpen={() => w && onAddFromOpen(w.start)}
            onEditTimes={() => w && onEditTimes(w)}
            onRemove={() => w && onRemove(w)}
            editable={editable}
            reduceMotion={reduceMotion}
            theme={theme}
          />
        );
      })}

      {otherCount > 0 ? (
        <View
          ref={attachOthers}
          collapsable={false}
          style={[styles.others, overOthers ? { borderColor: theme.accent, borderWidth: 1.5, borderRadius: 12 } : null]}
        >
          <Pressable
            onPress={onToggleOthers}
            accessibilityRole="button"
            accessibilityState={{ expanded: othersOpen }}
            style={styles.othersHeader}
          >
            <View style={styles.othersTitle}>
              <AppText variant="label" color={theme.ink}>
                Other open tasks ({otherCount})
              </AppText>
              <ExpandChevron open={othersOpen} color={theme.muted} size={13} />
            </View>
          </Pressable>
          {othersOpen
            ? groups.map((g) =>
                g.ids.length > 0 ? (
                  <View key={g.key} style={styles.group}>
                    <AppText variant="caption" color={theme.muted} style={styles.groupLabel}>
                      {g.label}
                    </AppText>
                    <View style={[cardStyle(theme), styles.list]}>{g.ids.map(otherRow)}</View>
                  </View>
                ) : null,
              )
            : null}
        </View>
      ) : null}

      {notTodayCount > 0 ? (
        <View style={styles.others}>
          <Pressable
            onPress={onToggleOthers}
            accessibilityRole="button"
            accessibilityState={{ expanded: othersOpen }}
            style={styles.othersHeader}
          >
            <View style={styles.othersTitle}>
              <AppText variant="label" color={theme.ink}>
                Not on today ({notTodayCount})
              </AppText>
              <ExpandChevron open={othersOpen} color={theme.muted} size={13} />
            </View>
          </Pressable>
          {othersOpen
            ? notToday.map((g) => (
                <View key={g.group} style={styles.group}>
                  <AppText variant="caption" color={theme.muted} style={styles.groupLabel}>
                    {NOT_ON_TODAY_LABEL[g.group]}
                  </AppText>
                  <View style={[cardStyle(theme), styles.list]}>
                    {g.taskIds.map((id) => {
                      const t = taskOf(id);
                      if (!t) return null;
                      return (
                        <View key={`n-${id}`} style={styles.addRow}>
                          <View style={styles.grow}>{renderRow(t, { windowStart: null, dragged: false })}</View>
                          {editable ? (
                            <Pressable
                              onPress={() => onAddToday(t)}
                              accessibilityRole="button"
                              accessibilityLabel={`Add ${t.title} to today`}
                              hitSlop={6}
                              style={({ pressed }) => [
                                styles.addButton,
                                { backgroundColor: theme.fill, opacity: pressed ? 0.6 : 1 },
                              ]}
                            >
                              <AppText variant="caption" color={theme.accent}>
                                Add to today
                              </AppText>
                            </Pressable>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))
            : null}
        </View>
      ) : null}

      {done.length > 0 ? (
        <View style={styles.group}>
          {/* Folded to its count, so a long evening's list stays short. */}
          <Pressable
            onPress={() => setDoneOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: doneOpen }}
            accessibilityLabel={`Done, ${doneCount}`}
            style={styles.othersHeader}
          >
            <View style={styles.othersTitle}>
              <AppText variant="headline" color={theme.ink} accessibilityRole="header">
                Done ({doneCount})
              </AppText>
              <ExpandChevron open={doneOpen} color={theme.muted} size={13} />
            </View>
          </Pressable>
          {doneOpen ? (
          <View style={[cardStyle(theme), styles.list]}>
            {done.map((g) => (
              <View key={g.range ? `d-${g.range.start}` : "d-other"}>
                {/* With no windows, one group, and nothing to name it by. */}
                {g.range || done.length > 1 ? (
                  <AppText variant="footnote" color={theme.muted} tabular style={styles.doneLabel}>
                    {g.range ? spanLabel(g.range) : "Outside your windows"}
                  </AppText>
                ) : null}
                {g.taskIds.map((id) => {
                  const t = tasks.get(id);
                  return t ? (
                    <View key={`d-${id}`}>{renderRow(t, { windowStart: g.range?.start ?? null, dragged: false })}</View>
                  ) : null;
                })}
              </View>
            ))}
          </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  gap: { textAlign: "center" },
  others: { gap: space.sm },
  group: { gap: space.xs },
  groupLabel: { paddingHorizontal: space.xs },
  list: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  othersHeader: { minHeight: 44, justifyContent: "center" },
  addRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
  addButton: { minHeight: 32, paddingHorizontal: space.md, borderRadius: 999, justifyContent: "center" },
  othersTitle: { flexDirection: "row", alignItems: "center", gap: space.xs },
  doneLabel: { paddingTop: space.sm },
});
