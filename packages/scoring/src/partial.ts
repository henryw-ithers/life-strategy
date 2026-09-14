/**
 * Partial completion (ADR-0014).
 *
 * A task whose owner turned the toggle on may be completed 25%, 50%,
 * 75% or 100%. Progress is the **sum** of a task's fractions; at 1.0 it
 * is done. Finishing later pays only the remainder, which falls out of
 * the sum rather than needing a rule of its own — and means no state on
 * `task` that could disagree with the completion history.
 */

/** The fractions a person may pick. Nothing else is offered. */
export const PARTIAL_FRACTIONS = [0.25, 0.5, 0.75, 1] as const;
export type PartialFraction = (typeof PARTIAL_FRACTIONS)[number];

/** Snap to the nearest offered fraction, clamped to (0, 1]. */
export function normalizeFraction(value: number): PartialFraction {
  if (!Number.isFinite(value)) return 1;
  let best: PartialFraction = 1;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const f of PARTIAL_FRACTIONS) {
    const gap = Math.abs(f - value);
    if (gap < bestGap) {
      bestGap = gap;
      best = f;
    }
  }
  return best;
}

/** How much of a task is done, given the fractions already recorded. */
export function progressOf(fractions: readonly number[]): number {
  return Math.min(1, fractions.reduce((a, f) => a + f, 0));
}

/** Whether another completion is owed — progress has not reached 1. */
export function isSettled(fractions: readonly number[]): boolean {
  return progressOf(fractions) >= 1;
}

/**
 * What a completion pays: **the rounded running total, minus what has
 * already been paid** (ADR-0014 §3).
 *
 * On a 3-point task the four quarters pay **1, 1, 0, 1** — the steps
 * are uneven because each is the rounded total so far minus what has
 * been paid, and `round(1.5)` is 2. The unevenness is the point: the
 * total is always exactly the task's value, and no step can overpay.
 *
 * Rounding each step independently instead would either overpay — four
 * quarter-marks paying 4 points on a 3-point task — or round each to
 * zero and make the fraction do nothing. Neither is acceptable, and the
 * difference only shows up on small values, which is most of them.
 *
 * @param value       the task's full worth today
 * @param priorFractions fractions already recorded for this task
 * @param fraction    the fraction being recorded now
 */
export function partialPoints(
  value: number,
  priorFractions: readonly number[],
  fraction: number,
): number {
  const before = progressOf(priorFractions);
  const after = progressOf([...priorFractions, fraction]);
  const paidAlready = Math.round(before * value);
  const paidAfter = Math.round(after * value);
  return Math.max(0, paidAfter - paidAlready);
}
