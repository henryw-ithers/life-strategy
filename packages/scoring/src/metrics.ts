/**
 * Metric-linked goals (ADR-0015).
 *
 * Two kinds, because two of vision.md's own worked examples need
 * different arithmetic: "read 24 books this year" accumulates, and
 * "bench press 225 lb" is a reading that eventually reaches a number.
 *
 * Nothing here touches a grade. Progress is not a scoring event
 * (ADR-0015 §7): no points, no denominator, no effect on any day.
 */

/**
 * `habit` is deliberately unlike the other two: it has **no target**,
 * because a habit is meant to be permanent and so never completes
 * (decided 2026-08-16). Its rungs are day counts in its milestones,
 * and its state comes from `computeStreak` rather than from progress
 * entries. `metricState` refuses it for that reason — see the note
 * there.
 */
export type MetricKind = "cumulative" | "target" | "habit";

export interface MetricProgress {
  /** `'YYYY-MM-DD'`. Ordering is by this, not by insertion. */
  localDate: string;
  value: number;
}

export interface MetricDefinition {
  /** `habit` never reaches `metricState` — see the note on that
   *  function. This is the countable half of the enum. */
  kind: "cumulative" | "target";
  /** The number to reach. */
  targetValue: number;
}

export interface MetricState {
  /**
   * Where the goal stands, in the metric's own unit. **Null means there
   * is nothing to draw yet** — a `target` goal with no readings has no
   * starting point, and inventing one would be a lie about the data
   * (ADR-0015 §1).
   */
  current: number | null;
  /** 0–1 for a bar. Null under the same rule as `current`. May exceed
   *  1 when a cumulative goal is overshot; that is real and worth
   *  showing, so it is the caller's job to clamp the *width*. */
  fraction: number | null;
  /**
   * Which way a `target` goal runs, inferred from its earliest reading
   * rather than asked (ADR-0015 §1) — so gaining and losing share one
   * kind and one input. Always null for `cumulative`, and null for a
   * `target` goal until the first reading exists.
   */
  direction: "up" | "down" | null;
  /**
   * Has the target ever been reached? **Sticky**: for a `target` goal
   * this is true if *any* reading met it, not only the latest. "I
   * benched 225" stays true after a lighter session, which is why
   * ADR-0015 §3 has reaching a target *invite* completion rather than
   * perform it — only the user knows whether they are now a person who
   * benches 225.
   */
  met: boolean;
}

/** Earliest first. Stable within a date, so same-day readings keep
 *  their entry order. */
function chronological(entries: readonly MetricProgress[]): MetricProgress[] {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) =>
      a.e.localDate === b.e.localDate
        ? a.i - b.i
        : a.e.localDate < b.e.localDate
          ? -1
          : 1,
    )
    .map((x) => x.e);
}

/**
 * **Habit goals do not come through here.** They have no target to
 * measure against and no progress entries to sum; their state is a run
 * of days, which is `computeStreak`'s job. Keeping them out of this
 * function is what stops a habit acquiring a fraction, a bar, and an
 * implied finish line it is not supposed to have. The type signature
 * enforces it.
 */
export function metricState(
  def: MetricDefinition,
  entries: readonly MetricProgress[],
): MetricState {
  const ordered = chronological(entries);

  if (def.kind === "cumulative") {
    // Zero of twenty-four is a real, honest reading, so a cumulative
    // goal draws its bar from the start. Only `target` needs a first
    // entry before it can say anything.
    const current = ordered.reduce((sum, e) => sum + e.value, 0);
    const fraction = def.targetValue === 0 ? 1 : current / def.targetValue;
    return {
      current,
      fraction,
      direction: null,
      met: def.targetValue === 0 ? true : current >= def.targetValue,
    };
  }

  const first = ordered[0];
  if (first === undefined) {
    return { current: null, fraction: null, direction: null, met: false };
  }

  const start = first.value;
  const latest = ordered[ordered.length - 1]!.value;
  const span = def.targetValue - start;

  // Started at the target: nothing to travel, and no direction to
  // infer. Met, and drawn full.
  if (span === 0) {
    return { current: latest, fraction: 1, direction: null, met: true };
  }

  const direction: "up" | "down" = span > 0 ? "up" : "down";
  const met = ordered.some((e) =>
    direction === "up" ? e.value >= def.targetValue : e.value <= def.targetValue,
  );
  // `latest`, not best: the bar says where you are now, and `met`
  // carries the achievement so a lighter session cannot take it away.
  const fraction = (latest - start) / span;

  return { current: latest, fraction, direction, met };
}

/** Bar width. Clamped, unlike `fraction`, which stays honest about
 *  overshoot so the caller can show "26 of 24". */
export function barFraction(state: MetricState): number | null {
  if (state.fraction === null) return null;
  return Math.min(1, Math.max(0, state.fraction));
}

/**
 * Milestone rungs on a metric goal (ADR-0015 §5). Returns the rungs
 * whose threshold the reading has passed, so the caller can *prompt* to
 * advance — never advance silently, per §3 and §5.
 */
export function milestonesReached(
  def: MetricDefinition,
  state: MetricState,
  thresholds: readonly { id: string; targetValue: number | null }[],
): string[] {
  if (state.current === null) return [];
  const current = state.current;
  return thresholds
    .filter((m) => {
      if (m.targetValue === null) return false;
      if (def.kind === "cumulative") return current >= m.targetValue;
      return state.direction === "down"
        ? current <= m.targetValue
        : current >= m.targetValue;
    })
    .map((m) => m.id);
}
