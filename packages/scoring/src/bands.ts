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

// ── The commitment band (ADR-0032) ──────────────────────────────────

/** The band's permitted range, in steps of 5 (ADR-0032 §2). */
export const COMMITMENT_BAND_MIN = 10;
export const COMMITMENT_BAND_MAX = 60;
export const COMMITMENT_BAND_STEP = 5;

/** At most three commitments (ADR-0029 §1). */
export const MAX_COMMITMENTS = 3;

/**
 * One commitment and the units that roll up to it.
 *
 * `unitIds` is the commitment's own unit plus its sub-commitments,
 * resolved by the caller. The scoring package does not walk
 * `parent_unit_id` — hierarchy is the app's business, arithmetic is
 * this package's.
 */
export interface CommitmentGroup {
  commitmentId: string;
  /** Relative share of the band. Need not sum to anything. */
  share: number;
  /** This commitment's unit plus its sub-commitments. */
  unitIds: readonly string[];
}

/**
 * A window's pool of interchangeable options (ADR-0033 §3).
 *
 * `plannedCount` is how many of them the user means to do. It sets the
 * **divisor**, not the payout: every member is worth one slot, so doing
 * more than planned is beyond-plan work rather than a discount on each.
 */
export interface Pool {
  taskIds: readonly string[];
  /** 1..taskIds.length. */
  plannedCount: number;
}

/**
 * What a day's commitment work looks like. Omit it — or pass one with
 * nothing eligible — and the day is an ordinary two-band day.
 */
export interface CommitmentDay {
  /** 10–60. Clamped and snapped to a step of 5 by `normalizeBand`. */
  band: number;
  commitments: readonly CommitmentGroup[];
  /** Ids of the commitment tasks scheduled or planned for this date. */
  eligibleTaskIds: readonly string[];
  /** Pools among today's eligible tasks. */
  pools?: readonly Pool[];
}

/** Clamp to [10, 60] and snap to the nearest step of 5 (ADR-0032 §2). */
export function normalizeBand(band: number): number {
  if (!Number.isFinite(band)) return COMMITMENT_BAND_MIN;
  const snapped =
    Math.round(band / COMMITMENT_BAND_STEP) * COMMITMENT_BAND_STEP;
  return Math.min(COMMITMENT_BAND_MAX, Math.max(COMMITMENT_BAND_MIN, snapped));
}

/**
 * The share of the day left to the 18 life units, as a multiplier.
 *
 * A day with no eligible commitment work returns 1 — the band does not
 * exist on days it could not be earned, which is what stops an empty
 * Sunday capping below 100 (ADR-0032 §1).
 */
function lifeScale(day: CommitmentDay | undefined, eligible: Set<string>): number {
  if (!day || eligible.size === 0) return 1;
  return (100 - normalizeBand(day.band)) / 100;
}

/**
 * Which of today's eligible tasks belong to each commitment, and how
 * many slots each commitment's work occupies.
 *
 * A pool contributes its `plannedCount`; every other eligible task
 * contributes one. Pool members still each receive a full slot's value
 * — the count is the ceiling, not the payout (ADR-0033 §3).
 */
function commitmentSlots(
  day: CommitmentDay,
  eligible: Set<string>,
  tasks: readonly BandTask[],
): Map<string, { taskIds: string[]; slots: number }> {
  const unitOwner = new Map<string, string>();
  for (const c of day.commitments) {
    for (const unitId of c.unitIds) unitOwner.set(unitId, c.commitmentId);
  }

  const byCommitment = new Map<string, { taskIds: string[]; slots: number }>();
  const pooled = new Set<string>();
  for (const pool of day.pools ?? []) {
    for (const id of pool.taskIds) pooled.add(id);
  }

  for (const task of tasks) {
    if (!eligible.has(task.id)) continue;
    const owner = unitOwner.get(task.unitId);
    if (owner === undefined) continue;
    const entry = byCommitment.get(owner) ?? { taskIds: [], slots: 0 };
    entry.taskIds.push(task.id);
    // Loose tasks take a slot each; pooled ones are counted below.
    if (!pooled.has(task.id)) entry.slots += 1;
    byCommitment.set(owner, entry);
  }

  // Each pool adds its planned count once, to whichever commitment its
  // members belong to. A pool spanning two commitments is not a shape
  // the app can create, and is ignored rather than guessed at.
  for (const pool of day.pools ?? []) {
    const owners = new Set(
      pool.taskIds
        .map((id) => tasks.find((t) => t.id === id))
        .filter((t): t is BandTask => t !== undefined)
        .map((t) => unitOwner.get(t.unitId))
        .filter((o): o is string => o !== undefined),
    );
    if (owners.size !== 1) continue;
    const owner = [...owners][0] as string;
    const entry = byCommitment.get(owner);
    if (!entry) continue;
    const planned = Math.max(
      1,
      Math.min(pool.plannedCount, pool.taskIds.length),
    );
    entry.slots += planned;
  }

  return byCommitment;
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
  day?: CommitmentDay,
): Map<string, number> {
  // Every task starts at 0 and is overwritten if its band can pay it.
  // A task in an excluded unit has no share to receive but must still
  // have a value — a consumer reading `undefined` here would find it at
  // the point it tried to add a number to a grade.
  const values = new Map<string, number>(tasks.map((t) => [t.id, 0]));

  // ── Commitment band (ADR-0032) ──
  // Carved off the top, and **only on days it can be earned**: a day
  // with no scheduled commitment work is an ordinary two-band day, so
  // an empty Sunday cannot cap below 100 through somebody else's
  // timetable (§1).
  //
  // Divided between the commitments that have work today — not all of
  // them — for the same reason one level down: a Monday holding only
  // School gives School the whole band rather than leaving Work's
  // share dead (§3).
  //
  // Divided *within* a commitment **equally across today's eligible
  // tasks**, not by rank. Sub-commitments take no cut: they group tasks
  // and price nothing (ADR-0029 §1).
  const eligible = new Set(day?.eligibleTaskIds ?? []);
  if (day && eligible.size > 0) {
    const slots = commitmentSlots(day, eligible, tasks);
    const active = day.commitments.filter(
      (c) => (slots.get(c.commitmentId)?.slots ?? 0) > 0 && c.share > 0,
    );
    const shareTotal = active.reduce((a, c) => a + c.share, 0);
    if (shareTotal > 0) {
      const band = normalizeBand(day.band);
      const budgets = largestRemainder(
        active.map((c) => (band * c.share) / shareTotal),
        band,
      );
      active.forEach((c, i) => {
        const entry = slots.get(c.commitmentId);
        const budget = budgets[i] ?? 0;
        if (!entry || budget <= 0) return;
        // Every eligible task is worth one slot, including each member
        // of a pool — the planned count sets the ceiling, not the
        // payout (ADR-0033 §3).
        const perSlot = budget / entry.slots;
        assign(
          values,
          entry.taskIds.map((id) => ({ id, claim: perSlot })),
        );
      });
    }
  }

  // What is left for the 18 life units. Their stored weights still sum
  // to 100 — the invariant is untouched — and are scaled here at read
  // time rather than restated (ADR-0029 §2).
  const scale = lifeScale(day, eligible);

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
    const budget = (ROUTINE_BAND / 100) * unit.weight * scale;
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
  const variableBand = Math.round(VARIABLE_BAND * scale);
  if (variableWeight > 0 && variableBand > 0) {
    const budgets = largestRemainder(
      variableUnits.map((u) => (variableBand * u.weight) / variableWeight),
      variableBand,
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
  day?: CommitmentDay,
): number {
  const covered = new Set(
    tasks.filter((t) => isRoutine(t.timesPerWeek)).map((t) => t.unitId),
  );
  const coveredWeight = units
    .filter((u) => covered.has(u.unitId))
    .reduce((a, u) => a + u.weight, 0);

  // The commitment band is wholly earnable on a day it exists: it is
  // split only between commitments that have work today, so none of it
  // is left stranded (ADR-0032 §3). That is why it adds to the ceiling
  // in full where the routine band adds only its *covered* share.
  const eligible = new Set(day?.eligibleTaskIds ?? []);
  const band = day && eligible.size > 0 ? normalizeBand(day.band) : 0;
  const scale = lifeScale(day, eligible);

  return (
    band +
    Math.round((ROUTINE_BAND / 100) * coveredWeight * scale) +
    Math.round(VARIABLE_BAND * scale)
  );
}
