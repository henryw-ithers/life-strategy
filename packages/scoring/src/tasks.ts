import { largestRemainder } from "./rounding";

/**
 * Linear rank shares (ADR-0003 §5): with n tasks, rank r (1 = most
 * important) gets share (n + 1 − r) / (n(n+1)/2). n = 3 → 3:2:1,
 * i.e. 50% / 33% / 17%.
 */
export function rankShares(taskCount: number): number[] {
  if (!Number.isInteger(taskCount) || taskCount < 1) {
    throw new Error(`rankShares: taskCount must be a positive integer, got ${taskCount}`);
  }
  const denominator = (taskCount * (taskCount + 1)) / 2;
  return Array.from({ length: taskCount }, (_, i) => (taskCount - i) / denominator);
}

/**
 * Divide a unit's integer weight across its ranked tasks (index 0 =
 * rank 1). Integer point values sum to exactly `unitWeight`.
 *
 * **Every task in a scoring unit is worth at least 1 point** (amended
 * 2026-07-30). Rank shares alone put the tail at zero as soon as a
 * unit's task count approached its weight — a 3-point unit with three
 * tasks paid 2/1/**0** — and a zero-point task is not a small task, it
 * is a dead one: `dayShare` gives it no place in the day's denominator
 * and completing it cannot move the grade. The checklist would show a
 * row that does nothing, which is worse than not offering it.
 *
 * So a point is reserved per task and only the surplus is ranked. The
 * ADR's worked example is unchanged by this (53 across 3 is still
 * 26/18/9); what shifts is small units and long lists, where the split
 * flattens slightly — 10 across 2 was 7/3 and is now 6/4. That is the
 * price of the floor, and it is the right way round: rank should order
 * tasks, not delete them.
 *
 * Two edges:
 * - **Zero weight** (a unit excluded from scoring) stays zero
 *   throughout. There is nothing to divide, and a floor there would
 *   invent points an excluded unit is not entitled to.
 * - **More tasks than points** (a 2-point unit holding three) spends
 *   `taskCount`, one or two points above the unit's weight. ADR-0003
 *   §6 advises against that shape and ADR-0003 §5 sizes the overspend
 *   at pennies; a dead row is the worse trade.
 */
export function taskPointValues(unitWeight: number, taskCount: number): number[] {
  if (!Number.isInteger(unitWeight) || unitWeight < 0) {
    throw new Error(`taskPointValues: unitWeight must be a non-negative integer, got ${unitWeight}`);
  }
  const shares = rankShares(taskCount);
  if (unitWeight === 0) return shares.map(() => 0);

  const surplus = Math.max(0, unitWeight - taskCount);
  const exacts = shares.map((share) => share * surplus);
  return largestRemainder(exacts, surplus).map((extra) => extra + 1);
}
