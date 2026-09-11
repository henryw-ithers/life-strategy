# Working Note — Commitments, windows, and the third band

> **Status: in flux (2026-09-11).** This records a design worked out
> across one long session with Henry. It is **not** decided — it is
> written down because the shape changed on almost every pass and the
> conversation was the only copy.
>
> It **supersedes most of ADR-0028..0031** on this branch. Those four
> were drafted against an earlier shape (a parallel academic module)
> that this note replaces. See [What this changes](#what-this-changes)
> at the foot. Do not implement from the ADRs without reading this.

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

A commitment — COMP2521, Basketball Club, a job — is a custom unit
carrying its own weight, holding its own tasks.

Measured: splitting school into five course-units at weight 8 takes its
total from **8 points to 15** and, more importantly, **removes every
zero-point task.** No dead rows.

**Commitments are weighted, not diagnosed.** The diagnostic keeps
rating the 18 life dimensions on importance and satisfaction; it stays
18. A commitment carries a weight only, set directly (§4). Which means
it is correctly absent from the portfolio graph — that plots importance
× satisfaction, and bubbles appearing and vanishing each semester would
make month-to-month comparison lumpier for nothing.

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

    commitment band   — the commitment weights (e.g. 40)
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

**The band size is the user's, 10–60 in steps of 5** (Henry,
2026-09-11), replacing the arbitrary 40 this note used to assume. The
range is itself a mild opinion — 60% max means life always keeps at
least 40% — and that is a guardrail rather than a violation of the
principle below: 0 would make the feature pointless and 100 would
delete the rest of a life.

> **Open, and it changes §1: is the band set or emergent?** §1 makes
> commitments custom units carrying their own weight *on the pie*,
> which makes the band **emergent** — five course-units at 8 each *is*
> a 40% band, and a slider would be a second control fighting the
> first. A slider instead implies two distributions: the band set
> directly, and the pie sharing what is left among the 18 life units.
>
> The slider reading is probably right, because the band is carved off
> **before** the 80/20 split and so is structurally separate from unit
> weights already. That gives: one slider for how much of a scheduled
> day belongs to commitments; commitments sharing that band by their
> own relative weights; the pie distributing the remaining 40–90 across
> the 18. Under that reading **commitment-units do not appear on the
> main pie**, which contradicts §1 as written. Needs settling.

**Within a day, the band divides across every commitment-unit task
eligible that day** — scheduled sessions *and* assignment work planned
for that day. Not across scheduled sessions alone, or a Friday holding
one tutorial would pay 40 points for one hour in a room.

    Monday, 3 lectures + 2 assignment tasks   → 40 ÷ 5 ≈ 8 each
    Friday, 1 tutorial + 2 assignment tasks   → 40 ÷ 3 ≈ 13 each

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

Open: where `V` comes from — the members are equal-priced by §3d's
rule, so the pool needs one value, and whether that is a tier's value,
the highest member's, or its own is unsettled.

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

**Open:**
- **Which tasks get it?** "Brush teeth, 50%" is meaningless, and a
  fraction picker on every habit is what ADR-0014's scope warns
  against. Probably limited to sized or one-off work — assignments,
  essays, projects — which ties to ADR-0026 again.
- **Does a 50% pool member half-earn the slot** (`0.5 × V`)? Presumably,
  but it interacts with §3d's "every completion pays in full" and
  should be stated rather than inferred.
- **Rounding.** `fraction × integer points` does not land on integers;
  `largestRemainder` already exists for this shape.

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

### 4. Weights are set directly, on a pie

The direct-manipulation write path **already exists**:
`applyPriorityOrder` (`db/ranking.ts:218`) writes user-arranged weights
to `unit_weight.override`, recomputes every task's points, and recaches
day scores; `resetToDiagnostic` drops them. The schema already says
*"Effective weight = override ?? derived."*

What is new is that today's override still runs **through** the formula
— the priority board converts an ordering into synthetic importance via
`rankToScore` and feeds `deriveWeights`, so the satisfaction gap still
applies. A pie sets the weight **directly**, which is the first thing to
bypass `deriveWeights`, and it trips the AGENTS.md invariant *"importance
first, satisfaction-gap boost second."*

Recommended: the pie is the **override editor**, not a replacement for
the diagnostic. The diagnostic still seeds it and still records
importance and satisfaction for the portfolio graph. The existing
invariant — *every override still displays the recommended value beside
it* — renders as **the dragged slice with a ghost mark where the
diagnostic put it.**

**The pie and commitment-units are one feature.** Adding a commitment
has to take weight from somewhere, and the pie is the only honest place
to do it.

**Not a literal pie, probably.** Eighteen-plus slices on a phone puts
several units under 3% — about 10° of arc — against 44pt hit targets,
200% Dynamic Type, and AA contrast across 18 colours from a 6-hue
palette. ADR-0021 carries the relevant scar: *"No UI may let the user
re-rank, re-weight, or reorder areas into a stored value; that has been
built once and it destroyed data."* Recommended shape: **pie as the
display, a row per unit as the editor.** Also decide what absorbs a
drag — proportionally across the rest, from a neighbour, or with locks.
`largestRemainder` already keeps the integers summing to 100.

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

1. ~~**Does carry-forward accumulate visibly?**~~ **Settled
   2026-09-11:** yes, and that is normal planner behaviour. See §3.
2. **What does the Tasks screen's point column say** when a task's
   value depends on the day? That column is exactly what ADR-0027 was
   written to fix — it summed to 118, and *"a page whose stated job is
   'where are my points going' answers with a number that is not 100."*
   A range, a typical day, or a weekly total.
3. **Does the pie replace the diagnostic or sit beside it?** Recommended
   beside. The honest counter: the diagnostic is 18 units × 2 ratings,
   monthly, and if Henry always overrides then it is ceremony. Decide
   from use, not now.
4. ~~**Is 40 a sensible default** for the commitment band?~~
   **Settled 2026-09-11:** the user picks, 10–60 in steps of 5. What
   replaced it is sharper and is in §2: **is the band set or
   emergent?** A slider and "commitments are weighted units on the pie"
   are two controls for one number, and only one can be right.
5. ~~**Choice set or pool**~~ **Settled by §§3d–3e:** equal-priced
   pools of at most three, one slot, every completion pays full. What
   remains open is narrower — where the pool's value `V` comes from,
   and the Masicampo & Baumeister question (how much optionality before
   a plan stops being a plan), which still wants a literature pass
   rather than a guessed number. Three is a plausible answer on that
   count too, which is mild evidence the cap is right.
6. ~~**Is "the user chooses" now a stated product principle?**~~
   **Answered 2026-09-11 — see below.** It is, and it is narrower and
   better than "the app has no opinions."
7. **Write ADR-0026 (task size and day load) now.** Three separate
   parts of this design need it (§3e). Its shape is already fixed by
   ADR-0024 §6 — `quick | normal | big`, never minutes.

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
