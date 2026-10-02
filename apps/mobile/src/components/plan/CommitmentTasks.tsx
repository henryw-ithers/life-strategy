/**
 * A commitment's work on the Tasks screen, listed after the 18 units
 * rather than among them. Commitments are not a share of your hundred —
 * they are paid from their own band on the days they have work
 * (ADR-0032) — and listing School as one more unit is what invited the
 * "put it back in my plan" offer that would have made it one. Rows edit
 * and swipe-delete exactly like every other task on the screen.
 */
import { router, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";

import type { PlanCommitment } from "../../db/tasks";
import type { ThemeTokens } from "../../theme/colors";
import { space } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Group } from "../ui/Group";
import { OutlineAction } from "../ui/OutlineAction";
import { eventWhen, ItemRow } from "./ItemRow";
import { TASK_ROW_HEIGHT } from "./PlanUnitSection";
import { TaskRow } from "./TaskRow";
import { COMMITMENT_AREA } from "./unitSelection";

type CommitmentTask = PlanCommitment["tasks"][number];

export function CommitmentTasks({
  commitment: c,
  justAdded,
  onEditTask,
  onDeleteTask,
  onAddTask,
  onAddEvent,
  theme,
}: {
  commitment: PlanCommitment;
  justAdded: string | null;
  onEditTask: (task: CommitmentTask) => void;
  onDeleteTask: (task: CommitmentTask) => void;
  onAddTask: () => void;
  onAddEvent: () => void;
  theme: ThemeTokens;
}) {
  const tasks = c.tasks.filter((t) => t.kind !== "event");
  const events = c.tasks.filter((t) => t.kind === "event");
  return (
    <Group
      theme={theme}
      title={c.name}
      footnote={
        c.tasks.length === 0
          ? "Classes, shifts, assignments — anything scheduled that belongs to this."
          : "Worth a share of the day each one is scheduled on, so the number changes with the day."
      }
    >
      {tasks.map((t) => (
        <View key={t.id} style={{ height: TASK_ROW_HEIGHT }}>
          <TaskRow
            context={t.homeUnitId === c.id ? null : t.homeName}
            title={t.title}
            timesPerWeek={t.timesPerWeek}
            pointValue={null}
            otherUnitNames={t.otherUnitNames}
            plannedWeekdays={t.plannedWeekdays}
            partOfDay={t.partOfDay}
            accent={theme.areas[COMMITMENT_AREA] ?? theme.accent}
            theme={theme}
            highlight={t.id === justAdded}
            onDelete={() => onDeleteTask(t)}
            onEdit={() => onEditTask(t)}
          />
        </View>
      ))}
      {/* Events apart, drawn as everywhere else (ADR-0038 §4). */}
      {events.length > 0 ? (
        <View style={styles.events}>
          <AppText variant="caption" color={theme.muted}>
            Events
          </AppText>
          {events.map((e, i) => (
            <ItemRow
              key={e.id}
              item={e}
              detail={[e.homeUnitId === c.id ? null : e.homeName, eventWhen(e)]
                .filter(Boolean)
                .join(" · ")}
              theme={theme}
              last={i === events.length - 1}
              onPress={() => onEditTask(e)}
            />
          ))}
        </View>
      ) : null}
      {/* A split commitment's work goes in a sub-commitment, so this
          opens the commitment to choose one. */}
      <OutlineAction
        label={c.split ? "Add in a sub-commitment ›" : "+ Add task"}
        accessibilityLabel={
          c.split ? `Open ${c.name} to add to a sub-commitment` : `Add a task to ${c.name}`
        }
        onPress={() =>
          c.split ? router.push(`/goals/commitment/${c.id}` as Href) : onAddTask()
        }
        theme={theme}
      />
      {c.split ? null : (
        <OutlineAction
          label="+ Add event"
          accessibilityLabel={`Add an event to ${c.name}`}
          onPress={onAddEvent}
          theme={theme}
        />
      )}
    </Group>
  );
}

const styles = StyleSheet.create({
  events: { marginTop: space.md },
});
