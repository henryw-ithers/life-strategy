# ADR-0029: A day is the fraction of itself you got through

> **Status:** Accepted\
> **Date:** 2026-08-26\
> **Deciders:** Henry

> **What Henry decided (2026-08-26), and what is drafted around it.**
> Four calls are his, all made the same afternoon as
> [ADR-0028](0028-priority-is-the-only-input.md) and correcting it:
> *"by daily I actually mean anything planned for that day"* — a
> 3×/week task scheduled for today is today's work; *"assume that
> weekly or less frequent tasks are evenly divided amongst the days of
> the week… seven one-time anytime-during-the-week tasks, you're
> expected to do one of those a day"*; a run done on a day it was not
> pinned to **counts on the day you did it**, and the pinned day then
> stops expecting it; and *"if you did every task you planned for the
> week you should have around a 90 average."* Everything else — the
> pool arithmetic, day-relative point values, the fate of ADR-0024 §2,
> and the action items — was drafted around those calls.

## Context

ADR-0028 §3 fixed the reported 64 by removing the coverage forfeit. It
did not touch the line ADR-0027 drew between a *routine* band of 80 and
a *variable* band of 20, and that line was the deeper mistake.

**Cadence was doing a job it should never have had.** Under ADR-0027 a
task earned from the routine band only if it happened every single day.
Everything else — a 3×/week gym session, a Sunday walk, a weekly
finance review — shared 20 points with logged activities and special
days. So a genuinely weekly commitment was worth a fraction of a daily
one, and a full week of exactly your own plan averaged about 83. The
ADR named this in its own Consequences: *"if this ADR proves wrong, it
is this paragraph that was wrong."* It was.

**An amortized denominator was drafted and rejected.** The first
attempt at this ADR spread every task's frequency across all seven days
— a 3×/week task contributing 3/7 of itself to each. Henry: *"makes no
sense and is not at all what I said."* He is right, and the reason is
worth recording, because it is the insight the whole model turns on: a
scheduled task is either on today's list or it is not. Diluting it
across the week means every day is a little bit short of every task,
which is a description of nobody's actual day. The same plan came out
at 74 for a week in which everything got done.

**What a person actually means by "today's tasks."** Two different
things, and they need two different rules:

- Work with a day attached — an every-day habit, or anything pinned to
  this weekday. It is on today's list, in full.
- Work with no day attached — "sometime this week." It is not on any
  particular day's list, so the honest thing is to spread it: seven
  loose weekly tasks means about one a day, and *which* one does not
  matter.

Constraints already in force:

- **Plans never touch the grade** (ADR-0024 §2). This ADR withdraws it
  — see §3, which is the only part of this decision that gives anything
  up.
- **The app never shames** (ADR-0008); no mechanic conditions on a
  shortfall.
- **The denominator is a constant 100** (ADR-0027 §1). Kept.
- **Extra runs are the one route above 100** (ADR-0023 §2). Kept.
- **History never silently restates** (ADR-0002). Kept.

## Open questions

1. What does a day expect of you?
2. What is a day's score, given that?
3. Does reading a weekday pin turn the grade into an adherence score?
4. What is a task worth, if not a fixed number of points?
5. Does any of this reach back into days already graded?

## Options considered

### What a day expects

- **Every-day tasks only** (ADR-0027). Rejected: it is what made a
  weekly commitment nearly worthless.
- **Amortize every task by `f ÷ 7`.** Drafted and rejected by Henry —
  see Context. It also fails his target: a full week reads 74.
- **Anchored work in full, flexible work pooled and spread.** Chosen.
  See §1.

### The 90

- **Keep 80/20 and let a good day overflow past the band.** Rejected:
  it makes "80" mean an average day rather than a full one, and days
  oscillate for reasons the user cannot see.
- **90 planned / 10 unplanned.** Chosen. Doing what the day asked pays
  90 by construction rather than by tuning.

## Decision

### 1. A day expects what is actually due, by two rules

**Anchored work is expected in full, on its own day.** An every-day
task is due every day. A task pinned to Monday, Wednesday and Friday is
due — completely, not fractionally — on each of those, and not at all
on a Tuesday. A fortnightly pinned task is due only in its own half of
the fortnight, as ADR-0024 §1 already defines.

**Flexible work is pooled and divided evenly.** A task with no weekday
pin is not due on any particular day, so the runs it still owes this
week join one pool, and the day expects that pool spread over the days
the week has left. Seven unpinned weekly tasks means the pool asks for
one a day, and *any* one of them fills the slot. One-offs join the same
pool, owing a single run.

    expected(day) = Σ weight of anchored work still owed
                  + (Σ weight of flexible runs still owed) ÷ days left in week

**"Still owed" is counted from the days before this one**, never from
today's own completions — the same rule `deriveChecklist` already used
for banding. The denominator cannot shift under someone while they work
through the list.

**A day with nothing due is not graded at all**, the same shape as a
day off: `{0, 0}`, no number, out of the weekly aggregate. That happens
only when the week's flexible work is finished and no task is anchored
to today. See Consequences for what it costs.

### 2. The day's score is that fraction, and the bands are 90 / 10

    planned  = 90 × min(1, weight completed today ÷ expected(day))
    unplanned = min(activities + special-day bonus, 10)
    day       = planned + unplanned + extra runs, out of 100

**Planned — 90.** Everything you said you would do, at any cadence.
ADR-0027's routine/variable split is replaced: the line now falls
between *planned* and *unplanned* rather than between *daily* and
*weekly*. Do what the day asked and the band pays in full, which lands
Henry's target — *"every task you planned for the week → around a 90
average"* — by construction.

**Unplanned — 10.** `UNPLANNED_CAP` goes 20 → 10 and goes back to
meaning what ADR-0023 §1 named it for. ADR-0027 §3 had widened it to
cover planned weekly work as well; planned work now has a band of its
own, so it stops competing for this one. A 10-rated special day draws
10 points rather than 20 — the honest consequence of giving the plan
90.

**Extra runs stay outside both bands** (ADR-0023 §2, unchanged), priced
at `EXTRA_RUN_RATE` against the same day-relative rate as everything
else.

**Task count within a unit still does not matter** (ADR-0028 §3, kept).
A unit divides its weight across its tasks by rank; one task carrying
30 and three carrying 10 each come to the same thing when they are all
done.

### 3. Obligations are weekly, so the wrong day costs nothing

**This withdraws [ADR-0024](0024-day-planning-is-intention.md) §2**,
which said `times_per_week` is "the sole scoring source of truth" and
that plans shape presentation and nothing else. The grade now reads
`planned_weekdays`. That invariant existed for a specific fear —
schedule-violation scoring — and the fear is answered directly rather
than by keeping the pins out.

**Nothing anywhere compares a completion's date to the day it was
pinned to.** What is tracked is what the *week* still owes. So:

- Do Friday's run on Monday and Monday counts it, in full. Friday then
  owes nothing and expects nothing.
- Miss a pinned Monday and it **lapses silently** — it does not
  reappear as a debt on Wednesday. That is ADR-0024 §2's third bullet,
  preserved exactly.
- No adherence rate, plan-completion percentage or streak is computed
  or stored, and none can be derived from what is: ADR-0024 §2's own
  final bullet, still true.

What genuinely changes is the *shape* of a day: a Tuesday with three
pinned tasks asks more of you than a Tuesday with one. That is the
point — it is what makes "did I do today's list" answerable — and it is
not the same thing as being charged for doing the right work on the
wrong day.

> **Amended 2026-10-01 by [ADR-0037](0037-rest-days.md) §3.** A run
> pinned to another day this week is no longer counted into the day it
> is done on. It is paid **what its pinned day would have paid**,
> outside the bands and uncapped, on whatever day it is done — Henry:
> *"early tasks count as much as they would if they were done on the
> day they were planned."* Everything above still holds: nothing
> compares a completion's date to its pin to charge for it, a missed
> pinned day still lapses silently, and no adherence figure exists.
> The date is read only to choose which day's price to pay.

### 4. A task's worth is a property of the day, not of the task

`task.point_value` now stores a **weight**: a share of the portfolio's
100, from its unit and its rank there. What a run is worth in points is
computed per day:

    points = 90 × weight ÷ expected(day)

So the same task pays more on a light day than on a heavy one. That is
not a quirk to hide; it is the model saying what it means, which is
that a day is graded on the fraction of itself you got through. The
checklist shows the live number.

The column keeps its name — the schema is forward-only (ADR-0002) — and
still sums to 100 across the portfolio, which is what the Tasks
screen's right-hand column reads.

### 5. Formula version 9, and history is left alone

`FORMULA_VERSION` moves to 9. Days already graded **keep the numbers
they were given**; `day_grade.formula_version` records which era each
belongs to. A v8 `earned` and a v9 one are not comparable.

## Consequences

**Easier.** The number finally answers the question a person actually
asks a daily score: *did I do today?* Cadence stops being a scoring
concept, so a weekly commitment is worth what its unit says it is
worth rather than a fraction of it. A full week of your own plan is 90,
whether that plan is three daily habits, a pinned gym schedule, or
seven loose errands — all three are tested. The engine loses the
routine/variable split, `bandPointValues`, `isRoutine`, and the
separate stored extra-run credit.

**Harder.** Point values move day to day, and that will be surprising
the first time someone notices a task worth 30 on Tuesday and 22 on
Wednesday. The explanation is short and true, but it *needs* an
explanation, where a fixed number did not.

**Accepted costs.**

- **Bunching a whole week into one day is free.** Do all seven loose
  weekly tasks on Monday and Monday reads 90; the rest of the week has
  nothing due and is not graded, so the week reads 90 for one day of
  work. This is deliberate — it *is* doing every task you planned for
  the week, which is exactly what Henry's target pays 90 for — and it
  is bounded by the fact that an every-day task cannot be bunched. A
  plan made entirely of flexible work is the shape ADR-0003 §6 already
  advises against.
- **A special day is worth half what it was.** The unplanned band is
  10, so the most a memorable day can draw from its rating is 10.
- **The 10 is thin for a genuinely spontaneous day** — a day off plan
  entirely still needs "Day off" (ADR-0023 §4) to avoid reading as a
  miss. That was true at 20 as well, just less sharply.
- **This is the fourth formula in nine days** (v7 on the 18th, v8 and
  v9 on the 26th). ADR-0028 said the next change should wait for a
  fortnight of evidence and then this landed the same afternoon; the
  defence is that v8 and v9 came from one conversation and one
  misreading rather than from two independent failures, and that v9 is
  the first version that states what a day *is* rather than how its
  points are divided. It is still churn, and the calibration
  experiment (ADR-0008) now has no window spanning a single formula.
  **The next change to this engine waits for a fortnight of use.**

**Revisit when:** a fortnight of real use shows 90 arriving on days
that did not feel like 90 — which is what ADR-0008's divergence
measures, and the reason §4 of ADR-0028 left the band split named as
calibration's candidate lever. Or if day-relative point values prove
genuinely confusing in use, in which case the lever is presentation
(show a share, not a number), not the model.

## Action items

1. [x] `packages/scoring`: new `dayLoad.ts` (anchored vs flexible,
       weekly obligations, `computeDayLoad`); bands become
       `PLANNED_BAND` 90 / `UNPLANNED_BAND` 10; `bandPointValues` →
       `taskWeights`; `computeDayScore` takes a `DayLoad`;
       `deriveChecklist` prices day-relative; `FORMULA_VERSION` 9.
2. [x] App: `loadDay` builds `LoadTask`s from `planned_weekdays` and
       feeds one `computeDayLoad`; `recomputeAllUnitPoints` stores
       weights; activity day-rate rebased to the 10 band; `DayData.daily`
       → `due`; coverage counts any task; onboarding copy says 90.
3. [x] Withdraw ADR-0024 §2, amend ADR-0023 §1, ADR-0027 §§1/3 and
       ADR-0028 §3 with pointers here; update the ADR index and
       AGENTS.md.
4. [x] The checklist shows a point value per row that now changes with
       the day. Read `components/today/TaskRow.tsx` against §4 and
       decide whether the number or a share reads better. *(Decided
       2026-10-02, Henry: **live points.** Each row shows what it pays
       today — or, done off its planned day, what that day would have
       paid (ADR-0037 §3).)*
5. [x] `docs/design/calendar-and-day-planning.md` and
       `docs/design/copy-guide.md` describe pins as presentation-only.
       Both need a pass against §3. *(Done 2026-10-02: the calendar
       note carries a dated amendment covering §3 and ADR-0037 §3; the
       copy guide never described pins and needed nothing.)*
6. [x] Decide what happens to a week bunched into one day, if it turns
       out to happen. The candidate is to keep grading days with
       nothing due, at full marks — but that pays for silence, so it
       needs its own thinking rather than a default. **Decided
       2026-10-01 by [ADR-0037](0037-rest-days.md):** a day with
       nothing due and a plan behind it is a rest day, automatically —
       70, then activities and early work on top.
