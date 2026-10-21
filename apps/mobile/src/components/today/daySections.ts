/**
 * What counts as done on a day's row. The checklist's sections and drag
 * went with Home's rebuild on windows (Phase 9); this is what's left.
 */
import type { TodayTask } from "../../db/today";

/** Done today, or done ahead on an earlier day (ADR-0032 §4). */
export function isDone(t: TodayTask): boolean {
  return t.completedToday || t.doneAheadOn !== null;
}
