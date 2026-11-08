/**
 * A day in its parts, for planning (ADR-0051): the Week tab's chosen
 * day, and a day ahead on Today. Morning, Afternoon, Evening, Night
 * (when it holds something) and Anytime, each with its events at their
 * times and then its tasks in your order. The same sections as Today
 * (`homeSections`), so the two can't drift apart.
 *
 * Tap a row to edit it. Hold a task and drag it to another part, or
 * within one, to move it there for that day and set your order; the
 * screen around it owns the drag (`DayDrag`) and calls `dropInPart`.
 * Nothing is ticked here and nothing is counted.
 *
 * **Nothing here changes a score**: a part is where a task sits, never
 * what it's worth (ADR-0039 §12).
 */
import { formatMinutes } from "@glide/scoring";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { DayPlan } from "../../db/dayPlan";
import { pinForDay } from "../../db/pins";
import { archiveTask, reorderDayTasks } from "../../db/tasks";
import type { TodayTask } from "../../db/today";
import type { UndoDelete } from "../../hooks/useUndoDelete";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import type { DropTarget } from "../today/DayDrag";
import { anchorOf, homeSections, timedRows, type HomeSection } from "../today/homeSections";
import { HomeSectionCard } from "../today/HomeWindow";
import { spanLabel } from "./dayView";
import { ItemEditor } from "./ItemEditor";

/** A day's sections, as Today builds them. */
export function partsOf(day: DayPlan): HomeSection[] {
  return homeSections({
    planned: day.planned,
    partOf: (id) => day.tasks.get(id)?.partOfDay ?? null,
    dayOrder: day.dayOrder,
    timed: timedRows(day, day.planned),
  });
}

/**
 * A task dropped in a part of `date`: moved there for that day if it
 * came from another, and your order kept. Null when the drop goes
 * nowhere.
 */
export function dropInPart(
  date: string,
  sections: readonly HomeSection[],
  taskId: string,
  fromKey: string,
  to: DropTarget,
): (() => Promise<void>) | null {
  const section = sections.find((s) => s.key === to.sectionKey);
  if (!section || section.kind !== "part") return null;
  const order = section.rows.map((r) => r.taskId).filter((id) => id !== taskId);
  order.splice(to.index, 0, taskId);
  const moved = to.sectionKey !== fromKey;
  return async () => {
    if (moved) await pinForDay(taskId, date, anchorOf(section.part), "window", { order: to.index });
    await reorderDayTasks(order);
  };
}

/** An event's span, or a timed task's start. */
function timeOf(t: TodayTask, e: { start: number; end: number } | undefined): string | undefined {
  if (e) return spanLabel({ start: e.start, end: e.end });
  return t.startMinute !== null ? formatMinutes(t.startMinute) : undefined;
}

/** One row of a planned day: its unit's colour (a bar for an event),
 *  its time if it has one, its title. Also the lifted copy in a drag. */
export function PartRow({
  task,
  time,
  event,
  theme,
}: {
  task: TodayTask;
  time?: string;
  event: boolean;
  theme: ThemeTokens;
}) {
  const hue = theme.areas[task.areaId] ?? theme.accent;
  return (
    <View style={styles.row}>
      <View style={[event ? styles.bar : styles.dot, { backgroundColor: hue }]} />
      {time ? (
        <AppText variant="label" color={theme.ink} tabular>
          {time}
        </AppText>
      ) : null}
      <AppText variant="body" color={theme.ink} style={styles.grow} numberOfLines={2}>
        {task.title}
      </AppText>
    </View>
  );
}

interface DayPartsProps {
  day: DayPlan;
  sections: readonly HomeSection[];
  /** Today or later: rows can be edited and dragged. */
  editable: boolean;
  /** Reload after an edit saved on its own. */
  reload: () => void;
  undo: UndoDelete;
  reduceMotion: boolean;
  theme: ThemeTokens;
}

export function DayParts({ day, sections, editable, reload, undo, reduceMotion, theme }: DayPartsProps) {
  /** A task or event being edited (`ItemEditor`). */
  const [editingItem, setEditingItem] = useState<string | null>(null);
  /** Parts folded by hand, by key; every part starts open. */
  const [folded, setFolded] = useState<Readonly<Record<string, boolean>>>({});
  const eventOf = new Map(day.events.map((e) => [e.id, e]));

  const renderRow = (t: TodayTask) => {
    const e = eventOf.get(t.id);
    const time = timeOf(t, e);
    return (
      <Pressable
        onPress={editable ? () => setEditingItem(t.id) : undefined}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={`${t.title}${time ? `, ${time}` : ""}`}
        accessibilityHint={editable ? (e ? "Edits or deletes the event" : "Edits the task") : undefined}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <PartRow task={t} time={time} event={e !== undefined} theme={theme} />
      </Pressable>
    );
  };

  return (
    <View style={styles.day}>
      {day.day.away ? (
        <AppText variant="caption" color={theme.muted}>
          Away{day.day.away.label ? ` · ${day.day.away.label}` : ""}. Nothing is planned.
        </AppText>
      ) : day.day.cleared ? (
        <AppText variant="caption" color={theme.muted}>
          Today&apos;s cleared. Its remaining events are set aside.
        </AppText>
      ) : null}

      {sections.map((whole) => {
        // A task waiting on a delete's Undo leaves the day at once.
        const s =
          whole.kind === "part"
            ? {
                ...whole,
                rows: whole.rows.filter((r) => !undo.hidden.has(r.taskId)),
                timed: whole.timed.filter((r) => !undo.hidden.has(r.taskId)),
              }
            : whole;
        const open = !(folded[s.key] ?? false);
        return (
          <HomeSectionCard
            key={s.key}
            section={s}
            state="later"
            expanded={open}
            onToggleExpanded={() => setFolded((f) => ({ ...f, [s.key]: open }))}
            now={null}
            tasks={day.tasks}
            renderRow={renderRow}
            holdFor={() => undefined}
            canDrag={(t) => editable && t.kind === "task"}
            onSwap={() => {}}
            onPullIn={() => {}}
            onAddFromOpen={() => {}}
            onEditTimes={() => {}}
            onRemove={() => {}}
            editable={editable}
            reduceMotion={reduceMotion}
            theme={theme}
          />
        );
      })}

      <ItemEditor
        itemId={editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={reload}
        onDelete={(t) => undo.remove({ id: t.id, message: `Deleted “${t.title}”`, run: () => archiveTask(t.id) })}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  day: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  bar: { width: 3, alignSelf: "stretch", marginVertical: space.xs, borderRadius: radius.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grow: { flex: 1 },
});
