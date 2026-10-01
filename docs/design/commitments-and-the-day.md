# Working Note — Commitments, windows, and the third band

> **Status: working note. The decisions now live in ADRs**
> (2026-09-11), **accepted 2026-10-01** with dated amendments from
> building them.
>
> This is the working-out — how the design moved across one long
> session, what was tried and dropped, and crucially **which numbers
> are measured against the scoring engine and which are hand-computed
> arithmetic.** It is kept for that; the ADRs are the decisions.
>
> | Decision | ADR |
> |---|---|
> | Commitments are custom units | [0029](../adr/0029-commitments-are-custom-units.md) |
> | The commitment band (formula v8) | [0032](../adr/0032-the-commitment-band.md) |
> | Windows and pools | [0033](../adr/0033-windows-and-pools.md) |
> | Any task may carry a time | [0030](../adr/0030-granularity-is-the-users.md) |
> | Task size and day load | [0026](../adr/0026-task-size-and-day-load.md) |
> | Partial credit | [0014](../adr/0014-partial-credit.md) |
> | Schedule mode · the semester score | [0028](../adr/0028-schedule-mode.md) · [0031](../adr/0031-the-semester-score.md) — **both withdrawn** |
>
> Where this note and an ADR disagree, **the ADR wins.**

## The problem, as it actually turned out

The first pass built a parallel academic module: seven new tables, its
own hierarchy, a mode switch to hide it from non-students. Henry's
later framing collapsed almost all of it — *make it general, so it
covers a club or a job as well as a class.*

Then the real problem surfaced, and it was not modelling. It was
**arithmetic**. Measured against the live scoring engine, with a
realistic 18-unit plan and `education-learning` at weight 12:

| Plan | What each school task is worth |
|---|---|
| 2 school tasks | 13 and 7 |
| 13 school tasks | 1, 1, 1, 1, 1, 1, 1, 1, **0, 0, 0, 0, 0** |

**Five of thirteen tasks are worth literally zero.** The variable band
is 20 points for *all* non-daily work in the whole app, a semester's
work is almost entirely non-daily, and the one-point floor in
`bandPointValues` is skipped when a band cannot pay everyone.

ADR-0027 predicted this in its own source: *"20 points cannot finely
price 20+ non-daily tasks. Beyond that the tail rounds to zero whatever
the rule."*

So the feature's real blocker is that **the app's model assumes few,
repeated tasks per unit, and a semester is many, varied, non-daily
tasks.**

## The shape, as it now stands

### 1. A commitment is a custom unit, not a goal

`life_unit.is_custom` **already exists**, and `syncTaxonomy`
(`db/seed.ts:92`) already spares custom units from archival — the
schema and the launch-time sync both anticipated user-created units.
Nothing writes it. No screen has ever set it. This is the same
situation ADR-0027 found with `include_in_scoring`.

A commitment — School, Work, Basketball Club — is a custom unit
carrying its own weight and holding its own tasks, with
**sub-commitments** inside it (School → COMP2521, MATH1231). At most
three commitments; see §2 for the band and its cap.

> **Revised 2026-09-11.** This section first described commitments as
> a *flat* set of custom units — five course-units at weight 8 each —
> sitting on the same pie as the 18. Both halves of that are
> superseded: they are **two levels** (commitment → sub-commitment),
> and their points come from **their own band**, not the pie. The
> measurement below was taken under the flat model and is kept because
> what it demonstrates still holds.

Measured (under the superseded flat model): splitting school into five
course-units at weight 8 takes its total from **8 points to 15** and,
more importantly, **removes every zero-point task.** No dead rows. The
lesson carries — giving school its own buckets is what stops its tasks
starving — even though the structure that delivers it has changed.

**Commitments are weighted, not diagnosed.** The diagnostic keeps
rating the 18 life dimensions on importance and satisfaction; it stays
18. A commitment carries a weight only, set directly (§2). So it is
correctly absent from the portfolio graph as a *bubble* — that plots
importance × satisfaction, and bubbles appearing and vanishing each
semester would make month-to-month comparison lumpier for nothing.

It is **not** absent from the graph's underlying effort, though: §2's
tagging rule lets a commitment task carry a `note` membership in a life
unit, so a semester still shows up as effort under
`education-learning`. That recovers what separating the band gave away.

It also resolves a vocabulary problem: AGENTS.md defines an SLU as a
*dimension of living*, and COMP2521 as a peer of Family and Sleep is a
stretch. As a scoring bucket that shares the `life_unit` table, it is
not.

Ending is `archived_at`: the weight returns to the pool, past snapshots
keep the course, and the portfolio history still shows the semester
happened.

> **This reverses an earlier call.** Two passes back, a commitment was
> a *goal* kind with `session` tasks under it. A thing that carries
> weight and holds tasks is unit-shaped — goals do not carry weight.
> Ordinary goals can still live inside a commitment ("get better at
> basketball" under Basketball Club).

### 2. Commitments get their own band

Splitting into units was not enough on its own: each school task was
still worth ~1, because the 20-point variable band is the binding
constraint and five courses were carving the same 20.

So a day with scheduled commitment work splits **three** ways:

    commitment band   — user-set, 10–60 in steps of 5 (§2)
    routine band      — 80% of what is left
    variable band     — 20% of what is left

A day with **no scheduled commitment work is an ordinary 80/20 day**,
untouched. The band exists only on days it can be earned, which is what
stops a Sunday capping at 60 through no fault of the user.

**The bucket is fixed, not scaled by the day's load** (Henry's call, and
the argument is his): a day with less scheduled genuinely *is* a day
with more free time, so life tasks being worth more on it is correct
modelling rather than an artefact. Scaling it by the day's share of the
week was tried on paper and fails the goal — it makes school ~8% of a
week rather than 40%.

**The band size is the user's, in steps of 5** (Henry, 2026-09-11),
replacing the arbitrary 40 this note used to assume. It runs from
**10 to 60**, a flat ceiling regardless of how many commitments are
held. The floor and ceiling are themselves a mild opinion, and a
defensible one: 0 would make the feature pointless, and 100 would
delete the rest of a life from a scheduled day.

**Commitment points are separate from the 18 units' points.** Settled,
and settled earlier than this note admitted — *"its own special bucket
of points separate from the 80/20 framework."* An earlier draft here
described commitments as units *on the pie*, which made the band the
sum of their slices; that was this note carrying a stale framing
forward, not a real ambiguity. The band is set directly and the pie
distributes what is left among the 18.

**At most three commitments, each holding sub-commitments** (Henry,
2026-09-11). School is a commitment; its classes are sub-commitments
inside it. Sub-commitments are **uncapped**, and a task may hang off a
commitment directly — "School" holds work belonging to no single class.

**The cap is a flat 60, whatever the count** (Henry, 2026-09-11,
revising a scaling 60/70/80 proposed the same day). One number, no
cliff when a third commitment is added, and **life always keeps at
least 40%.**

| | Band cap | Life pool | Routine | Daily exercise task (weight 9) |
|---|---|---|---|---|
| Today | — | 100 | 80 | ~7 pts |
| Any commitment count | 60 | 40 | 32 | **~3 pts** |

That revision came from the arithmetic: under the scaling caps, a band
of 80 left all 18 life units sharing 20 points, putting their daily
habits on the **one-point floor** — the same floor that produced the
zero-point finding at the head of this note, and with no resolution
left to tell sleep from exercise from nutrition. A flat 60 keeps the
worst case at ~3. (Design arithmetic; the band is not in the engine.)

**The Tasks screen shows a task's value for that day** (Henry,
2026-09-11), not a range and not a weekly total. A task whose value
depends on the day gets the day's answer. This is the column ADR-0027
was written to fix, when it summed to 118 and *"a page whose stated job
is 'where are my points going' answers with a number that is not 100."*
A single day-scoped number keeps that property.

**Sub-commitments do no arithmetic.** §2 divides the band across every
eligible commitment *task* that day, not across sub-commitments — so
"all sub-commitments are worth the same" (Henry) means they are purely
organisational. Classes group tasks and say which course something
belongs to; they price nothing.

That collapses three levels of dials to **one**: each commitment's
share of the band, set by the user. School 50 / Work 30 / Basketball
20, and that is the whole weighting story.

**The band divides only among commitments with eligible tasks that
day.** If School, Work and Basketball split it 50/30/20 and only School
is scheduled on Monday, School takes the whole band — the other shares
do not sit dead and cap the day at 70. This is the empty-Sunday problem
one level down: points unearnable through no fault of the user. Stated
because it is a real rule and not obvious.

**Commitment tasks may also be tagged to life units** (Henry,
2026-09-11), and the machinery exists. `task_unit` (ADR-0019) already
carries one membership row per unit, and `membership = 'note'` already
means *"touches the unit without taking a slot or earning anything: no
rank, no points, feeds effort and the log only"* (ADR-0025 §5).

**A tag must be `note`, never `scoring`.** A commitment task earning
from the commitment band *and* a life unit's band would double-pay
across two bands, which is the one route to inflating a day.

This also recovers something §1 gave up. That section notes commitments
are absent from the portfolio graph because they are not diagnosed —
with tagging, a basketball commitment feeds `exercise-fitness` effort
and classes feed `education-learning`, so the graph and the life log
see the semester even though the scoring does not.

**Schema.** Commitments can stay `life_unit` rows with `is_custom`,
plus a nullable `parent_unit_id` for the sub-level — one table, full
reuse of `task.unit_id` and `task_unit`. **What separates them is the
band, not the table.** Reusing `life_area` as the parent level is the
obvious alternative and is ruled out: ADR-0021 forbids an area carrying
weight, and notes that it has been built once and destroyed data.

**Within a day, the band divides across every commitment-unit task
eligible that day** — scheduled sessions *and* assignment work planned
for that day. Not across scheduled sessions alone, or a Friday holding
one tutorial would pay 40 points for one hour in a room.

    band 40, Monday, 3 lectures + 2 assignment tasks → 40 ÷ 5 ≈ 8
    band 40, Friday, 1 tutorial + 2 assignment tasks → 40 ÷ 3 ≈ 13

Against **1 point** today. (Design arithmetic — the third band does not
exist in the engine yet, so this is not measured.)

A light Friday paying more per task is **not** a bug: it is
`taskPointValues(unitWeight, taskCount)` — a unit's whole weight goes to
its single task, a fifth each when there are five — with the divisor
scoped to a day instead of a plan. Finish the week early, attend the one
Friday class, earn school's full share. The app should reward that.

### 3. The day is always divided into windows

A **window** is a stretch of the day you can put work into.

- On a day with commitments, windows are the **gaps between them** —
  the free intervals already in the hour-grid design (30 min or more;
  shorter gaps are buffer, not free time).
- On a day without, windows are **morning / afternoon / evening** —
  `part_of_day`, which `SectionedChecklist` already sections by.

One structure, two derivations, and the existing checklist renders
both. This also settles the checklist-density question that was open
for several passes: **sessions stop being extra rows in a flat list and
instead define the sections.**

**Work carries forward to the next window** if it is not done — that
evening, or the next day.

The mechanism already exists and is already proven non-punitive.
`task.one_off_date`'s comment: *"It never moves: rolling forward is a
display rule, not a write, so the original intention survives being
late."* So a window item reappears in the next window with **nothing
recording that the first one was missed** — which is what lets
carry-forward coexist with ADR-0024 §2's silent lapse rather than
contradict it.

**Accumulation is accepted** (Henry, 2026-09-11): a backlog building up
across windows is normal planner behaviour, not a shame mechanic. The
concern raised against it was that a pile growing in front of you is
the loss-aversion shape PRODUCT.md names as an anti-reference; the
call is that a planner which silently drops what you did not get to is
the worse failure. Roll-forward stays a display rule either way, so
nothing is written and nothing is counted.

### 3a. A day with no commitments is just today's app

Saturday and Sunday do not need a special case. They hold planned or
scheduled tasks exactly as the app does now — **commitment-based or
not** — and the user decides how precise to be.

### 3b. Any task may carry an explicit time, if the user wants one

> **This supersedes rather than amends ADR-0030 §1 and ADR-0024 §1.**
> Both were built on the principle that *only things somebody else set
> carry a clock time*, with a closed list of three columns and
> self-scheduled work kept rough. Henry's call on 2026-09-11 — *"they
> can be an explicit time slot or just placed in morning, afternoon, or
> evening. We give the freedom to the user to choose how they want to
> use the tool"* — removes that line. Read app-wide, not weekend-only:
> a rule permitting a time slot on Saturday but not Tuesday would not
> be coherent.

What this costs, honestly: the Tonietto & Malkoc protection ADR-0024
§1 was built around — rough scheduling avoids the enjoyment penalty
that specific scheduling puts on discretionary activity — is now the
user's to opt into rather than the app's to enforce. `anytime` and
part-of-day stay the **default**, which preserves the finding for
anyone who does not reach for a time.

What it does not cost: **nothing in the scoring engine touches a
time.** Bands key off frequency and unit. A timed task sorts into
whichever window contains its time; an untimed one sits in its
part-of-day window; both coexist in one structure. Cue-based placement
(ADR-0030 §4) survives as a *nicety* — a placement cued to a lecture
still follows that lecture when the timetable moves — rather than as
the required mechanism.

### 3c. A window may hold options, not just one task

Henry, 2026-09-11:

> You might have a group of tasks that you are planning to pick one of
> to complete in that window, which can be commitment based or not,
> rather than having only one task planned in that window and then
> punishing the user for not doing exactly that task.

A **new axis**. The app already has flexibility about *when* —
`times_per_week` unpinned is "three times, you pick the days,"
`anytime` is "you pick the part of day." This adds flexibility about
*what*, which nothing in the model does yet. It also fits ADR-0024 §2:
a placement is an intention that lapses silently, and *one of these
three* is an intention that is harder to fail.

**An option set must be one scoring slot, not N tasks.** This is the
constraint the feature lives or dies on. Three options modelled as
three ordinary tasks take three rank slots and split their unit's
budget three ways — and only one is ever completed, so two thirds of
that slot goes unearned *every day, by design*. Options would quietly
lower the day's ceiling, which is the opposite of the intent.

So: one rank position, one point value, **any member completes it in
full**. New machinery — `task_unit` gives one task many units; this is
the inverse, many tasks one slot.

**Two features may be hiding under one name.** Worth settling before
building:

- **A choice set** — "run, swim, or gym"; "revise COMP2521 or
  MATH1231." *Substitutes*: one intention, several ways to satisfy it.
  One slot, one value.
- **A pool** — "in this window, work on whatever school work is
  outstanding." Not substitutes; a queue being drawn from. Each item
  keeps its own value and the window does not pre-assign which.

The wording points at the first; the stated motivation (not punishing a
user for not doing exactly the planned task) points at the second. But
**carry-forward already solves the pool case** — unfinished work rolls
to the next window — which suggests building the choice set only.

**Open: how much optionality before a plan stops being a plan.**
ADR-0024 rests partly on Masicampo & Baumeister — a *specific* plan
eliminates the intrusive-thought cost of an unfulfilled goal without
doing the task, so *"the payoff of planning is mental quiet, not
throughput."* If the payoff comes from specificity, optionality may
erode what planning is for: a window holding five options is a list,
not a decision. Two or three substitutes probably still read as a
choice; that is an instinct, not a finding, and it wants a literature
pass in
[scheduling-and-motivation.md](scheduling-and-motivation.md) before it
becomes an ADR.

**Also open:** if an option set spans two commitment units, which
unit's band pays for it? Simplest answer is the completed member's
unit, but that interacts with the one-slot rule and needs working
through.

### 3d. An option pool is equal-priced, and holds at most three

Henry, 2026-09-11, refining §3c — **this is window planning, not a
change to how units rank their tasks:**

> You have pools or tiers of tasks, and tasks in the same pool are all
> worth the same points. We can also cap the number of tasks you can
> have per pool to maybe 3, so you never have too many to choose from.

`task.rank_in_unit` and `rankShares` are untouched. A unit still orders
and prices its own tasks exactly as ADR-0003 §5 has it. A **pool** is a
window-level object: up to three candidate tasks, any of which
satisfies that window's intention.

**Equal pricing is the load-bearing part, and it solves a problem §3c
had.** If a pool held "write the essay (8)" beside "do the reading
(3)," the choice would be made by the scoreboard rather than by what
you actually need — you would always take the eight. Equal points
inside a pool makes the choice **free**: pick on appetite, energy or
usefulness, and the number is indifferent. That is the app refusing to
put its thumb on a scale it has no business touching.

**The cap of three is defensible here in a way it would not be at unit
level.** It limits how many things one *choice* holds, not how much a
person may plan — so it does not conflict with dropping
`recommendedTaskRange`, which was the app prescribing the shape of a
plan. A window may hold several pools; a person may hold as many
windows as their day has.

**A second member pays again, at full value** (Henry, 2026-09-11):

> If you manage to complete two S-tier tasks in one window we should
> reward you for that. Sometimes an assignment with a lot of weighting
> turns out to be easier than we thought, but that shouldn't make it
> less valuable.

The pool holds **one slot worth `V`, and every completion pays `V`.**
This is the only model that is neither punishing nor accidental:

| | Do one | Do three |
|---|---|---|
| **Pool = one slot, each pays `V`** | `V` — a complete window ✓ | `3V` — beyond plan, which ADR-0027 wants ✓ |
| **Each member holds `V/3`** | `V/3` — the silent cap ✗ | `V` ✓ |

Doing two or three is genuinely *beyond* what was planned ("one of
these"), which is the route ADR-0027 §1 asks for by name — *"a grade
above 90 must mean you went beyond your plan."*

**On the rate, against an existing precedent.** `EXTRA_RUN_RATE = 0.5`
already pays beyond-plan work at half: a fourth run of a 3×/week task
is *"the plan done harder, not spontaneity"* (ADR-0023 §2), credited
outside `UNPLANNED_CAP`.

A second pool member is **not** that. An extra run is the same task
again, and the fourth is fairly worth less because the plan asked for
three. A second pool member is a *different task that was also
planned* — the only thing undecided was which one would get done. So:

> **Same task repeated → 50% (`EXTRA_RUN_RATE`, unchanged).
> A different planned thing → 100%.**

That keeps `EXTRA_RUN_RATE` meaning exactly what it means today and
needs no new constant.

**A task may be completed at most once per window** (Henry,
2026-09-11). This is a necessary tightening rather than a preference:
without it, *"every completion pays `V`"* could be read as ticking one
task three times for `3V`.

It needs **no scoring rule** — it falls out of placement. A task may be
placed at most once in a window, so it can only be ticked once there.
The one thing to get right is that uniqueness is scoped to the
**window**, not the pool: a window holding two pools must not carry the
same task in both.

**Extra runs are unaffected.** `task_completion` has no unique
constraint on `(task_id, local_date)` — multiple completions a day are
exactly how `EXTRA_RUN_RATE` works. This rule scopes a repeat to a
*different window*, which is more honest anyway: the same task twice
inside one two-hour gap is rarely two real sessions.

**A pool counts as its *planned count* when the band is divided**
(Henry, 2026-09-11, choosing option A with a refinement).

A pool carries how many of its members you intend to do — usually one,
but a plan may legitimately be "two of these three." On a day whose
band pays 8 per commitment task:

| Pool | Counts as | Do one | Do two | Do three |
|---|---|---|---|---|
| 3 members, plan 1 | 1 task → 8 | 8 | 16 | 24 |
| 3 members, plan 2 | 2 tasks → 16 | 8 | 16 | 24 |

Per member the value is the same; the planned count sets the day's
**ceiling**, not the payout. Anything beyond the planned count is
beyond-plan work, which ADR-0027 §1 asks for by name.

The rejected alternative was counting every member regardless of intent:
that inflates the ceiling with options you never meant to take, so an
ordinary day would permanently read as a partial one.

### 3e. Window capacity — how much fits

Henry, 2026-09-11: *"I was assuming that in a window you would only
plan for one task. That is variable based on task size and window
size."*

So a window has a **capacity**, and how many tasks fit depends on their
size against its length. A two-hour gap holds more than a twenty-minute
one.

**This is the third time planned ADR-0026 (task size and day load) has
become load-bearing in this design** — first for size-weighted
allocation, then for "what fits in this gap," now for window capacity.
ADR-0024 §6 deferred it by name, and its stated trigger was *"the
weekly planning pass is in real use and 'is this day too full?' has
come up unprompted."* Three independent pulls is that trigger firing:
**write 0026 as part of this work rather than deferring it a fourth
time.**

ADR-0024 §6 already fixed its shape, and that constraint carries here:
sizes are `quick | normal | big` (reusing `activity.size`'s
vocabulary), **never minute estimates**, because minutes inherit the
planning fallacy the app cannot correct. So capacity is a rough fit —
"about two normal things" — not an arithmetic of minutes.

### 3f. Partial completion

Henry, 2026-09-11:

> If you genuinely work the full window but don't complete the
> assignment, we'll still give you part of it. The user specifies the
> percentage they completed (25%, 50%, 75%), which informs how many
> points they get. When they complete on a later date they only get the
> remaining points.

**This pulls forward reserved ADR-0014, whose gate has not fired.**
ADR-0004 §2 is explicit: *"Completion is binary (v1)... The
`task_completion` schema **anticipates a partial-credit fraction
column**; it gets added only if ADR-0008 calibration shows
all-or-nothing grading diverges from felt contentment."* No such
calibration exists — `meetsColdStartGate` has not been satisfied by
anyone.

**The argument for doing it anyway is that windows changed the
premise**, not that the gate is inconvenient. Before windows, "I worked
on it and did not finish" was *invisible* — no object represented the
two hours. A window makes it a visible, recurring event, and binary
completion against a window is wrong in a way it was not obviously
wrong against a day. Same shape of argument ADR-0030 used against
ADR-0024: the premise moved, so the ADR's own logic licenses
revisiting.

> Note the pattern: this is the **second reserved ADR in two passes**
> that this design has pulled forward (0026 in §3e, 0014 here). Not
> necessarily wrong, but the window model keeps demanding things the
> app deliberately deferred until evidence arrived, and that is worth
> noticing before a third.

**The remaining-points rule needs no new state.** Sum
`task_completion.fraction` across a task's completions; at 1.0 it is
done. Points denormalize at each completion exactly as they do now, so
a day that banked 50% keeps 50% when the rest lands later — ADR-0002's
"history never restates" holds without special handling.

**One-tap survives, which is ADR-0014's stated constraint.** Tap =
done. Long-press = the 25/50/75 picker. Press-and-hold is already the
app's grammar for a row's second action (completion tagging in
ADR-0025, moving between parts of day in ADR-0024).

**Copy rule.** It renders as progress — *"50% done"* — never as deficit
or *"incomplete."* The feature exists to give credit that would
otherwise be lost; presenting it as a shortfall would invert that and
trip ADR-0008.

**Do not unify with `goal_progress`.** ADR-0015 §7 makes goal progress
explicitly *not* a scoring event: "no points, no denominator, no effect
on any day's number." Partial completion **is** one. They look alike
and must stay separate.

**Which tasks get it is a per-task toggle, set when the task is
made** (Henry, 2026-09-11). Better than the alternative considered
here — the app deciding, by limiting it to sized or one-off work —
and consistent with the principle below: the app offers the capability
and the user says where it applies. "Brush teeth" simply has the toggle
off.

**A partially completed pool member earns `fraction × V`.** Flagged as
open in an earlier draft; it is not. §3d's "every completion pays in
full" is about *multiple members*, and this is about *fractions* —
orthogonal, no conflict.

**Rounding: pay `round(total fraction so far × value)` minus what has
already been paid.** A 3-point task marked 25% pays 1; the next 25%
pays 0; reaching 75% pays 1 more. The total can never exceed the task's
value, and each step is individually honest. Without this, four
quarter-marks pay 4 points on a 3-point task.

### 3g. How many hours the grid draws

Henry, 2026-09-11: *"What is displayed should be based on what the user
has planned. The planning menu should display all hours of the day."*

This replaces an earlier assumption in this note that the grid drew a
fixed 07:00–22:00, widened to fit outliers — a number the app had no
business picking.

- **The grid draws the span of the day's windows**, not just its
  blocks. Windows are what work is placed into, so a 9am lecture with a
  free afternoon draws both; deriving the extent from blocks alone
  would show one hour on a tall screen.
- **The stretches before the first window and after the last collapse
  to one row each** — *earlier* / *later* — tappable to expand to the
  full day. So no day is ever un-plannable and no day draws sixteen
  hours of nothing.
- **A day with nothing planned needs no special case.** §3 already
  makes an uncommitted day's windows morning / afternoon / evening, so
  it draws those three rather than an empty ruler. Same rule.
- **The planning surface shows all 24 hours.** Display is bounded by
  the day; placement is not.

### 4. Setting the weights

**The draggable pie is backburnered** (Henry, 2026-09-11 — *"that was a
side thought"*). It was orthogonal to the commitment work this branch
is for, and the reasoning, the existing write path and the two things
to settle before building it are recorded in
[backburner.md](../backburner.md) under *The draggable weight pie*.

Nothing here depends on it:

- **The commitment band** has its own controls — one slider for the
  band (10–60, steps of 5) and a share per commitment.
- **The 18 life units** keep the diagnostic and the existing
  pairwise-ranking override (`applyPriorityOrder`,
  `resetToDiagnostic`), unchanged.

This also closes the question of whether a pie would replace the
diagnostic: it is not being built, so the diagnostic stands.

### 5. Clock times, narrowly

~~Unchanged from ADR-0030, which survives this rework.~~
**Superseded 2026-09-11 — see §3b.** Any task may carry an explicit
time; part-of-day stays the default. ADR-0030 needs rewriting rather
than amending: its §1 (*only things somebody else set*) and §2 (the
closed list of three columns) were the whole argument, and both are
gone.

What survives from it: **§4's cue-based placement**, now as a nicety
rather than the mechanism, and **§6's refusal of commitment
notifications** — a course name on the lock screen is still exactly
what ADR-0010 §3 exists to prevent, and having a clock time only ever
made that feature possible, never right.

## Invariants this breaks, and what each needs

Each of these is an accepted ADR. None should be absorbed quietly.

| Invariant | What breaks it | Status |
|---|---|---|
| **ADR-0024 §2** — plans never touch the grade; an unplanned day scores identically | A session pays from the commitment band on its day and from the 20 pool otherwise | **Henry's call, taken knowingly:** you lose Thursday's points because you did not do Thursday's work, and gain Sunday's from the bonus pool because unplanned work is what that pool is for. Needs an argued amendment |
| **ADR-0024 §1** — flexible is a first-class value and the default | Commitment sessions must be scheduled | Structurally necessary: the band exists only on scheduled days, so an unscheduled session could never be earned at all |
| **ADR-0024 §1 / ADR-0030 §§1–2** — no clock time on a self-scheduled task; a closed list of three columns | Any task may carry an explicit time (§3b) | **Superseded, not amended.** Henry, 2026-09-11. ADR-0030 needs rewriting; part-of-day stays the default, so the research finding survives for anyone who does not reach for a time |
| **ADR-0027** — the day is two bands, denominator a constant 100 | A third band, and a day-dependent split | Formula **v8**. Past days stay on v7 (ADR-0002) |
| **AGENTS.md** — importance first, satisfaction-gap boost second | The pie sets weights without `deriveWeights` | Only if the pie replaces derivation rather than overriding it (§4) |
| **ADR-0003 §6** — recommended task counts | Henry: *"we should shape around the user's tasks, not the other way around."* | §6 is load-bearing: `bands.ts` and `tasks.ts` both cite it as the reason a task may be worth zero. Removing the advice obliges fixing the allocation |

## Open questions

Settled items live in their sections. What is genuinely left:

1. **Write ADR-0026 (task size and day load).** Three separate parts of
   this design need it (§3e). Shape already fixed by ADR-0024 §6 —
   `quick | normal | big`, never minutes.

2. **Write ADR-0014 (partial credit)**, recording that its calibration
   gate has not fired and why the premise changed anyway (§3f).

3. **Rewrite the ADR set** — withdraw 0028 and 0031, rewrite 0029 as
   commitment-units, rewrite 0030 (superseded by §3b), add the
   third-band ADR. See [What this changes](#what-this-changes).

4. **Correct the stale dates.** ADR-0028..0031 are stamped 2026-08-21,
   inferred from the repo's recent ADRs rather than checked.

5. **Build the third band in `packages/scoring`.** Every figure in this
   note marked *design arithmetic* is hand-computed. The one measured
   finding — five tasks worth zero — is what restructured the design,
   which is the argument for measuring the rest.

**Recently answered:** the Tasks screen shows a task's value *for that
day* (§2, Henry 2026-09-11) rather than a range or a weekly total;
partial-completion rounding pays the rounded running total minus what
is already paid (§3f); the pie is backburnered (§4); the optionality
limit had its literature pass —
[scheduling-and-motivation.md](scheduling-and-motivation.md), addendum
2026-09-11 — which found three safe on choice-overload grounds and
identified **framing**, not the number, as the lever that matters.

## The principle underneath all of this

Henry, 2026-09-11:

> It's most important that we allow users to use the app however they
> like. If someone wants to plan every second of their day then so be
> it. However we will absolutely **not force** that kind of scheduling
> on them, and I think that's the feature a lot of planners miss out on.

Four calls in this session ran on one axis — drop the recommended task
range; *"shape around the user's tasks, not the other way around"*; any
task may carry a time; and this. That is a principle, not four
decisions.

**It is not in tension with PRODUCT.md, as an earlier draft of this
note claimed.** Design principle 4 already says most of it — *"A tool,
not a taskmaster. Partial use is valid use."* What is new is extending
it to a dimension it never covered: **granularity**. And design
principle 2 — *"a checklist and a number, closable in under a
minute"* — survives once read as a statement about what the app
**defaults to and pushes toward**, not a cap on what it permits.

So: **the opinion lives in the defaults; the ceiling belongs to the
user.** Which makes `anytime` and part-of-day being the defaults
load-bearing rather than incidental — they are where the product's
opinion now lives, and they must not drift.

**Proposed PRODUCT.md amendment**, for Henry's sign-off — it changes
the whole product, not this feature, so it wants its own commit rather
than riding a scheduling branch:

> **6. Granularity is the user's.** The app supports planning a day to
> the minute and planning it not at all, and neither is the lesser use.
> Defaults sit at the light end — `anytime` is first-class, part-of-day
> is the default, nothing requires a time — and every step toward
> precision is offered while none is required. The opinion lives in the
> defaults; the ceiling belongs to the user.

**Why this is the positioning, not just a preference.** Most planners
force one granularity and lose everyone it does not fit: Google
Calendar makes everything a time slot, so "read more" must become
7:30–8:00 or not exist; a flat-list to-do app makes a lecture a
checkbox; a build-it-yourself tool makes you design the structure
before you can use it.

**The window model is what lets one app span both** — not as a
compromise, but because a window is a two-hour gap between classes *or*
a whole Sunday morning, so precision is a property of the item rather
than of the app. That is a sharper claim than "better than Google
Calendar for students," and it is the one worth building toward.

## What this changes

On this branch, against ADR-0028..0031 as committed:

- **ADR-0028 (Schedule mode) — withdraw.** The mode existed because the
  academic module was a foreign body needing to be hidden. With
  commitments as ordinary custom units, there is nothing school-shaped
  to hide: a person with no commitments simply has none. What survives
  is a plain List/Day layout preference.
- **ADR-0029 (parallel model) — rewrite** as the commitment-unit
  decision. `term`, `course`, `assessment`, `fixed_commitment`,
  `study_session` all go; the model is columns on `life_unit` and
  `task`.
- **ADR-0030 (clock times) — keep**, with §2's containment argument
  revised as above.
- **ADR-0031 (semester score) — withdraw.** A term-length score needed a
  term, and the term was the most academic thing in the design. Per-goal
  and per-commitment progress covers it, and generalises to a club for
  free.
- **New ADR needed** for the third band and formula v8.

Also outstanding: the four ADRs are dated **2026-08-21**, inferred from
the repo's recent ADR dates rather than checked. Correct them in
whichever rewrite lands first.

## Next steps

1. Settle the open questions above.
2. Rewrite the ADR set to match this note.
3. Add the third band to `packages/scoring` behind tests, so the
   arithmetic in §2 can be **measured** rather than reasoned about. Every
   number in this note that is measured says so; every number that is
   not is marked as design arithmetic.
4. Build `is_custom` — the column, the sync exemption, and the
   archival path all exist; nothing writes them.
