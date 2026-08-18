/**
 * Which situation a unit is in, in the library's own vocabulary
 * (ADR-0006 §1).
 *
 * The content package tags every goal and task with the profile it
 * suits — *gap-closing*, *maintenance*, or *light* — and nothing in the
 * app has ever computed which one a unit is actually in, because
 * nothing has ever read the library. This is that missing half.
 *
 * It decides ordering, never availability: a suggestion tagged for a
 * different profile is still offered, just further down. Hiding
 * suggestions would turn a library the user can browse into a
 * recommendation engine that quietly withholds, which is a different
 * product and a worse one.
 */
import { recommendedTaskRange } from "./taskGuidance";

export type Profile = "gap-closing" | "maintenance" | "light";

export interface UnitSituation {
  /** Share of the 100 from the latest diagnostic. */
  weight: number;
  /** 1–10, rank-derived (ADR-0022). */
  importance: number;
  /** 1–10, rated directly (ADR-0022). */
  satisfaction: number;
}

/**
 * A gap of this much or more reads as "this matters more than it is
 * currently going". Two points on a ten-point scale is the smallest
 * difference that survives the user's own rounding — a one-point gap
 * is inside the noise of how anyone rates their own life on a Tuesday.
 */
export const GAP_THRESHOLD = 2;

/**
 * A unit is **light** when its weight cannot support much: ADR-0003's
 * bands cap it at one task, so weekly-cadence suggestions are the
 * honest ones. Otherwise it is **gap-closing** when satisfaction
 * trails importance, and **maintenance** when it does not — the unit
 * matters and is going well, so the goal is to keep it there.
 *
 * Light wins over gap-closing deliberately. A 2-point unit with a
 * four-point gap still cannot carry a serious plan, and offering one
 * would spend the user's attention where the diagnostic said not to.
 */
export function unitProfile(u: UnitSituation): Profile {
  if (recommendedTaskRange(u.weight).max <= 1) return "light";
  return u.importance - u.satisfaction >= GAP_THRESHOLD
    ? "gap-closing"
    : "maintenance";
}
