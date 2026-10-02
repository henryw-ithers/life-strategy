/**
 * One life unit on the Tasks screen: its row (name, weight, task count)
 * and, when open, the panel of its tasks and events.
 *
 * A unit's tasks open in place rather than on a pushed route — the
 * question people have ("where are my points going?") is answered by
 * seeing several units at once. Only one opens at a time.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { type Ref } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, type LinearTransition } from "react-native-reanimated";

import { LIBRARY } from "../../content/library";
import { UNIT_INFO } from "../../content/units";
import type { PlanTask, PlanUnit } from "../../db/tasks";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Disclosure } from "../ui/Chevron";
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
  open,
  rowRef,
  justAdded,
  onToggle,
  onShowInfo,
  onSetScoring,
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
  open: boolean;
  /** For scrolling the unit into view after something is added to it. */
  rowRef: Ref<View>;
  /** The task just created, tinted until the timer clears it. */
  justAdded: string | null;
  onToggle: () => void;
  onShowInfo: () => void;
  /** Put the unit in or out of the 100 (ADR-0027 §2). */
  onSetScoring: (include: boolean) => void;
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
  /** Whether "what this unit covers" is on offer — to the eye only while
   *  open, but to VoiceOver whenever, since the rotor costs no room. */
  const hasInfo = !excluded && UNIT_INFO[unit.id] !== undefined;
  const points = unit.weight ?? 0;
  const tasks = tasksOf(unit);
  const events = eventsOf(unit);
  const entering = reduceMotion ? undefined : FadeIn.duration(160);

  return (
    <Animated.View layout={layout}>
      <Pressable
        ref={rowRef}
        // Excluded units open too (ADR-0027 §2): the panel is the only way
        // back into the plan.
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          excluded
            ? `${unit.name}, not part of your plan`
            : unit.tasks.length === 0
              ? `${unit.name}, no tasks, ${points} points not in play`
              : `${unit.name}, ${points} points, ${unit.tasks.length} tasks`
        }
        accessibilityHint={open ? "Collapses its tasks" : "Shows its tasks"}
        // The info button below is nested in this row, and VoiceOver
        // treats the row as one element and never reaches it — so the
        // same action is offered on the row itself, in the actions rotor.
        accessibilityActions={
          hasInfo ? [{ name: "info", label: `What ${unit.name} covers` }] : undefined
        }
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === "info") onShowInfo();
        }}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View style={styles.chev}>
          <Disclosure open={open} theme={theme} size={15} />
        </View>
        {/* Shrinks rather than grows, so the info glyph sits against the
            end of the name and a long name truncates. */}
        <AppText color={excluded ? theme.muted : theme.ink} style={styles.name} numberOfLines={1}>
          {unit.name}
        </AppText>

        {/* What the unit covers, beside the name where the question is
            asked; only while open. Nested in the row's Pressable on
            purpose: the deepest responder wins, so the row stays one
            large tap target. */}
        {open && hasInfo ? (
          <Pressable
            onPress={onShowInfo}
            accessibilityRole="button"
            accessibilityLabel={`What ${unit.name} covers`}
            hitSlop={12}
            style={({ pressed }) => [styles.info, { opacity: pressed ? 0.4 : 1 }]}
          >
            <Ionicons name="information-circle-outline" size={17} color={theme.muted} />
          </Pressable>
        ) : null}

        <View style={styles.grow} />

        {excluded ? (
          <AppText variant="caption" color={theme.muted}>
            not scored
          </AppText>
        ) : (
          <>
            {/* The count is only useful while the unit is shut. */}
            {unit.tasks.length === 0 ? (
              <AppText variant="caption" color={theme.muted}>
                no tasks
              </AppText>
            ) : open ? null : (
              <AppText variant="caption" color={theme.muted}>
                {unit.tasks.length} {unit.tasks.length === 1 ? "task" : "tasks"}
              </AppText>
            )}
            {/* Muted means "not in play": what this unit would bring, not
                what it currently spends. */}
            <AppText
              color={unit.tasks.length === 0 ? theme.muted : theme.ink}
              tabular
              style={styles.pts}
            >
              {points}
            </AppText>
          </>
        )}
      </Pressable>

      {open && excluded ? (
        <Animated.View
          entering={entering}
          layout={layout}
          style={[styles.panel, { backgroundColor: theme.surface }]}
        >
          <AppText variant="caption" color={theme.muted}>
            Outside your 100 — your other units share its points.
          </AppText>
          <OutlineAction
            label="Put back in my plan"
            accessibilityLabel={`Put ${unit.name} back in my plan`}
            onPress={() => onSetScoring(true)}
            theme={theme}
          />
        </Animated.View>
      ) : null}

      {open && !excluded ? (
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
              onPress={() => onSetScoring(false)}
              accessibilityRole="button"
              accessibilityLabel={`Take ${unit.name} out of my plan for now`}
              accessibilityHint="One tap puts it back"
              style={({ pressed }) => [styles.footAction, { opacity: pressed ? 0.5 : 1 }]}
            >
              <AppText variant="caption" color={theme.muted}>
                Not in my plan
              </AppText>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 46,
    paddingLeft: space.sm,
  },
  /** Shrinks, never grows: a spacer after the info glyph does the
   *  pushing, so the glyph stays against the name. */
  name: { flexShrink: 1 },
  chev: { width: 14 },
  grow: { flex: 1 },
  /** One right-hand column for every number on the page. */
  pts: { minWidth: 30, textAlign: "right" },
  /** The negative inset pulls the glyph against the name, inside the
   *  row's own gap, so it reads as part of the title. */
  info: {
    minHeight: 28,
    marginLeft: -space.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  /** The open unit is the only surface on the screen, which is what
   *  makes it read as the thing being worked on. */
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
