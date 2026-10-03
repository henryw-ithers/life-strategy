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
keeps the exercise and adds what comes after it: the ratings become a
daily plan with a score out of 100, and both the ratings and the scores
are kept so you can see how they change over months and years.

## The core loop

1. **Diagnose.** Rank the 18 units by priority and rate your
   satisfaction with each from 1 to 10.
2. **Derive.** The priority ranking becomes each unit's share of 100
   daily points.
3. **Plan.** Add goals and tasks to the units.
4. **Do.** Tick tasks off each day and get a score out of 100.
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

**The three Relationships units work differently.** Significant other,
Family and Friendship are diagnosed like any other unit, but they hold
no tasks of their own. Instead, any completed task or activity can be
tagged as having involved one of them. Time with people usually happens
inside something else (a run with a friend, dinner with family), and
filing it under one unit hid the other
([ADR-0025](docs/adr/0025-communal-units-are-dimensions.md)).

A unit can be taken out of the plan ("Not in my plan") and put back
with one tap; its points go to the other units while it is out
([ADR-0027](docs/adr/0027-coverage-decides-the-ceiling.md) §2).

## The diagnostic

The diagnostic asks two different kinds of question, so it uses two
different controls
([ADR-0022](docs/adr/0022-satisfaction-is-rated-not-ranked.md)):

- **Priority is ranked.** You put all 18 units in order. When people
  rated importance on a 1–10 scale, almost everything landed between 6
  and 10, because almost everything on the list matters. A ranking
  forces a spread. The app calls this "Priority" rather than
  "Importance" for the same reason: the question is where each unit
  stands right now, not whether it matters.
- **Satisfaction is rated** from 1 to 10. It is a judgement about each
  unit on its own. Ranking it as well made the chart's x-axis a
  reshuffle of the same values every time, so real improvement could
  never show up as movement to the right.

The app prompts for a diagnostic once a month and allows one at any
time ([ADR-0005](docs/adr/0005-diagnostic-snapshots-and-history.md)).
Running it again never deletes anything: goals and tasks carry over,
point values update from the new ranking, and the app points out only
the units whose weight actually changed.

### The portfolio graph

Each diagnostic is saved as a snapshot and drawn as Strack's chart:

- **y-axis:** priority
- **x-axis:** satisfaction
- **bubble size:** effort, measured from the tasks and activities you
  actually logged rather than estimated

Snapshots are kept, so the chart can show units moving over time.

## Scoring

### Unit weights

Each unit's share of the 100 comes from its priority rank and nothing
else ([ADR-0028](docs/adr/0028-priority-is-the-only-input.md)). The
ranking is mapped onto a narrow range before the shares are worked out,
so the top unit gets about 7 points and the bottom about 4. That keeps
every unit large enough for a task to be worth doing.

Satisfaction used to add extra weight to units where it lagged behind
priority. That was withdrawn: using one set of answers both to build
the plan and to judge whether the plan was working made the second
measurement meaningless. Satisfaction is still recorded, plotted and
used to choose which suggestions to show. It just no longer changes any
points.

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

Activities are still worth logging: they feed the effort measurement
on the portfolio graph.

### Commitments

School, work or a club can be added as a **commitment**, up to three.
A commitment holds its own tasks and timed **events** (a class, a
shift) and can be split into sub-commitments (School → individual
courses).

On a day with commitment work scheduled, commitments get their own
share of the day, which you set (from 10, up to a cap of 60–80
depending on how many you have). The usual 90/10 day is scaled into
whatever is left. Commitments never compete with the 18 units for
weight, and the app never computes a mark, grade or attendance rate
for them
([ADR-0032](docs/adr/0032-the-commitment-band.md),
[ADR-0035](docs/adr/0035-commitments-are-custom-units.md),
[ADR-0038](docs/adr/0038-events.md)).

### Defaults and overrides

Everything the app derives is a recommendation. The data model stores
an override beside each derived weight, and wherever an override is
shown, the recommended value is shown next to it
([ADR-0002](docs/adr/0002-data-model-and-persistence.md) §3). There is
no screen for editing unit weights yet.

## Goals

    Area → Unit → Goal → Task

A goal is a specific, measurable objective inside a unit, with a clear
finish line. Goals end; the units they serve do not.

- **Conditions.** A goal can list the things that have to be true for
  it to happen, each with its own tasks. A condition can pull in a task
  from any unit; the task is still paid from its own unit
  ([ADR-0030](docs/adr/0030-goals-have-conditions.md)).
- **Measures.** A goal can track a number (books read, a target
  weight) or a habit streak, with milestones along the way
  ([ADR-0015](docs/adr/0015-metric-linked-goals.md)).
- **Lifecycle.** A goal can be active, paused, revised, set aside or
  completed. Setting aside and revising are normal outcomes, not
  failures. Completing a goal offers three paths: archive its tasks,
  start a follow-up goal, or keep its habits going as maintenance work
  ([ADR-0007](docs/adr/0007-goal-lifecycle.md)).
- **Achievements.** Completing a goal or milestone records an
  achievement. Achievements appear in monthly summaries and never in a
  daily grade, which measures consistency.

## Tasks

A task belongs to a unit and happens a set number of times a week (or
once a fortnight). It can optionally be pinned to weekdays, a part of
the day, or a clock time; none of these is required
([ADR-0036](docs/adr/0036-granularity-is-the-users.md)).

- **Point values come from order, not typing.** Within a unit, tasks
  are dragged into order and their share of the unit's weight follows
  from that order. Nobody enters a point value.
- **Suggestions.** Each unit has a "Need ideas?" link to a built-in
  library of goals and tasks, chosen to fit the unit's priority and
  satisfaction ([ADR-0006](docs/adr/0006-task-and-goal-recommendations.md)).
  The library ships with the app; nothing is sent anywhere.
- **Partial credit, multiple units, and sizes.** A task can be set to
  accept partial completion in steps of 25%
  ([ADR-0014](docs/adr/0014-partial-credit.md)), can serve more
  than one unit ([ADR-0019](docs/adr/0019-multi-unit-tasks.md)), and
  can be sized for planning, without the size changing its value
  ([ADR-0026](docs/adr/0026-task-size-and-day-load.md)).

Opening the app should feel like opening a checklist. The planning
detail is there for anyone who wants it, but the defaults stay light.

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

- **Strategy before execution.** Tasks exist because the diagnostic
  said their unit matters.
- **Simple every day.** The daily screen is a checklist and a number.
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
