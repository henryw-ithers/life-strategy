# ADR-0026: Task size and day load

> **Status:** Proposed\
> **Date:** 2026-09-11\
> **Deciders:** Henry

> **This fills a reserved slot.** ADR-0024 §6 deferred task size and
> the day-load meter to this number by name, with the trigger *"the
> weekly planning pass is in real use and 'is this day too full?' has
> come up unprompted."*
>
> **That trigger has not fired as written** — the weekly pass is not in
> heavy use. What pulled it forward is that **three separate parts of
> the commitments design need task size**, which is the same signal
> arriving by a different route.

## Context

ADR-0024 §6 deferred this and fixed its shape while doing so:

> Effort size (`quick | normal | big`, reusing `activity.size`'s
> vocabulary) and a per-day load indicator are the instrument for
> flow's challenge–skill balance, and the honest answer to "how long do
> I want to spend" — honest because minute estimates would inherit the
> planning fallacy, which the app cannot correct without task
> segmentation it has [not got].

Three things now need it:

1. **Window capacity** ([ADR-0033](0033-windows-and-pools.md)). Henry:
   *"how many tasks fit in a window is variable based on task size and
   window size."* A two-hour gap holds more than a twenty-minute one.
2. **"What fits here?"** — the useful question to ask of a free gap.
3. **Size-weighted allocation** — considered as a fix for big-ticket
   work being underpriced, and largely superseded by
   [ADR-0032](0032-the-commitment-band.md), but still the honest way to
   separate an essay from a reading *within* a budget.

Half of it already exists. `ONE_OFF_SIZE_RATE` in
`apps/mobile/src/db/tasks.ts:260` is `quick: 0.25, normal: 0.5, big: 1`
— *"the same three ratios logged activities use, so the sizes mean the
same thing wherever they appear."* One-offs are already priced by size;
recurring tasks are not.

## Open questions

1. Does every task get a size, or only some?
2. Does size affect what a task is worth?
3. What does a day-load indicator say, and may it ever be a warning?

## Decision

### 1. Size is `quick | normal | big`, optional, and never minutes

Same three values, same `ONE_OFF_SIZE_RATE` ratios, same meaning
everywhere — one effort vocabulary across activities, one-offs and now
recurring tasks.

**Never a minute estimate.** ADR-0024 §6's reasoning holds: minutes
inherit the planning fallacy, and the app cannot correct for it without
task segmentation it does not have. So window capacity is a rough fit —
*"about two normal things"* — not an arithmetic of minutes.

**Optional**, defaulting to unset rather than to `normal`. Per
PRODUCT.md principle 6, a person who never wants to think about size
should never have to, and an unsized task behaves exactly as tasks do
today.

### 2. Size does not change what a recurring task is worth

Deliberately narrow. Rank already prices tasks within a unit
(ADR-0003 §5), and letting size price them too would give one job two
mechanisms that can disagree — a `big` task ranked last, or a `quick`
one ranked first, and no answer to which wins.

So size is an input to **fit and display** only: window capacity, "what
fits here," and the load indicator. One-offs keep pricing by size
through `ONE_OFF_SIZE_RATE`, which is unchanged.

This leaves the door open: if real use shows rank alone underprices
genuinely large work, size-weighted allocation is a formula change to
be argued then, not smuggled in here.

### 3. Day load is shown, never warned about

A day's load is the sum of its sized tasks, displayed as a quiet
indicator on the planning surface.

**It may never become a warning.** No "this day is too full," no
colour change at a threshold, no refusal to add a task, no
recommendation to remove one. ADR-0008 forbids conditioning on a
shortfall, and a load meter that scolds is exactly the taskmaster
PRODUCT.md names as an anti-reference. It is also the closest thing in
this design to the `recommendedTaskRange` guidance Henry deleted on
2026-09-11 for telling the user how to live — an indicator that
*informs* is the honest version; one that *advises* is the version
that was already rejected.

**It never touches the grade.** Load is presentation, in the exact
sense ADR-0024 §2 means.

## Consequences

**Easier.** Windows can say what fits. The three parts of the
commitments design that need size get it from one place with one
vocabulary.

**Harder.** Another optional field on task creation, on a surface whose
whole job is that capture stays cheap. Mitigated by being optional and
unset by default — but it is a third question after "what is it" and
"how often," and capture friction is how ADR-0024's amendment describes
the failure of the description field.

**Accepted cost.** Deciding size does *not* price a recurring task
means the app knows an essay is big and still pays it by rank. That
will feel wrong at some point; §2 says what to do when it does.

**Revisit when:** rank alone demonstrably underprices large work in a
real plan, which is a formula-version conversation.

## Action items

1. [x] `task.size` (nullable `quick | normal | big`) and migration
       0015 landed with `setTaskSize` (2026-09-14); the optional
       control shipped in `TaskDetailPicker` (2026-09-15), closed by
       default and captioned *"shapes your day, not your points"* —
       because the obvious guess, that a bigger task is worth more, is
       wrong here (§2) and is a disappointment better avoided than
       discovered. A one-off is not asked twice: it answers "how big"
       in its own block, and `addTask` / `setTaskOneOff` mirror that
       answer into `size` so one effort vocabulary reaches window
       capacity and day load.
2. [x] Window capacity in `packages/scoring/src/windows.ts` —
       `windowCapacity`, `fitsInWindow`, `SIZE_HOURS`. A rough fit,
       never minutes, pure and tested.
3. [~] `dayLoadHours` computes it and deliberately returns a **bare
       number** — no threshold, no band, nothing a caller could colour
       red. A test asserts that shape. **The indicator itself is still
       unbuilt**, and §3 is the thing to re-read before building it:
       shown, never warned about.
4. [ ] Amend ADR-0024 §6 with a pointer here, noting the trigger that
       actually fired.
