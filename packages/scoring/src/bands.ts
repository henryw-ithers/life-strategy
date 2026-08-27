/**
 * The two bands a day divides into (ADR-0029 §2).
 *
 * **Planned — 90 points.** Everything you said you would do: every
 * recurring task and every one-off, whatever its cadence. Do what the
 * day asks of you and the band pays in full.
 *
 * **Unplanned — 10 points.** Logged activities and a special day's
 * rating bonus, capped, exactly as ADR-0023 intended `UNPLANNED_CAP`
 * before ADR-0027 §3 widened it to cover planned weekly work too.
 *
 * The denominator is still a constant 100 (ADR-0027 §1) and extra runs
 * still sit outside both bands (ADR-0023 §2), so doing more of your own
 * plan remains the one route above 100.
 *
 * **The 80/20 split this replaces was drawn at the wrong place.**
 * ADR-0027 put every-day tasks in one band and everything else in
 * another, which made a weekly commitment worth a fraction of a daily
 * one and left a full week of your own plan averaging about 83. The
 * line now falls between *planned* and *unplanned* rather than between
 * *daily* and *weekly*, and Henry's target sets the size: "if you did
 * every task you planned for the week you should have around a 90
 * average."
 *
 * **Cadence stopped being a scoring concept entirely.** What a day
 * expects is worked out in `dayLoad.ts` from what is actually due —
 * see there. Frequency decides how often something is due, not what it
 * is worth when it is.
 */
import { taskPointValues } from "./tasks";

/** Everything you planned: recurring tasks and one-offs alike. */
export const PLANNED_BAND = 90;

/** Activities and the special-day rating bonus. Capped, shared. */
export const UNPLANNED_BAND = 10;

export interface BandUnit {
  unitId: string;
  /** Share of the 100 from the diagnostic. 0 for an excluded unit. */
  weight: number;
}

export interface BandTask {
  /**
   * What the returned map should key this allocation by. A task id when
   * the task serves one unit; a task's **membership** id when it serves
   * several, since ADR-0019 gives it a rank and a value in each unit it
   * serves and the two have to be priced separately.
   */
  id: string;
  unitId: string;
  /** Beli-style rank within its unit, 1 = highest. */
  rankInUnit: number;
}

/**
 * What one run of each task is worth, keyed by task id — a **weight**,
 * not a point value.
 *
 * Every unit divides its own weight across its own recurring tasks by
 * rank (ADR-0003 §5's linear shares, with its one-point floor), so the
 * weights across the whole portfolio sum to 100. Nothing is split by
 * cadence and nothing is reserved: a unit's weight is spent on the
 * tasks it holds, however often they happen.
 *
 * **These are not points.** A day's score is the *fraction* of its
 * expected load that got done (`dayLoad.ts`), so what matters here is
 * one task's weight relative to another's; the scale cancels. A task's
 * worth in points is therefore a property of the day it is done on —
 * `PLANNED_BAND × weight ÷ the day's expected load` — and varies with
 * what else that day asks for. That is the honest number and it is
 * computed per day rather than stored.
 *
 * **Task count within a unit still does not change what the unit is
 * worth** (Henry, 2026-08-26). One task in a unit carries its whole
 * weight; five split it by rank and come to the same total.
 *
 * One-offs are deliberately absent. They are priced from their size
 * against their unit's weight, outside this allocation, so an errand
 * appearing on the list never moves what a recurring task is worth —
 * the instability ADR-0027's amendment took out of the variable band.
 */
export function taskWeights(
  units: readonly BandUnit[],
  tasks: readonly BandTask[],
): Map<string, number> {
  const weights = new Map<string, number>(tasks.map((t) => [t.id, 0]));
  for (const unit of units) {
    if (unit.weight <= 0) continue;
    const owned = tasks
      .filter((t) => t.unitId === unit.unitId)
      .sort((a, b) => a.rankInUnit - b.rankInUnit);
    if (owned.length === 0) continue;
    const values = taskPointValues(unit.weight, owned.length);
    owned.forEach((t, i) => weights.set(t.id, values[i] ?? 0));
  }
  return weights;
}

/**
 * How much of the portfolio has something planned in it: covered weight
 * out of total weight, both on the 100 scale.
 *
 * **Covered means holding any task at all** (ADR-0029 §2). It used to
 * mean holding a *daily* task, because under ADR-0027 that was the only
 * kind that could reach the routine band. Cadence no longer decides
 * what a band pays, so a unit with a weekly commitment in it is a unit
 * you are working on.
 *
 * Advice, never arithmetic. It caps nothing — ADR-0028 §3 settled that
 * and ADR-0029 does not disturb it. A mostly-empty bar means a plan
 * that touches a corner of your life, which is worth seeing on the
 * Tasks screen and is nobody's business to penalise in a grade.
 */
export function unitCoverage(
  units: readonly BandUnit[],
  tasks: readonly { unitId: string }[],
): { covered: number; total: number } {
  const held = new Set(tasks.map((t) => t.unitId));
  return {
    covered: units
      .filter((u) => held.has(u.unitId))
      .reduce((a, u) => a + u.weight, 0),
    total: units.reduce((a, u) => a + u.weight, 0),
  };
}
