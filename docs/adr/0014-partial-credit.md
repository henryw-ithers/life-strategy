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

Finishing on a later day pays only what is left, which falls out of the
sum rather than needing a rule. Points denormalize at each completion
exactly as they do now, so a day that banked 50% keeps 50% when the
rest lands on Friday — ADR-0002's "history never restates" holds with
no special handling.

### 3. Payment: the rounded running total, minus what is already paid

    pay = round(total fraction so far × value) − points already paid

A 3-point task marked 25% pays **1**; the next 25% pays **0**; reaching
75% pays **1** more. The total can never exceed the task's value, and
each step is individually honest.

Without this rule, four quarter-marks pay 4 points on a 3-point task —
`fraction × value` does not land on integers, and rounding each step
independently either overpays or silently pays nothing.

**A partially completed pool member earns `fraction × V`.**
ADR-0033 §3's "every completion pays in full" is about *multiple
members*; this is about *fractions*. Orthogonal.

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

1. [ ] `task_completion.fraction` and `task.allows_partial`; migration.
2. [ ] The rounding rule in `packages/scoring`, pure and tested,
       including the four-quarter-marks case.
3. [ ] Long-press picker; verify tap-to-complete is unchanged.
4. [ ] Decide what a partial day means for `computeStreak`.
5. [ ] Copy review against §5 — progress, never deficit.
6. [ ] Amend ADR-0004 §2 with a pointer here, recording that the
       calibration gate did not fire and why this proceeded anyway.
