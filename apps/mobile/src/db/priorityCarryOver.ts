/**
 * Carry-over prefill for the priority ranking (ADR-0005 §7's open gap,
 * ADR-0021 action item 2).
 *
 * Free of React Native imports so it can be tested here; the read that
 * feeds it is `loadPreviousPriorityOrder` in `diagnostic.ts`.
 *
 * A re-run diagnostic opens on **last time's order**, so the work is
 * moving what changed rather than rebuilding eighteen positions from an
 * area seed — the convenience the dial era had and the ranking era
 * lost. Only priority carries over: satisfaction is rated, not ranked
 * (ADR-0022), and a fresh rating each time is the point of rating it.
 */

/**
 * Last time's order, fitted to the units that exist now.
 *
 * - Units ranked last time keep their relative order.
 * - Units gone since (archived, retired by a taxonomy revision) drop
 *   out.
 * - Units new since have no position to keep, so they join at the end
 *   in `seed` order — the app's own suggestion — where dragging them up
 *   is one move.
 *
 * @param previous unit ids, highest priority first, from the last
 *   snapshot
 * @param seed every unit in the diagnostic now, in suggested order
 */
export function carryOverOrder(
  previous: readonly string[],
  seed: readonly string[],
): string[] {
  const present = new Set(seed);
  const kept = previous.filter((id, i) => present.has(id) && previous.indexOf(id) === i);
  const placed = new Set(kept);
  return [...kept, ...seed.filter((id) => !placed.has(id))];
}
