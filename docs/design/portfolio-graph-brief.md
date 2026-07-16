# Design Brief — PortfolioGraph

> Shaped and confirmed 2026-07-16 via /impeccable shape. Implemented as
> `apps/mobile/src/components/portfolio-graph/` with the dev spike
> route `src/app/dev/graph.tsx`.

## Summary

The app's centerpiece visualization: 16 life units as bubbles on
importance (y) × satisfaction (x), bubble size = measured effort,
rendered in React Native Skia. Built production-shaped from day one
(not a throwaway spike), exercised by a dev-only route with fake
snapshot data.

## Direction

- **Color:** the app is Restrained; this surface earns Full palette —
  six categorical area hues (one per SLA), OKLCH-composed at matched
  weight per theme, brand teal (hue 200) carried by Body/mind. No
  gap-heat or alarm colors — the "act" quadrant speaks through
  position (gentle by design).
- **Theme:** follows the app theme; both canvases first-class. Dark
  mode is the "jewel" rendering (luminous bubbles, light-path trails);
  light is the crisp analytical read.
- **Anchors:** Strack's HBR portfolio chart; Apple Health trend
  charts; Linear insights charts.

## Modes and states

Now (settle-in on mount only) · Compare (dashed ghosts + trails +
arrowheads vs. previous snapshot; "new" units get a dashed ring) ·
Playback (scrubber with haptic detents, UI-thread tween). Also:
first-snapshot uniform bubbles + "Bubbles grow as you log" hint;
excluded-from-scoring units render outlined; selection dims others;
legend chip focuses an area; reduced-motion collapses all tweens.

## Architecture commitments

- Reanimated shared values drive Skia props directly; React never
  re-renders during animation. This is the spike's pass/fail test.
- Accessibility: invisible 44pt pressable overlays at bubble positions
  carry per-unit labels ("Friendship. Importance 7 of 10…") — the
  accessible surface for Skia pixels. Overlays double as tap targets;
  small bubbles render on top; tapping a selected bubble cycles
  overlapping neighbors.
- Theme tokens in `src/theme/colors.ts`, OKLCH-composed → hex
  (contrast validated: ink ≥16:1, muted ≥6:1 on both canvases).

## Asserted defaults

Bubble radius 10–26pt; plot inset by max radius so nothing clips;
quadrant midlines at 5.5, hairline; axis labels "Importance ↑" /
"Satisfaction →" outside the canvas; 6-chip legend below; callout has
reserved height so the canvas never jumps.
