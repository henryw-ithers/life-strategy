# Design Brief — Diagnostic Flow

> Shaped and confirmed 2026-07-16 via /impeccable shape. Implemented as
> `apps/mobile/src/app/diagnostic.tsx` with `src/components/number-dial/`
> and `src/components/diagnostic/`; data layer in `src/db/diagnostic.ts`
> and `src/db/graph.ts`.

## Summary

The app's front door: rate all 16 SLUs on importance and satisfaction
(1–10) in six stepped screens (one per life area), save the snapshot
transactionally, and land on results where the portfolio graph renders
real data. Monthly ritual + anytime; always the full flow (ADR-0005).

## Direction

- Restrained base; each area step carries its categorical hue (accent
  rule, progress dot, dial highlight, Next button) — the same hue its
  bubbles wear on the graph.
- **NumberDial**: horizontal 1–10 scroll-snap carousel; centered digit
  scales/inks via scroll-driven UI-thread animation; haptic tick per
  detent (drags only); tap-to-jump; screen-reader adjustable with
  increment/decrement.
- Ratings start **unset** ("—") — no anchoring default; repeat runs
  prefill from the previous snapshot (confirm-or-nudge, ~2 min).

## Flow

Intro → 6 area steps (Next gated on all units rated; direction-aware
slide transitions; back walks steps) → transactional save (snapshot +
16 ratings + unit_weight rows from deriveWeights, stamped
formula_version; excluded units rated but unweighted) → results
(weights grouped by area, "100 points become your daily budget", then
PortfolioGraphView on real snapshots) → Done.

Mid-flow exit is guarded (usePreventRemove + confirm-discard); save
failure keeps ratings and offers retry; reduced motion collapses
slides and dial animation.

## Deferred (by design)

Override editing and the carry-over diff (nothing to show until tasks
exist); the trailing-28-day effort query (effort_points saves null →
uniform bubbles, ADR-0005's intended first-snapshot state).
