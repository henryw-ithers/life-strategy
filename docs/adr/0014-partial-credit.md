# ADR-0014: Partial credit

> **Status:** Proposed\
> **Date:** 2026-09-11\
> **Deciders:** Henry

> **This fills a reserved slot, and its gate has not fired.** ADR-0004
> §2 says completion is binary in v1, and that `task_completion`
> *"anticipates a partial-credit fraction column; it gets added only if
> ADR-0008 calibration shows all-or-nothing grading diverges from felt
> contentment."* **No such calibration exists** —
> `meetsColdStartGate` has not been satisfied by anyone.
>
> The argument for proceeding is that the premise changed, not that the
> gate is inconvenient. See Context.

## Context

ADR-0004 §2 chose binary completion for a good reason — *"done or not
done — one tap, checklist feel"* — and gated any change on evidence
from the calibration experiment.

**Windows change what binary completion is measured against.**
[ADR-0033](0033-windows-and-pools.md) divides the day into windows and
puts work into them. Before windows, *"I worked on it and did not
finish"* was **invisible**: no object in the app represented the two
hours you spent, so there was nothing for a fraction to attach to. A
window makes it a visible, recurring event — and binary completion
against a *window* is wrong in a way it was not obviously wrong against
a *day*.

That is the same shape of argument ADR-0030 used against ADR-0024 §1:
the premise the original decision rested on moved, so the decision's
own logic licenses revisiting it.

Henry, 2026-09-11: *"if you genuinely work the full window but don't
complete the assignment, we'll still give you part of it."*

> **Worth noticing:** this is the **second reserved ADR pulled forward
> in one session** ([ADR-0026](0026-task-size-and-day-load.md) is the
> other), in both cases because the commitments design demanded it
> rather than because the stated trigger fired. Both are defensible.
> A third would be a signal that this design is asking more of the app
> than the app was built to promise.

Constraints already in force:

- **One tap, checklist feel** (ADR-0004 §2) — the constraint the
  reserved slot names explicitly: *"the completion-fraction model and
  its UI without breaking one-tap simplicity."*
- **History never restates** (ADR-0002).
- **Nothing conditions on a shortfall** (ADR-0008).

## Open questions

1. Which tasks may be partially completed?
2. Where does the fraction live, and how does finishing later work?
3. How is a fraction of an integer paid?
4. How does it read?

## Decision

### 1. Partial completion is a per-task toggle, set when the task is made

Not a property the app infers. *"Brush teeth, 50%"* is meaningless, and
a fraction picker on every habit is what the reserved slot warns
against — but the app deciding which tasks qualify (by size, by being a
one-off) is the app prescribing again.

So: a toggle, off by default, on where it makes sense. This is
PRODUCT.md principle 6 — the app offers the capability, the user says
where it applies.

### 2. Fractions are 25 / 50 / 75, and later completions pay the remainder

`task_completion` gains the `fraction` column ADR-0004 §2 anticipated.

**Progress is the sum of a task's fractions**; at 1.0 it is done. No new
state on `task`, and therefore no state that can disagree with the
completion history.

> **Amended 2026-09-15: the sum is scoped, and this section did not say
> so.** Taken literally — every fraction a task ever recorded, across
> every day — the rule is right for a one-off and catastrophic for a
> recurring one. Building it proved that: a daily habit completed
> yesterday summed to 1.0, so its second completion paid
> `round(1×v) − round(1×v)` and the task was worth **nothing from its
> second day onward**, for the rest of its life.
>
> The scope is what this section meant and failed to write down:
>
> - **A one-off accumulates across days.** That is what makes
>   "finishing on a later day pays only what is left" work.
> - **A recurring task starts again each day.** Its Tuesday is a fresh
>   instance, not a continuation of its Monday, and within a day
>   picking again *replaces* the day's fraction rather than adding to
>   it — there is one completion row per task per day.
>
> A related defect fell out of the same omission: a one-off with any
> completion at all was treated as settled and disappeared from the
> list the next day, so a task you did a quarter of could never be
> finished. **Settled means progress reached 1**, not touched.

Finishing on a later day pays only what is left, which falls out of the
sum rather than needing a rule. Points denormalize at each completion
exactly as they do now, so a day that banked 50% keeps 50% when the
rest lands on Friday — ADR-0002's "history never restates" holds with
no special handling.

### 3. Payment: the rounded running total, minus what is already paid

    pay = round(total fraction so far × value) − points already paid

On a 3-point task the four quarters pay **1, 1, 0, 1**. The steps are
uneven because each is the rounded total so far minus what has been
paid, and `round(1.5)` is 2 — that unevenness is the mechanism working,
not a defect. The total is always exactly the task's value, and no step
can overpay.

> **Corrected 2026-09-11.** An earlier draft of this section claimed
> the quarters pay 1, 0, 1, 1. The totals were right and the breakdown
> was not; building it and testing the arithmetic is what showed the
> difference.

Without this rule, four quarter-marks pay 4 points on a 3-point task —
`fraction × value` does not land on integers, and rounding each step
independently either overpays or silently pays nothing.

**A partially completed pool member earns `fraction × V`.**
ADR-0033 §3's "every completion pays in full" is about *multiple
members*; this is about *fractions*. Orthogonal.

> **Amended 2026-09-15: the day's number has to be told.** This section
> describes what a completion *records*, and `task_completion.points_earned`
> records it correctly — but the grade is not built from that column.
> `computeDayScore` sums what completed tasks are **worth**, so a task
> somebody did a quarter of was credited in full and the day's number
> disagreed with the row underneath it.
>
> `DayTaskInput` gained `earnedToday`, and it is **omitted for every
> whole completion** — which is every row written before `fraction`
> existed. A day with no fractions therefore scores exactly what it
> scored before, which is what ADR-0002 requires.

### 4. One tap survives

**Tap = done.** Long-press opens the 25/50/75 picker.

Press-and-hold is already the app's grammar for a row's second action —
completion tagging (ADR-0025) and moving between parts of day
(ADR-0024 §3) both use it. So the checklist gains nothing on its
surface and the default gesture is unchanged.

### 5. It renders as progress, never as deficit

*"50% done"*, never *"incomplete"* and never *"half-finished."* The
feature exists to give credit that would otherwise be lost; presenting
it as a shortfall would invert its purpose and trip ADR-0008.

No colour state, no threshold, no prompt to finish.

### 6. Not to be unified with `goal_progress`

ADR-0015 §7 makes goal progress explicitly **not** a scoring event:
*"no points, no denominator, no effect on any day's number."* Partial
completion **is** one. They look alike, they are not, and a later
refactor that merges them would silently make goal progress pay.

## Consequences

**Easier.** Working a full window without finishing stops paying
nothing, which is the case windows make common and visible.

**Harder.** Completion is no longer a boolean anywhere downstream, and
every consumer of `task_completion` has to decide what a fraction means
to it. The grade is fine — it sums points — but statistics like streaks
need an explicit answer to "does 50% count as a day?"

**Accepted cost.** The fraction is self-reported and the planning
fallacy says people will overestimate progress. The app does not verify
anything else either, so this is consistent rather than new — but it is
the first number a person supplies that directly moves their grade.

**Revisit when:** calibration data finally exists, which is what this
ADR's gate was waiting for. It may say the fractions are too coarse,
too generous, or unnecessary.

## Action items

1. [x] `task_completion.fraction` and `task.allows_partial`; migration
       0015 (2026-09-14).
2. [x] The rounding rule in `packages/scoring/src/partial.ts`, pure and
       tested, including the four-quarter-marks case. Building it
       corrected §3's worked example — see the note there.
3. [x] `PartialSheet` on long-press, `setCompletionFraction` behind it,
       and `DayTaskInput.earnedToday` carrying the result into the
       grade (2026-09-15). **Tap is unchanged on an untouched row and
       on a finished one; on a part-done row it finishes rather than
       clearing**, so tap always moves forward until the task is done
       and undo lives on the sheet and on the completed row.
       `toggleCompletion` no longer takes a fraction — a toggle that
       also carried a value was two operations wearing one name, and
       the picker needs to *replace* a day's fraction rather than
       toggle it off. Building this surfaced the three defects
       amended into §§2–3; each has a test, and the `earnedToday`
       path is mutation-tested.
4. [x] **Decided 2026-09-30: a part-done day counts.** Henry:
       *"progress isn't linear and some days showing up is what
       counts."* A 25% completion extends a daily task's run and counts
       toward a week's count, which is what the code already did by
       reading every completion row; the streak query now says so, so
       nobody filters it to whole completions later.
       **And a part-credit task shows no weekly count at all.** Henry:
       *"for a task that has part credit, why would the 3 of 5 this
       week note even exist?"* It measures the wrong thing — a quarter
       on Monday and a quarter on Tuesday read as "2nd of 3", true of
       the rows and false of the work. Its line is its progress, or its
       run if it is daily, or nothing. One-offs lost the count for the
       same reason: "1st of 1 this week" states a cadence they do not
       have. `rowCaption`, tested.
5. [~] The sheet and the row count up — "Half done", "Takes you to
       75%" — and no copy names a remainder. Worth one more read on
       device against §5.
6. [ ] Amend ADR-0004 §2 with a pointer here, recording that the
       calibration gate did not fire and why this proceeded anyway.
