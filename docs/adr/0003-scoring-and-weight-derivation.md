# ADR-0003: Scoring and weight derivation

> **Status:** Accepted\
> **Date:** 2026-07-15\
> **Deciders:** Henry

## Context

Each active SLU gets a share of 100 daily points, derived from the
diagnostic (importance `I`, satisfaction `S`, both 1–10). vision.md
commits to: importance first, satisfaction-gap boost second, always
normalized to 100, everything overridable with recommendations still
shown. ADR-0002 materializes the results as `unit_weight` rows per
snapshot, stamped with a `formula_version`. This ADR defines formula
version 1.

## Decision

### 1. Weight formula (v1)

For each unit included in scoring:

    raw(u) = I(u) + g × max(0, I(u) − S(u))        with g = 0.5

    weight(u) = 100 × raw(u) / Σ raw(all included units)

- **Importance is the base.** A unit's weight is never below what its
  importance alone earns.
- **The gap term boosts, linearly.** I=8, S=3 → raw 10.5 vs. 8.0 for
  a satisfied unit of equal importance — a ~30% boost, noticeable but
  not domineering.
- **Surplus satisfaction (S > I): no boost, no penalty.** Weight =
  importance alone. Contentment with something unimportant neither
  earns nor costs points.
- **`g` is a named tunable** (`GAP_COEFFICIENT`), the first lever
  ADR-0008's contentment calibration is allowed to touch (per user,
  with consent). Changing `g` bumps `formula_version`.

### 2. Inclusion, not punishment by formula

- Archived units are excluded. The user may also deliberately
  **exclude** a unit from scoring (it stays in the diagnostic and on
  the portfolio graph, but holds no points).
- A unit that has weight but **no active tasks** keeps its weight: its
  points are simply unearnable, and the grade honestly reflects the
  neglect. The app's job is to surface this in the monthly review
  ("Friendship holds 9 points but has no tasks — add one or exclude
  it?"), not to silently re-normalize around it. Silent
  re-normalization would let deleting tasks inflate the rest — gaming
  by omission.

### 3. Rounding

User-facing weights are **integers that sum to exactly 100**, via the
largest-remainder method: floor everything, hand the leftover points
to the largest fractional remainders. The same method divides a unit's
weight across its tasks. Exact reals are kept internally; integers are
what users see and earn.

### 4. Overrides and rebalancing (hybrid)

- **Default: proportional auto-rebalance.** Overriding one unit's
  weight spreads the difference across all other included units in
  proportion to their current weights — one gesture, still 100.
- **Advanced: free reallocation.** An edit-all mode shows every
  unit's points with a live running total; the user reallocates freely
  and a **Normalize to 100** action resolves any residue (largest
  remainder again). The app never persists a non-100 state.
- Every overridden unit displays its derived value alongside
  (product invariant), and overrides reset-with-review at the next
  diagnostic (ADR-0002 decision 4).

### 5. Task point values: Beli-style ranking

Within a unit, tasks are **ranked, not priced**. Point values derive
from rank; the user never types a number (but may override one —
invariant applies).

- **Insertion:** adding a task triggers a short binary-comparison
  flow — "Which matters more: *Strength session* or *10k steps*?" —
  placing it by binary search in ~⌈log₂ n⌉ comparisons. With the
  recommended 1–3 tasks per unit this is usually one question.
- **Rank → points:** linear rank shares. With `n` tasks, rank `r`
  gets share `(n + 1 − r) / (n(n+1)/2)` of the unit's weight, rounded
  by largest remainder. (n=3 → 50% / 33% / 17%.)
- **Re-ranking:** available any time; the monthly review (ADR-0002
  decision 5) is the prompted moment. Point values recompute on any
  rank change — future days only, past completions keep their stored
  `points_earned` (ADR-0002).
- **Schema note:** adds `rank_in_unit` (integer, unique per unit
  among active tasks) to the ADR-0002 `task` table.
- **Cadence accounting** (how a weekly task's share lands on
  individual days) is deliberately left to ADR-0004.

### 6. Task-count guidance (recommendations, not enforcement)

| Unit weight | Recommended tasks |
|-------------|-------------------|
| ≥ 10 | 2–3 (mix of daily and weekly) |
| 5–9 | 1–2 |
| 3–4 | 1 (daily or weekly) |
| < 3 | one weekly task, or consider excluding the unit |

## Worked example

Three included units (illustrative; real portfolios have up to 16):

| Unit | I | S | raw | weight |
|------|---|---|-----|--------|
| Physical health | 9 | 4 | 9 + 0.5×5 = 11.5 | **53** |
| Friendship | 7 | 7 | 7.0 | **33** |
| Online entertainment | 3 | 6 | 3.0 (no penalty) | **14** |

Σ raw = 21.5 → 53.49 / 32.56 / 13.95 → largest remainder → 53 + 33 +
14 = 100. ✓

Physical health's 53 points across three ranked tasks (shares 3:2:1):
Strength session **26**, 10k steps **18**, Stretching **9** → 53. ✓

## Consequences

- **Easier:** the whole engine is a pure function (ratings + ranks →
  integer point values), unit-testable in the standalone `scoring`
  package from ADR-0001; one named constant is the calibration surface
  for ADR-0008; the ranking flow eliminates manual point entry — the
  original vision's Beli idea survives intact.
- **Harder:** the binary-comparison UI is bespoke v1 work; hybrid
  rebalancing means two editing modes to build; the "unearnable
  points" stance needs the monthly-review nudge to land, or it just
  feels like a leak.
- **Revisit when:** calibration data (ADR-0008) suggests a different
  `g` or a nonlinear gap term; if real portfolios make low-importance
  units feel spammy, revisit the task-count bands.

## Action items

1. [ ] Implement formula v1 + largest-remainder rounding in the
       `scoring` package, with property tests (sum always 100; weight
       monotone in I; no penalty when S > I).
2. [ ] Implement rank-share point derivation + binary-insertion
       comparison logic (pure functions; UI later).
3. [ ] Add `rank_in_unit` to the task schema (amends ADR-0002).
4. [ ] Resolve ADR-0004: cadence accounting and grade lifecycle now
       block the first end-to-end grade.
