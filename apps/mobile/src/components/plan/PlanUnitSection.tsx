/**
 * A life unit's tasks and events, on the unit's own screen (spec
 * §5.4.2): its tasks in your order to drag, its events apart, adding
 * either, "Need ideas?" and Change tier. A Not now unit holds none and
 * says how to bring it back.
 */
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, type LinearTransition } from "react-native-reanimated";

import { LIBRARY } from "../../content/library";
import type { PlanTask, PlanUnit } from "../../db/tasks";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { OutlineAction } from "../ui/OutlineAction";
import { ReorderableList } from "../ui/ReorderableList";
import { eventWhen, ItemRow } from "./ItemRow";
import { TaskRow } from "./TaskRow";

/** Uniform, because the drag maths depends on it. Sized for two lines
 *  of body text plus the row's own padding — a variable-height row would
 *  break `ReorderableList`, which positions every row from its index. */
export const TASK_ROW_HEIGHT = 64;

/** A unit's tasks and its events, listed apart (ADR-0038 §4). */
const tasksOf = (unit: PlanUnit) => unit.tasks.filter((t) => t.kind !== "event");
const eventsOf = (unit: PlanUnit) => unit.tasks.filter((t) => t.kind === "event");

export function PlanUnitSection({
  unit,
  hue,
  justAdded,
  onOpenPriorities,
  onReorder,
  onEditTask,
  onDeleteTask,
  onAddTask,
  onAddEvent,
  onSuggest,
  onDragStateChange,
  layout,
  reduceMotion,
  theme,
}: {
  unit: PlanUnit;
  hue: string;
  /** The task just created, tinted until the timer clears it. */
  justAdded: string | null;
  /** Put the unit in or out of the 100 (ADR-0027 §2). */
  /** Not now and back go through Priorities (ADR-0041 §3), which asks
   *  before pausing tasks and keeps one snapshot. */
  onOpenPriorities: () => void;
  /** The unit's task ids in their new order, events after. */
  onReorder: (orderedIds: string[]) => void;
  onEditTask: (task: PlanTask) => void;
  onDeleteTask: (task: PlanTask) => void;
  onAddTask: () => void;
  onAddEvent: () => void;
  onSuggest: () => void;
  onDragStateChange: (dragging: boolean) => void;
  layout: LinearTransition | undefined;
  reduceMotion: boolean;
  theme: ThemeTokens;
}) {
  const excluded = !unit.includeInScoring;
  const tasks = tasksOf(unit);
  const events = eventsOf(unit);
  const entering = reduceMotion ? undefined : FadeIn.duration(160);

  return (
    <Animated.View layout={layout}>

      {excluded ? (
        <Animated.View
          entering={entering}
          layout={layout}
          style={[styles.panel, { backgroundColor: theme.surface }]}
        >
          <AppText variant="caption" color={theme.muted}>
            Not now: out of your plan, so it holds no tasks. Move it up in Priorities to
            bring it back.
          </AppText>
          <OutlineAction
            label="Open Priorities"
            accessibilityLabel={`Open Priorities to move ${unit.name} up`}
            onPress={onOpenPriorities}
            theme={theme}
          />
        </Animated.View>
      ) : null}

      {!excluded ? (
        <Animated.View
          entering={entering}
          layout={layout}
          style={[styles.panel, { backgroundColor: theme.surface }]}
        >
          {/* Rank is what you most often want to change while looking at
              the list, so the grip is here rather than in the edit sheet. */}
          {tasks.length === 0 ? null : (
            <ReorderableList
              items={tasks.map((t) => ({ id: t.id, label: t.title }))}
              rowHeight={TASK_ROW_HEIGHT}
              scrollable={false}
              onDragStateChange={onDragStateChange}
              // Events rank after the unit's tasks, so a reorder keeps
              // them there.
              onReorder={(ids) => onReorder([...ids, ...events.map((e) => e.id)])}
              renderItem={(item) => {
                const t = unit.tasks.find((x) => x.id === item.id);
                if (!t) return null;
                return (
                  <TaskRow
                    title={t.title}
                    timesPerWeek={t.timesPerWeek}
                    pointValue={t.pointValue}
                    otherUnitNames={t.otherUnitNames}
                    plannedWeekdays={t.plannedWeekdays}
                    partOfDay={t.partOfDay}
                    accent={hue}
                    theme={theme}
                    highlight={t.id === justAdded}
                    onDelete={() => onDeleteTask(t)}
                    onEdit={() => onEditTask(t)}
                  />
                );
              }}
              theme={theme}
            />
          )}

          {/* Same words as the bar at the top of the screen: one action,
              named once. */}
          <OutlineAction
            label="+ Add task"
            accessibilityLabel={`Add a task to ${unit.name}`}
            onPress={onAddTask}
            theme={theme}
          />
          {/* Events apart from tasks, drawn as a commitment draws them
              (ADR-0038 §4): when and where. */}
          {events.length > 0 ? (
            <View style={styles.events}>
              <AppText variant="caption" color={theme.muted}>
                Events
              </AppText>
              {events.map((e, i) => (
                <ItemRow
                  key={e.id}
                  item={e}
                  detail={eventWhen(e)}
                  theme={theme}
                  last={i === events.length - 1}
                  onPress={() => onEditTask(e)}
                />
              ))}
            </View>
          ) : null}
          <OutlineAction
            label="+ Add event"
            accessibilityLabel={`Add an event to ${unit.name}`}
            onPress={onAddEvent}
            theme={theme}
          />

          {/* Both tertiary actions on one line, at opposite ends. The
              library (ADR-0006 §3) sits left because it is the one you
              might want; the exclusion valve (ADR-0027 §2) sits right,
              worded as scope and never as giving up. */}
          <View style={styles.foot}>
            {LIBRARY[unit.id] ? (
              <Pressable
                onPress={onSuggest}
                accessibilityRole="button"
                accessibilityLabel={`Ideas for ${unit.name}`}
                style={({ pressed }) => [styles.footAction, { opacity: pressed ? 0.5 : 1 }]}
              >
                <AppText variant="caption" color={theme.muted}>
                  Need ideas?
                </AppText>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable
              onPress={onOpenPriorities}
              accessibilityRole="button"
              accessibilityLabel={`Change ${unit.name}'s tier in Priorities`}
              style={({ pressed }) => [styles.footAction, { opacity: pressed ? 0.5 : 1 }]}
            >
              <AppText variant="caption" color={theme.muted}>
                Change tier
              </AppText>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  /** The unit's tasks sit on one surface, which is what makes it read
   *  as the thing being worked on. */
  panel: {
    gap: space.sm,
    borderRadius: radius.md,
    padding: space.lg,
    marginTop: space.xs,
    marginBottom: space.sm,
  },
  events: { marginTop: space.md },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footAction: { minHeight: 44, justifyContent: "center" },
});
