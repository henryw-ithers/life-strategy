import { UNPLANNED_BAND } from "./bands";

/**

 * Named tunables. `WEIGHT_SPREAD` and `EXTRA_RUN_RATE` are the levers a
 * retune may argue for moving; any change to the derivation math bumps
 * FORMULA_VERSION (ADR-0002/0003).
 * (BONUS_CAP retired in v3 — credit is additive, no separate pool.)
 * (GAP_COEFFICIENT retired in v8 — satisfaction no longer derives
 * weight at all; see ADR-0028 §1.)
 */

/**
 * How much more the highest-priority unit is worth than the lowest
 * (ADR-0028 §2).
 *
 * The weight of a unit is now a function of its priority rank and
 * nothing else, and this is the only dial on that function: rank 1
 * gets `WEIGHT_SPREAD` raw points, the last rank gets 1, everything in
 * between is linear, and the whole set is normalized to
 * `DAILY_BUDGET`. At 18 units and a spread of 2 that is roughly 7.4
 * points at the top and 3.7 at the bottom.
 *
 * **Why it exists.** Before v8 the spread was 10:1 — implicitly, as a
 * consequence of `rankToScore` mapping ranks onto 10…1 and weight
 * being proportional to that. The bottom third of an 18-unit portfolio
 * came out at one, two and three points, and a unit worth two points
 * cannot hold a task worth having — one task, moving the day by two.
 * The ranking said "these matter less"; the arithmetic said "these do
 * not matter." (`recommendedTaskRange`'s thresholds moved with the
 * scale; see ADR-0028 §2.)
 *
 * Every unit in the portfolio is one the user said belongs in their
 * life — the ones that do not are excluded outright, which is a
 * different statement with its own control (ADR-0027 §2). So priority
 * should order the units, not delete the tail of them.
 *
 * Set to 1 for a perfectly flat portfolio; set to 10 to reproduce the
 * pre-v8 shape exactly.
 */
export const WEIGHT_SPREAD = 2;

/** Credit rate for task runs beyond the weekly goal (ADR-0004 §4).
 *  Deliberately *outside* `UNPLANNED_CAP` (ADR-0023 §2): a fourth run
 *  of a 3×/week task is the plan done harder, not spontaneity. */
export const EXTRA_RUN_RATE = 0.5;

/**
 * The most a day can earn from work it didn't plan (ADR-0023 §1).
 *
 * One shared pool: activity credit and the special-day rating bonus
 * draw from the same 10, so a memorable day can't stack a full rating
 * bonus on top of a full day of logged activities. Extra runs are
 * exempt — see `EXTRA_RUN_RATE`.
 *
 * **25 → 20 → 10.** ADR-0027 §3 made it the variable band, so it
 * covered planned weekly work as well as spontaneity. ADR-0029 §2 gives
 * planned work a band of its own at every cadence, so this goes back to
 * meaning only what ADR-0023 named it for — and shrinks, because the
 * planned band grew to 90.
 *
 * Replaces ADR-0009's `BONUS_CAP`, which formula v3 retired and whose
 * absence let vacation days score above 100 with the checklist
 * untouched.
 */
export const UNPLANNED_CAP = UNPLANNED_BAND;

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
 *  v6 (2026-08-16): communal units earned by being tagged
 *  (ADR-0025 §3). Withdrawn by ADR-0027 §4: they hold tasks and score
 *  like any other unit.
 *  v7 (2026-08-18): two bands, allocated separately (ADR-0027). The
 *  routine band is 80 and pays only daily tasks; the variable band is
 *  20 and holds everything else; the weight of a unit with no daily
 *  task was forfeited rather than redistributed, so a plan's coverage
 *  set its ceiling.
 *  v8 (2026-08-26): **priority is the only input, and completing your
 *  plan is what is scored** (ADR-0028). Three changes, all to
 *  derivation:
 *  - Satisfaction leaves the weight formula. `raw = importance`; the
 *    gap term and `GAP_COEFFICIENT` are gone. Satisfaction is still
 *    diagnosed, stored, plotted and used to profile a unit — it is a
 *    measure of whether the plan is working, not an input to it.
 *  - Weights are flattened to `WEIGHT_SPREAD` (see above). The bottom
 *    of an 18-unit portfolio moves from ~1 point to ~3.7.
 *  - ADR-0027 §2's forfeit is withdrawn. Both bands are split across
 *    the units that hold work of that kind, so doing every daily task
 *    pays exactly 80 whatever the plan's coverage.
 *  A stored `earned` from v7 and one from v8 are not comparable, and
 *  history is not rewritten — grades finalize (ADR-0002). */
/*  v9 (2026-08-26): **a day is scored on the fraction of itself you
 *  got through** (ADR-0029). Cadence stops being a scoring concept: the
 *  80/20 routine/variable split becomes a 90/10 planned/unplanned one,
 *  and the day's denominator is the weight of the work actually due
 *  that day — every-day tasks and anything pinned to today in full,
 *  plus an even share of the flexible pool. Task point values become
 *  day-relative rather than stored. Weekday pins reach the grade for
 *  the first time, withdrawing ADR-0024 §2, though nothing compares a
 *  completion's date to the day it was pinned to: obligations are
 *  weekly, so doing Friday's run on Tuesday is still a perfect week.
 *  A v8 `earned` and a v9 one are not comparable; grades finalize. */
export const FORMULA_VERSION = 9;
export const DAILY_BUDGET = 100;
