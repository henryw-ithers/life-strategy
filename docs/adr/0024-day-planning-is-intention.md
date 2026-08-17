# ADR-0024: Day planning is intention, not obligation

> **Status:** Accepted\
> **Date:** 2026-08-16\
> **Deciders:** Henry

> **What Henry decided (2026-08-16), and what is drafted around it.**
> Four calls are his and are recorded as made: two ADRs rather than one
> (this, then ADR-0025); part-of-day **replaces** the checklist's
> frequency sections; the intrinsic/instrumental flag is unit-level with
> a task-level override (ADR-0025's business, banked here); task size
> and the load meter are **deferred** to their own ADR. Everything else
> below — schema shape, ordering rules, copy, action items — was drafted
> around those calls and **accepted with them on 2026-08-16**.

## Context

A task today is a title, a unit, and `times_per_week` (0–7). There is
no representation of *which day* a run happens on, or *when in the
day*. The checklist groups by frequency — "Every day," "This week" —
which is a statement about the scoring model, not about the shape of a
day.

[calendar-and-day-planning.md](../design/calendar-and-day-planning.md)
(2026-07-17) already planned two of the pieces — weekday pinning
(phase 2) and occurrence placement (phase 3) — and wrote the governing
principle this ADR promotes to a decision. That note stands; this ADR
supersedes none of it and adds the granularity question it never asked.

[scheduling-and-motivation.md](../design/scheduling-and-motivation.md)
(2026-08-16) is the research pass behind the decisions here. The load-
bearing findings:

- **Implementation intentions** (Gollwitzer & Sheeran 2006; 94 studies,
  8,000+ participants) produce **d = 0.65** on goal attainment and
  **d = 0.77** on preventing derailment. The effective form specifies a
  **cue**, not a clock.
- **Habit formation** (Lally et al. 2010) is context-cue → response
  built by repetition in an *unvarying* context — the case for stable
  weekday pins over "any 3 days." Lally also found **missing one
  occasion does not materially affect habit formation**, which is
  empirical backing for the gentleness this product already commits to.
- **Tonietto & Malkoc 2016** (13 studies): scheduling a leisure
  activity makes it feel more work-like and reduces enjoyment — but
  **"rough scheduling" (a broad window, no specific time) eliminates
  the effect**, and the penalty does not apply to utilitarian tasks.
- **Masicampo & Baumeister 2011**: making a specific plan eliminates
  the intrusive-thought cost of an unfulfilled goal *without doing the
  task*. The payoff of planning is mental quiet, not throughput.

Constraints already in force:

- **The daily surface stays checklist-simple** (PRODUCT.md design
  principle 2; the project-management anti-reference). This is the
  invariant most at risk from anything called "scheduling."
- **Planned work is what pays** (ADR-0023). Any new credit source must
  declare which side of the planned/unplanned line it falls on.
- **The app never shames.** No schedule-violation mechanics anywhere.
- **Ambient kindness** (ADR-0008): nothing may condition on a miss.

## Open questions

1. What granularity does a plan have — a weekday, a part of the day, a
   clock time?
2. May a plan affect the grade?
3. What does the daily checklist look like once plans exist?
4. Where does planning happen, and how often?
5. ADR-0010 §1 defers pinned-day reminders "until calendar phase 2."
   Shipping pins fires that trigger. What do they say?

## Options considered

### Granularity

- **Clock times.** Most expressive; integrates conceptually with a
  calendar. Rejected: it is the direct route to the project-management
  anti-reference, it needs a time picker on every task, and Tonietto &
  Malkoc show it actively damages roughly a third of the taxonomy —
  the third the app most wants people to actually do.
- **Weekday only.** Cheapest; already planned. But it says nothing
  about the shape of a day, so the checklist stays a flat list and the
  "when" half of an implementation intention is only half-specified.
- **Weekday + part of day.** Rough scheduling in exactly the sense the
  research validates. Enough to be an implementation intention, not
  enough to be a schedule. **Chosen.**

### Checklist grouping

- **Keep frequency sections, order within them.** Most conservative,
  nothing to relearn. Rejected by Henry: the day never reads as a
  shape, and frequency grouping communicates the scoring model rather
  than the day.
- **Part-of-day only in the weekly planner.** Smallest daily change.
  Rejected: the plan then has no effect where the user actually is.
- **Replace frequency sections with parts of day.** **Chosen.**
  Frequency becomes metadata on the row rather than a heading, and the
  day groups into fewer, deeper blocks — the flow-friendly direction,
  and a partial answer to the checklist-granularity concern raised in
  the subtasks backburner entry.

## Decision

### 1. A plan is a weekday and a part of day. Never a clock time.

> **Challenged and reaffirmed, 2026-08-16.** Henry argued for times on
> the strength of real cases — a weekly band practice, a Tuesday night
> movie tradition, a tee time — and the argument that carried for
> holding the line was **functional, not psychological: a clock time
> would drive nothing this app does.** There are no per-task reminders
> (§5 declined to add any) and no time-slot calendar, so the only thing
> a time could affect is checklist ordering, which part-of-day already
> provides. Recorded in
> [ADR-0025 §7](0025-communal-units-are-dimensions.md).

The planning primitive is **(weekday, part of day)** where part of day
is `morning | afternoon | evening | anytime`. No time picker exists
anywhere in the app, and none is added later without reopening this
ADR.

`anytime` is a first-class value and the default, not a null state. A
task with no part-of-day preference is *deliberately* flexible, which
is the correct representation for most of the plan.

### 2. Plans never touch the grade. This is an invariant.

`times_per_week` remains the sole scoring source of truth. Day plans
shape **presentation and defaults** — what the checklist leads with,
where runs sit on the calendar, what the weekly pass proposes — and
nothing else. Specifically:

- Doing three runs on three days you did not plan is a **perfect
  week**, scored identically to doing them as planned.
- An unfulfilled placement **lapses silently**. It is not surfaced, not
  counted, and never mentioned again.
- No streak, adherence rate, or plan-completion percentage is computed
  or stored. Adherence is not a statistic this app keeps.

This promotes the planning note's governing principle to ADR level
because it is the invariant the whole feature rests on, and because
"planning" is the single most likely place for a schedule-violation
mechanic to arrive by accident.

### 3. The checklist regroups by part of day

Sections become **Morning · Afternoon · Evening · Anytime**, replacing
"Every day" and "This week." Rules:

- **Empty sections do not render.** A user who pins nothing sees one
  "Anytime" list — the current experience, unchanged, with no new
  concepts on screen. The feature is invisible until used.
- **Frequency moves onto the row** as existing secondary text
  (`formatFrequencyShort`), where it already has a home.
- **"Done this week" and "Completed" are unchanged** and stay below the
  part-of-day sections.
- Within a section: planned-today first, then flexible-with-runs-left,
  then the rest. Completed rows sink, as now.

### 4. The weekly planning pass is where planning happens

Planning is a **once-a-week surface**, not a per-task interaction
scattered through the week. It offers the week's outstanding runs and
lets the user place them onto days.

Two reasons this shape and not another. First, Masicampo & Baumeister:
the benefit is the relief of having planned, which is a single act, not
a running obligation. Second, the app's three rhythms are daily,
weekly, and monthly, and **the weekly rhythm is currently the
thinnest** — one contentment question. Planning gives the weekly cycle
a forward-looking half to match the monthly review's backward-looking
one, at a cadence that cannot threaten daily simplicity.

The daily checklist stays **read-mostly with respect to planning**:
you may complete anything at any time regardless of where it was
placed, and nothing on the daily surface asks you to re-plan.

### 5. Pinned-day reminders: the trigger fires, the copy does not change

ADR-0010 §1 deferred pinned-day reminders until this phase. It is now
here, and the answer is that **§3's copy rule stands unamended**:
notification copy still carries no task names, no unit names, and no
counts. A pin may change *whether* the single daily nudge is worth
sending; it may never change what it says. "You planned Friendship
today" is exactly the lock-screen disclosure §3 exists to prevent, and
the ambient-kindness test it would have to pass is one it fails on any
day the user did not do it.

No new notification is added. ADR-0010's reminder set stays at one.

### 6. Deferred to ADR-0026: task size and the day-load meter

Effort size (`quick | normal | big`, reusing `activity.size`'s
vocabulary) and a per-day load indicator are the instrument for flow's
challenge–skill balance, and the honest answer to "how long do I want
to spend" — honest because minute estimates would inherit the planning
fallacy, which the app cannot correct without task segmentation it has
deliberately refused. Deferred because the weekly planner is what makes
load meaningful, and its shape should inform the decision. **Trigger:**
the weekly planning pass is in real use and the question "is this day
too full?" has come up unprompted.

## Schema additions

Landing with their phases, per ADR-0002 conventions:

- **`task.planned_weekdays`** — nullable text, ISO weekday numbers,
  e.g. `"1,3,5"`. Null = flexible. Picking days sets `times_per_week`
  (3 days picked = 3×/week); clearing pins reverts to flexible. One
  mental model, no contradiction between the two settings. *(Phase 2 —
  as specified in the planning note, unchanged.)*
- **`task.part_of_day`** — nullable text,
  `morning | afternoon | evening`. Null renders as *Anytime*. *(New in
  this ADR; phase 2.)*
- **`planned_occurrence`** — id, task_id, local_date, `part_of_day`,
  created_at. Archived rather than deleted when its task archives.
  *(Phase 3 — the planning note's shape plus part of day.)*

No scoring tables change. `day_grade.plan_snapshot` is untouched:
plans are not part of the plan-as-scored, so re-derivation does not
need them.

## Consequences

**Easier.** The checklist finally describes a day rather than a
scoring model. Habit-forming tasks get the stable context cue the
research says they need. The weekly rhythm gets substance. The
feature is invisible to a user who ignores it, so it costs nothing on
the daily surface until chosen. And "never a clock time" is a
structural guarantee rather than a discipline — with no time picker in
the codebase there is no path by which a schedule can leak in.

**Harder.** The checklist's grouping logic gets a second dimension, and
part-of-day sections plus frequency-derived ordering is more state than
the current two-bucket split. `planned_weekdays` and `times_per_week`
must be kept consistent in both directions, which is a real source of
edit-time bugs. The month calendar (phase 4) now has two kinds of
future marker to render rather than one.

**Accepted costs.** A user who wants a genuine time-blocked calendar
will not get one, ever, from this app — that is a deliberate product
boundary and not a gap to be filled later. Placements that lapse leave
no trace, so there is no data on how well anyone plans; that is the
price of refusing to compute adherence, and it is worth paying.

**Revisit when:** real use shows part-of-day is too coarse *for
instrumental units specifically* (which would be an ADR-0025 question
before it is this one's); the weekly pass goes unused, which would
suggest planning wants to live on the daily surface after all; or
ADR-0026's load work needs placement data this ADR chose not to keep.

## Action items

1. [ ] Phase 2: `task.planned_weekdays` + `task.part_of_day` migration;
       weekday chips and a part-of-day segmented control in
       `TaskEditSheet`, wired to `FrequencyPicker` per §Schema.
2. [ ] Regroup the checklist by part of day in
       `apps/mobile/src/app/(tabs)/index.tsx` — empty sections omitted,
       frequency demoted to row metadata.
3. [ ] Phase 3: `planned_occurrence` table and the weekly planning
       pass; the week strip becomes editable for future days.
4. [ ] Confirm no adherence statistic is computed anywhere — this is
       the invariant most likely to be violated by a well-meaning
       addition.
5. [ ] Note in ADR-0010 §1 that the pinned-day trigger fired and was
       answered here with "no change."
6. [ ] Update the ADR index: 0024 listed; 0025 and 0026 reserved with
       triggers.
7. [ ] Fold the Lally citation into
       [copy-guide.md](../design/copy-guide.md) beside the
       missed-day copy — the research and the tone agree, and that is
       worth recording where the copy decisions live.
