/**
 * Largest-remainder rounding (ADR-0003 §3): floor every value, then
 * hand the leftover units to the largest fractional remainders, so the
 * result is integers summing to exactly `total`. Ties break toward the
 * larger exact value, then the lower index, so the result is
 * deterministic.
 */
export function largestRemainder(exact: readonly number[], total: number): number[] {
  if (exact.some((v) => v < 0 || !Number.isFinite(v))) {
    throw new Error("largestRemainder: values must be finite and non-negative");
  }
  const exactSum = exact.reduce((a, b) => a + b, 0);
  if (Math.abs(exactSum - total) > 1e-6) {
    throw new Error(
      `largestRemainder: values sum to ${exactSum}, expected ${total}`,
    );
  }

  const floors = exact.map(Math.floor);
  let leftover = total - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, value, fraction: value - Math.floor(value) }))
    .sort(
      (a, b) =>
        b.fraction - a.fraction || b.value - a.value || a.index - b.index,
    );

  const result = [...floors];
  for (const { index } of order) {
    if (leftover <= 0) break;
    result[index] = (result[index] ?? 0) + 1;
    leftover -= 1;
  }
  return result;
}
