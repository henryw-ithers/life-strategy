# ADR-0019: Tasks that serve more than one unit

> **Status:** Accepted\
> **Date:** 2026-07-27\
> **Deciders:** Henry

## Context

Until now a task belonged to exactly one Strategic Life Unit:
`task.unit_id` was a non-null foreign key, and `task.point_value` came
from `rank_in_unit` via ADR-0003's rank shares — the unit's weight
divided linearly across its ranked tasks.

Real tasks don't respect that boundary. A morning walk is Exercise &
fitness *and* Nature. Cooking is Nutrition *and*, some nights,
Significant other. ADR-0009 already accepted this for spontaneous
**activities**, which tag up to three units and denormalize credit per
tag. Planned tasks had no equivalent, so the only options were to pick
one unit and under-count the work, or duplicate the task and check it
off twice.

## Decision

### 1. Membership moves to `task_unit`

A new table holds one row per (task, unit) pair:

- **`task_unit`** — task_id, unit_id, rank_in_unit, point_value;
  PK (task_id, unit_id)

Every task has at least one row. `task.unit_id` remains, now meaning
the **home unit** — where the task is grouped and listed — and always
has a matching membership row.

### 2. A shared task takes a rank slot in every unit it serves

It is ranked independently in each unit and earns each unit's share
from ADR-0003's formula. Completing it once credits all of them.

This is the decision the alternatives lose to:

- **Primary-scores-only** (extra units as labels) makes the second
  unit decorative — which is precisely the thing that made linking
  worth doing.
- **Splitting one slot's points across the units** makes a task worth
  *less* for doing double duty, penalising exactly the behaviour the
  model should reward.

**The 100-point invariant is untouched.** Each unit still divides only
its own weight across only its own ranked tasks. Nothing about a
shared task changes any unit's total.

**The grade does not inflate.** ADR-0004's denominator counts each
task's `day_share` once, from `task.point_value` — which is the *sum*
of that task's memberships. A shared task raises both the numerator
and the denominator by the same amount. It is worth more because it
occupies more of the plan, and it costs more when skipped.

### 3. `task.point_value` stays, as a cache

It holds the sum of the task's memberships. The scoring engine,
`computeDayScore`, and `task_completion.points_earned` keep taking one
number per task, so ADR-0004's arithmetic needs no changes at all.
`recomputeUnitPoints` refreshes the cache for every task it touches.

### 4. A task counts if *any* of its units is scored

An excluded unit (`include_in_scoring = false`) already contributes a
weight of 0, so it adds nothing to a shared task's total. Filtering the
daily checklist on the *home* unit alone would therefore drop points
the task legitimately earned elsewhere. The filter is membership-wide.

### 5. Three units is the cap

Matching ADR-0009's limit for activities. Past three, the link stops
describing the task and starts describing the taxonomy.

## Consequences

- **Easier:** the plan can describe real life without duplicate tasks;
  the daily checklist stays one row per real action; activities and
  tasks now share one mental model for multi-unit credit.
- **Harder:** a task's point value is no longer readable from one
  unit's list in isolation — reordering in one unit changes its total
  everywhere it appears, which the UI has to make legible (it shows
  "Also counts toward …" on every shared row). `recomputeUnitPoints`
  now cascades across units rather than staying local.
- **Revisit when:** the recommendation library (ADR-0006) starts
  proposing tasks, since a template will need to express default
  memberships; or if per-unit *partial* credit is ever wanted, which
  this deliberately does not model.

## Action items

1. [x] Add `task_unit`; migration 0006. *(Additive; `apps/mobile/
       drizzle/0006_plain_war_machine.sql`.)*
2. [x] Backfill one membership per existing task, archived ones
       included. *(`backfillTaskUnits`, `apps/mobile/src/db/
       migrations.ts` — guarded by an `app_setting` flag.)*
3. [x] Rework `recomputeUnitPoints` onto memberships and keep
       `task.point_value` as their sum. *(`apps/mobile/src/db/
       tasks.ts`.)*
4. [x] Membership-wide filter in the daily checklist.
       *(`loadDay`, `apps/mobile/src/db/today.ts`.)*
5. [ ] Teach ADR-0006's content-package schema to express default
       memberships for recommended tasks.
