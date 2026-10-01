/**
 * The decisions behind a day's commitment band, as pure functions
 * (ADR-0032, ADR-0035).
 *
 * Split out from `commitments.ts` so they can be tested: that module
 * imports `./client`, which is React Native, and the app's vitest
 * runner only handles modules free of those imports (ADR-0013). The
 * queries live there; the rules live here.
 */
import { MAX_COMMITMENTS, type CommitmentDay, type CommitmentGroup } from "@glide/scoring";

import { addDays } from "@glide/scoring";

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
 * because sub-commitments price nothing (ADR-0035 §1).
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

// ── Write-seam rules (ADR-0035 §1, ADR-0033 §3) ─────────────────────
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

// ── Commitment tasks (ADR-0035 §3) ─────────────────────────────────

/**
 * Whether a unit is a commitment or one of its parts.
 *
 * `is_custom` alone is not enough: a custom unit with neither a share
 * nor a parent is an ordinary life unit somebody made, and it prices
 * from the 18's weights like any other. A commitment carries a share;
 * a part carries a parent.
 */
export function isCommitmentUnit(u: {
  isCustom: boolean;
  parentUnitId: string | null;
  commitmentShare: number | null;
}): boolean {
  return u.isCustom && (u.parentUnitId !== null || u.commitmentShare !== null);
}

export type Membership = "scoring" | "note";

/**
 * The membership each chosen unit takes, home unit first.
 *
 * **A commitment task never takes a scoring slot in a life unit**
 * (ADR-0035 §3). It may tag one — School work that is also Learning —
 * but that row is a `note`: it feeds effort and the log and earns
 * nothing. A `scoring` row would pay the same completion from two
 * bands, which is the one route to inflating a day.
 *
 * **A commitment can only be where a task is listed**, never a second
 * unit it also counts toward. A life task tagged to a commitment has
 * nowhere to be paid from — the band prices a commitment's *own* work,
 * found by home unit — so the tag would be a row that looks like it
 * does something and does not. Refused here rather than stored.
 */
export function membershipsFor(
  unitIds: readonly string[],
  commitmentUnitIds: ReadonlySet<string>,
): { unitId: string; membership: Membership }[] {
  const [home, ...rest] = unitIds;
  if (home === undefined) return [];
  if (rest.some((id) => commitmentUnitIds.has(id))) {
    throw new Error(
      "A commitment can only be the unit a task is listed under, not a second one it counts toward.",
    );
  }
  const homeIsCommitment = commitmentUnitIds.has(home);
  return unitIds.map((unitId, i) => ({
    unitId,
    membership: i > 0 && homeIsCommitment ? "note" : "scoring",
  }));
}

// ── Off-schedule work (ADR-0032 §4, amended 2026-09-30) ─────────────

/** How far ahead a pinned task's next session is looked for: a
 *  fortnightly task's next one is at most fourteen days out. */
const SCHEDULE_HORIZON_DAYS = 14;

/**
 * The day a commitment task is scheduled for, seen from `date` — the
 * day whose value it earns when it is done on `date` instead.
 *
 * Henry, 2026-09-30: off-schedule work is *"worth the same amount as it
 * would on a scheduled day, because that would mean you're either super
 * ahead on work or it's taking the place of some other thing that
 * day."* So it is priced against a real scheduled day, sharing that
 * day's band with that day's other work — not against today, where on
 * a Sunday with no classes one assignment would take the entire band.
 *
 * - **A one-off planned for later**: its own planned day.
 * - **A pinned task**: its next scheduled session after `date`.
 * - **Anything else**: null. A one-off due today or undated is already
 *   eligible, and an unpinned recurring task has no scheduled day to
 *   borrow a value from — which is why commitment work must name its
 *   days (`needsDays`).
 */
export function scheduledDateFor(
  task: {
    oneOffSize: string | null;
    oneOffDate: string | null;
    plannedWeekdays: string | null;
    timesPerWeek: number;
    fortnightOffset?: number;
  },
  date: string,
): string | null {
  if (task.oneOffSize != null) {
    return task.oneOffDate != null && task.oneOffDate > date ? task.oneOffDate : null;
  }
  for (let i = 1; i <= SCHEDULE_HORIZON_DAYS; i++) {
    const next = addDays(date, i);
    if (isDueOn(task, next)) return next;
  }
  return null;
}

// ── An early session stands in for the next one (ADR-0032 §4) ───────

/** The schedule fields `isDueOn` reads. */
export interface ScheduledTask {
  plannedWeekdays: string | null;
  timesPerWeek: number;
  fortnightOffset?: number;
}

/**
 * Which scheduled session each off-schedule completion stands in for —
 * `offScheduleDate → sessionDate`.
 *
 * Henry, 2026-10-01, choosing between three ways to stop a recurring
 * session paying again every day it is ticked off its schedule: **an
 * early session replaces the next scheduled one.** Tuesday's tick is
 * Wednesday's session done early, so Wednesday is already done, and a
 * session is paid once however far ahead it is worked.
 *
 * Walked in date order, so the answer is the same however the rows were
 * entered. Each off-schedule completion takes the first session after
 * it that is neither **done on its own day** nor **already taken** by
 * an earlier one — so Saturday covers Monday and Sunday covers
 * Wednesday, rather than both claiming Monday. One with nothing left to
 * take inside the horizon stands in for nothing.
 *
 * Recurring tasks only: a one-off is done once, so working it early
 * already settles it.
 */
export function coverage(
  task: ScheduledTask,
  completionDates: readonly string[],
): Map<string, string> {
  const dates = [...new Set(completionDates)].sort();
  const doneOnTheDay = new Set(dates.filter((d) => isDueOn(task, d)));
  const taken = new Set<string>();
  const out = new Map<string, string>();
  for (const d of dates) {
    if (doneOnTheDay.has(d)) continue;
    for (let i = 1; i <= SCHEDULE_HORIZON_DAYS; i++) {
      const session = addDays(d, i);
      if (!isDueOn(task, session)) continue;
      if (doneOnTheDay.has(session) || taken.has(session)) continue;
      out.set(d, session);
      taken.add(session);
      break;
    }
  }
  return out;
}

/**
 * The session a tick on `date` would stand in for, given what is
 * already recorded — what an unticked off-schedule row is worth.
 * Null when the date is one of the task's own days, or nothing is left
 * to take.
 */
export function sessionFor(
  task: ScheduledTask,
  date: string,
  completionDates: readonly string[],
): string | null {
  if (isDueOn(task, date)) return null;
  return coverage(task, [...completionDates, date]).get(date) ?? null;
}

/**
 * The off-schedule day that already did `date`'s session, or null.
 * The session is then done: it leaves the day's band and cannot be
 * ticked again.
 */
export function doneAheadOn(
  task: ScheduledTask,
  date: string,
  completionDates: readonly string[],
): string | null {
  for (const [early, session] of coverage(task, completionDates)) {
    if (session === date) return early;
  }
  return null;
}

/**
 * How far back a completion can reach to cover a session. One horizon
 * to find its session, and another for the earlier completions that
 * pushed it along: past that, a chain would need three weeks of daily
 * off-schedule ticks.
 */
export const COVERAGE_LOOKBACK_DAYS = SCHEDULE_HORIZON_DAYS * 2;
