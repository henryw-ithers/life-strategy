# ADR-0005: Diagnostic snapshots and portfolio history

> **Status:** Accepted\
> **Date:** 2026-07-15\
> **Deciders:** Henry

## Context

Each diagnostic is saved as a snapshot; the portfolio graph
(importance × satisfaction, bubble size = effort) shows change across
snapshots. Watching units migrate toward the top-right over months is
the emotional payoff of the whole system. This ADR fixes the cadence,
the carry-over experience, the bubble-size metric, the history
visualizations, and how the graph survives taxonomy edits.

## Decisions

### 1. Cadence: monthly prompt, available anytime, always full

- The app prompts a diagnostic **monthly**, as the opening act of the
  monthly review (amends ADR-0002 decision 5: diagnostic + goal/task
  review + monthly grade + achievements are one ritual).
- A diagnostic can be run **anytime** life changes — the app never
  refuses a reflection.
- It is always the **full 16-unit flow** (~5 minutes; ranked, not
  rated — see decision 7). No partial snapshots: every snapshot is
  complete and comparable, and the override reset (ADR-0002 decision
  4) stays tied to a deliberate, whole-portfolio act.
- Monthly cadence also gives the history playback (below) twelve
  frames a year — enough to feel like motion, not slideshow.

### 2. Diagnostics never destroy anything: carry-over by default

A new snapshot re-derives weights, but **goals and tasks all carry
over untouched by default**. The post-diagnostic flow is a diff, not a
rebuild:

- New derived weights appear beside the old (and beside old overrides,
  per ADR-0002's reset-with-review).
- Task point values **recompute automatically**: tasks keep their
  ranks, and rank shares (ADR-0003) simply rescale to the new unit
  weights. Ranking makes carry-over free — no one re-prices anything.
- Diff-driven prompts appear only where the diagnostic moved things:
  "Friendship rose to 12 points — add a second task?", "You excluded
  Societal engagement — pause its goal?"
- Accepting the defaults with zero edits is a first-class path.

### 3. Bubble size: measured effort, frozen per snapshot

- Bubble size = **points earned per unit over the trailing 28 days**
  — task completions plus activity credit (ADR-0009), normalized
  across units. Measured effort, not Strack's self-estimated hours.
- The values are **denormalized into the snapshot at creation**
  (`effort_points` on each rating row — amends ADR-0002), so
  historical graphs never restate. Reproducible-history rule applies.
- **First snapshot:** no effort data exists — bubbles render uniform
  and small, with a hint that they grow as life gets logged.

### 4. History visualization: compare mode and playback (both v1)

- **Compare mode with trails:** pick any two snapshots (default:
  latest vs. previous); each bubble draws an arrow from where it was
  to where it is. The instant read: "Friendship moved right, Job slid
  left."
- **Animated playback:** a time scrubber interpolates bubble
  positions and sizes across all snapshots. Built on the same Skia
  canvas (ADR-0001); compare mode is the fallback if playback slips,
  but both are in scope for v1.

### 5. SLU and SLA views

The graph toggles between the **16-unit view** (default) and a
**6-area rollup**: an area's position is the weight-weighted mean of
its children's ratings; its bubble is their summed effort. Rollups are
computed on demand, never stored (ADR-0002 decision 6).

### 6. Taxonomy drift rules

- **Renames** are labels (ADR-0002): history always displays the
  current name.
- **Units added** after a snapshot appear only in snapshots that rated
  them; in compare/playback they enter marked "new," with no trail.
- **Archived units** ghost out of the current view but remain in
  historical snapshots where they were rated.
- **Excluded-from-scoring units still plot** — the diagnostic is about
  the whole life, not just the scored part (ADR-0003 decision 2).

### 7. Ranked, not rated (amended 2026-07-22)

Absolute 1–10 dials for importance and satisfaction had no guard
against ceiling-clustering: when most units genuinely feel important,
most dials land 6–10, and the gap term becomes the only thing doing
any differentiating work. Replaced with **relative ranking on both
axes**, hierarchical to keep the comparison count sane:

- Within each area, rank its units by priority ("which needs more
  attention right now?"), then again by satisfaction ("which are you
  more satisfied with?") — Beli-style binary insertion, the same
  mechanism ADR-0003 decision 5 already uses for tasks.
- Rank the six areas against each other the same way, once per axis.
- A unit's area rank and within-area rank combine into one overall
  position per axis; `rankToScore` maps that position onto a
  continuous 1–10 (rank 1 of n → 10, rank n → 1) — the same range the
  formula and the bubble chart have always used, so `deriveWeights`
  (ADR-0003), the graph, compare mode, and playback are all unchanged
  downstream of the diagnostic.
- Ranking guarantees full-range spread on both axes every single
  diagnostic, by construction — regardless of how important everything
  subjectively feels, someone is always ranked last.
- `rating.importance`/`rating.satisfaction` widen from integer to real
  (amends ADR-0002) — rank-derived scores aren't generally whole
  numbers.
- **Not built this pass:** carry-over prefill for rankings (today's
  diagnostic is always cold-start-ranked; the dial era's "confirm last
  month's numbers" convenience doesn't yet have a ranking equivalent —
  a drag-to-reorder starting from the previous order is the likely
  shape, shared with the still-deferred task re-rank gesture).

> **Amended 2026-07-30 (re-ranking without a diagnostic):** the
> Portfolio tab's primary job is now the priority order, and the graph
> is a preview that opens full-size. Priority can be re-ordered at any
> time, as **one flat list of units**.
>
> *Corrected same day:* it shipped with a second "Areas" mode that
> moved whole areas as blocks, and that mode **destroyed data**. The
> flat list deliberately allows interleaving across areas — which is
> exactly what the diagnostic's own final review produces and what
> `finalOrder` treats as the source of truth — and any area-level move
> must regroup units into contiguous blocks, silently discarding every
> cross-area decision behind it. The two representations cannot both be
> authoritative and the flat one determines the weights, so the mode
> was removed rather than patched. Bringing area moves back means going
> genuinely hierarchical (area order and within-area order stored
> separately, composed by `combineHierarchicalRank`) and giving up
> interleaving — a product decision, not a UI convenience.
>
> **A re-rank writes `unit_weight.override`; it never mints a
> snapshot.** Snapshots are immutable and they *are* this ADR's
> history. A re-rank is not a diagnostic: satisfaction has not been
> re-assessed, so creating a snapshot would plot points on the
> portfolio graph the user never gave and feed ADR-0008's divergence
> statistic invented data. The snapshot keeps recording what was
> actually said; the adjustment is recorded as the override the schema
> has always had.
>
> - **Priority only.** Satisfaction is an assessment rather than a
>   preference, and stays with the diagnostic that captured it — which
>   is also what keeps the monthly ritual worth doing.
> - **The rank denominator includes unscored units**, matching
>   `buildEntriesFromRanking`: the diagnostic ranks everything and
>   filters afterwards, so filtering first would hand the same order
>   different weights. `weightsForPriorityOrder`
>   (`packages/scoring/src/ranking.ts`) owns that rule and is tested on
>   it.
> - **Commits on drop, no confirm step.** A drag is already deliberate
>   and the points beside each row move with it, so the consequence is
>   on screen rather than in a dialog. A manual order is remembered
>   against its snapshot id, so a fresh diagnostic supersedes it — you
>   just restated the order in full.
> - **A weight change refreshes both caches it feeds.**
>   `task.point_value` (read by `loadPlan` and `loadDay`) *and*
>   `day_grade.points_earned/possible` (read by the calendar, the week
>   and the month). *(Both were latent bugs predating this feature:
>   `saveDiagnostic` refreshed neither, so a new diagnostic's weights
>   reached the checklist only when some unrelated task edit happened
>   to touch that unit, and the calendar never agreed with the day
>   screen's own number at all — that number is computed live while the
>   calendar reads the cache.)*

## Consequences

- **Easier:** the monthly ritual is one coherent ceremony (rate →
  review → carry over → grade); rank-based pricing makes re-diagnosis
  cheap enough to actually do monthly; frozen effort values keep every
  historical graph honest; measured bubbles surface
  importance-vs-effort mismatches Strack's estimates can't.
- **Harder:** two history visualizations is real Skia work (the
  ADR-0001 spike should now include a trail and a tween); monthly
  override resets mean the review screen must be genuinely fast or it
  becomes nagware; 28-day effort needs a backfill-safe query (the
  ADR-0004 edit window can alter effort up to 3 days back — snapshots
  taken mid-window accept that noise).
- **Revisit when:** users skip monthly diagnostics repeatedly (maybe
  the prompt should adapt); if first-snapshot uniform bubbles confuse,
  consider a one-time self-estimated-hours seed.

## Action items

1. [x] Amend ADR-0002: `rating` gains `effort_points`; monthly review
       decision now includes the diagnostic. (Both landed:
       `rating.effortPoints` in `apps/mobile/src/db/schema.ts`, and
       ADR-0002 decision 5 now opens the monthly ritual with the
       diagnostic. The ritual itself is still unbuilt — no screen.)
2. [x] Extend the ADR-0001 Skia spike: bubble trails + position tween
       between two snapshots. (Shipped in the PortfolioGraph component:
       compare trails + playback scrubber, verified on-device.)
3. [x] Implement the 28-day effort query (completions + activity
       credit per unit). (Shipped: `trailingEffort()` in
       `apps/mobile/src/db/diagnostic.ts` freezes normalized effort
       into `rating.effort_points` at snapshot time.)
4. [x] Design the post-diagnostic diff flow (weights, overrides,
       task-count prompts, carry-over defaults). (Shipped: weight
       deltas, task-count prompts, and goal-aware exclusion prompts —
       `loadDiagnosticDiff()` in `apps/mobile/src/db/diagnostic.ts`,
       the `"diff"` phase in `apps/mobile/src/app/diagnostic.tsx`.
       **Overrides gained their editor on 2026-07-30**: the Portfolio
       tab is now a re-rankable priority list that writes
       `unit_weight.override` — see the amendment below.)
5. [x] Implement decision 7 (ranked, not rated): `rankToScore` +
       `combineHierarchicalRank` (`packages/scoring/src/ranking.ts`),
       the hierarchical ranking flow (`apps/mobile/src/app/diagnostic.tsx`,
       `components/diagnostic/RankGroup.tsx`, reusing
       `components/ui/PairwiseRank.tsx`), and the `rating` column
       widen to `real`. Carry-over prefill for rankings not yet built
       (see decision 7).
