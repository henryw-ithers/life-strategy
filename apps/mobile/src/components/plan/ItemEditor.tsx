/**
 * Edit or delete any task or event by its id, wherever it shows (Henry,
 * 2026-10-26: "if some type of object appears I should easily be able
 * to edit, delete, or move it"). A task opens its edit sheet; an event
 * opens the event sheet, with Delete. One component, so Home, Plan and
 * the weekly pass edit the same way the unit and commitment screens do.
 *
 * The caller owns the deleting (its own Undo bar), so a delete is
 * handed back rather than written here.
 */
import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import { loadPlan, type PlanData, type PlanTask } from "../../db/tasks";
import { useRetained } from "../../hooks/useRetained";
import { recordProblem } from "../../lib/problemLog";
import type { ThemeTokens } from "../../theme/colors";
import { applyTaskEdit, editableFrom } from "./applyTaskEdit";
import { EventSheet } from "./EventSheet";
import { savedOrSaid, saveEventEdit } from "./saveEvent";
import { TaskEditSheet } from "./TaskEditSheet";
import { pickableUnits } from "./unitSelection";

/** The task, its home's name, wherever in the plan it lives. */
function findTask(plan: PlanData, id: string): { task: PlanTask; home: string } | null {
  for (const a of plan.areas) {
    for (const u of a.units) {
      const t = u.tasks.find((x) => x.id === id);
      if (t) return { task: t, home: u.name };
    }
  }
  for (const c of plan.commitments) {
    const t = c.tasks.find((x) => x.id === id);
    if (t) return { task: t, home: t.homeName };
  }
  return null;
}

export function ItemEditor({
  itemId,
  onClose,
  onSaved,
  onDelete,
  theme,
}: {
  /** The task or event to edit; null when closed. */
  itemId: string | null;
  onClose: () => void;
  /** After a save, to reload the screen. */
  onSaved: () => void;
  /** Delete, through the caller's Undo. */
  onDelete: (task: PlanTask) => void;
  theme: ThemeTokens;
}) {
  const [shownId, gone] = useRetained(itemId);
  /** The plan as loaded for this open, and which item it was for: a
   *  sheet seeds itself once, so it must never mount from an older
   *  load (it would show, and save back, what was there before). */
  const [loaded, setLoaded] = useState<{ id: string; plan: PlanData } | null>(null);

  useEffect(() => {
    if (itemId === null) return;
    let cancelled = false;
    void loadPlan()
      .then((p) => {
        if (!cancelled) setLoaded({ id: itemId, plan: p });
      })
      .catch((e: unknown) => recordProblem(e, "load"));
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  // A load that finished before the last close doesn't count: only one
  // made for this open, which `itemId` names while it's open.
  const plan = loaded && loaded.id === shownId ? loaded.plan : null;
  const found = useMemo(() => (plan && shownId ? findTask(plan, shownId) : null), [plan, shownId]);
  const units = useMemo(() => pickableUnits(plan), [plan]);
  if (!found || shownId === null) return null;
  const { task: t, home } = found;
  const visible = itemId !== null;

  if (t.kind === "event") {
    const stored = {
      id: t.id,
      title: t.title,
      plannedWeekdays: t.plannedWeekdays,
      oneOffDate: t.oneOffDate,
      startMinute: t.startMinute,
      endMinute: t.endMinute,
      notes: t.description,
      timesPerWeek: t.timesPerWeek,
      repeatFrom: t.repeatFrom,
      repeatUntil: t.repeatUntil,
    };
    return (
      <EventSheet
        key={t.id}
        visible={visible}
        onDismissed={gone}
        unitName={home}
        initial={{ ...stored }}
        seriesId={t.id}
        accent={theme.accent}
        theme={theme}
        onClose={onClose}
        onSave={async (input, bounds) => {
          const saved = await savedOrSaid(() => saveEventEdit(stored, input, bounds));
          if (!saved) return;
          onClose();
          onSaved();
        }}
        onDelete={() => {
          onClose();
          onDelete(t);
        }}
      />
    );
  }

  return (
    <TaskEditSheet
      key={t.id}
      visible={visible}
      onDismissed={gone}
      task={editableFrom(t)}
      units={units}
      areaColors={theme.areas}
      accent={theme.accent}
      theme={theme}
      onClose={onClose}
      onSave={(next) => {
        onClose();
        void applyTaskEdit(t, next)
          .then(onSaved)
          .catch((e: unknown) => {
            recordProblem(e, "save");
            Alert.alert("That wasn't saved", e instanceof Error ? e.message : String(e));
            onSaved();
          });
      }}
      onDelete={() => {
        onClose();
        onDelete(t);
      }}
    />
  );
}
