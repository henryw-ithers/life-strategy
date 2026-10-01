# ADR-0027: Coverage decides the ceiling

> **Status:** Accepted\
> **Date:** 2026-08-18\
> **Deciders:** Henry

> **What Henry decided (2026-08-18), and what is drafted around it.**
> Five calls are his and are recorded as made: doing every daily task
> tops out around **80**, with the remaining 20 for weekly and
> spontaneous work; a grade above 90 must mean you went beyond your
> plan; the weight of a unit you hold no tasks in is **not
> redistributed**; `UNPLANNED_CAP` **becomes** that 20 rather than
> sitting on top of it; and communal units are **treated like any
> other unit**, with a soft warning rather than a separate mechanism.
> Everything else below — the band arithmetic, the exclusion valve, the
> fate of tagging, and the action items — was drafted around those
> calls.

> **Extended 2026-09-11 by [ADR-0032](0032-the-commitment-band.md)**
> — formula v8 adds a **third band** on days with scheduled commitment
> work, and makes the day's split date-dependent for the first time.
> The two-band model here is unchanged on every other day, the
> denominator stays a constant 100, and the coverage principle in §2
> is reused rather than revised. The caveat this ADR records — *"20
> points cannot finely price 20+ non-daily tasks"* — is exactly the
> edge that forced 0032.

## Context

**The report (2026-08-18, from real use):** completing every task
across morning, afternoon and evening scored **112**. A day cannot be
worth more than a day, and a number that can exceed its own maximum
cannot carry meaning.

**The mechanism, exactly.** ADR-0004 §4 made the day's denominator the
weekly commitment spread evenly — `dayShare = point_value ×
times_per_week ÷ 7` — while a completion still earns its **full**
`point_value`. A task done `f` times a week therefore pays `7 ÷ f`
times its own share on the day you do it: fair at daily, 2.3× at
3×/week, 7× at once a week. Task point values sum to 100, so a plan
with any non-daily work has a denominator below 100 and a payout of
100, and the overshoot is arithmetic rather than achievement. This was
analysed and parked in [backburner.md](../backburner.md) on 2026-08-13
("The daily number is too generous") and is unparked here.

**A second inflation, from the other direction.** ADR-0003 §5's
amendment shares the weight of task-less units out among the units
that do hold tasks. Three tasks in one unit can therefore carry the
whole 100, and the Tasks screen's right-hand column — which mixes
*spendable* (post-reallocation) for covered units with *weight* for
uncovered ones — currently sums to **118** on a real plan. A page
whose stated job is "where are my points going" answers with a number
that is not 100.

**What the grade is for.** The daily number is the app's one
quantitative claim, and the calibration experiment (ADR-0008) rests on
it converging with felt contentment. A grade that reads 112 on a
routine day, or 100 on a plan covering two units of eighteen, cannot
converge with anything.

Constraints already in force:

- **The app never shames** (ADR-0008). No mechanic may condition on a
  shortfall, and a harder ceiling must not become a way of telling
  someone they are failing.
- **Planned work is what pays** (ADR-0023). Unplanned work is capped;
  the only uncapped route above 100 is doing more of your own plan.
- **Plans never touch the grade** (ADR-0024 §2). Weekday pins and part
  of day shape presentation only. This ADR does not disturb that.
- **History never silently restates** (ADR-0002).

## Open questions

1. What stops a completion paying more than its share of the day?
2. What should a perfect ordinary day score?
3. What happens to the weight of a unit that holds no tasks?
4. Where do communal units sit once coverage decides the ceiling?
5. Does any of this reach back into days already graded?

## Options considered

### Stopping the overshoot

- **Make the denominator "what is due today."** Newly possible,
  because ADR-0024 gives tasks weekday pins. Rejected: it makes the
  plan decide the grade, so missing Friday's run on Friday charges you
  for it — schedule-violation scoring, which ADR-0008 forbids and
  ADR-0024 §2 makes an invariant.
- **Pay a completion its daily share and bank the remainder to the
  week.** Faithful to the current model, and keeps a perfect day at
  exactly 100. Rejected only because it cannot answer question 2.
- **Two bands, allocated separately.** Chosen. It fixes the overshoot
  for the same reason — nothing is amortized against anything — and it
  is the only option that also decides what a full day is worth.

### Uncovered weight

- **Keep full redistribution.** Today's behaviour; a two-unit plan
  still reaches 100.
- **Half credit.** Softer, but needs a constant nothing else
  justifies.
- **No redistribution.** Chosen. See §2.

## Decision

### 1. The day has two bands: the routine is 80, everything else is 20

> **Superseded by [ADR-0029](0029-a-day-is-the-fraction-you-got-through.md)
> §§1–2 (2026-08-26).** The two-band structure and the constant
> denominator of 100 survive; the line between the bands does not. It
> ran between *daily* and *weekly*, which made a genuinely weekly
> commitment worth a fraction of a daily one and left a full week of
> someone's own plan averaging about 83 — the failure this section's
> own Consequences predicted ("if this ADR proves wrong, it is this
> paragraph that was wrong"). The line now runs between *planned* and
> *unplanned*, at 90 / 10, and a day is scored on the fraction of its
> actually-due work that got done.

The day's denominator is **always 100**. It divides into:

- **The routine band — 80 points.** A unit of weight `w` contributes
  `0.8 × w` here, split across that unit's **daily tasks**
  (`times_per_week = 7`) by the existing rank shares. A unit with no
  daily tasks leaves its `0.8 × w` unearnable.
- **The variable band — 20 points.** Everything that is not a daily
  task: weekly and fortnightly tasks, extra runs, logged activities,
  and a special day's rating bonus. Shared, and capped at 20.

A completion pays a fixed value from its own band. Nothing is
amortized against anything, so no completion can pay more than it is
worth and **the 112 is structurally impossible**.

Every daily task done and nothing else is **80** — a full, ordinary,
unremarkable day, which is what 80 should mean. Above 90 requires the
routine *and* real work outside it. 100 is the ceiling of an ordinary
day; extra runs of your own plan remain the one route past it
(ADR-0023, unchanged).

**"Every daily task done" is 80 only at full coverage.** The two
halves of this decision pull against each other and §2 wins: the
routine band pays `0.8 × w` per unit, so a ceiling is
`0.8 × covered weight + 20`.

| Daily tasks cover | Every daily task done | Ceiling with the band full |
|---|---|---|
| all 100 of your weight | 80 | 100 |
| 75 | 60 | 80 |
| 50 | 40 | 60 |
| 25 | 20 | 40 |

A plan is therefore not scored on how well you did the plan; it is
scored on how much of your own stated life the plan reaches. That is
the whole point of §2, and it is the sentence to disagree with if this
ADR is wrong.

**Why the line falls at "every day" rather than at "planned for
today".** Frequency is a property of the task; a plan is not. Drawing
the band at `times_per_week = 7` keeps ADR-0024 §2 intact — the grade
still cannot see a weekday pin. A task you want in the routine should
be daily, and the day off (ADR-0023 §4) is how a daily task survives a
day you could not do it.

> **Amendment (2026-08-19): both bands are split between units by
> weight, then settled inside each unit.**
>
> This section described the routine band per unit and the variable
> band as "shared", and the implementation took that literally: it
> pooled every unit's variable claims and settled them in one pass. An
> audit found the consequence, and it is the same failure §2 exists to
> forbid — **a task's value depended on how many tasks existed
> elsewhere in the plan.**
>
> Measured, with a weight-40 unit and a weight-2 unit each holding half
> the plan's non-daily tasks:
>
> | Non-daily tasks | heavy (w40) | light (w2) |
> |---|---|---|
> | 4 | 17 | 3 |
> | 10 | 15 | 5 |
> | 20 | **10** | **10** |
> | 30 | 20 | 0 |
>
> The light unit's share climbed until it matched a unit twenty times
> its weight, then collapsed to nothing. The cause was ADR-0003 §5's
> **one-point floor** applied across the pool: with twenty tasks and
> twenty points, the floor alone consumed the band and weight stopped
> mattering; at thirty the floor became unaffordable and the allocation
> fell through to a proportional branch that behaved completely
> differently. Two rules meeting at a boundary, disagreeing.
>
> **The floor was never decided here.** It is inherited from ADR-0003
> §5, which this ADR withdrew *the reallocation half* of (§2) while
> saying nothing about the floor. It survived in the code by inertia.
>
> The fix is to apply this ADR's own sentence — *a unit's weight stays
> its own* — to the band where it wasn't. The variable band is now a
> largest-remainder split of 20 between the units holding non-daily
> work, in proportion to weight, and each unit's budget is then divided
> by rank with the floor applied inside it. The same two steps as the
> routine band.
>
> **"Shared, and capped at 20" still holds**, because the sub-budgets
> sum to 20 at every plan size: completing every non-daily task in a
> week still earns the band exactly once. What changes is that the
> split is now 19/1 at four tasks and at forty, instead of drifting
> from 17/3 to 10/10 to 20/0.
>
> Only units that actually hold non-daily work share the band. A unit
> with nothing but daily tasks does not reserve part of it and leave it
> unearnable — that rule is the routine band's, where coverage is the
> point.
>
> **A limit the arithmetic cannot remove.** Twenty points cannot finely
> price twenty or more non-daily tasks; beyond that the tail rounds to
> zero under any rule, and dropping the floor entirely makes it worse
> (half of ten weekly tasks fall to zero). Per-unit allocation does not
> solve that, it makes it *predictable*: a function of the unit's own
> weight rather than of the whole plan's size. If large plans prove to
> matter in real use, the lever is the 80/20 split itself, not this
> allocation — and that would be a new decision, not an amendment.

### 2. The weight of a unit you hold no tasks in is not redistributed

> **Withdrawn by [ADR-0028](0028-priority-is-the-only-input.md) §3
> (2026-08-26), eight days later.** This section invited its own
> refutation — *"it is the sentence to disagree with if this ADR is
> wrong"* — and a week of use produced it: every daily task completed,
> at 80% coverage, read **64**. Each band is now spent in full by the
> units holding work of its kind, so doing every daily task pays 80 at
> any coverage. What survives is §1's line: the routine band pays only
> daily tasks, so no redistribution buys 80 for a plan of weekly work.
> `include_in_scoring` remains the scope valve; it is no longer the
> answer to a low ceiling.

ADR-0003 §5's reallocation is **withdrawn**. A unit's weight stays its
own: if nothing under it can earn those points, nobody earns them, and
the day is scored out of the user's whole life rather than out of
whichever corner of it they happened to plan.

**Exclusion is the valve, and it already exists.** `include_in_scoring`
removes a unit from the diagnostic's 100 entirely, and weights
re-derive over what remains. The distinction the app now draws is the
honest one:

- *"This matters to me and I am doing nothing about it"* — the points
  stay in your denominator and go unearned. That is not a punishment;
  it is the diagnostic repeating what you told it.
- *"This does not apply to me"* — exclude it, and it leaves the 100.

This is what lets a hard ceiling survive ADR-0008. Nothing conditions
on a shortfall and no copy mentions one; the number reflects a gap the
user described themselves, and the way to close it is to add a task or
to say the unit does not apply.

**The valve is available at any time, from the Tasks screen** (Henry,
2026-08-18), not gated behind the monthly diagnostic. The consequence
has to be stated rather than implied: **the ceiling is therefore as
hard as the user chooses.** Someone capped at 64 can set aside the
units they hold no tasks in, watch the weights re-derive across what
remains, and reach 100 again. Nothing in the app can distinguish that
from the person with no partner doing the same thing, because the two
are the same act with different intent, and intent is not a column.

So the grade's claim is narrower than this ADR's title suggests. It
means **"out of what I have taken on right now"**, not "out of
everything that matters to me". What survives regardless is §1: the
routine band pays only daily tasks, so no amount of exclusion buys a
100 for a plan of two weekly tasks. Scope is negotiable; habit is not.

Two things keep it honest rather than free. The portfolio graph keeps
plotting excluded units, greyed and marked *not scored*, so a
shrinking scope stays visible in the one place the user goes to look
at their life. And weights re-derive **at read time** over the
included set: exclusion never writes a snapshot and never edits one,
so the portfolio history stays a record of what was diagnosed rather
than of what was later set aside.

### 3. `UNPLANNED_CAP` becomes the variable band

> **Reversed by [ADR-0029](0029-a-day-is-the-fraction-you-got-through.md)
> §2.** Planned work has a band of its own at every cadence now, so it
> no longer competes for this pool and the constant goes back to
> meaning only what ADR-0023 §1 named it for — and shrinks from 20 to
> **10**, because the planned band grew to 90.

The constant moves from 25 to **20** and now covers planned non-daily
work as well as unplanned work. **Planned work has first claim within
it:** weekly and fortnightly completions are credited first, then
extra runs, then activities and the special-day bonus fill whatever
remains. A spontaneous coffee can never displace a task you planned,
which is ADR-0023's ordering preserved inside a single pool.

### 4. Communal units become ordinary units

**This amends [ADR-0025](0025-communal-units-are-dimensions.md) §§1–5.**
Significant other, Family and Friendship hold tasks, take rank slots,
and are planned like any other unit. `motivation_kind` stays as a
column and as editorial context; it stops changing how anything
scores.

The reason is §2, not a change of heart about relationships. Once
coverage decides the ceiling, a unit that earns its full share from a
single press-and-hold is exempt from the one rule the whole system
rests on — and three units of eighteen, holding roughly a third of the
weight, is not an exception a ceiling can carry.

ADR-0025 §3's central worry — that someone living alone would be
structurally capped every day, "the shame surface AGENTS.md forbids
arriving through arithmetic" — is answered by §2's valve instead of by
a separate mechanism. Someone with no partner **excludes** the unit and
its weight leaves their 100. That is a better answer than the one
ADR-0025 built, because it is the same answer the app already gives
for every other part of life that does not apply.

**Tagging survives as a record and stops earning.** Press-and-hold on a
completion still writes `task_completion_tag`, still feeds effort and
the log, and still asks *where does this count* rather than *who were
you with* (ADR-0025 §4's non-goal is untouched). It no longer pays
points, because points now come from tasks everywhere.

**The soft warning.** Reducing a relationship to a checklist row is a
real risk and the reason ADR-0025 existed. So adding a task to a
communal unit shows one line of editorial copy — the note those units
already carry (ADR-0025 §13) — and nothing more. A warning, not a
gate: no confirmation step, no second screen, no different control.

### 5. Formula version 7, and history is left alone

`FORMULA_VERSION` moves to 7. Days already graded **keep the numbers
they were given**; `day_grade.formula_version` already records which
era each belongs to.

**Settings → Recompute past grades is removed.** It was built so a
retune could correct history rather than approximate it, and
`plan_snapshot` was added to make that correction possible. Both stay
in the schema, and the button goes: a grade is a record of what a day
was worth on the day it happened, and a plan changed in August has no
business rewriting July. Changing today's task list changes today's
number and nothing before it.

## Consequences

**Easier.** The number means something. 80 is a full routine day, 90+
is a day you did more than your routine, and neither is reachable by
arithmetic accident. The Tasks screen's column sums to 100 again,
because `spendable` and `weight` stop being two different numbers. The
scoring engine loses `dayShare`, the communal special case, and the
recompute path — three of its four most-explained pieces.

**Harder.** A plan covering half its weight tops out near half the
points, and reaching 100 means a daily task under every included unit
*and* a full variable band. That will feel severe in the first week.
The honest description of what the app then asks is: either widen the
plan, or narrow the scope and say so — and the second is one tap away,
which is the trade §2 accepts. A grade is comparable to your own past
grades only for as long as your scope holds; change what is included
and the number changes meaning without changing arithmetic. Nothing
warns you about that, because a warning would be the app second-
guessing a statement about someone's life.

**Accepted costs.** Weekly work is worth markedly less per completion
than daily work, which will push plans toward daily tasks. That is the
point — what matters most should show up in your day every day — but
it is a real narrowing of what the app rewards, and a genuinely weekly
commitment (a long Sunday walk) now earns from a pool of 20 it shares
with everything else. If this ADR proves wrong, it is this paragraph
that was wrong.

Grades from before formula 7 are not comparable to grades after it,
and there is now no way to make them comparable. That is a deliberate
loss.

**Revisit when:** a fortnight of real use shows the ceiling is
unreachable rather than merely hard; or exclusion turns out to be the
thing nobody finds, which would make §2 punitive by accident.

## Action items

1. [ ] `packages/scoring`: replace `dayShare` with band allocation;
       `UNPLANNED_CAP` 25 → 20 with planned-first ordering; drop the
       communal path from `computeDayScore` and `effort.ts`;
       `FORMULA_VERSION` 7.
2. [ ] Withdraw ADR-0003 §5's reallocation in `weights.ts` and
       `recomputeAllUnitPoints`; `spendable` collapses into `weight`.
3. [ ] Communal units hold tasks again: Tasks screen rows restored,
       `UnitPicker` offers them, the editorial note shows on add.
4. [ ] Remove Settings → Recompute past grades.
5. [ ] Build the exclusion control — `include_in_scoring` is read in
       five places and **written by nothing**; no screen has ever set
       it. On the unit, on the Tasks screen, reversible in one tap,
       worded as scope. Weights re-derive at read time; no snapshot is
       written.
6. [ ] Amend ADR-0003 §5 and ADR-0025 §§1–5 with pointers here.
7. [ ] Update the ADR index, and note in backburner.md that "The daily
       number is too generous" is resolved here.
