/**
 * Which situation a unit is in, in the library's own vocabulary
 * (ADR-0006 §1).
 *
 * The content package tags every task with the profile it suits —
 * *gap-closing*, *maintenance*, or *light* — and this decides which a
 * unit is in.
 *
 * It decides ordering, never availability: a suggestion tagged for a
 * different profile is still offered, just further down. Hiding
 * suggestions would turn a library the user can browse into a
 * recommendation engine that quietly withholds, which is a different
 * product and a worse one.
 *
 * Satisfaction isn't asked since ADR-0041 §4, so the profile reads the
 * tier you chose instead (Henry, 2026-10-19).
 */
import { recommendedTaskRange } from "./taskGuidance";
import type { Tier } from "./weights";

export type Profile = "gap-closing" | "maintenance" | "light";

export interface UnitSituation {
  /** Its Priorities tier. */
  tier: Tier;
  /** Its share of the 100. */
  weight: number;
}

/**
 * A unit is **light** when its weight can't support much: it holds one
 * task at most, so weekly-cadence suggestions are the honest ones.
 * Otherwise a **Top** unit is gap-closing, the part of life you put
 * first and want more of, and every other unit is **maintenance**:
 * it matters, and the aim is to keep it going.
 *
 * Light wins over Top deliberately. A unit too small to hold a second
 * task can't carry a serious plan, however high you put it.
 */
export function unitProfile(u: UnitSituation): Profile {
  if (recommendedTaskRange(u.weight).max <= 1) return "light";
  return u.tier === "top" ? "gap-closing" : "maintenance";
}
