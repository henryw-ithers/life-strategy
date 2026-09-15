# ADR-0033: Windows and pools

> **Status:** Proposed\
> **Date:** 2026-09-11\
> **Deciders:** Henry

## Context

[ADR-0024](0024-day-planning-is-intention.md) §3 groups the day into
**parts of day** — morning, afternoon, evening, anytime — and its
2026-08-17 amendment established that all three always render, an empty
one reading *Free*, because *"'Free until this afternoon' is the most
useful sentence this screen can say, and it is unsayable if the empty
half of the day is missing."*

A timetable changes what a day's shape *is*. Once some of the day is
occupied by things at fixed times, the useful division is not the three
parts of the day but the **gaps between the fixed things**.

Henry, 2026-09-11: *"you have classes and quizzes and assignments and
then in the free time the regular tasks appear. You choose which tasks
appear in which time period."*

Constraints already in force:

- **The daily surface stays checklist-simple** (PRODUCT.md principle 2)
  and **read-mostly with respect to planning** (ADR-0024 §4).
- **A placement is an intention that lapses silently** (ADR-0024 §2).
- **Granularity is the user's** (PRODUCT.md principle 6,
  [ADR-0030](0030-granularity-is-the-users.md)).
- **The app never shames**, and loss-aversion mechanics are a named
  anti-reference (PRODUCT.md).

## Open questions

1. What divides a day once it has fixed commitments in it?
2. What happens to work that does not get done in its window?
3. Must a window hold exactly one task?
4. How many hours does the grid draw?

## Decision

### 1. The day is always divided into windows

A **window** is a stretch of the day work can be placed into.

- **With commitments**, windows are the **gaps between them** — 30
  minutes or more. A shorter gap is **buffer**, not free time: fifteen
  minutes between two lectures across campus is not time you have, and
  a grid that offers it is lying to the person reading it.
- **Without commitments**, windows are **morning / afternoon /
  evening** — `part_of_day`, which `SectionedChecklist` already
  sections by.

One structure, two derivations, and the existing checklist renders
both. A weekend needs no special case: it is today's app.

This also settles a density problem the timetable would otherwise
create. **Sessions stop being extra rows in a flat list and instead
define the sections** — twelve lectures a week become the shape of the
day rather than twelve more checkboxes.

### 2. Work carries forward to the next window

Unfinished work appears in the next window — that evening, or the next
day.

The mechanism exists and is already proven non-punitive.
`task.one_off_date`'s comment: *"It never moves: rolling forward is a
display rule, not a write, so the original intention survives being
late."* So a window item reappears with **nothing recording that the
first window was missed**, which is what lets carry-forward coexist
with ADR-0024 §2's silent lapse rather than contradict it.

**Accumulation is accepted** (Henry): a backlog building across windows
is normal planner behaviour. The concern raised against it was that a
pile growing in front of you is the loss-aversion shape PRODUCT.md
names as an anti-reference; the call is that a planner which silently
drops what you did not get to is the worse failure.

### 3. A window may hold a pool of options

A **pool** is up to **three** candidate tasks, any of which satisfies
that window's intention. Commitment-based or not.

**All members of a pool are worth the same.** This is load-bearing: a
pool holding "write the essay (8)" beside "do the reading (3)" would
have the choice made by the scoreboard rather than by what the person
needs. Equal points make the choice **free** — pick on appetite,
energy or usefulness, and the number is indifferent.

**A pool carries a planned count**, usually one but legitimately "two
of these three." That count is what the pool contributes when the band
is divided:

| Pool | Counts as | Do one | Do two | Do three |
|---|---|---|---|---|
| 3 members, plan 1 | 1 task | 8 | 16 | 24 |
| 3 members, plan 2 | 2 tasks | 8 | 16 | 24 |

Per member the value is identical; **the planned count sets the day's
ceiling, not the payout.** Anything beyond it is beyond-plan work,
which ADR-0027 §1 asks for by name. The rejected alternative counted
every member regardless of intent, which inflates the ceiling with
options never meant to be taken, so an ordinary day would permanently
read as a partial one.

**Every completion pays in full**, including a second member in the
same window. Henry: *"if you manage to complete two S-tier tasks in one
window we should reward you for that."* Note this is **not**
`EXTRA_RUN_RATE` territory: that pays 50% for *the same task again*,
where the plan asked for three runs and the fourth is fairly worth
less. A second pool member is a **different task that was also
planned**, with only the choice undecided. The line:

> **Same task repeated → 50% (`EXTRA_RUN_RATE`, unchanged).
> A different planned thing → 100%.**

**A task may be completed at most once per window.** Without this,
"every completion pays in full" could be read as ticking one task three
times. It needs no scoring rule — a task may be placed at most once in
a window, so it can only be ticked once there. Uniqueness is scoped to
the **window**, not the pool: a window holding two pools must not carry
the same task in both. Extra runs are unaffected — `task_completion`
has no unique constraint on `(task_id, local_date)`, so a repeat simply
has to land in a *different* window.

**A pool must read as one choice with three routes, never a list of
three things owed.** This is a copy rule with research behind it —
Dalton & Spiller (2012) found the benefit of implementation intentions
does not extend to multiple goals *because planning surfaces the
difficulty and undermines commitment*, and their rescue was framing.
See the 2026-09-11 addendum in
[scheduling-and-motivation.md](../design/scheduling-and-motivation.md);
three is safe on choice-overload grounds, and framing is the lever.

### 4. The grid draws the span of the day's windows

Not a fixed range, and not just the blocks:

- The extent runs across the day's **windows**, so a 9am lecture with a
  free afternoon draws both. Deriving it from blocks alone would show
  one hour on a tall screen.
- The stretches before the first window and after the last **collapse
  to one row each** — *earlier* / *later* — tappable to expand to the
  full day.
- **A day with nothing planned needs no special case:** §1 makes its
  windows the three parts of day, so it draws those rather than an
  empty ruler.
- **The planning surface shows all 24 hours.** Display is bounded by
  the day; placement is not.

### 5. What may be dragged

Tasks drag into and between windows, reusing the grammar ADR-0024 §3's
2026-08-18 amendment built. Empty windows are drop targets — "do this
in the gap" matters most when the gap is empty, which is exactly when
there is no row to drop beside.

**Commitment blocks are inert.** Dragging a lecture would assert the
lecture moved, which is false. You may move what you set.

## Consequences

**Easier.** The day reads as its actual shape. Free time becomes
something the app can point at rather than something to infer. And
pools make a plan survivable: not doing the specific thing you wrote
down stops being a failure.

**Harder.** Two derivations of "window" have to stay consistent, and
the layout walk is the kind of code whose failure is silent — a row
placed in the wrong window and written there. It wants the same
treatment `checklistLayout.ts` got: pure, RN-free, heavily tested.

**Accepted cost.** Carry-forward accumulates, and on a bad fortnight
the pile will be visible. That is the deliberate trade in §2, and it is
the thing most likely to feel wrong in real use.

**Revisit when:** pools are used to avoid deciding rather than to stay
flexible — a plan of five windows each holding three options is a list,
not a plan, and Masicampo & Baumeister suggests it would not buy the
mental quiet planning is for.

## Action items

1. [x] Window derivation, gap vs buffer and the grid extent shipped as
       `packages/scoring/src/windows.ts` rather than `timetable.ts`
       (2026-09-14) — pure and tested. Eligibility ("does this happen on
       this date") reuses the checklist's own `isDueOn` instead of a new
       `occursOn`, so the day a task is *shown* and the day it is *paid*
       cannot diverge.
2. [x] `components/today/dayGridLayout.ts` and `DayGrid.tsx`
       (2026-09-15) — the pixel walk, pure and free of React Native
       imports, 32 tests. It computes its own bounds from the day's
       blocks rather than through `gridExtent`, and keeps only the
       display half of the window question: `clipWindows` trims what
       `windowsFor` returns to the hours actually drawn. The windows
       themselves still come from the scoring package, so what the grid
       draws and what a pool is priced against cannot drift.
3. [x] Pools: `pool`/`pool_member` (migration 0015), the planned count
       honoured by `bandPointValues`, and once-per-window uniqueness
       enforced in `commitmentPlan.poolProblem` and tested.
4. [~] `WindowSheet` asks *"Pick what might go here; any of them
       counts"* and the planned count is a separate question, asked
       only when there is more than one option. **Still to check on
       device:** that a window holding three options reads as one
       choice rather than as three outstanding tasks.
5. [x] `loadDayLayout` / `setDayLayout` in `db/settings.ts`, default
       `checklist`, with a List / Hours toggle on Home and on a pushed
       day (2026-09-15). The toggle appears only once the day has an
       hour to draw — and always once you are in the grid, since a view
       you can enter and not leave is a trap.
