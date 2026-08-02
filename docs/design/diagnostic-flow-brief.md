# Design Brief — Diagnostic Flow

> Shaped and confirmed 2026-07-16 via /impeccable shape. Implemented as
> `apps/mobile/src/app/diagnostic.tsx` with `src/components/number-dial/`
> and `src/components/diagnostic/`; data layer in `src/db/diagnostic.ts`
> and `src/db/graph.ts`.

> **Revised 2026-08-02** for [ADR-0022](../adr/0022-satisfaction-is-rated-not-ranked.md):
> the two axes now use different instruments. The dial-era brief below
> described 1–10 dials for both; ADR-0005 §7 moved both to ranking, and
> ADR-0022 moved satisfaction back.

## Summary

The app's front door: rank all 18 SLUs by priority, rate each on
satisfaction (1–10), save the snapshot transactionally, and land on
results where the portfolio graph renders real data. Monthly ritual +
anytime; always the full flow (ADR-0005).

**Why two instruments.** Priority is a preference — meaningful only
against the rest of the list, and ranking guarantees full-range spread
where dials cluster at the ceiling. Satisfaction is an assessment with
an absolute referent, and the weight formula subtracts it as one. See
ADR-0022 for the arithmetic that forced the split.

## Direction

- Restrained base; each satisfaction step carries its area's categorical
  hue (progress dot, dial highlight) — the same hue its bubbles wear on
  the graph. The primary action stays app-accent: three of the six
  light-theme hues fail 4.5:1 as a button fill.
- **RankGroup**: drag-to-reorder list; a row tap opens the unit's
  guidelines sheet.
- **NumberDial**: horizontal 1–10 scroll-snap carousel; centered digit
  scales/inks via scroll-driven UI-thread animation; haptic tick per
  detent (drags only); tap-to-jump; screen-reader adjustable with
  increment/decrement.
- Satisfaction starts **unset** ("—") — no anchoring default, and
  **no carry-over prefill**, deliberately: showing last month's number
  anchors against the fresh assessment the axis exists for. Priority
  *does* want prefill from the previous order; not built yet
  (ADR-0005 §7, ADR-0021 §4).

## Flow

Intro → rank the 6 areas by priority → drag the full 18-unit priority
list (seeded by the area ranking) → 6 satisfaction steps, one per area,
3 dials each (Continue gated on all three rated; direction-aware slide
transitions; back walks steps) → review → transactional save (snapshot +
18 ratings + unit_weight rows from deriveWeights, stamped
formula_version; excluded units rated but unweighted) → post-diagnostic
diff where weights moved → results (weights grouped by area, "100 points
become your daily budget", then PortfolioGraphView on real snapshots) →
Done.

Mid-flow exit is guarded (usePreventRemove + confirm-discard); save
failure keeps ratings and offers retry; reduced motion collapses
slides and dial animation.

## Deferred (by design)

Carry-over prefill for the priority ranking (ADR-0005 §7's open gap;
ADR-0021 §4 wants it before the area step can go first-run-only).
Satisfaction prefill is not deferred — it is refused, see Direction.

*Resolved since the original brief:* override editing (the Portfolio
tab's re-rankable priority list), the carry-over diff
(`loadDiagnosticDiff`), and the trailing-28-day effort query
(`trailingEffort`) have all shipped.
