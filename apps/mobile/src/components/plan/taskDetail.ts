/**
 * A task's optional detail (ADR-0036 §2): a clock time, a size and part
 * credit, all unset unless asked for. Set in the task form
 * (`SchedulePicker` for the time and part credit, `SizePicker` for the
 * size).
 */
import type { TaskSize } from "@glide/scoring";

export interface TaskDetail {
  /** Minutes from the date's midnight, or null for no clock time. */
  startMinute: number | null;
  endMinute: number | null;
  /** Null is unsized, a first-class state (ADR-0026 §1). */
  size: TaskSize | null;
  allowsPartial: boolean;
}

export const NO_DETAIL: TaskDetail = {
  startMinute: null,
  endMinute: null,
  size: null,
  allowsPartial: false,
};
