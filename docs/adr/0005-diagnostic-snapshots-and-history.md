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
- It is always the **full 16-unit flow** (~5 minutes of sliders). No
  partial snapshots: every snapshot is complete and comparable, and
  the override reset (ADR-0002 decision 4) stays tied to a deliberate,
  whole-portfolio act.
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

1. [ ] Amend ADR-0002: `rating` gains `effort_points`; monthly review
       decision now includes the diagnostic.
2. [x] Extend the ADR-0001 Skia spike: bubble trails + position tween
       between two snapshots. (Shipped in the PortfolioGraph component:
       compare trails + playback scrubber, verified on-device.)
3. [ ] Implement the 28-day effort query (completions + activity
       credit per unit).
4. [ ] Design the post-diagnostic diff flow (weights, overrides,
       task-count prompts, carry-over defaults).
