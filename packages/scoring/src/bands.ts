/**
 * The two bands a day divides into (ADR-0027 §1).
 *
 * **Routine — 80 points.** A unit of weight `w` contributes `0.8 × w`,
 * split across that unit's *daily* tasks (`timesPerWeek === 7`). A unit
 * with no daily task leaves its share unearnable: nobody else receives
 * it, which is §2's whole point.
 *
 * **Variable — 20 points.** Every task that is not daily. The band is
 * split between units by weight, then divided inside each unit by rank,
 * exactly as the routine band is; the sub-budgets still sum to 20, so
 * completing all of them in a week earns the band exactly once.
 * Whatever the day's planned work leaves unspent is what activities and
 * a special day's rating can draw on (ADR-0023's ordering).
 *
 * **Both bands settle per unit, and that is the whole rule** (ADR-0027
 * §2: a unit's weight stays its own). The variable band used to pool
 * every unit's claims and settle them together, which made a task's
 * value depend on how many tasks existed elsewhere in the plan: a
 * weight-2 unit's share of the band climbed to match a weight-40
 * unit's at twenty tasks, then collapsed to nothing at thirty. Per
 * unit, a unit can only overspend itself.
 *
 * A caveat the arithmetic cannot remove: **20 points cannot finely
 * price 20+ non-daily tasks.** Beyond that the tail rounds to zero
 * whatever the rule. Per-unit allocation makes it predictable — a
 * function of the unit's weight alone — rather than a function of the
 * whole plan's size.
 *
 * Why the bands are allocated separately rather than amortized against
 * each other: the old model spread a task's weekly commitment across
 * seven denominators (`dayShare`) while paying its full value on the
 * day, so a completion was worth `7 ÷ f` times its own share and a full
 * day could score 112. Here a completion pays a fixed number from its
 * own band, and the day's denominator is a constant 100.
 */
import { largestRemainder } from "./rounding";
import { rankShares } from "./tasks";

/** The routine band: what every-day tasks divide. */
export const ROUTINE_BAND = 80;

/** The variable band: everything that is not an every-day task, plus
 *  whatever spontaneous work the day's planned work leaves room for. */
export const VARIABLE_BAND = 20;

/** A task is *routine* when it happens every day. `timesPerWeek` 0 is
 *  fortnightly, not zero-times, so it belongs to the variable band. */
export function isRoutine(timesPerWeek: number): boolean {
  return timesPerWeek === 7;
}

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
  /** 7 = every day, 1–6 = times a week, 0 = once a fortnight. */
  timesPerWeek: number;
  /** Beli-style rank within its unit, 1 = highest. */
  rankInUnit: number;
}

/**
 * Point values for every task, keyed by task id.
 *
 * Both bands keep ADR-0003 §5's linear rank shares and its **floor of
 * one point per task**, now applied inside a unit's own budget rather
 * than across a shared pool — a zero-point task is not a small task, it is a
 * row that cannot move the number. The floor is skipped only when it
 * would overspend its band (more tasks than points), where paying
 * everyone 1 would break the band's total; there the split is purely
 * proportional and the tail rounds to zero. ADR-0003 §6 already advises
 * against plans that shaped.
 */
export function bandPointValues(
  units: readonly BandUnit[],
  tasks: readonly BandTask[],
): Map<string, number> {
  // Every task starts at 0 and is overwritten if its band can pay it.
  // A task in an excluded unit has no share to receive but must still
  // have a value — a consumer reading `undefined` here would find it at
  // the point it tried to add a number to a grade.
  const values = new Map<string, number>(tasks.map((t) => [t.id, 0]));

  // ── Routine band ──
  // Allocated **per unit, and settled per unit**, because a unit's
  // share is its own and an uncovered one forfeits it rather than
  // passing it on.
  //
  // Settling matters as much as allocating. This used to collect every
  // unit's claims into one list and call `assign` once, which handed
  // the whole band's rounding *and its one-point floor* to the pool: a
  // unit of weight 1 carrying twenty daily tasks reserved twenty points
  // before anything was shared out, and took them from the units that
  // had actually earned them. Measured, a weight-40 unit's only daily
  // task fell from 31 points to 13 when such a pile was added
  // elsewhere. That is the reallocation ADR-0027 §2 rules out, arriving
  // through the back door.
  //
  // Per unit, an over-subscribed unit can only overspend *itself*: its
  // own budget rounds down to a point or two, its tail rounds to zero,
  // and no other unit notices.
  for (const unit of units) {
    const daily = tasks
      .filter((t) => t.unitId === unit.unitId && isRoutine(t.timesPerWeek))
      .sort((a, b) => a.rankInUnit - b.rankInUnit);
    if (daily.length === 0 || unit.weight <= 0) continue;

    const shares = rankShares(daily.length);
    const budget = (ROUTINE_BAND / 100) * unit.weight;
    assign(
      values,
      daily.map((t, i) => ({ id: t.id, claim: budget * (shares[i] ?? 0) })),
    );
  }

  // ── Variable band ──
  // Split between units by weight first, then settled inside each unit
  // — the same two steps as the routine band. The band still totals 20:
  // the per-unit budgets are a largest-remainder split of it, so
  // completing every non-daily task in a week earns the band once.
  //
  // Only units that actually hold non-daily work share it. A unit with
  // nothing but daily tasks does not reserve part of this band and
  // leave it unearnable; that rule belongs to the routine band, where
  // coverage is the point (§2).
  const variableUnits = units.filter(
    (u) =>
      u.weight > 0 &&
      tasks.some((t) => t.unitId === u.unitId && !isRoutine(t.timesPerWeek)),
  );
  const variableWeight = variableUnits.reduce((a, u) => a + u.weight, 0);
  if (variableWeight > 0) {
    const budgets = largestRemainder(
      variableUnits.map((u) => (VARIABLE_BAND * u.weight) / variableWeight),
      VARIABLE_BAND,
    );
    variableUnits.forEach((unit, u) => {
      const budget = budgets[u] ?? 0;
      if (budget <= 0) return;
      const rest = tasks
        .filter((t) => t.unitId === unit.unitId && !isRoutine(t.timesPerWeek))
        .sort((a, b) => a.rankInUnit - b.rankInUnit);
      const shares = rankShares(rest.length);
      assign(
        values,
        rest.map((t, i) => ({ id: t.id, claim: budget * (shares[i] ?? 0) })),
      );
    });
  }

  return values;
}

/**
 * Turn fractional claims into integers that sum to their rounded total,
 * with a one-point floor wherever the band can afford it.
 */
function assign(
  into: Map<string, number>,
  claims: readonly { id: string; claim: number }[],
): void {
  if (claims.length === 0) return;
  const total = Math.round(claims.reduce((a, c) => a + c.claim, 0));
  if (total <= 0) {
    for (const c of claims) into.set(c.id, 0);
    return;
  }

  // Not enough to give everyone a point: proportional only.
  if (total < claims.length) {
    const sum = claims.reduce((a, c) => a + c.claim, 0);
    const exacts = claims.map((c) => (total * c.claim) / sum);
    const ints = largestRemainder(exacts, total);
    claims.forEach((c, i) => into.set(c.id, ints[i] ?? 0));
    return;
  }

  const surplus = total - claims.length;
  const sum = claims.reduce((a, c) => a + c.claim, 0);
  const exacts = claims.map((c) => (surplus * c.claim) / sum);
  const ints = largestRemainder(exacts, surplus);
  claims.forEach((c, i) => into.set(c.id, (ints[i] ?? 0) + 1));
}

/**
 * The most a day can pay, given a plan: `0.8 × covered weight + 20`.
 *
 * Coverage means *a daily task*, not any task — a unit whose only work
 * is weekly earns from the variable band and leaves its routine share
 * on the table. Used to explain the ceiling, never to grade against:
 * the denominator is always 100 (ADR-0027 §1).
 */
export function dayCeiling(
  units: readonly BandUnit[],
  tasks: readonly BandTask[],
): number {
  const covered = new Set(
    tasks.filter((t) => isRoutine(t.timesPerWeek)).map((t) => t.unitId),
  );
  const coveredWeight = units
    .filter((u) => covered.has(u.unitId))
    .reduce((a, u) => a + u.weight, 0);
  return Math.round((ROUTINE_BAND / 100) * coveredWeight) + VARIABLE_BAND;
}
