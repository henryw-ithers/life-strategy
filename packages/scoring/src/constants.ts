import { VARIABLE_BAND } from "./bands";

/**

 * Named tunables. GAP_COEFFICIENT and EXTRA_RUN_RATE are the levers
 * contentment calibration (ADR-0008) may propose changing; any change
 * to the derivation math bumps FORMULA_VERSION (ADR-0002/0003).
 * (BONUS_CAP retired in v3 — credit is additive, no separate pool.)
 */
export const GAP_COEFFICIENT = 0.5;
/** Credit rate for task runs beyond the weekly goal (ADR-0004 §4).
 *  Deliberately *outside* `UNPLANNED_CAP` (ADR-0023 §2): a fourth run
 *  of a 3×/week task is the plan done harder, not spontaneity. */
export const EXTRA_RUN_RATE = 0.5;

/**
 * The most a day can earn from work it didn't plan (ADR-0023 §1).
 *
 * One shared pool: activity credit and the special-day rating bonus
 * draw from the same 25, so a memorable day can't stack a full rating
 * bonus on top of a full day of logged activities. Extra runs are
 * exempt — see `EXTRA_RUN_RATE`.
 *
 * Replaces ADR-0009's `BONUS_CAP`, which formula v3 retired and whose
 * absence let vacation days score above 100 with the checklist
 * untouched. Named, because ADR-0008's calibration may argue for
 * moving it.
 */
export const UNPLANNED_CAP = VARIABLE_BAND;

/**
 * `MISSED_DAY_CREDIT` **retired 2026-08-13.** An elapsed day with no
 * stored row was filled at 0.5 of the standard denominator so skipped
 * days could not vanish from it. Two problems ended it:
 *
 * - It paid for absence. A day nobody opened out-scored a day someone
 *   opened and half-finished — 50% against 30% — which the constant
 *   already flagged as a knowingly accepted trade.
 * - Worse, it collided with what the scale is *for*. On the intended
 *   reading, 50 means "you did the basics; it's a pass." Filling an
 *   unopened day with exactly 50 asserted the one thing there was no
 *   evidence for.
 *
 * A day with no row is now not a graded day at all. The denominator
 * it used to occupy is gone with it, so `PeriodGrade.gradedDays`
 * carries how many days a period grade stands on — see `periodDays`.
 *
 * Not a derivation change either way: `FORMULA_VERSION` does not move
 * for this. That stamp records how *weights* were derived; this only
 * affects how finished days aggregate.
 */
/** v2 (2026-07-17): unified day denominator — every task contributes
 *  point_value × times_per_week ÷ 7 per day; completions earn full
 *  value on their day; daily grades may exceed 100 (ADR-0004 §4).
 *  v3 (2026-07-17): bonus pool retired — extra-run and activity
 *  credit add directly to the day's earned points (ADR-0009).
 *  v4 (2026-08-02): satisfaction is an absolute 1–10 rating rather than
 *  a rank-derived score (ADR-0022). The arithmetic is untouched; the
 *  *inputs* change meaning, which is exactly what this version stamp
 *  exists to record. A stored satisfaction of 3 means "3rd-lowest of
 *  18" in v≤3 and "quite dissatisfied" in v4, so the two eras are not
 *  comparable on the graph's x-axis.
 *  v5 (2026-08-13): planned work is what pays (ADR-0023). Unplanned
 *  credit — activities and the special-day rating bonus — shares one
 *  `UNPLANNED_CAP` pool; extra runs sit outside it; special days are
 *  graded on their tasks plus that bonus rather than `rating × 10`;
 *  activity credit is denominated in a unit's daily share rather than
 *  its portfolio weight. A stored `earned` from v4 and one from v5 are
 *  not comparable. History is not rewritten — grades finalize.
 *  v6 (2026-08-16): **communal units earn by being tagged**
 *  (ADR-0025 §3). The three Relationships units hold no tasks, so they
 *  are *covered by definition* rather than donating their weight to
 *  units that do, and a single tag anywhere in the day earns that
 *  share in full. Not proportional: relationships are not
 *  dose-dependent, and a proportional rule would cap a solo day
 *  structurally — the shame surface AGENTS.md forbids, arriving
 *  through arithmetic instead of copy.
 *  Two things were expected in this version and are **not** in it.
 *  *Fill-first activity credit* (ADR-0025 §12) was built and pulled:
 *  it scored a day with no tasks completed and two activities logged
 *  at 100, which is the failure ADR-0023 exists to prevent, and it
 *  contradicts AGENTS.md's cap invariant outright. *The
 *  daily-denominator retune* was never decided — docs/backburner.md
 *  lists four directions and none was chosen — so there was nothing to
 *  build. Both are open questions, not omissions.
 *  v8 (2026-09-11): **the commitment band** (ADR-0032). A day holding
 *  eligible commitment work splits three ways — the band, then 80/20
 *  on what remains — and the 18 life units are scaled into that
 *  remainder. This is the first time a day's split depends on the
 *  *date*, so a task's value is no longer one stored number true on
 *  every day; `loadDay` computes it for the date when a band applies
 *  and reads the stored column otherwise. A day with no commitment
 *  work is arithmetically identical to v7, but the version moves
 *  regardless: the stamp records how a grade *could* have been
 *  derived, and two eras where the same plan can score differently are
 *  not comparable. Grades finalize; history is not rewritten.
 *  v9 (2026-09-30): **commitment work off its schedule pays** (ADR-0032
 *  §4, amended). Done on a day it was not scheduled — ahead of its day,
 *  or in place of something else — it is priced at what it is worth on
 *  its scheduled day and paid from the unplanned pool. Under v8 it paid
 *  nothing, because a commitment has no weight among the 18. */
export const FORMULA_VERSION = 9;
export const DAILY_BUDGET = 100;
