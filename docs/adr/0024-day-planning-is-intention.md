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

- ~~**Empty sections do not render.** A user who pins nothing sees one
  "Anytime" list — the current experience, unchanged, with no new
  concepts on screen. The feature is invisible until used.~~
  **Amended 2026-08-17 — see below.**
- **Frequency moves onto the row** as existing secondary text
  (`formatFrequencyShort`), where it already has a home.
- **"Done this week" and "Completed" are unchanged** and stay below the
  part-of-day sections.
- Within a section: planned-today first, then flexible-with-runs-left,
  then the rest. Completed rows sink, as now.

> **Amendment (2026-08-18): the day is arrangeable, and pins now
> group.**
>
> Three changes, all on the daily surface, all still presentation:
>
> - **Custom order.** `task.day_order` (migration 0011) records where
>   a row sits within its part of the day, and dragging writes it.
>   Persistent rather than per-day, on Henry's call: *"if I put
>   sunlight and supplements at the start of my tasks I want it to
>   stay there."* Deliberately separate from `rank_in_unit`, which
>   prices the task — two orders doing two jobs.
> - **Moving between parts of the day**, by press-and-hold on an
>   incomplete row. The sheet asks the scope every time: *just today*
>   writes a `planned_occurrence`, *from now on* rewrites the task.
>   §2 is untouched — a placement is still an intention, still lapses
>   silently, and still produces no adherence statistic.
> - **Tasks pinned to other days leave today's slots** for a section
>   of their own. They used to sort last inside the periods, which
>   padded a Tuesday morning with Monday's plan and stopped the day
>   describing the day. They stay open, tappable and worth full
>   points: doing Friday's run on Tuesday is still a perfect week.
>
> - **The look-ahead planner**, which is what §4 asked for and never
>   got. Tapping a future day — or "Plan tomorrow" on today — opens
>   the day's shape and walks a task through its slots on tap. Every
>   move writes a `planned_occurrence` for that date only, so
>   arranging Wednesday never edits the task; verified that today,
>   Thursday and the task itself all stayed put. Completion is
>   deliberately absent: you cannot tick tomorrow.
> - **Fortnightly tasks can pin to a weekday**, with a switch for
>   *which* Tuesday. `task.fortnight_offset` (migration 0012) plus
>   `weekOfFortnight` in the scoring package: fortnights stay anchored
>   to epoch-even weeks so the boundary never drifts, which leaves the
>   choice to the task and the flip to the user. `isDueOn` is now the
>   single answer to "does this belong to this date", shared by the
>   checklist and the planner.
>> **Cross-section dragging** (built 2026-08-18, after a first pass
> deferred it). Hold a row and drag it anywhere in the day: reorder
> inside a slot, or move it to another. `ReorderableList` could not
> do this — it positions rows at `index × rowHeight`, and once
> headers sit between sections a row's y depends on which section it
> is currently in, which is the thing the drag changes. Rather than
> put that walk inside the component the Tasks screen depends on,
> the checklist got its own: `SectionedChecklist`, over a list of
> lists.
>
> **Empty periods are drop targets.** That is most of the point —
> "do this in the afternoon" matters most when the afternoon is
> empty, which is exactly when there is no row to drop beside.
>
> The layout walk lives in `checklistLayout.ts`, free of React Native
> imports and covered by 16 tests, because a long-press-armed pan is
> not reproducible with synthetic events and the failure mode is
> silent: a row lands in the wrong part of the day and is written
> there. A drop **into another slot** still asks the scope question a
> drag has nowhere to put — just today, or from now on — while a
> reorder inside a slot saves without comment, because arrangement is
> a preference and a slot is a plan.
> **Amendment (2026-08-17): the three periods always render, and an
> empty one reads *Free*.**
>
> "Invisible until used" was the right instinct applied to the wrong
> object. It produced two behaviours that both had to go:
>
> - The shipped build kept **frequency mode** ("Every day," "This
>   week") as the default and switched to part-of-day only once some
>   task carried one. Two groupings for one list, and which you got
>   depended on a field you may never have opened.
> - Empty sections vanished, so a day with an evening run and nothing
>   else showed *one* section. The page then described a fragment of a
>   day rather than a day.
>
> Now: **Morning, Afternoon and Evening render every day, in order,
> whether or not anything sits in them.** A period with nothing planned
> in it reads **Free**; one whose tasks are all ticked off reads **All
> done** (Henry, 2026-08-17). Saying "Free" for both would report a
> morning you spent as a morning you skipped. There is deliberately no
> state for a period you have not got to yet — it keeps its rows and
> says nothing, which is what ADR-0008 requires of anything that could
> otherwise notice a shortfall.
>
> "Free until this afternoon" is the most useful sentence this screen
> can say, and it is unsayable if the empty half of the day is missing.
>
> **Anytime keeps the old rule** and hides when empty. It is not a
> fourth time of day — it is where deliberately unplaced work lives —
> so an empty one is nothing to report rather than free time.
>
> This costs nothing in vertical space that matters: an empty period is
> one line of caption text, and three of them are cheaper than the two
> section headings they replaced. The copy is `emptyPeriodNote` in
> `planning.ts`, tested there.
>
> **Completed stays collapsible**, as every section with rows in it is.
> A finished day fills that section with everything you did, and the
> header is how you fold it away — the one control the day's tail
> needs.

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

> **Amendment (2026-08-17): a task's standing plan is set when the task
> is created.**
>
> Phase 2 put the weekday chips and the part-of-day control in
> `TaskEditSheet` only (action item 1, as written). The effect was that
> **every task was born flexible**, and planning it meant finding it
> again on another screen — so the implementation intention this whole
> ADR rests on was the one step the flow made optional, and the
> checklist's day shape stayed empty for anyone who never went looking.
>
> Creating a task now asks, in this order: what it is, which units it
> serves, **how often, which days, when in the day**. Both surfaces
> render the same `SchedulePicker`, so the questions cannot drift into
> two orders between creating a task and revising one.
>
> This does not move planning off the weekly pass. The two are
> different objects: a task's **standing plan** (this happens Monday,
> Wednesday and Friday, in the morning) belongs with the task and is
> answered once, while **placing this week's outstanding runs** on
> particular dates is the weekly pass's job and still is (§4 above,
> `planned_occurrence`, phase 3). Nothing here touches the daily
> surface, which stays read-mostly.
>
> Days remain multi-select and the frequency stays derived from them
> (§Schema, unchanged): three chips is three times a week. Choosing
> nothing is still flexible, still the default, and still not a lesser
> state.

> **Amendment (2026-08-20): the look-ahead planner is a route, reaches
> four weeks, and is arranged by dragging.**
>
> The planner shipped as a bottom sheet opened by a text link at the
> foot of Home's scroll, labelled *Plan tomorrow*. Four things were
> wrong with that, and only one was cosmetic.
>
> - **It could not reach past Saturday.** The link and the week strip
>   both drew on `editWindowDays`, which returns fourteen days starting
>   at `weekStart(today) − 7` — last week plus this week. On a Friday
>   the entire look-ahead was one day. A surface for planning that
>   cannot see next week is not a planning surface. The window is now
>   its own function, `planningDays`, and it is **the next 28 days**:
>   far enough to hold an appointment made a fortnight out, short
>   enough that the arrows stay a reasonable way to travel it.
> - **A sheet cannot host a drag.** §3's cross-section drag is a
>   long-press-armed downward pan, which is exactly the gesture a
>   bottom sheet reads as *dismiss me*. So the planner moved tasks by
>   **tapping** — a second, weaker grammar for the one operation the
>   rest of the app does by hand. As a pushed route it reuses
>   `SectionedChecklist` unchanged, and arranging tomorrow is the same
>   gesture as arranging today.
> - **The link sat last on a scroll**, under the record buttons, which
>   is where you put something you hope nobody needs. It is now a quiet
>   trailing control in the date header, beneath the week strip:
>   an affordance about *which day* belongs beside the days.
> - **It could only ever mean tomorrow.** The route takes the date as a
>   parameter and steps with arrows, and tapping any future day in the
>   strip or the month grid opens it at that date.
>
> **The drag here never asks the scope question.** §3's amendment has
> a drop into another slot ask *just today* or *from now on*; on a
> future day that prompt is noise, because "just this day" is the only
> thing a drag on a day you are planning can mean.
>
> A drop writes the same two things a drop on the checklist writes,
> and they are separate on purpose. **Which slot** is a statement about
> that date: a `planned_occurrence`, never the task — verified by
> dropping a morning task into tomorrow's evening and confirming today,
> the following day, and the task row itself were all untouched.
> **Where in the slot** is `dayOrder`, which this ADR settled as
> persistent and shared by every day, so a row arranged in the planner
> is arranged on Home too. A same-slot reorder briefly wrote *nothing*
> — the row animated into place and snapped back on the next load —
> which is the failure mode a silent no-op with visual feedback always
> is.
>
> **Rows pinned to other days are not part of the day's shape.** They
> get the same treatment §3 gives them on the checklist: their own
> group, below the periods, outside the drag. Without that split a task
> pinned to Monday sat in Friday's Afternoon slot looking exactly like
> something due Friday, so the one screen whose whole job is showing a
> day's shape showed the wrong one. They are not draggable here because
> a placement made on them would be sorted straight back out of the
> slot on reload — a control that appears to work and does not. The
> ordering and the split are now one implementation in `planning.ts`
> (`compareForDay`, `pinnedElsewhere`), shared by both screens and
> covered by tests, because a day arranged one way on Home and another
> way in the planner is the same day disagreeing with itself.
>
> **The route parameter is not trusted.** A deep link to a past date,
> or one past the window, falls back to tomorrow: the arrows already
> refuse to go there, and a placement written on a settled day would
> change a record rather than a plan.
>
> **Adding from inside a day makes a one-off dated to that day.** The
> add sheet takes a `lockedOneOffDate`, which fixes the date and hides
> the Repeats/Once switch: you came to arrange Thursday, and a
> recurring task created from there would quietly change every
> Thursday. Making a repeating task is a tab away, where you can see
> the plan you are changing.
>
> §2 is untouched. A placement made here is still an intention, still
> lapses silently, and still yields no adherence statistic. Completion
> remains absent by construction — `isEditable` refuses anything after
> today, and offering the tick would invite the get-ahead mechanic the
> grade exists to ignore.

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

1. [x] Phase 2: `task.planned_weekdays` + `task.part_of_day` migration;
       weekday chips and a part-of-day segmented control in
       `TaskEditSheet`, wired to `FrequencyPicker` per §Schema.
       **Extended 2026-08-17** (§4 amendment): the same three controls
       are in `AddTaskModal` too, shared as `SchedulePicker`, so a task
       is planned when it is created rather than on a later visit.
       **`FrequencyPicker` was replaced by `FrequencyStepper`
       2026-08-18** and deleted. Nothing in §Schema changes: the same
       0-7 value, the same "days set the frequency" rule. The wheel
       simply cost 120pt of a sheet that now asks five questions, which
       put the last two below the fold on every phone; a stepper says
       the same thing in 50.
2. [x] Regroup the checklist by part of day in
       `apps/mobile/src/app/(tabs)/index.tsx` — ~~empty sections
       omitted~~ the three periods always shown with **Free** when
       empty (§3 amendment, 2026-08-17), frequency demoted to row
       metadata.
3. [x] Phase 3: `planned_occurrence` **is written and read** —
       by the daily move sheet and by the look-ahead planner
       (2026-08-18). The table sat unused from the day this ADR
       created it. What remains of §4 is the *weekly* pass — a
       once-a-week surface over the whole week rather than one day
       at a time.
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
