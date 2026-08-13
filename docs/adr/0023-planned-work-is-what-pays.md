# ADR-0023: Planned work is what pays

> **Status:** Accepted\
> **Date:** 2026-08-13\
> **Deciders:** Henry\
> **Amends:** [ADR-0004](0004-grade-lifecycle-and-aggregation.md) §3, §4 ·
> [ADR-0009](0009-spontaneous-activities.md) §3, §4

## Context

A vacation exposed the grade as gameable in the direction the product
least wants: **days spent doing almost none of the intended routines
scored above 100**, consistently, and the number felt good while the
plan quietly lapsed. That is the opposite of what the app is for.
vision.md's premise is intentionality — deciding what deserves
attention and then giving it. A score that pays out just as well for a
day of pleasant novelty teaches the wrong lesson, and it teaches it
most loudly on exactly the weeks when routines are hardest to hold.

ADR-0009 predicted this in its own revisit clause: *"if users route
everything through activities and abandon tasks, the fill mechanic is
too generous."* The trigger has fired. Two independent mechanisms
produced it.

### Leak 1: activity credit is denominated on the wrong scale

Activity credit is `SIZE_RATE[size] × unitWeight`
(`quick 0.25 / normal 0.5 / big 1.0`, `db/today.ts`). But unit
**weights** sum to `DAILY_BUDGET` across the whole portfolio, while the
day's **denominator** is the weekly commitment spread over seven days —
`point_value × times_per_week ÷ 7` (ADR-0004 §4, formula v2).

Those are different scales, and nothing reconciled them. A unit
weighing 12 whose tasks run 3×/week contributes ≈5 to the day's
denominator; one "big" activity tagged to it credits the full **12** —
more than twice everything that unit's plan asks of the day.

On a realistic plan (half daily tasks, half 3×/week) the daily
denominator lands near 70, so a single big activity tagged to three
good units credits ≈30: **+42% of the day, for one logged event.** Two
of them clear 80% with no routine touched. Formula v3 had already
retired `BONUS_CAP`, so nothing bounded the total.

The sizes were doing no work either. Because credit scaled with full
weight, `quick` on three units already exceeded most individual tasks.

### Leak 2: special days ignore tasks entirely

`computeDayScore` returns `earned = rating × 10` for
`kind === "special"` and never consults the task list (ADR-0004 §3).
Rate a day 9 and it scores 90 regardless of what was done. On a
vacation, where most days are genuinely memorable, that is a standing
90+ with the checklist switched off.

## Open questions

1. How much of a day *should* come from unplanned work?
2. Are extra runs of planned tasks "planned" or "spontaneous"?
3. If special days stop being an automatic high score, what protects
   the genuinely exceptional day — a wedding, a funeral, an illness —
   from grading as a failure?

## Options considered

**Re-cap the bonus pool only (restore `BONUS_CAP`).** One-line revert.
Bounds the total but leaves the scale mismatch underneath, so sizes
stay meaningless and the cap does all the work.

**Fix the scale, no cap.** Correct arithmetic, and on most days
sufficient. But a day with several large activities can still
outproduce the plan, and there is no stated ceiling to reason about.

**Fix the scale *and* cap the unplanned share.** Two changes, one
principle. Costs a formula version and a re-explanation of the day's
number.

**Exclude activities from grading entirely.** Maximally aligned with
"the plan is what pays," and wrong: ADR-0009's core insight stands —
golf genuinely was exercise, and a life log that refuses to credit real
effort is dishonest in the other direction.

## Decision

### 1. At most `UNPLANNED_CAP` = 25 points of a day come from unplanned work

One shared pool, one sentence the user can hold: **at most 25 of your
100 can come from anything you didn't plan.** The rest has to come from
the tasks chosen while being intentional.

The pool is fed by:

- **activity credit** (ADR-0009), and
- **the special-day rating bonus** (§3 below).

It is a single shared ceiling, not an allowance per source, so a
memorable day cannot stack a full rating bonus on top of a full day of
logged activities. Credit is applied chronologically and truncated at
the cap, so the *first* things logged are the ones that pay — no
re-ordering games.

### 2. Extra runs sit outside the cap

A fourth run of a 3×/week task is not spontaneity; it is the plan,
done harder. It keeps `EXTRA_RUN_RATE` (50%) and is credited without
limit, alongside within-goal completions.

This is deliberate asymmetry: the one uncapped way to push a day above
100 is **doing more of your own planned work**. That is precisely the
behaviour the app exists to encourage, and it should not have to
compete with a logged brunch for the same 25 points.

### 3. Special days are graded, plus a rating bonus from the pool

A special day is now graded **exactly like a normal day** on its tasks,
plus a rating-scaled draw from the unplanned pool:

    specialBonus = round(rating ÷ 10 × UNPLANNED_CAP)

A 10-rated special day contributes 25; a 6-rated one contributes 15.
The bonus shares the pool with activity credit, so 25 is the ceiling
for both together.

The rating stays a 1–10 self-assessment and keeps its meaning; what
changes is that it now *supplements* the day's work instead of
replacing it. A wonderful day where the routines also held scores
higher than a wonderful day where they lapsed — which is the entire
point.

### 4. Rest days become **"Day off"**, and absorb the exceptional day

Making special days graded removes the escape hatch that ADR-0004 §3
relied on, so the escape hatch moves to where it always belonged.

The `rest` kind is **renamed "Day off"** in all user-facing copy and
its definition widens: rest, illness, travel, a wedding, a funeral —
any day where grading is not a meaningful question. Behaviour is
unchanged and already correct: **no grade, excluded from aggregates
entirely**, anything done still logs (ADR-0009 §4).

**The stored value stays `"rest"`.** Renaming the enum would need a
migration for a change that is purely a label, and ADR-0021's
reasoning applies directly: names are presentational. The DB keeps
`rest`; the UI says "Day off."

This leaves three kinds that finally divide cleanly by *question
asked*:

| Kind | The question | Grade |
|------|--------------|-------|
| Normal | How did the plan go? | Tasks |
| Special | How did the plan go, and how was the day? | Tasks + rating bonus |
| Day off | Not asked. | None; excluded |

### 5. Activity credit is denominated in the unit's daily share

    pointsCredited = round(SIZE_RATE[size] × unitDailyShare)

where `unitDailyShare` is the unit's own contribution to the day's
denominator — `Σ point_value × times_per_week ÷ 7` over its tasks —
rather than its portfolio weight. Credit and denominator finally live
on the same scale, and the sizes mean what they say: a `big` activity
is worth a unit's whole day, `normal` half of it, `quick` a quarter.

**A unit with no tasks credits nothing.** That follows from ADR-0003
§5: a task-less unit's weight is already reallocated to units that have
tasks, so it holds no share of the day to be credited against. This is
a real reduction from the old behaviour and the honest one — points
that were never in play cannot be earned.

### 6. `FORMULA_VERSION` bumps 4 → 5

The day's arithmetic changes materially: a stored `earned` from v4 and
one from v5 are not comparable. **History is not rewritten.** The seam
is real and stays visible, like ADR-0022's.

That claim was not free, and on first writing it was **false**.
`recacheAllDayScores()` re-derived every stored day at current weights
— a deliberate, documented trade while the only drift was a weight
change, but under a formula-version bump it would have re-scored a
tester's whole history weeks after the fact, collapsing v4 special
days from `rating × 10` the next time they ran a diagnostic. Two
changes make finalization mean what ADR-0002 always said it did:

- `recacheAllDayScores` **skips rows with `finalized_at` set**,
  reconciling only the days still inside the edit window.
- `loadDay` **reads a finalized day's grade back** from its stored row
  (`storedDayScore`) instead of recomputing it, so the day screen, the
  calendar tint, and the weekly and monthly grades all report the one
  historical number.

A settled day is now a fact rather than a function of today's weights.

## Consequences

- **Easier:** the day's number finally means "how much of what you
  meant to do got done"; activity sizes become meaningful; the one way
  to exceed 100 is doing more of your own plan; the three day kinds
  divide by a question rather than by scoring mechanics; the vacation
  failure mode is closed at both sources rather than masked at one.
- **Harder:** special days can now grade low, which is a shame risk the
  product invariants take seriously — "Day off" has to be genuinely
  discoverable, or someone will grind a low grade through a funeral
  because they did not know the option existed; a second formula seam
  lands in history two weeks after the first; the untasked-unit rule
  means logging a genuine activity in a unit you have no plan for
  earns nothing, which will feel wrong the first time it happens.
- **Revisit when:** ADR-0008's calibration can test whether the capped
  model tracks felt contentment better than the uncapped one did — this
  ADR is a hypothesis about motivation, and calibration is the
  instrument that can check it. Also if "Day off" usage stays near zero
  while low-scoring special days appear in the log: that is the
  discoverability failure above, showing up as data.

## Action items

1. [x] Add `UNPLANNED_CAP = 25`, bump `FORMULA_VERSION` to 5.
       *(`packages/scoring/src/constants.ts`.)*
2. [x] Rework `computeDayScore`: shared capped pool, extra runs
       outside it, special days graded on tasks plus rating bonus.
       *(`packages/scoring/src/grade.ts`.)*
3. [x] Re-denominate activity credit onto the unit's daily share.
       *(`apps/mobile/src/db/today.ts`.)*
4. [x] Rename `rest` to "Day off" in all copy and widen its
       description. *(`components/today/DayKindSheet.tsx`,
       `content/notificationCopy.ts`, `app/(tabs)/index.tsx`.)*
5. [x] Freeze finalized days: guard `recacheAllDayScores` on
       `finalized_at` and read stored grades back in `loadDay`, so the
       version bump cannot restate history. *(`db/today.ts`,
       `storedDayScore` in `packages/scoring/src/grade.ts`.)*
6. [x] Tests: pool never exceeds `UNPLANNED_CAP`; extra runs are
       exempt; a special day with no completions scores its bonus
       alone; an untasked unit credits zero.
7. [ ] Make "Day off" discoverable enough to carry its new load — the
       consequence above is the one most likely to bite. Needs a real
       look at the day-kind sheet, not just the rename.
