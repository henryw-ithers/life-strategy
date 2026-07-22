/**
 * Task-count guidance (ADR-0003 §6): recommendations, not enforcement.
 * A single source of truth for the weight → task-count band table,
 * used wherever code needs to check a count against it (display copy
 * may still live closer to its screen).
 */
export function recommendedTaskRange(weight: number): { min: number; max: number } {
  if (weight >= 10) return { min: 2, max: 3 };
  if (weight >= 5) return { min: 1, max: 2 };
  if (weight >= 3) return { min: 1, max: 1 };
  return { min: 0, max: 1 };
}
