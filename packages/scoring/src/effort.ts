/**
 * Bubble size on the portfolio graph: how much effort a unit actually
 * absorbed over the trailing window (ADR-0005 §3, ADR-0025 §8).
 *
 * vision.md claims this axis is *measured* rather than estimated —
 * "more honest than estimation" — which is only true while every unit
 * has a way to be measured. Deriving effort purely from points broke
 * that claim for any unit that earns none: a communal unit
 * (ADR-0025 §1) holds no tasks, so it would sit at minimum bubble size
 * forever, small and high and left — the quadrant vision.md defines as
 * "important, unsatisfying, neglected" — no matter how much of the
 * person's life actually involved those people.
 */

export interface UnitEffortInput {
  unitId: string;
  /** Points from completions and activity credit inside the window. */
  points: number;
  /**
   * Distinct local dates on which the unit was tagged — on a task
   * completion or an activity (ADR-0025 §4).
   */
  taggedDays: number;
  /** The unit's share of the 100 daily points. */
  weight: number;
}

/**
 * **Distinct days, not occurrences.** ADR-0025 §8's text says
 * "occurrences … weighted by `activity.size`", but §3 of the same ADR
 * decides that *one tag anywhere in the day earns the unit's full
 * share*. Counting occurrences here would make the bubble and the
 * grade tell different stories about the same behaviour — five things
 * logged with family on one day would read as five days of investment
 * on the chart and one on the score. Days is what §3 settled on, so
 * days is what this measures.
 *
 * Pricing a tagged day at the unit's full weight is what puts the two
 * paths on one scale: a scored unit accrues roughly its weight on a
 * day it is fully done, so a tagged day is worth the same.
 */
export function rawEffort(u: UnitEffortInput): number {
  // A unit that earns points is measured by them; the tag path exists
  // for units whose involvement is note-shaped. Checking `points`
  // rather than a kind flag means this keeps working unchanged when
  // ADR-0025 §3 lands and communal units start earning — they simply
  // move onto the points path, with no seam here.
  if (u.points > 0) return u.points;
  return Math.max(0, u.taggedDays) * Math.max(0, u.weight);
}

/**
 * Normalized 0–1 effort per unit, or null when nothing has been
 * logged at all — the caller stores null rather than a row of zeroes,
 * so a first-ever snapshot renders uniform bubbles instead of claiming
 * every unit was neglected.
 */
export function deriveEffort(
  units: readonly UnitEffortInput[],
): Map<string, number> | null {
  const raw = units.map((u) => ({ unitId: u.unitId, value: rawEffort(u) }));
  const max = Math.max(0, ...raw.map((r) => r.value));
  if (max <= 0) return null;
  return new Map(raw.map((r) => [r.unitId, r.value / max]));
}
