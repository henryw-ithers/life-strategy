/**
 * How long a piece of completed work counts for, in effort share
 * (ADR-0041 §5). Pure, so it's tested without a database.
 *
 * **Nothing here counts what wasn't done**: no missed counts, no share
 * of the plan, no comparison with the week before (P15).
 */
import { sizeMinutes } from "@glide/scoring";

/**
 * How long a tick counts for: an event by its length; a task by its
 * size (Normal when it has none); times how much of it was done. Never
 * "Took about…": that's an hours achievement's measure (ADR-0047), and
 * many ticks don't have it.
 */
export function doneMinutes(t: {
  kind: "task" | "event";
  size: "quick" | "normal" | "big" | null;
  startMinute: number | null;
  endMinute: number | null;
  fraction: number;
}): number {
  const whole =
    t.kind === "event" && t.startMinute !== null && t.endMinute !== null
      ? Math.max(0, t.endMinute - t.startMinute)
      : sizeMinutes(t.size);
  return whole * Math.max(0, Math.min(1, t.fraction));
}

/** An activity's minutes, shared evenly across the units it's tagged
 *  with. One logged with no size is a note and counts for nothing. */
export function activityMinutes(
  size: "quick" | "normal" | "big" | null,
  unitIds: readonly string[],
): { unitId: string; minutes: number }[] {
  if (size === null || unitIds.length === 0) return [];
  const each = sizeMinutes(size) / unitIds.length;
  return unitIds.map((unitId) => ({ unitId, minutes: each }));
}
