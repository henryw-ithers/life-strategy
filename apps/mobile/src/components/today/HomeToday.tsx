/**
 * Today on Home (spec §5.1, §4.6): the day in time order, windows with
 * the events, named gaps and timed tasks between them, then Other open
 * tasks.
 *
 * - The open window starts open; the rest are closed until tapped.
 * - Events sit at their times and are ticked like tasks; a long press
 *   skips one (ADR-0040 §2).
 * - Anything ticked outside a window is listed after the windows, so it
 *   can still be unticked.
 * - **Other open tasks** has three groups: Doesn't fit today, More for
 *   today and Planned for other days (ADR-0037 §3). With no window
 *   left today it's the one list, open, with a sort (§4.6); otherwise
 *   it starts closed.
 *
 * Every open task shows exactly once (EC-19).
 */
import {
  formatMinutes,
  sortOpenTasks,
  type OpenSort,
  type PlannedDay,
  type TimeRange,
} from "@glide/scoring";
import { Pressable, StyleSheet, View } from "react-native";

import type { DayPlan } from "../../db/dayPlan";
import type { TodayTask } from "../../db/today";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { timeline } from "../plan/dayView";
import { Segmented } from "../plan/Segmented";
import { AppText } from "../ui/AppText";
import { openIndex, situationLine, windowState } from "./homeDay";
import { HomeWindow } from "./HomeWindow";

const SORTS: { value: OpenSort; label: string }[] = [
  { value: "suggested", label: "Suggested" },
  { value: "dueDate", label: "Due" },
  { value: "size", label: "Size" },
  { value: "priority", label: "Priority" },
  { value: "points", label: "Points" },
];

export const windowId = (r: TimeRange) => `${r.start}-${r.end}`;

interface HomeTodayProps {
  plan: DayPlan;
  /** `plan.planned`, filled again with swaps and "Pull in another". */
  planned: PlannedDay;
  now: number | null;
  /** Windows waiting on a removal's Undo. */
  hidden: ReadonlySet<string>;
  /** Windows opened or closed by hand, by `windowId`. */
  expanded: Readonly<Record<string, boolean>>;
  onToggleWindow: (id: string, open: boolean) => void;
  /** Open one-offs planned for later days, loaded once the list opens. */
  ahead: readonly TodayTask[] | null;
  othersOpen: boolean;
  onToggleOthers: () => void;
  sort: OpenSort;
  onSort: (sort: OpenSort) => void;
  renderRow: (task: TodayTask, extra?: { reason?: string; onSwap?: () => void }) => React.ReactNode;
  editable: boolean;
  onSwap: (windowStart: number, taskId: string) => void;
  onPullIn: (windowStart: number) => void;
  onAddFromOpen: (windowStart: number) => void;
  onEditTimes: (range: TimeRange) => void;
  onRemove: (range: TimeRange) => void;
  theme: ThemeTokens;
}

export function HomeToday({
  plan,
  planned,
  now,
  hidden,
  expanded,
  onToggleWindow,
  ahead,
  othersOpen,
  onToggleOthers,
  sort,
  onSort,
  renderRow,
  editable,
  onSwap,
  onPullIn,
  onAddFromOpen,
  onEditTimes,
  onRemove,
  theme,
}: HomeTodayProps) {
  const windows = planned.windows.filter((w) => !hidden.has(windowId(w.range)));
  const ranges = windows.map((w) => w.range);
  const open = openIndex(ranges, now);
  const tasks = plan.tasks;
  const line = situationLine(ranges, plan.hours.gaps, now);

  // Timed tasks no window holds sit at their time, like events.
  const atTime = planned.atTime
    .map((id) => tasks.get(id))
    .filter((t): t is TodayTask => t !== undefined && t.startMinute !== null);
  const items = [
    ...timeline({ ...plan.hours, windows: ranges }, plan.events).map((item) => ({
      start: item.kind === "event" ? item.event.start : item.range.start,
      item,
    })),
    ...atTime.map((t) => ({ start: t.startMinute!, item: { kind: "atTime" as const, task: t } })),
  ].sort((a, b) => a.start - b.start);

  // Ticked today but in no window (before the first, in a gap): still
  // listed, so a tick can be taken back.
  const inWindows = new Set(windows.flatMap((w) => w.done));
  const doneElsewhere = plan.input.done
    ? plan.input.done
        .map((d) => d.taskId)
        .filter((id) => !inWindows.has(id))
        .map((id) => tasks.get(id))
        .filter((t): t is TodayTask => t !== undefined)
    : [];

  // Other open tasks. With no window left today, it's the one list.
  const oneList = open === null;
  const aheadIds = new Set(planned.plannedAhead);
  const aheadRows = [
    ...planned.plannedAhead.map((id) => tasks.get(id)).filter((t): t is TodayTask => t !== undefined),
    ...(ahead ?? []).filter((t) => !aheadIds.has(t.id) && !tasks.has(t.id)),
  ];
  const later = [...planned.unplacedPins.map((p) => p.taskId), ...planned.later];
  const sorted = (ids: readonly string[]) => {
    if (!oneList || sort === "suggested") return ids;
    const set = new Set(ids);
    const points = new Map([...tasks.values()].map((t) => [t.id, t.pointsIfCompletedNow]));
    return sortOpenTasks(
      plan.input.open.filter((t) => set.has(t.taskId)),
      sort,
      points,
    ).map((t) => t.taskId);
  };
  const groups = [
    { key: "fit", label: "Doesn't fit today", ids: sorted(planned.doesntFit) },
    { key: "more", label: oneList ? "Open today" : "More for today", ids: sorted(later) },
  ];
  const otherCount = later.length + planned.doesntFit.length + aheadRows.length;
  const showOthers = oneList || othersOpen;

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
          return t ? <View key={`e-${t.id}`}>{renderRow(t)}</View> : null;
        }
        if (item.kind === "atTime") {
          return <View key={`t-${item.task.id}`}>{renderRow(item.task, { reason: `At ${formatMinutes(item.task.startMinute!)}` })}</View>;
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
        const w = windows[item.index];
        if (!w) return null;
        const id = windowId(w.range);
        const state = windowState(item.index, open, ranges, now);
        return (
          <HomeWindow
            key={id}
            window={w}
            state={state}
            expanded={expanded[id] ?? state === "open"}
            onToggleExpanded={() => onToggleWindow(id, !(expanded[id] ?? state === "open"))}
            now={now}
            tasks={tasks}
            renderRow={renderRow}
            refilled={w.done.length > 0}
            onSwap={(taskId) => onSwap(w.range.start, taskId)}
            onPullIn={() => onPullIn(w.range.start)}
            onAddFromOpen={() => onAddFromOpen(w.range.start)}
            onEditTimes={() => onEditTimes(w.range)}
            onRemove={() => onRemove(w.range)}
            editable={editable}
            theme={theme}
          />
        );
      })}

      {doneElsewhere.length > 0 ? (
        <View>
          <AppText variant="caption" color={theme.muted}>
            Done today
          </AppText>
          {doneElsewhere.map((t) => (
            <View key={`d-${t.id}`}>{renderRow(t)}</View>
          ))}
        </View>
      ) : null}

      {otherCount > 0 || oneList ? (
        <View style={styles.others}>
          {oneList ? (
            <AppText variant="headline" color={theme.ink} accessibilityRole="header">
              Open tasks
            </AppText>
          ) : (
            <Pressable
              onPress={onToggleOthers}
              accessibilityRole="button"
              accessibilityState={{ expanded: othersOpen }}
              style={styles.othersHeader}
            >
              <AppText variant="label" color={theme.ink}>
                {othersOpen ? "▾" : "▸"} Other open tasks ({otherCount})
              </AppText>
            </Pressable>
          )}
          {oneList && later.length + planned.doesntFit.length > 1 ? (
            <Segmented
              segments={SORTS}
              value={sort}
              onChange={onSort}
              accent={theme.accent}
              theme={theme}
              label="Sort open tasks by"
            />
          ) : null}
          {showOthers
            ? groups.map((g) =>
                g.ids.length > 0 ? (
                  <View key={g.key}>
                    {!oneList || g.key === "fit" ? (
                      <AppText variant="caption" color={theme.muted}>
                        {g.label}
                      </AppText>
                    ) : null}
                    {g.ids.map((id) => {
                      const t = tasks.get(id);
                      return t ? <View key={id}>{renderRow(t)}</View> : null;
                    })}
                  </View>
                ) : null,
              )
            : null}
          {showOthers && (aheadRows.length > 0 || (oneList && !othersOpen)) ? (
            <View>
              <Pressable
                onPress={onToggleOthers}
                accessibilityRole="button"
                accessibilityState={{ expanded: othersOpen }}
                style={styles.othersHeader}
              >
                <AppText variant="caption" color={theme.muted}>
                  {othersOpen ? "▾" : "▸"} Planned for other days
                </AppText>
              </Pressable>
              {othersOpen
                ? aheadRows.map((t) => <View key={`a-${t.id}`}>{renderRow(t)}</View>)
                : null}
            </View>
          ) : null}
          {oneList && later.length + planned.doesntFit.length === 0 ? (
            <AppText color={theme.muted}>Nothing else is open today.</AppText>
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
  othersHeader: { minHeight: 44, justifyContent: "center" },
});
