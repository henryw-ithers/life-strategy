/** 0 encodes "once every two weeks"; 1–7 are times per week. */
export const MIN_TIMES_PER_WEEK = 0;
export const MAX_TIMES_PER_WEEK = 7;

/** "Every 2 weeks" · "Once a week" · "4× a week" · "Every day" */
export function formatFrequency(times: number): string {
  if (times <= 0) return "Every 2 weeks";
  if (times >= 7) return "Every day";
  if (times === 1) return "Once a week";
  if (times === 2) return "Twice a week";
  return `${times}× a week`;
}

/** Compact row form: "2 wks" · "1×/wk" · "4×/wk" · "daily" */
export function formatFrequencyShort(times: number): string {
  if (times <= 0) return "2 wks";
  if (times >= 7) return "daily";
  return `${times}×/wk`;
}

/** Nearest legal frequency. Guards the stored value, which predates
 *  this range and is only ever validated here. */
export function clampFrequency(times: number): number {
  if (!Number.isFinite(times)) return MAX_TIMES_PER_WEEK;
  return Math.min(
    MAX_TIMES_PER_WEEK,
    Math.max(MIN_TIMES_PER_WEEK, Math.round(times)),
  );
}

/**
 * One nudge of the stepper, clamped at both ends.
 *
 * It stops rather than wrapping: "every day" and "every 2 weeks" are
 * the ends of a range, not a loop, and a control that rolls over turns
 * an overshoot into the opposite of what was meant.
 */
export function stepFrequency(times: number, direction: 1 | -1): number {
  return clampFrequency(clampFrequency(times) + direction);
}
