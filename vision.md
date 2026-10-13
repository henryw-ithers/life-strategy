# Life Strategy: Vision

What the app is for, how it works, and the principles behind it. The
details of each mechanism, and the evidence for it, are in the
[architecture decision records](docs/adr/README.md); this document
links to them where it matters.

## Where the idea comes from

Rainer Strack, Susanne Dyrchs and Allison Bailey's *Harvard Business
Review* article "Use Strategic Thinking to Create the Life You Want"
applies corporate portfolio strategy to a person's life. You divide
your life into **Strategic Life Areas** and the **Strategic Life Units**
inside them, rate each unit for importance and for how satisfied you
are with it, and plot the result as a portfolio chart that shows where
your attention should go.

In the article this is an occasional, reflective exercise. This app
keeps the exercise in a quicker form (sorting units into tiers) and
adds what comes after it: the priorities become a daily plan with a
score out of 100, and both are kept so you can see how they change over
months and years.

## The core loop

1. **Prioritise.** Sort the 18 units into tiers: Top, Important,
   Background and Not now.
2. **Derive.** The tiers become each unit's share of 100 daily points.
3. **Plan.** Add tasks to the units, set your working hours, and let
   the app fill your free time with them. Goals are optional.
4. **Do.** Work through the window you're in and tick tasks off. Each
   day gets a score out of 100.
5. **Review.** Days roll up into weekly and monthly grades. A weekly
   question, "how content did you feel this week?", is recorded beside
   them so the two can be compared over time.

## Life areas and units

Eighteen units in six areas, adapted from the article's portfolio:

| Area | Units |
|---|---|
| Relationships | Significant other · Family · Friendship |
| Physical health | Exercise & fitness · Nutrition · Sleep & recovery |
| Mental wellbeing | Mental & emotional health · Spirituality · Giving & service |
| Work & money | Job/career · Learning & growth · Finances |
| Environment | Living space · Nature · Hygiene |
| Leisure & creativity | Hobbies & projects · Art & media · Adventure & experiences |

Changes from the original taxonomy: physical and mental health each
have their own area; personal care is folded into them; spirituality is
described broadly, as contact with something beyond the everyday,
whatever your beliefs; and leisure separates making things from taking
things in. Environment holds low-effort upkeep (getting outside, a
clean living space, hygiene) so the basics have a place and are not
crowded out by bigger goals.

Areas only decide colour and grouping. They never affect weights or
scores ([ADR-0021](docs/adr/0021-areas-are-presentational.md)).

Each unit has a short description and some general guidelines,
reachable from an info button wherever the unit appears. They are
written as information you can weigh, not instructions.

**The three Relationships units** (Significant other, Family and
Friendship) are planned like any other unit and hold tasks. For a while
they were tag-only, since time with people usually happens inside
something else, but a unit that earned its share from a tag didn't fit
the scoring
([ADR-0025](docs/adr/0025-communal-units-are-dimensions.md), amended by
[ADR-0027](docs/adr/0027-coverage-decides-the-ceiling.md) §4).

Putting a unit in the **Not now** tier takes it out of the plan: it has
no weight and holds no tasks, and its points go to the other units.
Moving a unit with tasks into Not now pauses those tasks, and moving it
back restores them
([ADR-0041](docs/adr/0041-priorities-are-tiers.md)).

## Priorities

You sort the 18 units into four tiers (Top, Important, Background and
Not now) and put them in order within each tier. It takes about 30
seconds. The tiers set each unit's weight, and the order inside a tier
adjusts it slightly
([ADR-0041](docs/adr/0041-priorities-are-tiers.md)).

The app used to ask for a full ranking of all 18 units and a 1–10
satisfaction rating for each, and drew both on Strack's portfolio
chart. For a new user that was several minutes before anything useful
happened, so satisfaction is no longer asked and the chart is gone.
Ratings already given stay in their snapshots. Life shows each unit's
share of the work you completed in the last 4 weeks instead, and the
weekly contentment question is how the app checks whether the plan is
working.

Saving your tiers keeps a snapshot, so history is kept. The first
weekly pass of each month offers a look at your tiers, and Priorities
is always available from the Life tab.

## Scoring

### Unit weights

Each unit's share of the 100 comes from its tier and its place in the
tier, and nothing else
([ADR-0041](docs/adr/0041-priorities-are-tiers.md)). With a typical
split, a Top unit gets about 10 points, an Important one about 6 and a
Background one about 4. Not now units get nothing.

Satisfaction once added weight to units where it lagged behind
priority. That was withdrawn
([ADR-0028](docs/adr/0028-priority-is-the-only-input.md)): using one
set of answers both to build the plan and to judge whether it was
working made the second measurement meaningless.

### A day's score

**A day is scored on the fraction of that day's work you got through**
([ADR-0029](docs/adr/0029-a-day-is-the-fraction-you-got-through.md)).

- Work pinned to a particular weekday, or done every day, is due in
  full on its day.
- Work with no fixed day is pooled for the week and spread evenly over
  the days left.
- Finishing what the day asked for earns **90** points.
- Anything you did that you had not planned (logged activities, or the
  bonus for a special day) can add up to **10** more. That cap is
  deliberate; see below.
- Doing extra runs of your own tasks can take a day past 100.

A task's points therefore depend on the day. The same run is worth more
on a light day than on a heavy one. How often a task happens decides
how often it is due, not what it is worth, and adding more tasks to a
unit divides that unit's weight rather than adding to it.

Obligations are weekly. Doing Friday's run on Tuesday still counts as a
complete week, and a missed weekday is never carried forward as a debt.

**Rest days.** A day with nothing due becomes a rest day automatically
and scores 70. Activities can fill the remaining 30, and any work done
ahead of its planned day is paid what that day would have paid
([ADR-0037](docs/adr/0037-rest-days.md)).

### Planned work is what pays

Activities (a round of golf, a film with a friend) are logged in a few
taps, tagged to up to three units, and sized quick, normal or big
([ADR-0009](docs/adr/0009-spontaneous-activities.md)).

An earlier version let activity credit fill in for planned work you
skipped, on the theory that golf could stand in for a missed workout.
In use, it made a good score too easy to get while ignoring the plan,
which defeats the point of having one. So everything unplanned now
shares one small capped pool, shown beside the day's number (for
example "92 +6"), and the only uncapped ways above 100 are doing more
of your own plan
([ADR-0023](docs/adr/0023-planned-work-is-what-pays.md)).

Activities are still worth logging: they count toward the effort
shares on the Life tab.

### Commitments

School, work or a club can be added as a **commitment**, up to three.
A commitment holds its own tasks and timed **events** (a class, a
shift) and can be split into sub-commitments (School → individual
courses).

On a day with commitment work scheduled, commitments get their own
share of the day. By default it's the commitment's time that day (its
events plus its scheduled tasks) as a part of your working hours, so a
day that's mostly School is mostly scored as School. You can set a
fixed share instead, such as School at 60%. The share is kept between
10% and a cap of 60–80% depending on how many commitments you have,
and the usual 90/10 day is scaled into whatever is left
([ADR-0044](docs/adr/0044-a-commitment-share-comes-from-your-day.md)). Commitments never compete with the 18 units for
weight, and the app never computes a mark, grade or attendance rate
for them
([ADR-0032](docs/adr/0032-the-commitment-band.md),
[ADR-0035](docs/adr/0035-commitments-are-custom-units.md),
[ADR-0038](docs/adr/0038-events.md)).

### Defaults and overrides

Everything the app derives is a recommendation. The data model stores
an override beside each derived weight, and wherever an override is
shown, the recommended value is shown next to it
([ADR-0002](docs/adr/0002-data-model-and-persistence.md) §3). Unit
weights are overridden on the Priorities screen, and a commitment's
share on its own screen.

## Goals

    Area → Unit → Goal → Task

Goals are optional. Each goal is built on something the app can count
([ADR-0042](docs/adr/0042-goals-are-measured-by-the-app.md)):

- **Times done:** "Run 30 times by December", counting ticks on the
  tasks you choose.
- **Time spent:** "40 hours of study this term", counting each tick's
  size, or the time you entered when ticking.
- **Points earned:** "Earn 300 Exercise points", a running total in the
  unit.
- **Streak:** "Meditate every day", counting days in a row.

Goals start from templates, one per type for each unit. Progress is a
running total with no pace line. An active goal moves its tasks up a
little when the app suggests what to do, and never changes points.
Reaching a target is an achievement: it appears in monthly summaries
and never in a daily grade, which measures consistency. Goals can be
paused, revised or set aside
([ADR-0007](docs/adr/0007-goal-lifecycle.md)).

## Tasks

A task belongs to a unit and happens a set number of times a week (or
once a fortnight). It can optionally be pinned to weekdays, a part of
the day, or a clock time; none of these is required
([ADR-0036](docs/adr/0036-granularity-is-the-users.md)).

- **Point values come from order, not typing.** Within a unit, tasks
  are dragged into order and their share of the unit's weight follows
  from that order. Nobody enters a point value.
- **Suggestions.** Each unit has a "Need ideas?" link to a built-in
  library of tasks and goal templates, chosen to fit the unit's tier
  ([ADR-0006](docs/adr/0006-task-and-goal-recommendations.md)).
  Tasks are sized quick, normal or big, which is how the app knows
  what fits in a window.
  The library ships with the app; nothing is sent anywhere.
- **Partial credit, multiple units, and sizes.** A task can be set to
  accept partial completion in steps of 25%
  ([ADR-0014](docs/adr/0014-partial-credit.md)), can serve more
  than one unit ([ADR-0019](docs/adr/0019-multi-unit-tasks.md)), and
  can be sized for planning, without the size changing its value
  ([ADR-0026](docs/adr/0026-task-size-and-day-load.md)).

Opening the app should feel like opening a checklist. The planning
detail is there for anyone who wants it, but the defaults stay light.

## Windows and your week

You set your **working hours** once, the way iOS sets a sleep
schedule: groups of days, each with time ranges. Your events (classes,
shifts) are cut out of them, and what's left are your **windows**, the
free time you have to get things done. The gaps between windows are
breaks, and you can name them. You can add, move or remove a window
for any day from Home or Plan
([ADR-0039](docs/adr/0039-work-windows-come-from-your-hours.md)).

The app fills each window with a few tasks that fit, based on their
size and the time available. You can pin your own choices instead,
once a week in the weekly pass or whenever you like, and the app never
moves what you pinned. Unfinished work moves on to the next window and
the next day, labelled "Still open". Repeating tasks stop at the end of
the week, and their count starts again. Windows decide where tasks
appear, not what they're worth.

Repeating events can run for a set number of weeks, and single weeks
(reading week) can be skipped. On a bad day, **Clear today** sets
aside today's windows and events. **Time away** turns a date range into
days off
([ADR-0040](docs/adr/0040-schedules-can-end-skip-and-clear.md)).

## Grades and the log

- **Daily grade:** points out of 100.
- **Weekly and monthly grades:** straight totals of the days, so they
  are easy to predict.
- A **day off** can be declared, before or after, and is left out of
  the totals. A past day you never opened counts as zero, so that
  skipping is not quietly free; declaring the day off is the way to
  leave it out.
- A **special day** (a wedding, a trip) gets a title and a note, and a
  bonus from the capped unplanned pool based on how good the day was.

Each day can also hold journal notes, photos, and a "worth remembering"
flag. The Log tab reads these back by month, putting memories ahead of
numbers.

### Calibration

The longer-term question is whether the score matches how a week
actually felt. Each week the app asks one question, "How content did
you feel this week, 1–10?", and stores the answer next to the grade.
Over time it can point out mismatches: high grades with low contentment
suggest the plan measures the wrong things, and the reverse suggests
the plan is stricter than it needs to be. Suggestions only change
anything if you confirm them
([ADR-0008](docs/adr/0008-contentment-calibration.md)).

## Principles

- **Strategy before execution.** Tasks exist because your priorities
  said their unit matters.
- **Simple every day.** The daily screen is the window you're in, a
  short list, and a number.
- **Strong defaults, full control.** Derived values are recommendations.
- **No shame.** Scores are guidelines, and the app says so wherever a
  grade appears. Encouragement reads the same on a good week and a bad
  one, because comfort that only appears after a bad week feels like
  being watched. The app may celebrate good moments; it never comments
  on bad ones. There are no alarm colours, streak penalties or
  loss-aversion tricks.
- **A tool, not a taskmaster.** Use only the parts you want. Skipping
  days or disappearing for a month is fine, and coming back is never
  met with guilt.
- **Private.** Grades are private by default. There are no
  leaderboards, rankings or score comparisons.

## Deferred

Kept out until the core loop has proved itself:

- **Templates:** shareable sets of goals and tasks for a unit.
- **Light community:** accountability partners and shared goals, never
  comparison.

Parked ideas, and the reasons they were parked, are in
[docs/backburner.md](docs/backburner.md).

## The measure of success

The app tries to keep answering three questions:

1. What matters most to me?
2. Where am I falling short?
3. What should I do today?

Success is not engagement or streaks. It is whether a person's grade
comes to match how well they felt their life was going.

## Reference

Strack, R., Dyrchs, S., & Bailey, A. "Use Strategic Thinking to Create
the Life You Want." *Harvard Business Review*, December 2023. Source of
the area and unit taxonomy and the importance–satisfaction chart.
