# Life Strategy — Vision Document

> **Status:** Draft Vision (rev. 2)\
> **Purpose:** Define the philosophy, mechanics, and roadmap for the
> Life Strategy application.

## Inspiration

This project is inspired by **Rainer Strack's** work on strategic life
planning (with Susanne Dyrchs and Allison Bailey), published in the
*Harvard Business Review* as "Use Strategic Thinking to Create the Life
You Want." Strack adapts corporate portfolio strategy to personal life:
you break your life into **Strategic Life Areas (SLAs)** and their
underlying **Strategic Life Units (SLUs)**, rate each unit on
**importance** and **current satisfaction**, and plot the results on a
portfolio graph to see where your life needs strategic attention.

Strack's framework is a periodic, reflective exercise. This application
extends it into a **living system**: the diagnostic doesn't just produce
a chart — it derives a personalized daily scoring system that connects
what matters most to what you actually do each day, and tracks both over
months and years.

## The Core Idea

1. **Diagnose.** The user rates every Strategic Life Unit from 1–10 on
   *importance* and 1–10 on *current satisfaction*.
2. **Derive.** From those ratings, the app derives a personal scoring
   system out of **100 points per day**, allocating point weight to each
   unit — primarily by importance, with additional weight for units
   where satisfaction lags.
3. **Do.** Within each unit the user sets **goals** — concrete,
   measurable objectives — and goals generate daily or weekly tasks, a
   blend of app recommendations and user-created tasks. Completing
   tasks earns that unit's points.
4. **Track.** Daily grades accumulate into weekly and monthly grades.
   Each month, the user repeats the diagnostic and watches their
   portfolio graph shift over time.
5. **Calibrate.** Over the long term, the grading method is tuned so
   that a person's grade genuinely reflects how content they felt over
   that period — not just how many boxes they checked.

## Strategic Life Areas and Units

The default taxonomy — adapted from Strack's portfolio and then
revised (physical and mental health each earn their own area; personal
care dissolves into them; spirituality is framed inclusively, as being
in touch with reality beyond the everyday, whatever one's beliefs;
leisure distinguishes making from taking in):

| # | Strategic Life Area (SLA) | Strategic Life Units (SLUs) |
|---|---------------------------|------------------------------|
| 1 | Relationships | Significant other · Family · Friendship |
| 2 | Physical health | Exercise & fitness · Nutrition · Sleep & recovery |
| 3 | Mental wellbeing | Mental & emotional health · Spirituality · Giving & service |
| 4 | Work & money | Job/career · Learning & growth · Finances |
| 5 | Home & environment | Living space · Nature & surroundings |
| 6 | Leisure & creativity | Hobbies & projects · Art & media · Adventure & experiences |

Seventeen units across six areas. The taxonomy is the default, not a
cage — users can rename units, hide ones that don't apply, or add their
own, but the app always starts from this structure so nothing important
is silently forgotten. Each unit carries a short description and
healthy guidelines, reachable from an info button wherever the unit is
rated — direct, evidence-based claims the user can weigh for
themselves, never prescriptions. The tool is what you make of it; the
app's job is accurate inputs.

## The Diagnostic

For each SLU the user records:

- **Priority** (1–10): Strack's *importance*, deliberately reframed —
  everything on this list is important, so the honest question is
  where the unit stands in your life right now. ("Importance" remains
  the domain/formula term; "Priority" is what users see.)
- **Satisfaction** (1–10): how satisfied they are with this unit today.

The diagnostic is quick (17 units, two ratings each) and is repeated
**monthly** as the opening act of the monthly review — and anytime
life changes. Re-diagnosing never destroys anything: goals and tasks
carry over by default, point values rescale automatically from their
ranks, and the app only prompts where weights actually shifted.

### The Portfolio Graph

The diagnostic is visualized as Strack's portfolio graph, a centerpiece
of the app:

- **Y-axis:** importance
- **X-axis:** satisfaction
- **Bubble size:** effort actually invested — in Strack's original
  exercise this is self-reported hours per week; in this app it can be
  *measured* from task activity, which is more honest than estimation.

The graph makes gaps visible at a glance: big, high, left-side bubbles
(important, unsatisfying, absorbing effort without payoff) and small,
high, left-side bubbles (important, unsatisfying, neglected) are where
strategy should focus.

**Change over time is a first-class feature.** Each diagnostic is saved
as a snapshot. The app can animate or trail bubble movement between
snapshots, so users literally watch units migrate toward the
high-importance/high-satisfaction quadrant over months and years. This
long-horizon view is the emotional payoff of the whole system.

## The Scoring System

Each day is scored out of **100 points**.

### Deriving unit weights

Every active SLU receives a share of the 100 points, derived from the
diagnostic:

- **Importance is the primary driver.** A unit rated 9 in importance
  deserves more daily weight than one rated 4.
- **Satisfaction is a secondary modifier.** Units where satisfaction
  lags importance get a boost — they're the gaps the user said they
  want to close. As satisfaction improves in later diagnostics, the
  boost naturally shrinks and points flow to the next gap.

A candidate default formula (to be validated in practice):

> unit weight ∝ importance + 0.5 × max(0, importance − satisfaction)

Weights are normalized so all active units sum to 100. The exact
formula is an implementation detail; the design commitment is:
**importance first, gap-boost second, always normalized to 100.**

### Task counts follow the weights

The number of recommended tasks per unit is also informed by the
diagnostic: high-weight units carry 2–3 daily/weekly tasks, low-weight
units may carry one small task or a weekly-only task. A unit the user
marks unimportant shouldn't nag them daily.

### Customizable, with strong defaults

The derived system is a **recommendation, not a mandate**. Users can:

- Adjust a unit's point weight (the app rebalances the rest to keep
  the 100 total).
- Add, remove, or re-weight tasks within a unit.
- Accept the recommended configuration untouched — which should be a
  genuinely good experience, because most users will.

Whenever the user overrides a value, the app still displays the
recommended value alongside it, so customization never loses the
guideline.

## Goals

Goals sit between strategic life units and tasks:

    Strategic Life Area → Strategic Life Unit → Goal → Task

A goal is a concrete, measurable objective within a unit, created in
response to what the diagnostic revealed.

Example:

- **SLA:** Body, mind, and spirituality
- **SLU:** Physical health/sports
- **Goal:** Bench press 225 lb
- **Tasks:** "Strength training session" (3× weekly), "10k steps" (daily)

Goals should be:

- **Specific** — a clear finish line, not a direction.
- **Measurable** — you can tell whether it's done.
- **Temporary** — goals end; the units they serve don't.

Larger goals may contain **milestones** (bench 135 → 185 → 225), with
only the current milestone in active focus.

Goals have a lifecycle: *active*, *paused*, *revised*, *abandoned*, or
*completed*. Abandoned and revised goals are first-class outcomes, not
failures to hide — the reflection cycle asks whether the goal was wrong
or the plan was. Completing a goal or milestone generates an
**achievement**, which feeds monthly and yearly summaries rather than
daily grades.

Completing a goal also asks what it leaves behind: archive its tasks,
roll into a follow-up goal (bench 225 → bench 275), or **transition to
maintenance** — the goal ends but its habits detach to the unit and
live on. Goals are temporary; the units they serve aren't.

## Tasks

Tasks are the daily unit of execution. Every task belongs to a
strategic life unit and carries a point value drawn from its unit's
weight. Tasks that pursue a finish line link to a goal; recurring
maintenance habits ("10k steps") may attach directly to their unit
without one (decided in ADR-0002).

- **Recommended tasks:** the app suggests concrete, evidence-informed
  goals and tasks per unit (e.g., Physical health → "30 minutes of
  exercise"; Friendship → "reach out to one friend") from a curated
  on-device library, matched to the unit's importance/satisfaction
  profile. After the first diagnostic, the app proposes a complete
  starter plan to edit or accept — useful in minute one.
- **User-created tasks:** users add their own tasks under any goal or
  unit.
- **Point values from ranking, not typing:** within a unit, tasks are
  ranked via a quick binary-comparison flow (inspired by the Beli
  app's ranking UX) — "which matters more?" — and point values derive
  automatically from rank. Users never enter point numbers manually,
  though any derived value can be overridden.
- **Cadence:** each task states how many times a week it happens, from
  once to every day — which days is up to you. Daily simplicity is a
  core principle — opening the app should feel like opening a
  checklist, not project-management software.

## Spontaneous Activities

Life doesn't only happen on the checklist. A round of golf, a movie
with a friend, an afternoon volunteering — **activities** are logged
in a few taps, tagged to the units they served (up to three), and
sized quick/normal/big.

Activity credit first *fills* the tagged units' unearned planned
points — golf can honestly stand in for the workout you skipped — and
anything beyond that becomes a small visible bonus above 100, capped
so grades stay meaningful ("92 +6"). The point is to encourage
actually doing things, and to make people mindful of how their time
maps onto what they said matters.

Activities can also be logged without credit as pure journal lines —
they're part of the log of your life either way.

## Grades and Tracking

The second centerpiece graphic (alongside the portfolio graph) is the
**grade log**:

- **Daily grade:** points earned out of 100.
- **Weekly grade:** aggregated from the week's dailies.
- **Monthly grade:** aggregated from the month.

Grades are displayed as a continuous log — calendar heat-map, trend
line, and rolling averages — so consistency and drift are both visible.

### Grading principles

- The grade measures **consistency of intentional behavior**, not
  productivity or hustle.
- The grade should never punish planned rest: **rest days** are
  declared (in advance or retroactively) and excluded from aggregates
  entirely.
- Weekly and monthly grades are straight point totals — transparent
  and predictable. Consistency is shown as separate statistics, never
  baked invisibly into the grade.

### Scores are guidelines, not judgments

The grade is information for reflection, never a verdict. The app
reassures regularly — and contextually, not naggingly — that the
number is a guideline: a lens on how the week mapped to intentions,
not a measure of worth. Distance is rendered kindly: zoomed-out
history emphasizes trends, best days, and special days over individual
low numbers, the way memory does. The stored record stays true; the
presentation stays gentle.

### The grade log is a log of your life

Not every day is a task day. **Special days** — a wedding, a summit, a
day that was entirely its own thing — get a title and note in the log,
suspend regular tasks, and are graded by how satisfying the day was
(rated 1–10). Years later, the grade log reads back as a record of a
life, not a spreadsheet of checkboxes: you can scroll to any day and
see what it was.

Three light touches deepen the log, all optional and all encouraged
softly rather than required:

- **Journaling:** any day can carry a few written lines alongside its
  grade — what the day was like, not just what it scored. Entries
  append rather than overwrite: adding a note to a past day never
  replaces what was written at the time, and late additions are marked
  as retroactive.
- **Photos:** a day can hold a few photos. A year-old grade with a
  picture attached is a memory; without one it's a number.
- **Memory flags:** any day or activity can be marked *worth
  remembering*. Flagged moments feed look-back views — month and year
  reviews resurface them, the way you'd want the past retold.

### The Contentment Experiment

The long-term ambition — and the most experimental part of the app —
is a grading method that **actually reflects how content the person
felt over that period**, not merely their completion rate.

Mechanism: periodically (e.g., weekly), the app asks one question —
*"How content did you feel this week, 1–10?"* — and stores it alongside
the computed grade. Over time, the app compares felt contentment
against computed grades and surfaces mismatches:

- Grades high, contentment low → the tasks or weights are measuring
  the wrong things; the app suggests diagnostic or task revisions.
- Grades low, contentment high → the system is stricter than the life
  it serves; the app suggests loosening.

Eventually this feedback loop can tune the scoring formula itself, per
user. A grade that *predicts* the user's own felt contentment is the
end-state metric of success for the entire application.

## Reflection Cycle

The system runs on three nested rhythms:

- **Daily:** complete tasks, log activities, receive a grade. Simple,
  fast, checklist-like.
- **Weekly:** review the week's grade and answer the contentment
  question.
- **Monthly:** the full ritual — repeat the diagnostic, watch the
  portfolio graph update, review re-derived weights, carry over or
  adjust goals and tasks, and see the monthly grade and new
  achievements. A diagnostic can also be run anytime life changes.

Strategy stays thoughtful and adaptive; execution stays simple.

## Design Principles

- **Strategy before execution.** The diagnostic is the front door; tasks
  exist because the diagnostic justified them.
- **Daily simplicity.** The daily surface is a checklist and a number.
- **Strong defaults, full customization.** Everything derived is
  overridable; everything overridable shows its recommended value.
- **Measure what matters, not what's easy.** The contentment experiment
  keeps the score honest.
- **Gentle by design.** For someone struggling, a life-wide grade can
  curdle into shame. Scores are guidelines, and the app says so
  constantly — the framing lives wherever grades appear, never
  triggered by a low number. Kindness is **ambient, not targeted**:
  encouragement carries the same tone on good weeks and bad, because
  comfort conditioned on your worst data feels like surveillance.
  Celebration may notice your best moments; nothing ever announces it
  noticed your worst. Support resources live quietly in the app —
  discoverable always, pushed never. No shame mechanics anywhere (no
  alarm colors, no streak guilt, no loss-aversion tricks). The score
  serves the life, never the reverse.
- **A tool, not a taskmaster.** You decide how much use you get out of
  it. Scoring is never strict about participation: skip days, ignore
  whole features, use only the diagnostic, disappear for a month and
  come back. Partial use is valid use, and returning never earns a
  guilt trip.
- **Personal over social.** A private self-improvement tool first.
  Daily grades are private by default. No leaderboards, no competitive
  rankings, no score comparisons.

## Future Directions (Deliberately Deferred)

These are plausible extensions, kept out of the core vision until the
core loop proves itself:

- **Templates:** packaged goal/task sets per unit, shareable between
  users or curated by experts; possibly a marketplace much later.
- **Light community:** accountability partners and shared goals —
  knowledge-sharing, never comparison.

## Sequencing

Exact version boundaries are deliberately loose at this stage. The
build order is:

1. **The core loop** — diagnostic, portfolio graph, derived scoring,
   goals, tasks, daily grade.
2. **Time** — diagnostic snapshots, portfolio change over time,
   weekly/monthly grades, contentment data collection.
3. **Calibration** — contentment vs. grade analysis, adaptive
   recommendations, richer statistics.
4. **Extensions** — templates, then community, if warranted.

## Long-Term Vision

The application aims to continually answer three questions:

1. What matters most to me?
2. Where am I currently falling short?
3. What should I do today to move closer to the life I want?

The measure of success is not engagement, streaks, or completion
percentages — it is whether the user's grade converges with the user's
own felt experience of a life well lived.

## References

- Strack, Rainer; Dyrchs, Susanne; Bailey, Allison. "Use Strategic
  Thinking to Create the Life You Want." *Harvard Business Review*,
  December 2023. Source of the Strategic Life Areas/Units taxonomy and
  the importance–satisfaction portfolio graph. Consult the original for
  the complete seven-question framework and methodology.
