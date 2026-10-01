# ADR-0035: Commitments are custom units

> **Status:** Accepted 2026-10-01\
> **Date:** 2026-09-11 (rewritten; first drafted 2026-09-08)\
> **Deciders:** Henry

> **This ADR was rewritten, not amended.** Its first draft described a
> *parallel academic module* — `term`, `course`, `assessment`,
> `fixed_commitment`, `study_session`, `term_result`, a second
> hierarchy beside `SLA → SLU → Goal → Task`, and a mode switch
> ([ADR-0034](0034-schedule-mode.md), now withdrawn) to hide it from
> anyone not at university. Henry generalised it twice: *"make it more
> general so it can apply to things outside of school as well,"* then
> *"commitments basically behave like an SLU with its own weighting."*
> Seven tables became two columns. Nothing of the first draft's schema
> survives; its refusals do.

## Context

A university course looked like something the app had no room for. It
is not, and the thing it actually needed was already half-built.

**`life_unit.is_custom` already exists**, and `syncTaxonomy`
(`apps/mobile/src/db/seed.ts:92`) already spares custom units from
archival so a user-created unit survives every taxonomy revision.
**Nothing writes it. No screen has ever set it.** This is the same
situation ADR-0027 §2 found with `include_in_scoring` — a column read
in several places and written by nothing.

**The problem that forced this, and it was arithmetic rather than
modelling.** Measured against the live scoring engine with a realistic
18-unit plan and `education-learning` at weight 12:

| Plan | What each school task is worth |
|---|---|
| 2 school tasks | 13 and 7 |
| 13 school tasks | 1, 1, 1, 1, 1, 1, 1, 1, **0, 0, 0, 0, 0** |

**Five of thirteen tasks are worth literally zero.** The variable band
is 20 points for *all* non-daily work in the app; a semester is almost
entirely non-daily; and `bandPointValues` skips its one-point floor
when a band cannot pay everyone. ADR-0027 predicted exactly this in its
own source — *"20 points cannot finely price 20+ non-daily tasks.
Beyond that the tail rounds to zero whatever the rule."*

So the real blocker is that **the model assumes few, repeated tasks per
unit, and a semester is many, varied, non-daily tasks.**

Constraints already in force:

- **Areas are presentational** (ADR-0021). A soft attribute may decide
  colour and grouping, never a stored score. It notes that a
  weight-carrying area *"has been built once and it destroyed data."*
- **Coverage decides the ceiling** (ADR-0027).
- **The app never shames** (ADR-0008); nothing may condition on a
  shortfall.
- **History never silently restates** (ADR-0002).

## Open questions

1. Is a course a goal, a parallel model, or a unit?
2. How does school stop starving its own tasks?
3. What keeps commitment work visible to effort and the life log?
4. What must this model refuse?

## Options considered

- **Courses as goals in `education-learning`.** Rejected: a goal is
  something you chose and may pause or revise (ADR-0007); a timetable
  is not. And five courses in one unit is the arithmetic above.
- **A parallel academic module.** The first draft. Rejected on
  generalisation — it could not hold a club, a job or a team without
  becoming a second general-purpose model, and it gave the app two
  hierarchies where its README advertises one.
- **A commitment is a goal kind holding `session` tasks.** An
  intermediate pass. Rejected: a thing that carries weight and holds
  tasks is unit-shaped, and goals do not carry weight.
- **A commitment is a custom unit.** **Chosen.**

## Decision

### 1. A commitment is a custom `life_unit`, in two levels

A **commitment** — School, Work, Basketball Club — is a `life_unit`
with `is_custom = true`, carrying its own weight and holding its own
tasks. Inside it sit **sub-commitments** (School → COMP2521,
MATH1231), via a new nullable `life_unit.parent_unit_id`.

- **At most three commitments.** Sub-commitments are **uncapped**.
- **A task may hang off a commitment directly**, not only off a
  sub-commitment — "School" holds work belonging to no single class.
- **Sub-commitments do no arithmetic.** They group tasks and say which
  course something belongs to; [ADR-0032](0032-the-commitment-band.md)
  divides the band across eligible *tasks*, so sub-commitments price
  nothing and are purely organisational.
- **Ending is `archived_at`.** The weight returns to the pool, past
  snapshots keep the course, and the log still shows the semester
  happened.

One table, so `task.unit_id`, `task_unit`, `task_completion` and the
whole scoring path are reused unchanged. **What separates a commitment
from a life unit is its band (ADR-0032), not its table.**

`life_area` is deliberately **not** reused as the parent level.
ADR-0021 forbids an area carrying weight and records that building one
destroyed data.

### 2. Commitments are weighted, not diagnosed

The diagnostic keeps rating the **18 life dimensions** on importance
and satisfaction, and stays 18. A commitment carries a weight only.

So a commitment is correctly absent from the portfolio graph **as a
bubble** — that plots importance × satisfaction, and bubbles appearing
and vanishing each semester would make month-to-month comparison
lumpier for nothing.

It also settles a vocabulary problem: AGENTS.md defines an SLU as a
*dimension of living*, and COMP2521 as a peer of Family and Sleep is a
stretch. As a scoring bucket sharing the table, it is not.

### 3. Commitment tasks may tag life units — as `note`, never `scoring`

A commitment task may carry a `task_unit` row in an ordinary life unit,
and that row **must be `membership = 'note'`**, which ADR-0025 §5
already defines as *"touches the unit without taking a slot or earning
anything: no rank, no points, feeds effort and the log only."*

`scoring` is prohibited here: a task earning from the commitment band
**and** a life unit's band would double-pay across two bands, which is
the one route to inflating a day.

This recovers what §2 gives away. A basketball commitment feeds
`exercise-fitness` effort and classes feed `education-learning`, so the
portfolio graph and the life log see the semester even though the
scoring does not.

### 4. What this model refuses, by name

Inherited from the withdrawn [ADR-0031](0031-the-semester-score.md) and
kept as properties of the model rather than of a score:

- **No mark, grade or result column, anywhere.** Every course app has
  one; this one must not. The app measures effort and consistency,
  never outcomes, and a mark column is the shame surface arriving
  through the schema — in the one place where the number is not even
  the app's to report.
- **No absence record**, so no `attended ÷ scheduled` and no attendance
  percentage. Nothing anywhere records that you did *not* do
  something. That makes the model **structurally incapable** of
  noticing a missed lecture, which is stronger than the copy rule
  ADR-0008 would otherwise require, and it closes ADR-0024's
  still-open action item 4 rather than reopening it.
- **No adherence statistic** (ADR-0024 §2), restated because a
  timetable makes one look computable for the first time.

## Consequences

**Easier.** School stops starving its own tasks: measured under an
earlier flat variant, splitting it into its own buckets took its total
from 8 points to 15 and **removed every zero-point task**. The app
keeps one hierarchy. A club, a job and a team all fit the same object.
And `is_custom` finally gets a writer.

**Harder.** `life_unit` now holds two kinds of thing, and every query
over units has to know which it is looking at. The three refusals in §4
are permanently tempting and have to be re-refused by reviewers rather
than by the type system.

**Accepted cost.** Capping commitments at three is the app having an
opinion, which sits against PRODUCT.md principle 6. It is a guardrail
rather than a prescription — sub-commitments are uncapped, so a
semester of any size fits — but it is an opinion and it should be
revisited if three ever proves wrong.

**Revisit when:** a fourth commitment is genuinely needed; or
`life_unit` holding two kinds starts producing bugs where a query
forgets to filter.

## Action items

1. [x] Migration 0015: `life_unit.parent_unit_id` (nullable,
       self-reference) and `commitment_share` (2026-09-14).
2. [x] `TABLES_IN_DELETE_ORDER` in `db/reset.ts` fixed (2026-09-14).
       It listed 19 tables against the schema's 20. Writing a test that
       derives the true order from the schema found **two ordering bugs
       as well as the three missing tables** — the constant's own
       "children before parents" comment was false in more ways than
       this ADR knew. `resetCoverage.test.ts` now fails if it drifts
       again.
3. [x] `createCommitment`, `createSubCommitment`, `updateCommitment`,
       `archiveCommitment`, `unarchiveCommitment` and
       `deleteCommitment` in `db/commitmentWrites.ts`, with the
       Commitments surface and a commitment's detail screen over them
       (2026-09-15).
4. [x] Enforced at the write seam (2026-09-30): `membershipsFor`
       decides every row `addTask` and `setTaskUnits` write, making a
       commitment task's life-unit tags `note` and **refusing a
       commitment anywhere but first** — a life task that merely also
       counted toward School would have nowhere to be paid from. The
       picker applies the same rule (`selectUnit`: a commitment moves
       to the front; a second replaces the first), and says what the
       other chips now do: *"Paid from School · also noted in
       Learning."* Pricing reads scoring rows only, so a note cannot be
       paid even if one is written by some other route. Both rules are
       tested and mutation-tested.
5. [x] AGENTS.md: vocabulary rows for Commitment and Sub-commitment,
       and the invariant that a commitment task never takes a scoring
       slot in a life unit.
6. [x] **Commitments are not listed among the 18** (2026-09-30).
       `loadPlan` returns them separately, because a commitment is a
       custom unit and was reaching the Tasks screen as an excluded
       life unit — one tap from "Put back in my plan", which would have
       made School one of the 18. They now have their own groups after
       the areas, where their tasks edit and delete like any other.
       Finishing a commitment pauses its tasks, and starting it again
       now brings back exactly those; it used to restore the units and
       leave every task inactive.
