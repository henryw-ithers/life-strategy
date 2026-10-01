/**
 * Task-count guidance (ADR-0003 §6): recommendations, not enforcement.
 * A single source of truth for the weight → task-count band table,
 * used wherever code needs to check a count against it (display copy
 * may still live closer to its screen).
 *
 * **Rescaled 2026-08-26 for the flattened spread** (ADR-0028 §2). The
 * thresholds are absolute point counts, and flattening changed what a
 * point count means: an 18-unit portfolio used to run 10 down to 1 and
 * now runs about 7 down to 4. Left alone, the old table would have
 * called the entire bottom third of every portfolio *light* — one task,
 * weekly-cadence suggestions only — which is the exact opposite of what
 * flattening was for. Nothing here is a new judgement; the bands are
 * the same four bands, moved onto the new scale so they pick out the
 * same *parts of a portfolio* they always did.
 *
 * Sized against what a unit can actually be paid: under the routine
 * band a unit of weight `w` at full coverage is worth `0.8 × w` points
 * a day, so a 4-point unit prices about three points and one habit, and
 * a 7-point unit can carry two or three.
 */
export function recommendedTaskRange(weight: number): { min: number; max: number } {
  if (weight >= 7) return { min: 2, max: 3 };
  if (weight >= 4) return { min: 1, max: 2 };
  if (weight >= 2) return { min: 1, max: 1 };
  return { min: 0, max: 1 };
}
