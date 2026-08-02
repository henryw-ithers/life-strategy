# ADR-0022: Satisfaction is rated, not ranked

> **Status:** Accepted\
> **Date:** 2026-08-02\
> **Deciders:** Henry\
> **Amends:** [ADR-0005](0005-diagnostic-snapshots-and-history.md) §7

## Context

ADR-0005 §7 replaced the diagnostic's absolute 1–10 dials with relative
ranking **on both axes**, to fix ceiling-clustering: when most units
genuinely feel important, most dials land 6–10 and the gap term ends up
doing all the differentiating work.

It fixed the axis it was aimed at and broke the other one.

Both axes run the same `rankToScore` over the same set of units, so they
produce **identical multisets of values**. Therefore, on every
diagnostic, for every user:

    Σ I = Σ S = 99          mean(I − S) = 0 exactly

The weight formula's gap term is `max(0, I − S)`. Summed, that is
`½ Σ|I − S|` — a pure measure of **disagreement between two orderings**.
How satisfied the user actually is cancels out by construction.

Three stated commitments this contradicts:

1. **vision.md's mechanism is false as implemented.** "As satisfaction
   improves in later diagnostics, the boost naturally shrinks and points
   flow to the next gap." It cannot: if life improves uniformly and the
   order holds, `S` is bit-identical and so are the derived weights.
2. **The portfolio graph's x-axis is pinned.** ADR-0005 and vision.md
   both call watching bubbles migrate toward the top-right "the
   emotional payoff of the whole system." Under ranked satisfaction the
   x-axis is a permutation of the same values every snapshot — bubbles
   swap places, the cloud never drifts right. A year of real improvement
   renders as a reshuffle.
3. **Forced spread invents a crisis and hides a real one.** Someone
   always ranks last, so some unit always sits at S=1 — manufacturing a
   large gap boost in a life where nothing is wrong. In reverse, the
   least-bad thing in a bad life sits at S=10 and gets no boost at all.

ADR-0005 had already written down the distinction that resolves this,
while justifying why re-ranking outside the diagnostic is priority-only:
**"Satisfaction is an assessment rather than a preference."**

## Open questions

1. Does the ceiling-clustering argument apply to satisfaction?
2. What happens to snapshots taken under the old scale?
3. What shape does rating eighteen units take, without undoing the
   simplification ADR-0005 §7 bought?

## Options considered

**Keep both axes ranked.** No migration, no seam in history, one
instrument to explain. Costs the graph's central promise and makes
vision.md's stated mechanism untrue.

**Return both axes to 1–10 dials.** Symmetric and simple. Reintroduces
exactly the ceiling-clustering ADR-0005 §7 was right to kill: priority
is a preference among things that are all genuinely important, and
absolute dials cannot discriminate between them.

**Rank priority, rate satisfaction.** Asymmetric, which needs
explaining, and puts a scale boundary in history. Matches what the two
quantities actually are.

## Decision

### 1. Priority is ranked. Satisfaction is rated 1–10.

The asymmetry is the point, and it follows from what each axis is:

- **Priority is a preference.** It is only meaningful relative to the
  rest of the list — there is no absolute scale of "how important is
  friendship," which is why vision.md reframes it as "where the unit
  stands in your life right now." Ranking is the correct instrument, and
  it guarantees full-range spread by construction.
- **Satisfaction is an assessment with an absolute referent.** Are you
  actually satisfied? The weight formula *subtracts it as if it were
  absolute*, so it needs to be.

**Why ceiling-clustering doesn't carry over.** Clustering on importance
is **measurement failure** — the instrument cannot separate things that
are all genuinely important. Clustering on satisfaction is a
**finding**: it means life is going well, and the correct response is
flatter gap boosts with importance driving the weights, which is what
the formula already does unaided.

### 2. `FORMULA_VERSION` bumps 3 → 4

The arithmetic in `deriveWeights` is untouched. The *inputs* change
meaning, which is what the version stamp exists to record: a stored
satisfaction of 3 means "3rd-lowest of 18" under v≤3 and "quite
dissatisfied" under v4.

### 3. History is not rewritten, and the graph says why

Snapshots are immutable (ADR-0002) and their stored numbers are what the
user actually gave. Converting old satisfaction values to the new scale
would be inventing data, and deleting old snapshots would destroy the
history this ADR's parent exists to protect.

Instead the boundary is **stated**. `GraphSnapshot` carries
`satisfactionScale: "ranked" | "rated"`, derived from the snapshot's
`formula_version`, and compare mode and playback say so when the span
on screen crosses it: *"Satisfaction used to be ranked, not rated —
sideways movement across that change isn't real."* Honest about the one
thing the graph cannot show, rather than tweening through it silently.

### 4. Flow: rate by area, one screen each, gated

- Two priority steps (rank the areas, then drag the full unit list),
  unchanged.
- Then **one screen per area**, three dials each. Each rating is an
  independent judgement, so there is nothing to compose and nothing to
  seed; three at a time fits without scrolling.
- **Ratings start unset ("—") and Continue is gated** on every unit in
  the area carrying a number. There is no defensible default: an unrated
  unit would fall back to a value the user never gave and quietly move
  their weights. `buildEntries`' internal fallback is a unit's own
  importance — gap exactly 0, neither manufacturing nor hiding a
  deficit — but the gate means it should never fire.
- **No carry-over prefill for satisfaction, deliberately.** Absolute
  self-ratings drift, and showing last month's number is anchoring bias
  against precisely the fresh assessment this axis is for. This is the
  opposite of the call for priority, where prefill is wanted
  ([ADR-0021](0021-areas-are-presentational.md) §4) — because restating
  an order is a different act from re-judging a level.
- `ProgressDots` goes back to one dot per area wearing that area's hue,
  which is the presentational work ADR-0021 leaves areas.

## Consequences

- **Easier:** the graph's x-axis can finally move, which is the feature
  the whole history visualization was built for; vision.md's
  gap-shrinking mechanism becomes true; satisfaction ratings become
  usable ground truth for ADR-0008's calibration in a way rank positions
  never were; the satisfaction half of the ranking machinery retires
  (`DiagnosticAxis` is gone, `buildSequence` no longer doubles).
- **Harder:** history has a permanent seam, and the graph carries a
  sentence explaining it; self-report drift is now a real source of
  noise across snapshots, where ranking was immune to it; the diagnostic
  has two different instruments to explain rather than one.
- **Revisit when:** drift becomes visible in practice — if a user's
  satisfaction ratings trend without their life doing so, an anchor
  ("last month you said 6") is the fix, and its anchoring cost becomes
  the lesser evil. Also if ADR-0008's calibration finds the gap
  coefficient `g` wants retuning against absolute rather than relative
  satisfaction; `g` was chosen when the two axes had identical spreads.

## Action items

1. [x] `buildEntriesFromRanking` → `buildEntries(areas, priorityOrder,
       satisfaction)`; `suggestOverallOrder` loses its axis parameter;
       `DiagnosticAxis` retired. *(`apps/mobile/src/db/diagnostic.ts`.)*
2. [x] Bump `FORMULA_VERSION` to 4 with the reasoning inline.
       *(`packages/scoring/src/constants.ts`.)*
3. [x] Rework the diagnostic flow: per-area satisfaction steps with
       `NumberDial`, gated Continue, `ProgressDots` back on areas.
       *(`apps/mobile/src/app/diagnostic.tsx`,
       `components/diagnostic/ProgressDots.tsx`.)*
4. [x] Surface the scale boundary on the graph.
       *(`GraphSnapshot.satisfactionScale`, `db/graph.ts`,
       `PortfolioGraphView.tsx`.)*
5. [ ] Revisit `GAP_COEFFICIENT`. At g=0.5 the gap term was tuned
       against two axes with identical spreads; absolute satisfaction
       makes real gaps both rarer and larger, so the same coefficient
       may now boost harder than intended. Needs real snapshots to
       judge, not arithmetic.
6. [x] Update [diagnostic-flow-brief.md](../design/diagnostic-flow-brief.md),
       which still described the pre-ranking dial era on both axes.
