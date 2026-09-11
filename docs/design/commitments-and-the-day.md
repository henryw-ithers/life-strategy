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
4. **Is 40 a sensible default** for the commitment band, and is it per
   commitment or shared across all of them?
6. **Choice set or pool** for window options, and how many members
   before a plan stops being a plan (§3c). Wants a literature pass, not
   a guess.
5. ~~**Is "the user chooses" now a stated product principle?**~~
   **Answered 2026-09-11 — see below.** It is, and it is narrower and
   better than "the app has no opinions."

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
