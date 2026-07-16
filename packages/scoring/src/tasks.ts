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
 */
export function taskPointValues(unitWeight: number, taskCount: number): number[] {
  if (!Number.isInteger(unitWeight) || unitWeight < 0) {
    throw new Error(`taskPointValues: unitWeight must be a non-negative integer, got ${unitWeight}`);
  }
  const exacts = rankShares(taskCount).map((share) => share * unitWeight);
  return largestRemainder(exacts, unitWeight);
}
