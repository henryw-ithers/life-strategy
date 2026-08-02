/**
 * Named tunables. GAP_COEFFICIENT and EXTRA_RUN_RATE are the levers
 * contentment calibration (ADR-0008) may propose changing; any change
 * to the derivation math bumps FORMULA_VERSION (ADR-0002/0003).
 * (BONUS_CAP retired in v3 — credit is additive, no separate pool.)
 */
export const GAP_COEFFICIENT = 0.5;
/** Credit rate for task runs beyond the weekly goal (ADR-0004 §4). */
export const EXTRA_RUN_RATE = 0.5;

/**
 * What an elapsed day with no stored row earns, as a fraction of the
 * standard daily denominator (ADR-0004 §5 as amended 2026-07-30).
 *
 * Not a derivation change, so `FORMULA_VERSION` deliberately does not
 * move: that version is stamped on snapshots to record how *weights*
 * were derived, and this only affects how finished days aggregate.
 *
 * **Known trade, accepted deliberately.** At 0.5 a day you never
 * opened out-scores a day where you opened the app and completed some
 * of your tasks (50% versus, say, 30%). Halving the day's *weight*
 * instead — `{ earned: 0, possible: dailyPossible / 2 }` — softens a
 * missed day without ever paying you to skip one, and is the one-line
 * change if the incentive turns out to bite in real use.
 */
export const MISSED_DAY_CREDIT = 0.5;
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
 *  comparable on the graph's x-axis. */
export const FORMULA_VERSION = 4;
export const DAILY_BUDGET = 100;
