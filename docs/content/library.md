# The content library — goals and tasks

**Source of truth.** `npm run content:build` regenerates
`apps/mobile/src/content/library.ts`.

This is ADR-0006's content package: the goals and tasks the app draws a
starter plan from after the first diagnostic. Write it here; the build
turns it into typed data and tells you what's missing.

**Read [library-outline.md](library-outline.md) first** — it carries
the editorial rules, the profile-tag guidance, and the launch bar.
This file is where the writing goes.

## Format

    ## <unit-id> — <Display name>

    ### Goals

    #### <goal-id> · <Goal title>
    profiles: gap-closing, light
    milestones: Run 1k, Run 3k, Run 5k
    metric: cumulative, km, 5

    What finishing looks like. One line, optional.

    ### Tasks

    #### <task-id> · <Task title>
    frequency: 3
    profiles: gap-closing, maintenance
    goal: run-5k

    What counts as done. Optional, and it is the self-contract —
    the fine print behind the title.

**Field lines** go directly under the `####` heading, one per line,
`key: value`. Everything after the blank line is the description.

| Field | Applies to | Values |
|---|---|---|
| `profiles` | both | `gap-closing`, `maintenance`, `light` — one or more. Required. |
| `frequency` | tasks | `0`–`7`. 7 is daily, 0 is once a fortnight. Required. |
| `goal` | tasks | A goal id in the same unit. Optional — habit tasks attach straight to the unit. |
| `milestones` | goals | Comma-separated rung titles, in order. Optional. |
| `metric` | goals | `<kind>, <unit>, <target>` for `cumulative` or `target` (ADR-0015 §1). For a habit, just `habit` — see below. Optional. |

**Habit goals** take `metric: habit` with **no unit and no target**,
because a habit is meant to be permanent and never completes. Its rungs
are day counts in `milestones` — **7, 30, 66** by default, where 66 is
Lally's median time to automaticity, so the top rung is a research
number rather than a round one. Decided 2026-08-16; the app support is
not built yet ([backburner.md](../backburner.md)).

**Numbers come from actual recommendations for a healthy person**, not
from what's typical. WHO's 150–300 active minutes and 2 strength days,
7–9 hours of sleep, 30g of fibre. Where the popular number is folklore,
use the evidence: **8,000 steps, not 10,000** — the 10,000 figure came
from a 1960s pedometer's name, and mortality benefit plateaus around
8,000. Where there is no good number, don't invent one (water).

**Task order within a unit is `defaultRank`** — the order you write
them in. Rank 1 is the task you would keep if you could only keep one.
Proposed tasks arrive pre-ranked so onboarding needs no pairwise
comparisons (ADR-0006 §2).

## Two rules the build enforces

- **Communal units take goals but no tasks** — Significant other,
  Family, Friendship (ADR-0025 §5). The library never proposes a
  checklist task for a relationship. A task written under one of those
  units is a build error, not a warning.
- **Ids must be unique within their unit**, and a task's `goal:` must
  name a goal in the same unit.

## The bar

**There isn't a count.** ADR-0006 §4 originally set one (≥3 goals, ≥6
tasks per unit); it was dropped on 2026-08-16 because writing to a
quota is how a library fills with padding, and padding is exactly what
reads as generated. Put in as many genuinely useful entries as a unit
has, and stop.

What `content:build` still checks is **coverage**: a unit with nothing
in it has nothing to offer, and a unit whose entries all carry one
profile tag has nothing to offer whoever isn't in that situation.

## House rules, learned the hard way

- **Don't characterise the reader.** "Ship the thing you keep not
  shipping", "the subscription you forgot you had", "the one you've
  been meaning to" all assume the person is behind. Say what the task
  is; the app never implies you're failing at it.
- **No em dashes.** One of the clearest tells that a line was generated
  rather than written. A comma or a full stop nearly always works, and
  when neither does, rewrite the sentence.
- **Templates have no context.** "Finish the project", "two hours on
  it", "the thing you keep looking at" all assume something the app
  doesn't know. Generic and plain beats clever: "Finish a project."
- **Descriptions say what counts as done**, not why it's good for you.
  A description on every row is itself a tell; leave the obvious ones
  blank.

---

## exercise-fitness — Exercise & fitness

### Goals

#### run-5k · Run 5k without stopping
profiles: gap-closing
milestones: Run 1k without stopping, Run 3k without stopping, Run 5k without stopping
metric: target, km, 5

A single continuous 5k, at any pace.

#### pull-up · Do a pull-up
profiles: gap-closing
metric: target, reps, 1

From a dead hang, chin over the bar.

#### gym-twice-weekly · Two gym sessions a week for three months
profiles: gap-closing, maintenance
milestones: 8 sessions, 16 sessions, 24 sessions
metric: cumulative, sessions, 24

Two a week is the strength recommendation, and three months is long enough to feel it.

#### active-minutes · 150 active minutes a week for a month
profiles: maintenance, light
metric: cumulative, minutes, 600

The weekly floor for a healthy adult. Walking counts.

#### walk-daily · Walk every day
profiles: maintenance, light
milestones: 7, 30, 66
metric: habit

### Tasks

#### gym · Gym
frequency: 3
profiles: gap-closing, maintenance
goal: gym-twice-weekly

Squat, hinge, push, pull. Warm-up counts.

#### run · Run
frequency: 2
profiles: gap-closing
goal: run-5k

#### walk · Walk
frequency: 7
profiles: maintenance, light
goal: walk-daily

Twenty minutes, in one go or spread out.

#### stretch · Stretch
frequency: 3
profiles: maintenance

Ten minutes. Hips, shoulders, ankles.

#### steps · Steps
frequency: 7
profiles: light, maintenance

Around 8,000. Benefits flatten after that.

#### swim · Swim
frequency: 1
profiles: light, gap-closing

#### sport · Sport
frequency: 1
profiles: light

#### hike · Hike
frequency: 1
profiles: light, maintenance

The one that takes half a morning.

## nutrition — Nutrition

### Goals

#### five-a-day · Five a day, every day
profiles: gap-closing, maintenance
milestones: 7, 30, 66
metric: habit

400g of fruit and veg. Frozen and tinned count.

#### fibre-30 · 30g of fibre a day
profiles: gap-closing
milestones: 7, 30, 66
metric: habit

The recommended amount. Most people manage about 17.

#### cook-20 · Cook 20 dinners this month
profiles: gap-closing, maintenance
milestones: 5 dinners, 10 dinners, 20 dinners
metric: cumulative, meals, 20

#### no-weeknight-takeaway · No takeaway on weeknights
profiles: gap-closing, light
milestones: 7, 30, 66
metric: habit

### Tasks

#### cook · Cook
frequency: 5
profiles: gap-closing, maintenance
goal: cook-20

#### five-a-day-task · Five a day
frequency: 7
profiles: maintenance, gap-closing

400g. Frozen and tinned count.

#### fibre · Fibre
frequency: 7
profiles: gap-closing

30g. Most people manage about 17.

#### protein · Protein
frequency: 7
profiles: maintenance, gap-closing

Something worth calling protein at each meal.

#### water · Water
frequency: 7
profiles: light, maintenance

#### meal-prep · Meal prep
frequency: 1
profiles: gap-closing, maintenance

The shop and the chopping, so the week doesn't need deciding.

#### supplements · Supplements
frequency: 7
profiles: light, maintenance

#### no-late-snacking · No snacking after dinner
frequency: 7
profiles: gap-closing, light

## sleep-recovery — Sleep & recovery

### Goals

#### phone-out-bedroom · Phone out of the bedroom
profiles: gap-closing
milestones: 7, 30, 66
metric: habit

#### same-wake-time · Up at the same time every day
profiles: gap-closing, maintenance
milestones: 7, 30, 66
metric: habit

Weekends included. That's the part that does the work.

#### caffeine-cutoff · No caffeine after midday
profiles: gap-closing, light
milestones: 7, 30, 66
metric: habit

#### seven-hours · Seven hours a night for a fortnight
profiles: gap-closing, maintenance
metric: cumulative, nights, 14

Seven to nine is the range for an adult.

### Tasks

#### lights-out · Lights out
frequency: 7
profiles: gap-closing, maintenance

Pick the time once. The point is that it's the same one.

#### screens-off · Screens off
frequency: 7
profiles: gap-closing
goal: phone-out-bedroom

The last hour before bed.

#### wind-down · Wind-down
frequency: 7
profiles: maintenance, light

Whatever yours is. Not deciding each night is the point.

#### up-same-time · Up at the same time
frequency: 7
profiles: gap-closing, maintenance
goal: same-wake-time

Harder than bedtime and matters more.

#### caffeine-cutoff-task · Caffeine cut-off
frequency: 7
profiles: gap-closing, light
goal: caffeine-cutoff

Midday. It's still half in you six hours later.

#### nap · Nap
frequency: 2
profiles: light

Twenty minutes or ninety. The ones in between are worse.

#### daylight · Daylight
frequency: 7
profiles: maintenance, light

Ten minutes outside sets the clock for that night.

## mental-health — Mental & emotional health

### Goals

#### write-daily · Write something down every day
profiles: gap-closing, maintenance
milestones: 7, 30, 66
metric: habit

#### name-feelings · Name how you're actually feeling, daily
profiles: gap-closing
milestones: 7, 30, 66
metric: habit

Putting words to it is most of the work.

#### ten-minutes-quiet · Ten minutes of quiet every day
profiles: maintenance, light
milestones: 7, 30, 66
metric: habit

#### proper-conversation · A proper conversation every week for two months
profiles: gap-closing, maintenance
metric: cumulative, conversations, 8

Not logistics. The other kind.

### Tasks

#### journal · Journal
frequency: 7
profiles: gap-closing, maintenance
goal: write-daily

Three lines is a journal.

#### meditate · Meditate
frequency: 7
profiles: maintenance, light
goal: ten-minutes-quiet

#### breathwork · Breathwork
frequency: 3
profiles: light

#### check-in · Check in with someone
frequency: 1
profiles: gap-closing, maintenance
goal: proper-conversation

Someone who'd notice if you weren't honest.

#### screen-free-evening · Screen-free evening
frequency: 2
profiles: light, maintenance

#### therapy · Therapy
frequency: 1
profiles: gap-closing

#### walk-no-headphones · Walk without headphones
frequency: 2
profiles: light

#### phone-another-room · Phone in another room
frequency: 7
profiles: gap-closing, light

An hour, awake.

## spirituality — Spirituality

### Goals

#### quiet-practice · A quiet practice every day
profiles: gap-closing, maintenance
milestones: 7, 30, 66
metric: habit

#### gratitude-written · Three things, written down, every day
profiles: maintenance, light
milestones: 7, 30, 66
metric: habit

### Tasks

#### stillness · Stillness
frequency: 7
profiles: gap-closing, maintenance
goal: quiet-practice

Ten minutes, no input.

#### gratitude · Gratitude
frequency: 7
profiles: maintenance, light
goal: gratitude-written

Three things. Specific ones.

#### prayer · Prayer
frequency: 7
profiles: gap-closing, maintenance

#### read-old · Read something old
frequency: 3
profiles: light, gap-closing

#### service · Service
frequency: 1
profiles: light

#### phone-free-hour · Phone-free hour
frequency: 7
profiles: light, maintenance

## giving-service — Giving & service

### Goals

#### volunteer-six · Volunteer twice a month for three months
profiles: gap-closing
milestones: 2 sessions, 4 sessions, 6 sessions
metric: cumulative, sessions, 6

#### regular-donation · Set up a regular donation
profiles: maintenance, light
metric: target, set up, 1

#### small-thing-daily · One small thing for someone, every day
profiles: gap-closing, maintenance, light
milestones: 7, 30, 66
metric: habit

### Tasks

#### volunteer · Volunteer
frequency: 0
profiles: gap-closing

#### help-someone · Help someone out
frequency: 2
profiles: gap-closing, maintenance
goal: small-thing-daily

#### check-on-someone · Check on someone
frequency: 1
profiles: maintenance, gap-closing

#### donate · Donate
frequency: 0
profiles: light, maintenance

#### give-away · Give something away
frequency: 1
profiles: light

#### say-the-thing · Say the thing
frequency: 2
profiles: light, maintenance

Tell someone the good thing you thought about them.

#### reply-properly · Reply properly
frequency: 3
profiles: gap-closing, light

A real reply rather than a holding one.

## job-career — Job/career

### Goals

#### deep-work-month · Two hours of deep work a day for a month
profiles: gap-closing
milestones: 10 hours, 20 hours, 40 hours
metric: cumulative, hours, 40

#### leave-on-time · Leave on time every day
profiles: gap-closing, maintenance
milestones: 7, 30, 66
metric: habit

#### ask-for-raise · Ask for a raise
profiles: gap-closing
metric: target, asked, 1

#### finish-certification · Finish a certification
profiles: gap-closing, light
metric: target, done, 1

#### career-conversation · Have a career conversation with your manager
profiles: maintenance, light
metric: target, done, 1

### Tasks

#### deep-work · Deep work
frequency: 5
profiles: gap-closing, maintenance
goal: deep-work-month

Two hours, one thing, nothing else open.

#### plan-tomorrow · Plan tomorrow
frequency: 5
profiles: maintenance, light

Five minutes at the end of the day.

#### inbox-zero · Inbox to zero
frequency: 3
profiles: maintenance, light

#### finish-something · Finish something
frequency: 1
profiles: gap-closing

#### learn-for-work · Learn something for work
frequency: 2
profiles: gap-closing, light
goal: finish-certification

#### leave-on-time-task · Leave on time
frequency: 5
profiles: gap-closing, maintenance
goal: leave-on-time

#### review-week · Review the week
frequency: 1
profiles: maintenance

What moved, what didn't, what's next.

#### industry-contact · Talk to someone in your field
frequency: 0
profiles: light

## education-learning — Learning & growth

### Goals

#### read-12 · Read 12 books this year
profiles: gap-closing, maintenance
milestones: 3 books, 6 books, 12 books
metric: cumulative, books, 12

#### fifty-hours · 50 hours on one skill
profiles: gap-closing
milestones: 10 hours, 25 hours, 50 hours
metric: cumulative, hours, 50

#### practice-daily · Practice something every day
profiles: gap-closing, maintenance
milestones: 7, 30, 66
metric: habit

#### finish-course · Finish a course
profiles: gap-closing, light
metric: target, done, 1

### Tasks

#### read · Read
frequency: 7
profiles: maintenance, light
goal: read-12

Twenty minutes.

#### practice · Practice
frequency: 5
profiles: gap-closing
goal: fifty-hours

#### course · Course
frequency: 3
profiles: gap-closing, light
goal: finish-course

#### test-yourself · Test yourself
frequency: 2
profiles: gap-closing

Closed book. The recall is what makes it stick.

#### write-it-up · Write it up
frequency: 1
profiles: maintenance, gap-closing

Explaining it is how you find the holes.

#### language · Language
frequency: 7
profiles: light, maintenance

#### podcast-lecture · Podcast or lecture
frequency: 3
profiles: light

## finances — Finances

### Goals

#### three-months-saved · Three months of expenses saved
profiles: gap-closing
milestones: 1 month, 2 months, 3 months
metric: target, months, 3

The standard buffer. It buys calm well beyond its size.

#### weekly-check · Check the accounts every week for three months
profiles: gap-closing, maintenance
metric: cumulative, checks, 12

#### clear-a-debt · Clear one debt
profiles: gap-closing
metric: target, cleared, 1

#### track-a-month · Track every expense for a month
profiles: gap-closing, light
milestones: 7, 30, 66
metric: habit

### Tasks

#### check-accounts · Check the accounts
frequency: 1
profiles: gap-closing, maintenance
goal: weekly-check

Five minutes.

#### log-spending · Log what you spent
frequency: 7
profiles: gap-closing
goal: track-a-month

#### move-to-savings · Move money to savings
frequency: 0
profiles: maintenance, gap-closing

#### review-subscriptions · Review subscriptions
frequency: 0
profiles: light, maintenance

#### no-spend-day · No-spend day
frequency: 2
profiles: light, gap-closing

#### admin · Admin
frequency: 1
profiles: maintenance, light

One form, letter, or call.

#### read-statement · Read the statement
frequency: 0
profiles: maintenance

## living-space — Living space

### Goals

#### make-bed · Make the bed every day
profiles: maintenance, light
milestones: 7, 30, 66
metric: habit

#### tidy-ten · Ten minutes of tidying every day
profiles: gap-closing, maintenance
milestones: 7, 30, 66
metric: habit

#### clear-a-room · Clear one room properly
profiles: gap-closing
metric: target, done, 1

#### deep-clean · Deep clean the whole place
profiles: gap-closing, light
metric: target, done, 1

### Tasks

#### tidy · Tidy
frequency: 7
profiles: gap-closing, maintenance
goal: tidy-ten

Ten minutes.

#### make-bed-task · Make the bed
frequency: 7
profiles: maintenance, light
goal: make-bed

#### dishes · Dishes
frequency: 7
profiles: maintenance, gap-closing

#### laundry · Laundry
frequency: 2
profiles: maintenance

#### hoover · Hoover
frequency: 1
profiles: maintenance, gap-closing

#### change-sheets · Change the sheets
frequency: 0
profiles: maintenance, light

#### bins · Bins
frequency: 2
profiles: maintenance

#### plants · Plants
frequency: 2
profiles: light

#### one-drawer · One drawer or shelf
frequency: 1
profiles: gap-closing, light

## nature-surroundings — Nature

### Goals

#### two-hours-outside · 120 minutes outside a week for a month
profiles: gap-closing, maintenance
milestones: 120 minutes, 240 minutes, 480 minutes
metric: cumulative, minutes, 480

Any combination, one long walk or ten short ones. Below two hours a week the benefit doesn't show.

#### outside-daily · Outside every day
profiles: gap-closing, maintenance
milestones: 7, 30, 66
metric: habit

#### morning-daylight · Daylight before 10am every day
profiles: gap-closing, light
milestones: 7, 30, 66
metric: habit

#### somewhere-new · Somewhere new every week for two months
profiles: light
metric: cumulative, places, 8

### Tasks

#### get-outside · Get outside
frequency: 7
profiles: gap-closing, maintenance
goal: outside-daily

Ten minutes counts.

#### morning-daylight-task · Morning daylight
frequency: 7
profiles: gap-closing, light
goal: morning-daylight

#### green-space · Green space
frequency: 3
profiles: maintenance, gap-closing
goal: two-hours-outside

A park, trees, water.

#### sit-outside · Sit outside
frequency: 3
profiles: light, maintenance

#### walk-somewhere-new · Walk somewhere new
frequency: 1
profiles: light
goal: somewhere-new

#### open-windows · Open the windows
frequency: 7
profiles: light, maintenance

#### day-out · A proper day out
frequency: 0
profiles: light, gap-closing

## hygiene — Hygiene

### Goals

#### floss-daily · Floss every day
profiles: gap-closing, maintenance
milestones: 7, 30, 66
metric: habit

#### brush-twice · Brush twice a day, every day
profiles: gap-closing, maintenance
milestones: 7, 30, 66
metric: habit

Two minutes each time.

#### book-dentist · Book the dentist
profiles: gap-closing, light
metric: target, booked, 1

#### skincare-daily · Skincare every day
profiles: light, maintenance
milestones: 7, 30, 66
metric: habit

### Tasks

#### brush · Brush
frequency: 7
profiles: maintenance, gap-closing
goal: brush-twice

Twice, two minutes.

#### floss · Floss
frequency: 7
profiles: gap-closing, maintenance
goal: floss-daily

#### shower · Shower
frequency: 7
profiles: maintenance

#### skincare · Skincare
frequency: 7
profiles: light, maintenance
goal: skincare-daily

#### hygiene-laundry · Laundry
frequency: 2
profiles: maintenance

#### shave-trim · Shave or trim
frequency: 2
profiles: light, maintenance

#### nails · Nails
frequency: 0
profiles: light

#### haircut · Haircut
frequency: 0
profiles: light, maintenance

## hobbies-interests — Hobbies & projects

### Goals

#### finish-project · Finish a project
profiles: gap-closing, maintenance
metric: target, done, 1

#### learn-new-skill · Learn a new skill
profiles: gap-closing, light
metric: target, done, 1

#### hours-this-quarter · 24 hours on a hobby this quarter
profiles: gap-closing, maintenance
milestones: 6 hours, 12 hours, 24 hours
metric: cumulative, hours, 24

#### make-for-someone · Make something for someone
profiles: light
metric: target, done, 1

### Tasks

#### project-time · Project time
frequency: 3
profiles: gap-closing, maintenance
goal: hours-this-quarter

One hour.

#### hobby-practice · Practice
frequency: 3
profiles: gap-closing
goal: learn-new-skill

#### make-something · Make something
frequency: 1
profiles: maintenance, light

#### learn-technique · Learn a technique
frequency: 2
profiles: gap-closing, light

#### tidy-workspace · Tidy the workspace
frequency: 1
profiles: maintenance

#### restock-supplies · Restock supplies
frequency: 0
profiles: maintenance, light

#### show-someone · Show someone
frequency: 0
profiles: light

## art-media — Art & media

### Goals

#### watch-12-films · Watch 12 films this year
profiles: gap-closing, light
milestones: 3 films, 6 films, 12 films
metric: cumulative, films, 12

#### read-6-novels · Read 6 novels this year
profiles: gap-closing, maintenance
milestones: 2 books, 4 books, 6 books
metric: cumulative, books, 6

#### six-live-events · Go to 6 live events this year
profiles: gap-closing, light
milestones: 2 events, 4 events, 6 events
metric: cumulative, events, 6

#### four-galleries · Visit 4 galleries or museums this year
profiles: light, maintenance
metric: cumulative, visits, 4

### Tasks

#### film · Film
frequency: 1
profiles: maintenance, light
goal: watch-12-films

#### read-novel · Read
frequency: 7
profiles: maintenance, gap-closing
goal: read-6-novels

#### album · Album, start to finish
frequency: 1
profiles: light

#### gallery · Gallery or museum
frequency: 0
profiles: light, gap-closing
goal: four-galleries

#### live-music · Live music
frequency: 0
profiles: gap-closing, light
goal: six-live-events

#### new-genre · Try a new genre
frequency: 0
profiles: gap-closing, light

#### talk-about-it · Talk about it
frequency: 1
profiles: light, maintenance

## adventure-experiences — Adventure & experiences

### Goals

#### four-new-places · Visit 4 new places this year
profiles: gap-closing, maintenance
milestones: 1 place, 2 places, 4 places
metric: cumulative, places, 4

#### four-weekends-away · 4 weekends away this year
profiles: gap-closing, light
metric: cumulative, trips, 4

#### trip-abroad · Take a trip abroad
profiles: gap-closing, light
metric: target, done, 1

#### ten-new-things · Try 10 new things this year
profiles: maintenance, light
milestones: 3 things, 6 things, 10 things
metric: cumulative, things, 10

### Tasks

#### plan-something · Plan something
frequency: 1
profiles: gap-closing, maintenance

Twenty minutes of booking.

#### somewhere-new · Somewhere new
frequency: 1
profiles: gap-closing, light
goal: four-new-places

#### day-trip · Day trip
frequency: 0
profiles: light, maintenance

#### try-something-new · Try something new
frequency: 0
profiles: gap-closing, light
goal: ten-new-things

#### book-something · Book something
frequency: 0
profiles: gap-closing, maintenance

#### long-way · Take the long way
frequency: 2
profiles: light, maintenance

## significant-other — Significant other

### Goals

#### twelve-dates · Go on 12 dates this year
profiles: gap-closing, maintenance
milestones: 3 dates, 6 dates, 12 dates
metric: cumulative, dates, 12

#### trip-together · Take a trip together
profiles: gap-closing, light
metric: target, done, 1

#### six-new-things · Do 6 new things together this year
profiles: maintenance, light
milestones: 2 things, 4 things, 6 things
metric: cumulative, things, 6

Novelty keeps satisfaction alive where routine wears it down.

#### weekend-away · Plan a weekend away
profiles: gap-closing, light
metric: target, done, 1

## family — Family

### Goals

#### visit-six · Visit 6 times this year
profiles: gap-closing, maintenance
milestones: 2 visits, 4 visits, 6 visits
metric: cumulative, visits, 6

#### standing-call · Set up a standing call
profiles: gap-closing, maintenance, light
metric: target, done, 1

A set time each week that neither of you has to arrange.

#### family-trip · Plan a family trip
profiles: gap-closing, light
metric: target, done, 1

#### family-story · Record a family story
profiles: light
metric: target, done, 1

## friendship — Friendship

### Goals

#### host-something · Host something
profiles: gap-closing, light
metric: target, done, 1

#### trip-with-friends · Plan a trip with friends
profiles: gap-closing, light
metric: target, done, 1

#### old-friend · Get back in touch with an old friend
profiles: gap-closing, maintenance
metric: target, done, 1

#### twelve-things · Do 12 things with friends this year
profiles: maintenance, light
milestones: 3 times, 6 times, 12 times
metric: cumulative, times, 12
