/**
 * Editing a task, wherever it is edited from — the Tasks tab, or a
 * commitment's own screen (Henry, 2026-10-02: "tasks should definitely
 * be editable in place"). One mapping into the sheet and one save out
 * of it, so the two places cannot drift into saving a task differently.
 */
import {
  setTaskAllowsPartial,
  setTaskDetails,
  setTaskFortnightOffset,
  setTaskFrequency,
  setTaskGoal,
  setTaskOneOff,
  setTaskPlanning,
  setTaskSize,
  setTaskTime,
  setTaskUnits,
  type PlanTask,
} from "../../db/tasks";
import type { EditableTask, TaskEditResult } from "./TaskEditSheet";

/** A task as the edit sheet takes it. */
export function editableFrom(t: PlanTask): EditableTask {
  return {
    id: t.id,
    title: t.title,
    timesPerWeek: t.timesPerWeek,
    unitIds: t.unitIds,
    plannedWeekdays: t.plannedWeekdays,
    partOfDay: t.partOfDay,
    goalId: t.goalId,
    fortnightOffset: t.fortnightOffset,
    oneOffSize: t.oneOffSize,
    oneOffDate: t.oneOffDate,
    oneOffDue: t.oneOffDue,
    startMinute: t.startMinute,
    endMinute: t.endMinute,
    size: t.size,
    allowsPartial: t.allowsPartial,
  };
}

/** Write only what changed, each through its own setter. */
export async function applyTaskEdit(t: PlanTask, next: TaskEditResult): Promise<void> {
  // The description field is gone from the sheet (2026-08-18) but the
  // column stays, so this preserves whatever was already written rather
  // than clearing it on the next save.
  if (next.title !== t.title) {
    await setTaskDetails(t.id, next.title, t.description);
  }
  if (next.timesPerWeek !== t.timesPerWeek) {
    await setTaskFrequency(t.id, next.timesPerWeek);
  }
  if (next.unitIds.join("|") !== t.unitIds.join("|")) {
    await setTaskUnits(t.id, next.unitIds);
  }
  if (next.plannedWeekdays !== t.plannedWeekdays || next.partOfDay !== t.partOfDay) {
    await setTaskPlanning(t.id, next.plannedWeekdays, next.partOfDay);
  }
  if (next.goalId !== t.goalId) {
    await setTaskGoal(t.id, next.goalId);
  }
  if (next.fortnightOffset !== t.fortnightOffset) {
    await setTaskFortnightOffset(t.id, next.fortnightOffset === 1 ? 1 : 0);
  }
  if (
    next.oneOff &&
    (next.oneOff.size !== t.oneOffSize ||
      next.oneOff.date !== t.oneOffDate ||
      next.oneOff.due !== t.oneOffDue)
  ) {
    await setTaskOneOff(t.id, next.oneOff.size, next.oneOff.date, next.oneOff.due);
  }
  if (next.detail.startMinute !== t.startMinute || next.detail.endMinute !== t.endMinute) {
    await setTaskTime(t.id, next.detail.startMinute, next.detail.endMinute);
  }
  if (next.detail.size !== t.size) {
    await setTaskSize(t.id, next.detail.size);
  }
  if (next.detail.allowsPartial !== t.allowsPartial) {
    await setTaskAllowsPartial(t.id, next.detail.allowsPartial);
  }
}
