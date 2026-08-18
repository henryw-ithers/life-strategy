/**
 * The two bands a day divides into (ADR-0027 §1).
 *
 * **Routine — 80 points.** A unit of weight `w` contributes `0.8 × w`,
 * split across that unit's *daily* tasks (`timesPerWeek === 7`). A unit
 * with no daily task leaves its share unearnable: nobody else receives
 * it, which is §2's whole point.
 *
 * **Variable — 20 points.** Every task that is not daily, sharing one
 * pool across the whole plan rather than per unit, so completing all of
 * them in a week earns the band exactly once. Whatever the day's
 * planned work leaves unspent is what activities and a special day's
 * rating can draw on (ADR-0023's ordering, inside one pool).
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
 * one point per task** — a zero-point task is not a small task, it is a
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
  // Per unit, because a unit's share is its own and an uncovered one
  // forfeits it rather than passing it on.
  const routineClaims: { id: string; claim: number }[] = [];
  for (const unit of units) {
    const daily = tasks
      .filter((t) => t.unitId === unit.unitId && isRoutine(t.timesPerWeek))
      .sort((a, b) => a.rankInUnit - b.rankInUnit);
    if (daily.length === 0 || unit.weight <= 0) continue;

    const shares = rankShares(daily.length);
    const budget = (ROUTINE_BAND / 100) * unit.weight;
    daily.forEach((t, i) => {
      routineClaims.push({ id: t.id, claim: budget * (shares[i] ?? 0) });
    });
  }
  assign(values, routineClaims);

  // ── Variable band ──
  // One pool for the whole plan: a unit's weight sets how much of it a
  // task can claim, and rank orders the claims inside a unit, but the
  // total is 20 however many units are involved.
  const variableClaims: { id: string; claim: number }[] = [];
  for (const unit of units) {
    const rest = tasks
      .filter((t) => t.unitId === unit.unitId && !isRoutine(t.timesPerWeek))
      .sort((a, b) => a.rankInUnit - b.rankInUnit);
    if (rest.length === 0 || unit.weight <= 0) continue;

    const shares = rankShares(rest.length);
    rest.forEach((t, i) => {
      variableClaims.push({
        id: t.id,
        claim: unit.weight * (shares[i] ?? 0),
      });
    });
  }
  const claimed = variableClaims.reduce((a, c) => a + c.claim, 0);
  if (claimed > 0) {
    assign(
      values,
      variableClaims.map((c) => ({
        id: c.id,
        claim: (VARIABLE_BAND * c.claim) / claimed,
      })),
    );
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
