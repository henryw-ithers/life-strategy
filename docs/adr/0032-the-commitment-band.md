# ADR-0032: The commitment band

> **Status:** Proposed\
> **Date:** 2026-09-11\
> **Deciders:** Henry

> **This is a scoring formula change — v7 → v8.** Read
> [ADR-0027](0027-coverage-decides-the-ceiling.md) first; this adds a
> third band to the two it established and makes the day's split
> date-dependent for the first time.

## Context

[ADR-0029](0029-commitments-are-custom-units.md) gives a commitment its
own `life_unit`, which stops a semester's tasks competing for one
unit's share. It is not enough on its own. Measured: splitting school
into five units took its total from 8 points to 15 and removed every
zero-point task, but **each individual task was still worth about 1**,
because ADR-0027's variable band is **20 points for all non-daily work
in the entire app** and five courses were carving the same 20.

A semester is almost entirely non-daily work. So the binding constraint
is not how units are arranged; it is the 80/20 split itself.

Constraints already in force:

- **The day's denominator is a constant 100** and *"a day cannot be
  worth more than a day"* (ADR-0027).
- **Planned work is what pays** (ADR-0023); `EXTRA_RUN_RATE = 0.5` is
  the rate for beyond-plan repetition, sitting outside `UNPLANNED_CAP`.
- **Plans never touch the grade** (ADR-0024 §2) — amended in §4.
- **History never silently restates** (ADR-0002).
- **Nothing may condition on a shortfall** (ADR-0008).

## Open questions

1. Where do commitment points come from?
2. What happens on a day with no commitment work?
3. How big is the band, and who decides?
4. How is it divided?

## Options considered

- **Scale the band by the day's share of the week's commitment load.**
  Tried on paper and rejected: it makes school roughly 8% of a week
  rather than the 40% intended.
- **A flat band on every day.** Rejected: a Sunday with no classes
  would carry unearnable points and cap at 60 through no fault of the
  user — the app conditioning on somebody else's timetable.
- **A flat band on days with scheduled commitment work only.**
  **Chosen.**

## Decision

### 1. Three bands, on days with scheduled commitment work

    commitment band   — user-set, 10–60 in steps of 5
    routine band      — 80% of what remains
    variable band     — 20% of what remains

**A day with no scheduled commitment work is an ordinary 80/20 day**,
untouched. The band exists only on days it can be earned, which is what
stops an empty Sunday capping below 100.

**The band is fixed, not scaled by the day's load.** Henry's argument,
and it is the right one: a day with less scheduled genuinely *is* a day
with more free time, so life tasks being worth more on it is correct
modelling rather than an artefact.

### 2. The size is the user's; the cap is a flat 60

10 to 60, in steps of 5, **whatever the number of commitments**. An
earlier proposal scaled the cap 60/70/80 by count and was withdrawn on
the arithmetic:

| Band | Life pool | Routine | A daily habit at weight 9 |
|---|---|---|---|
| — (today) | 100 | 80 | ~7 pts |
| 60 | 40 | 32 | ~3 pts |
| 80 | 20 | 16 | **~1 pt** |

At 80, all 18 life units share 20 points and their daily habits sit on
the **one-point floor** — the same floor that produced the zero-point
finding in ADR-0029, with no resolution left to tell sleep from
exercise from nutrition. A flat 60 keeps the worst case at ~3 and means
**life always keeps at least 40%**.

The floor and ceiling are the app having a mild opinion, against
PRODUCT.md principle 6. Defensible: 0 makes the feature pointless, 100
deletes the rest of a life from a scheduled day.

### 3. Division: by commitment, then across that day's eligible tasks

- **Between commitments**, by user-set shares — School 50 / Work 30 /
  Basketball 20.
- **Only among commitments with eligible tasks that day.** If only
  School is scheduled on Monday, School takes the **whole band**; the
  other shares do not sit dead and cap the day at 70. This is §1's
  empty-Sunday reasoning one level down.
- **Within a commitment**, across **every eligible task that day** —
  scheduled sessions *and* assignment work planned for that day. Not
  across sessions alone, or a Friday holding one tutorial would pay the
  whole share for one hour in a room.
- **Sub-commitments take no cut.** They group tasks and price nothing
  (ADR-0029 §1).

A light day paying more per task is **not** a bug. It is
`taskPointValues(unitWeight, taskCount)` — a unit's whole weight goes
to its single task, a fifth each when there are five — with the divisor
scoped to a day instead of a plan. Finish the week early, attend the
one Friday class, earn the commitment's full share.

### 4. This amends ADR-0024 §2, knowingly

ADR-0024 §2 is an invariant: *"Doing three runs on three days you did
not plan is a perfect week, scored identically."* Under this ADR, a
commitment task done on its scheduled day pays from the commitment
band, and the same work done on an unscheduled day pays from the
ordinary variable/unplanned route instead. **When you do it changes
what it is worth.**

Henry's reasoning, and it is recorded as his: *"you would simply lose
out on points on Thursday and then gain some points for doing it on
Sunday. I don't think that's unfair or incorrect."* Thursday pays
nothing because Thursday's work did not happen; Sunday pays from the
unplanned pool because unplanned work is what that pool is for. That is
ADR-0023 behaving normally rather than a schedule-violation penalty.

**ADR-0024 §2 otherwise stands in full** — no adherence rate, no
plan-completion percentage, no streak, and an unfulfilled placement
still lapses silently.

### 5. Formula version 8; history does not restate

`FORMULA_VERSION` 7 → 8. Days graded under v7 keep their stored values
and their stamp (ADR-0002). `recacheAllDayScores` already exists and
already honours the `finalized_at` guard ADR-0023 added.

> **Not yet bumped (2026-09-11).** The band is built and tested, but
> `FORMULA_VERSION` stays at 7 until the app actually passes a
> `CommitmentDay`. A version stamp records how a grade was *derived*,
> and nothing's derivation has changed while every caller still omits
> the parameter — moving it early would mark a whole era of days as
> belonging to a formula they were not graded under. It moves with the
> first caller.

## Consequences

**Easier.** A semester's work is worth something. **Measured** against
the engine, with a band of 40 and a realistic 18-unit plan: five tasks
eligible on a Monday price at **8 points each**, and thirteen eligible
on one day price at **3–4 each** — against the `1,1,…,0,0,0` the
two-band model produced. Commitment work stops competing with every
weekly task in the app for the same 20 points.

The §2 table is also measured rather than reasoned: a weight-9 daily
habit is **7 points** on an ordinary day and **3** at a band of 60,
exactly as tabulated.

**Harder.** The day's split is now **date-dependent**, which is new.
`task.point_value` can no longer be a single stored number that means
one thing — the Tasks screen shows a task's value *for that day*
(Henry's call), which keeps the column honest but makes it contextual.
And the band is a third thing to explain in a scale that had two.

**A limit measurement found, and the band does not remove it.** When a
day's eligible commitment tasks outnumber the band's points, the
one-point floor is dropped and the tail rounds to zero — thirteen tasks
eligible on one day against a band of 10 leaves three worth nothing.
This is the property ADR-0027 already records for the variable band
(*"20 points cannot finely price 20+ non-daily tasks"*), reappearing at
the bottom of this band's range.

The band **raises** the threshold rather than curing it: the old model
hit this with thirteen non-daily tasks at any setting, and the new one
needs them all eligible on a single day at the lowest band. Raising the
band fixes it, and that is the user's own lever — measured, 25 is
enough for thirteen. Covered by tests in `commitmentBand.test.ts`.

**Accepted cost.** On a scheduled day your life tasks are worth up to
40% less than on a free one — the same gym session, different value,
because you had a tutorial. That is inherent to school being 40% of a
school day, and it is the property ADR-0027 spent a rewrite removing in
its other form. If this ADR proves wrong, this paragraph is what was
wrong.

**Revisit when:** a term of real use shows the band is generous or
stingy, which is what building it behind tests will indicate before any
of it reaches a screen.

## Action items

1. [~] `packages/scoring`: third band in `bandPointValues` and
       `dayCeiling` — **built 2026-09-11**, 21 tests, pure and free of
       React Native imports, behind an optional parameter so a day with
       no eligible commitment work is byte-for-byte what it is today
       (all 188 pre-existing tests pass unchanged).
       **`FORMULA_VERSION` is not yet bumped** — it moves when the app
       starts passing a `CommitmentDay`, not when the capability lands,
       so no stored grade changes meaning before there is anything to
       change it.
2. [x] **Run a real plan through it before building UI.** Done
       2026-09-11 — the §2 table and the Consequences figures are now
       measured, and measuring found the low-band tail described above.
3. [x] `life_unit.commitment_share` (migration 0015); the band size is
       one number for the whole app and lives in `app_setting` under
       `commitment.band`, since there is no row it belongs to. Its
       sheet states what the setting costs in real points rather than
       leaving a percentage to be interpreted (2026-09-15).
4. [x] ADR-0024 §2 points at §4 here; ADR-0027 records the extension.
5. [x] AGENTS.md carries both.
