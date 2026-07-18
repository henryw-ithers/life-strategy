/**
 * Named tunables. GAP_COEFFICIENT and EXTRA_RUN_RATE are the levers
 * contentment calibration (ADR-0008) may propose changing; any change
 * to the derivation math bumps FORMULA_VERSION (ADR-0002/0003).
 * (BONUS_CAP retired in v3 — credit is additive, no separate pool.)
 */
export const GAP_COEFFICIENT = 0.5;
/** Credit rate for task runs beyond the weekly goal (ADR-0004 §4). */
export const EXTRA_RUN_RATE = 0.5;
/** v2 (2026-07-17): unified day denominator — every task contributes
 *  point_value × times_per_week ÷ 7 per day; completions earn full
 *  value on their day; daily grades may exceed 100 (ADR-0004 §4).
 *  v3 (2026-07-17): bonus pool retired — extra-run and activity
 *  credit add directly to the day's earned points (ADR-0009). */
export const FORMULA_VERSION = 3;
export const DAILY_BUDGET = 100;
