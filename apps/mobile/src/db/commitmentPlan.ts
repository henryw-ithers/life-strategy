/**
 * The decisions behind a day's commitment band, as pure functions
 * (ADR-0032, ADR-0029).
 *
 * Split out from `commitments.ts` so they can be tested: that module
 * imports `./client`, which is React Native, and the app's vitest
 * runner only handles modules free of those imports (ADR-0013). The
 * queries live there; the rules live here.
 */
import type { CommitmentDay, CommitmentGroup } from "@glide/scoring";

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
