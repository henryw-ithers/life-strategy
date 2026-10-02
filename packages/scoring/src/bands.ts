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
import { largestRemainder } from "./rounding";
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

// ── The commitment band (ADR-0032) ──────────────────────────────────
//
// Commitments — School, Work, a club — sit outside the 18 life units
// and their weights. On a day with commitment work scheduled, the
// user's band (10–60) is **that share of the whole day**, carved off
// first and paid as the share of today's commitment work done; the
// planned and unplanned bands are scaled into what is left. Every
// other day is exactly the two-band day above.

/** The band's permitted range, in steps of 5 (ADR-0032 §2). */
export const COMMITMENT_BAND_MIN = 10;
/** The highest the band can go at all — with three commitments. */
export const COMMITMENT_BAND_MAX = 80;
export const COMMITMENT_BAND_STEP = 5;

/**
 * How large the band may be for this many commitments (ADR-0032 §2 as
 * amended 2026-10-02): **60 with one, 70 with two, 80 with three.**
 * Henry: *"bump the commitments value to up to 70 if they have two
 * commitments and 80 if they have 3."* More of a week is spoken for
 * when more of it is scheduled, so more of the day may be.
 */
export function commitmentBandMax(commitments: number): number {
  if (commitments >= 3) return 80;
  if (commitments === 2) return 70;
  return 60;
}

/** At most three commitments (ADR-0035 §1). */
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
  /** 10 up to `commitmentBandMax(commitments.length)`. Clamped and
   *  snapped to a step of 5 by `normalizeBand`. */
  band: number;
  commitments: readonly CommitmentGroup[];
  /** Ids of the commitment tasks scheduled or planned for this date. */
  eligibleTaskIds: readonly string[];
  /** Pools among today's eligible tasks. */
  pools?: readonly Pool[];
}

/** Clamp to [10, the cap for this many commitments] and snap to the
 *  nearest step of 5 (ADR-0032 §2). A setting above the cap — 80 kept
 *  from when there were three commitments, after one was archived — is
 *  read as the cap, never stored back down. */
export function normalizeBand(band: number, commitments = 1): number {
  if (!Number.isFinite(band)) return COMMITMENT_BAND_MIN;
  const snapped =
    Math.round(band / COMMITMENT_BAND_STEP) * COMMITMENT_BAND_STEP;
  return Math.min(
    commitmentBandMax(commitments),
    Math.max(COMMITMENT_BAND_MIN, snapped),
  );
}

/**
 * Set one commitment to `percent` of the band and fit the others into
 * the rest, **keeping their proportions** — the commitment sheet's
 * arithmetic (ADR-0032 §3 as amended 2026-10-02).
 *
 * Shares used to be free relative weights, which were right for the
 * engine and too vague to set: "weight 2" means nothing until you know
 * the others. They are now whole percentages summing to 100, so what is
 * stored is what is shown. Integers that sum exactly, via
 * `largestRemainder`; others whose shares are all zero split the rest
 * evenly.
 *
 * With no others the commitment takes the whole band, whatever was
 * asked — there is nothing to share it with.
 */
export function rebalanceShares(
  others: readonly { id: string; share: number }[],
  percent: number,
): { self: number; others: { id: string; share: number }[] } {
  if (others.length === 0) return { self: 100, others: [] };
  const self = Math.min(99, Math.max(1, Math.round(percent)));
  const rest = 100 - self;
  const total = others.reduce((a, o) => a + Math.max(0, o.share), 0);
  const exact = others.map((o) =>
    total > 0 ? (rest * Math.max(0, o.share)) / total : rest / others.length,
  );
  const ints = largestRemainder(exact, rest);
  return { self, others: others.map((o, i) => ({ id: o.id, share: ints[i] ?? 0 })) };
}

/**
 * How much of a day the commitment band actually takes: the normalised
 * band on a day with eligible commitment work, and **0 on any other
 * day** — the band does not exist on days it could not be earned,
 * which is what stops an empty Sunday capping below 100 (ADR-0032 §1).
 *
 * Exported so a screen that draws the band asks the same question the
 * grade does, rather than re-deriving "does it apply today" and
 * drifting from it.
 */
export function commitmentBandOn(day: CommitmentDay | null | undefined): number {
  if (!day || day.eligibleTaskIds.length === 0) return 0;
  return normalizeBand(day.band, day.commitments.length);
}

/**
 * The share of the day left to the 18 life units, as a multiplier:
 * 1 on an ordinary day, `(100 − band) / 100` on a commitment day. The
 * planned and unplanned bands, and every life task's points, scale by
 * it.
 */
export function lifeShare(day: CommitmentDay | null | undefined): number {
  return (100 - commitmentBandOn(day)) / 100;
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
  eligible: ReadonlySet<string>,
  tasks: readonly { id: string; unitId: string }[],
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
        .filter((t): t is { id: string; unitId: string } => t !== undefined)
        .map((t) => unitOwner.get(t.unitId))
        .filter((o): o is string => o !== undefined),
    );
    if (owners.size !== 1) continue;
    const owner = [...owners][0] as string;
    const entry = byCommitment.get(owner);
    if (!entry) continue;
    entry.slots += Math.max(1, Math.min(pool.plannedCount, pool.taskIds.length));
  }

  return byCommitment;
}

/**
 * What each of today's eligible commitment tasks is worth, in points of
 * the band (ADR-0032 §3).
 *
 * Divided between the commitments that have work today — not all of
 * them — so a Monday holding only School gives School the whole band
 * rather than leaving Work's share dead. Divided *within* a commitment
 * **equally across today's eligible tasks**, not by rank, and
 * sub-commitments take no cut: they group tasks and price nothing
 * (ADR-0035 §1). Integers that sum to the band, with a one-point floor
 * wherever the band can afford it.
 *
 * Every task passed in gets a value; one that is not eligible today is
 * worth 0 here. Life tasks are priced by `taskWeights` and the day's
 * load, not by this.
 */
export function commitmentPointValues(
  day: CommitmentDay,
  tasks: readonly { id: string; unitId: string }[],
): Map<string, number> {
  const values = new Map<string, number>(tasks.map((t) => [t.id, 0]));
  const eligible = new Set(day.eligibleTaskIds);
  if (eligible.size === 0) return values;

  const slots = commitmentSlots(day, eligible, tasks);
  const active = day.commitments.filter(
    (c) => (slots.get(c.commitmentId)?.slots ?? 0) > 0 && c.share > 0,
  );
  const shareTotal = active.reduce((a, c) => a + c.share, 0);
  if (shareTotal <= 0) return values;

  const band = normalizeBand(day.band, day.commitments.length);
  const budgets = largestRemainder(
    active.map((c) => (band * c.share) / shareTotal),
    band,
  );
  active.forEach((c, i) => {
    const entry = slots.get(c.commitmentId);
    const budget = budgets[i] ?? 0;
    if (!entry || budget <= 0) return;
    const perSlot = budget / entry.slots;
    assign(
      values,
      entry.taskIds.map((id) => ({ id, claim: perSlot })),
    );
  });
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
