/**
 * The New task and New event sheets the `+` menu opens, on Today (they
 * lived on the Week tab until it went; Henry, 2026-11-07). They read
 * the units to file under when they open. With no priorities sorted or
 * no unit to file under, Life comes first instead.
 */
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { addTask, loadPlan, type PlanData } from "../../db/tasks";
import { useRetained } from "../../hooks/useRetained";
import { recordProblem } from "../../lib/problemLog";
import type { ThemeTokens } from "../../theme/colors";
import { AddTaskModal } from "./AddTaskModal";
import { EventSheet } from "./EventSheet";
import { CANCELLED, saveNewEvent, savedOrSaid } from "./saveEvent";
import { pickableUnits } from "./unitSelection";

export type AddKind = "task" | "event";

export function AddSheets({
  adding,
  onClose,
  save,
  onSaved,
  theme,
}: {
  adding: AddKind | null;
  onClose: () => void;
  /** Writes through the screen's own saving, so a failure is said. */
  save: (write: () => Promise<unknown>) => Promise<unknown>;
  /** After an event saves, so the day shows it. */
  onSaved: () => void;
  theme: ThemeTokens;
}) {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [shown, gone] = useRetained(adding);
  const [eventUnits, setEventUnits] = useState<string[]>([]);
  const units = useMemo(() => pickableUnits(plan), [plan]);

  useEffect(() => {
    if (adding === null) return;
    let live = true;
    void loadPlan()
      .then((next) => {
        if (!live) return;
        // Nothing to file under yet: sort your units on Life first.
        if (!next.hasSnapshot || pickableUnits(next).length === 0) {
          onClose();
          router.navigate("/goals" as Href);
          return;
        }
        setPlan(next);
      })
      .catch((e: unknown) => recordProblem(e, "load"));
    return () => {
      live = false;
    };
    // `onClose` is the screen's setter; the load is wanted once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding]);

  if (plan === null) return null;
  return (
    <>
      {shown === "task" ? (
        <AddTaskModal
          visible={adding === "task"}
          onDismissed={gone}
          onClose={onClose}
          units={units}
          areaColors={theme.areas}
          theme={theme}
          onCommit={async (title, timesPerWeek, unitIds, plannedWeekdays, partOfDay, oneOff, detail) => {
            await save(() => addTask(unitIds, title, timesPerWeek, plannedWeekdays, partOfDay, oneOff, detail));
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      ) : null}

      {shown === "event" ? (
        <EventSheet
          visible={adding === "event"}
          onDismissed={gone}
          unitChoice={{ units, value: eventUnits, onChange: setEventUnits, areaColors: theme.areas }}
          accent={theme.accent}
          theme={theme}
          onClose={onClose}
          onSave={async (input, bounds) => {
            const saved = await savedOrSaid(async () => (await saveNewEvent(eventUnits, input, bounds)) !== CANCELLED);
            if (!saved) return;
            onClose();
            setEventUnits([]);
            onSaved();
          }}
        />
      ) : null}
    </>
  );
}
