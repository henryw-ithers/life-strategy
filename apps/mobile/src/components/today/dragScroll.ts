/**
 * How fast the page scrolls under a dragged row (Henry, 2026-11-07:
 * "the whole screen should be a ramp"). Only a band across the middle
 * stays still, so you can place a row among the ones in view; from
 * there to either edge the speed climbs, slowly at first and then fast,
 * so a row reaches the far end of a long day in a second or two.
 *
 * Pure, so it's tested off-device; `DayDrag` reads it every frame from
 * where the finger is now.
 */

/** The share of the screen, top and bottom, that scrolls. */
export const RAMP_SHARE = 0.38;
/** Points a frame at the very edge. */
export const MAX_STEP = 34;
/** Points a frame where the ramp begins, so it starts moving at once. */
const MIN_STEP = 2;

/** Points to scroll this frame: negative is up, 0 holds still. */
export function rampStep(y: number, screenHeight: number): number {
  if (screenHeight <= 0) return 0;
  const zone = screenHeight * RAMP_SHARE;
  const depth = y < zone ? (zone - y) / zone : y > screenHeight - zone ? (y - (screenHeight - zone)) / zone : 0;
  if (depth <= 0) return 0;
  const d = Math.min(1, depth);
  const speed = MIN_STEP + (MAX_STEP - MIN_STEP) * d * d;
  return Math.round(y < zone ? -speed : speed);
}
