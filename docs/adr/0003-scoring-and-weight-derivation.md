# ADR-0003: Scoring and weight derivation

> **Status:** Accepted\
> **Date:** 2026-07-15\
> **Deciders:** Henry

## Context

Each active SLU gets a share of 100 daily points, derived from the
diagnostic (importance `I`, satisfaction `S`, both 1–10 — amended
2026-07-22 per ADR-0005 decision 7: rank-derived, so not necessarily
integers, but the same 1–10 range and meaning). vision.md
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

- **Insertion (amended 2026-07-30):** a new task **appends last** in
  each unit it joins, and the screen opens that unit with the row in
  view so it can be dragged where it belongs. The original decision
  was a binary-comparison flow at creation — "Which matters more:
  *Strength session* or *10k steps*?", ~⌈log₂ n⌉ questions — and it
  was built (`PairwiseRank`). It came out because the cost lands on
  every single add, at the one moment the user is least able to pay
  it: mid-capture, about a task they are still wording. Ranking is
  unchanged as a concept and as maths; it moved to the list, where the
  drag grip already lives and where you can see what you're comparing
  against. Cost of the change: a task starts at the smallest share of
  its unit until it's moved. The comparison UI stays in the app — the
  diagnostic (ADR-0005 decision 7) is its remaining caller, and there
  the ranking *is* the task rather than a toll on it.
- **Rank → points:** linear rank shares. With `n` tasks, rank `r`
  gets share `(n + 1 − r) / (n(n+1)/2)` of the unit's weight, rounded
  by largest remainder. (n=3 → 50% / 33% / 17%.)
- **Point floor (added 2026-07-30):** every task in a scoring unit is
  worth **at least 1 point**. Shares alone sent the tail to zero as
  soon as a unit's task count approached its weight — a 3-point unit
  with three tasks paid 2/1/**0** — and a zero-point task is not a
  small task but a dead one: `dayShare` keeps it out of the day's
  denominator, so ticking it cannot move the grade, and the checklist
  offers a row that does nothing. One point is reserved per task and
  only the surplus is ranked. The worked example below is unchanged
  (53 across 3 is still 26/18/9); small units and long lists flatten a
  little (10 across 2 was 7/3, now 6/4), which is accepted — rank
  orders tasks, it doesn't delete them, and near-even task values
  within a unit are fine. Two edges: a unit with **zero weight** (not
  in scoring) stays at zero throughout, floor included; a unit holding
  **more tasks than points** spends `n`, a point or two above its
  weight, which §6 already advises against and which is the better
  trade than a dead row.
- ~~**Uncovered weight is reallocated (added 2026-07-30)**~~ —
  **withdrawn 2026-08-18 by
  [ADR-0027 §2](0027-coverage-decides-the-ceiling.md).** A unit's weight
  now stays its own: if nothing under it can earn those points, nobody
  earns them, and the day is graded out of the user's whole life rather
  than out of whichever corner of it they planned. The paragraphs below
  are kept as the record of what was tried and why it read as an
  improvement at the time — reallocation was answering a real problem
  (a half-covered portfolio graded against half a plan) with the tool
  available before the diagnostic had an exclusion control. ADR-0027 §2
  answers the same problem by letting the user say a unit does not
  apply, which is the honest version of the same move.

  What replaced it: `spendableWeights` is retired, `spendable`
  collapses back into `weight`, and coverage now decides a plan's
  *ceiling* rather than redistributing its *points*.

- **Uncovered weight is reallocated (added 2026-07-30):** a unit with
  no tasks spends nothing, so its weight is divided among the units
  that do have tasks, **in proportion to their own weight**. Integer
  results still sum to exactly 100 (`spendableWeights`, largest
  remainder). One task covers a unit; a unit's own weight is untouched
  on the diagnostic and in history — this is only the question of what
  today's checklist is scored against.

  *Why:* `dayShare` counts only tasks that exist, so an uncovered
  unit's weight sat outside the day's denominator entirely. A
  half-covered portfolio graded against half a plan, and a user could
  score 100 while ignoring 60 points of what they said mattered.

  **Amended 2026-08-16 (formula v6,
  [ADR-0025 §3](0025-communal-units-are-dimensions.md)): "covered"
  means the unit has somewhere to spend its weight — not that it holds
  tasks.** A **communal** unit holds no tasks and never will, but
  tagging is always available to it, so its weight *is* earnable and it
  is covered. Reading coverage as "holds tasks" made the three
  Relationships units donate their weight to chores, which inverted the
  product's founding claim that this app starts with what matters.
  `spendableWeights` is unchanged; the definition its callers pass in
  is what moved.

  *Why proportional to weight, not to task count:* routing points
  toward whichever unit holds the most tasks would let the shape of
  execution outrank the diagnostic — a 5-point unit with three tasks
  would matter more in a day than a 12-point unit with one — and it
  would reward writing more tasks, the one lever entirely under the
  user's hand. Scaling by weight leaves the strategy's order exactly
  as the diagnostic set it.

  *Rejected for now:* grading coverage against §6's recommended counts
  (a 15-point unit with 1 of a recommended 2 spending only half). It
  makes adding a task to one unit quietly move points in another,
  which is a lot of motion to explain for a nudge §6 already gives in
  words.

  *Consequences:* a unit's task points can no longer be derived from
  that unit alone, so every recompute is portfolio-wide
  (`recomputeAllUnitPoints`; the per-unit entry point is gone).
  Activity credit still prices off the **raw** unit weight (ADR-0009):
  a spontaneous act in an uncovered unit is exactly how that unit
  earns, and those numbers were designed against a 100-point day —
  which, before this, is not what they were landing in.

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

1. [x] Implement formula v1 + largest-remainder rounding in the
       `scoring` package, with property tests (sum always 100; weight
       monotone in I; no penalty when S > I). (Shipped:
       `packages/scoring/src/weights.ts` + `rounding.ts`, tests in
       `__tests__/weights.test.ts`.)
2. [x] Implement rank-share point derivation + binary-insertion
       comparison logic (pure functions; UI later). (Shipped:
       `packages/scoring/src/tasks.ts` (`rankShares`/`taskPointValues`);
       UI in `components/ui/PairwiseRank.tsx`.)
3. [x] Add `rank_in_unit` to the task schema (amends ADR-0002).
       (Shipped: `task.rankInUnit`, `apps/mobile/src/db/schema.ts`.)
4. [x] Resolve ADR-0004: cadence accounting and grade lifecycle now
       block the first end-to-end grade. (Accepted; the grade runs end
       to end, daily through monthly.)
