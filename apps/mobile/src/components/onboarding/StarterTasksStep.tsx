/**
 * Onboarding's "A few tasks" step (ADR-0045 §1 step 5, spec §5.11):
 * for each Top unit, two or three starter tasks from the library to
 * tap, plus "Add your own". Nothing is selected for you (ADR-0011 §3 as
 * amended). A tap adds the task at once, with the library's cadence;
 * a starter you already have is ticked and does nothing.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { LIBRARY } from "../../content/library";
import { addTask, type PlanData } from "../../db/tasks";
import { useRetained } from "../../hooks/useRetained";
import { starterUnits } from "../../lib/starterTasks";
import type { ThemeTokens } from "../../theme/colors";
import { radius, space } from "../../theme/tokens";
import { AddTaskModal } from "../plan/AddTaskModal";
import { formatFrequencyShort } from "../plan/frequency";
import { pickableUnits } from "../plan/unitSelection";
import { AppText } from "../ui/AppText";
import { Group } from "../ui/Group";
import { OutlineAction } from "../ui/OutlineAction";

export function StarterTasksStep({
  plan,
  save,
  theme,
}: {
  plan: PlanData;
  /** Writes, then reloads the flow's data. */
  save: (write: () => Promise<unknown>) => Promise<unknown>;
  theme: ThemeTokens;
}) {
  /** "Add your own": the unit it opens on, or "" for none chosen. */
  const [adding, setAdding] = useState<string | null>(null);
  const [addingShown, addingGone] = useRetained(adding);

  /** Starters being added. A ref so two quick taps can't both add,
   *  mirrored in state so the chip shows it at once. */
  const pendingRef = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const addStarter = (unitId: string, id: string, title: string, timesPerWeek: number) => {
    const key = `${unitId}:${id}`;
    if (pendingRef.current.has(key)) return;
    pendingRef.current.add(key);
    setPending(new Set(pendingRef.current));
    void save(() => addTask([unitId], title, timesPerWeek)).finally(() => {
      pendingRef.current.delete(key);
      setPending(new Set(pendingRef.current));
    });
  };

  const units = useMemo(
    () =>
      starterUnits(
        plan.areas.flatMap((a) =>
          a.units.map((u) => ({
            id: u.id,
            name: u.name,
            areaId: a.id,
            tier: u.tier,
            tierOrder: u.tierOrder,
            taskTitles: u.tasks.map((t) => t.title),
          })),
        ),
        LIBRARY,
      ),
    [plan],
  );
  const pickable = useMemo(() => pickableUnits(plan), [plan]);

  return (
    <>
      <AppText variant="display" color={theme.ink}>
        A few tasks
      </AppText>
      <AppText color={theme.ink} style={styles.lead}>
        Some ideas for what you put at the top. Tap any you want. You can
        change how often later.
      </AppText>

      {units.length === 0 ? (
        <AppText color={theme.muted} style={styles.lead}>
          Nothing is in Top yet, so there are no ideas to show. Add your
          own, or move something up in Priorities later.
        </AppText>
      ) : null}

      {units.map((u) => {
        const hue = theme.areas[u.areaId] ?? theme.accent;
        return (
          <Group key={u.id} theme={theme} title={u.name}>
            <View style={styles.chips}>
              {u.starters.map(({ task, added: saved }) => {
                const added = saved || pending.has(`${u.id}:${task.id}`);
                const often = formatFrequencyShort(task.timesPerWeek);
                return (
                  <Pressable
                    key={task.id}
                    disabled={added}
                    onPress={() => addStarter(u.id, task.id, task.title, task.timesPerWeek)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: added }}
                    accessibilityLabel={added ? `${task.title}, ${often}, added` : `${task.title}, ${often}`}
                    accessibilityHint={added ? undefined : `Adds it to ${u.name}`}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        borderColor: added ? hue : theme.hairline,
                        backgroundColor: theme.canvas,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Ionicons name={added ? "checkmark" : "add"} size={16} color={hue} />
                    <AppText variant="label" color={theme.ink}>
                      {task.title}
                    </AppText>
                    <AppText variant="caption" color={theme.muted}>
                      {often}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
            <OutlineAction
              label="Add your own"
              accessibilityLabel={`Add your own task to ${u.name}`}
              onPress={() => setAdding(u.id)}
              theme={theme}
            />
          </Group>
        );
      })}

      {units.length === 0 ? (
        <OutlineAction label="Add your own" onPress={() => setAdding("")} theme={theme} />
      ) : null}

      {addingShown !== null ? (
        <AddTaskModal
          visible={adding !== null}
          onClose={() => setAdding(null)}
          onDismissed={addingGone}
          units={pickable}
          homeUnitId={addingShown === "" ? undefined : addingShown}
          areaColors={theme.areas}
          theme={theme}
          onCommit={async (title, timesPerWeek, unitIds, plannedWeekdays, partOfDay, oneOff, detail) => {
            await save(() =>
              addTask(unitIds, title, timesPerWeek, plannedWeekdays, partOfDay, oneOff, detail),
            );
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  lead: { maxWidth: 340 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
});
