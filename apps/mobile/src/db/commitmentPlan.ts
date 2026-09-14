/**
 * The decisions behind a day's commitment band, as pure functions
 * (ADR-0032, ADR-0029).
 *
 * Split out from `commitments.ts` so they can be tested: that module
 * imports `./client`, which is React Native, and the app's vitest
 * runner only handles modules free of those imports (ADR-0013). The
 * queries live there; the rules live here.
 */
import { MAX_COMMITMENTS, type CommitmentDay, type CommitmentGroup } from "@glide/scoring";

import { isDueOn } from "../components/plan/planning";

/** The commitment fields these rules need. */
export interface CommitmentUnitRow {
  id: string;
  parentUnitId: string | null;
  commitmentShare: number | null;
}

/** The task fields these rules need. */
export interface EligibilityRow {
  id: string;
  unitId: string;
  plannedWeekdays: string | null;
  timesPerWeek: number;
  fortnightOffset?: number;
  oneOffSize: string | null;
  oneOffDate: string | null;
}

/**
 * Commitments, each with its sub-commitments folded in.
 *
 * A **commitment** is custom, unparented and carries a share. A custom
 * unit *with* a parent is a sub-commitment, and never appears here in
 * its own right — it only contributes its id to its parent's group,
 * because sub-commitments price nothing (ADR-0029 §1).
 */
export function groupCommitments(
  units: readonly CommitmentUnitRow[],
): CommitmentGroup[] {
  return units
    .filter((u) => u.parentUnitId === null && u.commitmentShare !== null)
    .map((parent) => ({
      commitmentId: parent.id,
      share: parent.commitmentShare ?? 0,
      unitIds: [
        parent.id,
        ...units.filter((u) => u.parentUnitId === parent.id).map((u) => u.id),
      ],
    }));
}

/**
 * Which commitment tasks are eligible on `date` (ADR-0032 §3).
 *
 * Deliberately the same two tests the checklist already applies, so a
 * task the day *shows* and a task the band *pays for* cannot diverge:
 *
 * - **pinned to this weekday** — `isDueOn` (ADR-0024 §1); or
 * - **an outstanding one-off** dated on or before this date, using
 *   `loadDay`'s own rule for whether a one-off is still owed.
 *
 * A commitment task with neither a pin nor a date belongs to no
 * particular day, so no day's band can pay it. That is why ADR-0033
 * requires commitment sessions to be scheduled — the requirement is
 * structural, not stylistic.
 */
export function eligibleTaskIds(
  rows: readonly EligibilityRow[],
  settledBefore: ReadonlySet<string>,
  date: string,
): string[] {
  return rows
    .filter((t) => {
      if (t.oneOffSize != null) {
        if (settledBefore.has(t.id)) return false;
        return t.oneOffDate == null || t.oneOffDate <= date;
      }
      return isDueOn(t, date);
    })
    .map((t) => t.id);
}

/**
 * A `CommitmentDay`, or **`null` for an ordinary two-band day**.
 *
 * Three distinct routes to null, and the third is the one that matters
 * most: **no commitment work scheduled today.** ADR-0032 §1 — the band
 * exists only on days it can be earned, which is what stops an empty
 * Sunday capping below 100 through somebody else's timetable.
 */
export function buildCommitmentDay(
  band: number | null,
  groups: readonly CommitmentGroup[],
  eligible: readonly string[],
): CommitmentDay | null {
  if (band === null) return null;
  if (groups.length === 0) return null;
  if (eligible.length === 0) return null;
  return {
    band,
    commitments: [...groups],
    eligibleTaskIds: [...eligible],
  };
}

// ── Write-seam rules (ADR-0029 §1, ADR-0033 §3) ─────────────────────
//
// The schema can express neither of these, so they live here and every
// write goes through them.

// `MAX_COMMITMENTS` deliberately is **not** redefined here — it lives
// in `@glide/scoring` beside the band arithmetic that depends on it.
// Two constants for one rule is how the two drift apart.

/** At most three options in one pool (ADR-0033 §3). */
export const MAX_POOL_MEMBERS = 3;

/**
 * Whether another commitment may be created.
 *
 * Counts **commitments only** — a sub-commitment is not one, and
 * sub-commitments are deliberately uncapped so a semester of any size
 * fits under a cap of three.
 */
export function canAddCommitment(
  active: readonly { id: string; parentUnitId: string | null }[],
): boolean {
  return active.filter((u) => u.parentUnitId === null).length < MAX_COMMITMENTS;
}

export interface PoolValidationInput {
  taskIds: readonly string[];
  /** Other pools already in the same window. */
  existing: readonly { poolId: string; taskIds: readonly string[] }[];
}

/**
 * Why a pool is invalid, or `null` if it is fine.
 *
 * Returned rather than thrown so a caller can decide whether this is an
 * error or a disabled button.
 */
export function poolProblem(input: PoolValidationInput): string | null {
  if (input.taskIds.length === 0) return "A pool needs at least one option.";
  if (input.taskIds.length > MAX_POOL_MEMBERS) {
    return `A pool holds at most ${MAX_POOL_MEMBERS} options.`;
  }
  if (new Set(input.taskIds).size !== input.taskIds.length) {
    return "A task can only appear once in a pool.";
  }
  // A task in two pools in the same window would let "every completion
  // pays in full" be read as ticking one task twice (ADR-0033 §3).
  const elsewhere = new Set(input.existing.flatMap((p) => [...p.taskIds]));
  const clash = input.taskIds.find((id) => elsewhere.has(id));
  if (clash !== undefined) {
    return "That task is already an option in this window.";
  }
  return null;
}

/** `poolProblem`, as a throw — for write paths that cannot continue. */
export function assertPoolSize(input: PoolValidationInput): void {
  const problem = poolProblem(input);
  if (problem !== null) throw new Error(problem);
}
