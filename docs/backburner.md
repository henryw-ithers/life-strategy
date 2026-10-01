# Backburner

Ideas deliberately parked — recorded so they aren't lost, with the
concerns that parked them.

## Rosy retrospection: softening past scores

*Parked 2026-07-15.*

**The idea:** over time, slightly boost past scores at random —
mirroring how human memory genuinely works (rosy retrospection /
fading affect bias). A hard month, viewed from a year away, shouldn't
sting the way it did in the moment.

**Why it's parked, not rejected:** the insight is good; the mechanism
as stated has problems worth solving first:

- **It corrupts the calibration experiment.** ADR-0008 needs true
  grades to correlate against felt contentment; silently inflated
  grades poison the ground truth.
- **It breaks reproducible history**, the principle the entire data
  model (ADR-0002) is built on.
- **It risks all trust in the log.** If a user notices numbers
  drifting upward, every number becomes suspect — and the "log of your
  life" is only valuable while the log is true.

**The likely honest version (presentation-layer kindness):** keep
stored grades true; render distance softly. Older periods display as
coarser, kinder summaries ("a solid week" instead of "71"); zoomed-out
views foreground trends, bests, and special days rather than
individual low numbers; year-in-review reads like memory does, not
like an audit. Same emotional effect, no falsified data. Partially
adopted already in vision.md ("Scores are guidelines, not judgments");
the fuller treatment (grade "fading" into display bands with age)
stays here until the core loop ships.

## Streaks

*Raised 2026-07-26.*

**The idea:** a streak mechanic — consecutive days of completing the
daily checklist — as a motivational surface.

**Status: already half-decided, in the permissive direction.** This
is less parked than it looks. ADR-0004 §5 explicitly allows it:
"Consistency is *shown*, not *enforced*: streaks, variance, and
best/worst days are separate statistics that never bend the grade."
ADR-0004 §3 goes further and already presumes streaks exist as a
concept — rest days are defined as "no grade, no penalty, **no streak
break**." The invariant in AGENTS.md prohibits "streak guilt," not
streaks.

**So the live question is presentation, not existence.** The line the
existing decisions draw:

- **Allowed:** a streak counted and displayed as one statistic among
  several (variance, bests), sitting in the strategy/stats layer.
- **Not allowed:** the streak affecting the grade (§5 — the grade is
  purely additive, and this would be a formula-version change, not a
  UI addition); alarm colors or mourning copy on a break; anything
  that makes the number feel like it can be *lost* rather than
  *observed*. That's the loss-aversion mechanic PRODUCT.md names as
  an anti-reference, and vision.md's "no streak guilt."

**Decided and built 2026-08-16.** `packages/scoring/src/streak.ts`
with 14 tests; habit goals render in `GoalMetricPanel`, daily-task runs
in `TaskRow`. The copy rules this entry demanded are now in
[copy-guide.md](design/copy-guide.md) under Streaks, and ADR-0015
carries the third metric kind. The decisions, as taken:

- **Habit goals are a third metric kind** alongside ADR-0015's
  `cumulative` and `target`. **No target value, milestones only** —
  Henry: *"the idea is you make it a permanent habit."* That cuts
  against ADR-0007's "goals are temporary" and wants an amendment
  there when it lands. A habit goal never auto-completes.
- **Default milestone ladder: 7 · 30 · 66 days.** 66 is Lally's median
  to automaticity, so the top rung is a research number rather than a
  round one (the same instruction that replaced 10,000 steps with
  8,000).
- **Streaks also appear on daily tasks**, not only on habit goals.
- **Strict consecutive days. One miss resets.** A declared day off is
  skipped entirely, never a break (ADR-0004 §3 already requires this).
  Lally's finding that a single miss doesn't materially affect habit
  formation would have supported forgiveness; Henry chose strict
  anyway, which is his call and makes the **break copy carry all the
  weight this entry warns about below.** Whoever builds it writes that
  copy rule into the copy guide first: no alarm colour, no mourning, no
  language that makes the number feel lost rather than restarted.
- Still bound by ADR-0004 §5: a streak is **shown, never enforced**,
  and never touches the grade.

**Badges are deliberately not decided.** They need a look-back surface
to live in, and the `achievement` table is still write-only. Revisit
once the monthly review exists.

**The design risk worth naming before building it:** a streak is the
single most load-bearing shame surface in habit apps, and its
emotional weight comes almost entirely from the break, not the count.
A streak that genuinely never punishes may also not motivate — at
which point it's decoration. Worth deciding what it's *for* before
adding it. The gentler framings already available: "best month so
far," "days logged this month," or consistency as a shape (the month
grid already tints days) rather than a fragile integer.

**Prerequisite:** rest days must not break it (already specified) and
neither should days outside the edit window that were simply never
opened — see the aggregation gap noted 2026-07-26, where untouched
days currently vanish rather than counting as zero.

## Screen-time limits with negative scoring

*Parked 2026-07-26.*

**The idea:** track device screen time, let the user set their own
limits, and dock points from the daily grade when a limit is broken.

**Why it's parked, not rejected:** the underlying goal — making a
real behavioural constraint count for something — is legitimate, and
the taxonomy already has somewhere to put it (ADR-0003's worked
example uses "Online entertainment" as an SLU). The stated mechanism
hits four walls:

- **Negative scoring contradicts ADR-0004 §5.** The grade is "purely
  additive… no floors, curves, or weighting tricks anywhere."
  Subtracting points is not a UI addition; it is a formula-version
  change, and the ADR says so explicitly.
- **A penalty is a loss-aversion mechanic** — the exact pattern
  PRODUCT.md lists as an anti-reference and AGENTS.md lists as an
  invariant. Points you can *lose* behave differently from points you
  haven't *earned yet*, even when the arithmetic is identical.
- **iOS makes it close to impossible.** Screen Time data lives behind
  FamilyControls / DeviceActivity / ManagedSettings, which need the
  Family Controls entitlement (an Apple approval process), and the
  usage data is rendered inside a sandboxed report extension — the
  host app cannot read raw numbers out of it. Android is far more
  permissive (`UsageStatsManager` + the `PACKAGE_USAGE_STATS`
  special-access grant), so this would be a lopsided feature at best.
- **It ends the Expo Go workflow.** No part of this runs in Expo Go;
  it needs a config plugin and a development build. The SDK 54 pin
  exists precisely because the test iPhone's Expo Go caps there
  (ADR-0001, apps/mobile/AGENTS.md). This feature would force that
  decision open.

There is also a softer objection: every input in the app today is
self-reported. Passive device surveillance is a different
relationship with the user, and worth choosing deliberately rather
than arriving at via a feature.

**The likely honest version (invert the sign):** staying under a
self-set limit becomes a *task* under its SLU — completed, earning
its rank-derived points like any other task, on the additive model
that already exists. Same behavioural target, no penalty, no formula
change, and it works today with manual self-report and zero platform
APIs. If manual reporting proves unreliable in real use, *that* is
the trigger to open an ADR for automated measurement (Android first,
iOS as a known-degraded case) — and the ADR would then be about the
data source only, since the scoring question would already be
settled.

## Social: accountability partners

*Raised 2026-07-28.*

**The idea:** let a small number of friends see something about your
progress, so other people can hold you accountable. Instinct attached
to it: cap the number of friends, and cap what's displayed.

**Status: already inside the existing line, but the hard part is
unsolved.** This is not a new direction — vision.md's Future
Directions names "light community: accountability partners and shared
goals — knowledge-sharing, never comparison." So the question was
always *when* and *what*, not *whether*.

The two caps are the right instincts, and they're the same instinct
the existing decisions already encode. What's ruled out is specific
and absolute — AGENTS.md's invariant ("never add leaderboards, score
comparisons, or competitive rankings — excluded by design, not omitted
by accident"), PRODUCT.md's social-comparison anti-reference, and
vision.md's "personal over social. Daily grades are private by
default."

**The unsolved problem: the grade is the obvious thing to share, and
it's the one thing that can't be shared.** A number out of 100, shown
to a friend who also has a number out of 100, is a leaderboard with
two rows — the mechanic is comparison whether or not it's ranked, and
capping the friend count doesn't change that. It also breaks the
premise underneath the number: weights are derived from *your*
diagnostic, so two grades aren't measured on the same scale. A 70 and
a 90 aren't comparable even in principle, which makes displaying them
side by side not just unkind but meaningless.

**So the design question is: what do you share that isn't a score?**
Sketches worth exploring, roughly in order of how well they survive
the invariants:

- **A goal, not a grade.** Share one active goal and its status with
  one friend — "Henry is working on: run 10k by October." The
  accountability comes from the commitment being witnessed, which is
  the actual mechanism in the research; the number never appears.
- **Presence, not performance.** "Checked in today" as a binary, with
  no score attached. Survives the invariants cleanly, but it is a step
  toward streak-adjacent pressure, so it needs the ADR-0004 §5
  treatment: shown, never enforced.
- **Direction, not level.** Share that a unit is improving without
  sharing where it sits. Dodges the incomparable-scales problem, but
  a trend is still a metric and still invites comparison.
- **Knowledge-sharing** — the thing vision.md actually names. Friends
  exchange goals and tasks that worked for them, with no visibility
  into each other's data at all. This is the safest version and is
  really ADR-0018 (templates and sharing) wearing a social hat.

**What it would cost, and why that matters more here than usual.**
Everything in Life Strategy is local-first: no accounts, no server, no
telemetry, and a privacy story that currently fits in one sentence
([ADR-0002](adr/0002-data-model-and-persistence.md);
[ADR-0013](adr/0013-crash-reporting-and-telemetry.md) kept it that way,
telemetry included). Any friend graph needs an account
system, a server, and a sync path — which drags in ADR-0012 (identity)
and ADR-0016 (sync) as hard prerequisites, and replaces "your data
never leaves your device" with something that needs paragraphs. That
is the real price, and it is much larger than the feature.

**Prerequisites before this is even designable:** the friends test has
to have run (does accountability turn out to be the missing
ingredient, or is that an assumption?), plus ADR-0012 and ADR-0016.
If it graduates from here it becomes its own ADR, and the first
question that ADR has to answer is not "how do we build this" but
"what does a friend see, and can it be something other than a
number?"

## Subtasks: breaking a task into smaller steps

*Raised 2026-08-02.*

**The idea:** let a task contain sub-tasks — a series of smaller steps
inside one checklist row. Motivating example: "Skincare" containing
each product in the routine.

**Status: split into three, and only one of them is worth building.**
"Subtasks" is a single name over three different features, and the
motivating example belongs to the cheapest one.

**1. Defining what a task means — accepted 2026-08-02.** Promoted out
of here; the build plan lives in
[task-setup-brief.md](design/task-setup-brief.md#task-description). The
reasoning is kept below because it is why the other two stay parked.

**1. Defining what a task means — build this, it's a text field.**
The real problem under the skincare example isn't structure, it's that
*"Skincare" is a vague promise to yourself*. Ticked, it could mean the
full routine or a face wash, and the grade cannot tell the difference —
which erodes the honesty the whole record depends on. Writing down what
the task consists of is a self-contract, and it wants a **description
on `task`**, not a tree under it. `goal.description` already exists;
`task` has no notes field at all. One column, one input in
`TaskEditSheet`, rendered on the plan screen and on tap-to-expand from
Today — never as extra rows in the checklist. It also gives ADR-0006's
recommendation library somewhere to put per-task guidance when it
ships.

**2. Wanting 3-of-5 to score differently from 5-of-5 — that is
[ADR-0014](adr/README.md), and it has a written trigger.** Partial
credit is already reserved and deliberately deferred; ADR-0004 §2's
trigger is calibration data (ADR-0008) showing binary completion
diverging from felt contentment. Subtasks-with-progress is that
decision made accidentally, with the fraction living in a subtask table
instead of on `task_completion` where the model wants it. Pulling the
trigger early is allowed — it is Henry's app — but it is an ADR, not a
migration.

**3. Steps that are independently worth doing — already supported.**
ADR-0003 ranks tasks within a unit. Several tasks is the answer, the
same way ADR-0007 §3 answers nesting for goals ("if a plan genuinely
needs nesting, it's usually two goals"). The cost being avoided is
checklist length, and the answer to *that* is grouping and collapsing
in the UI, not a new level in the data model.

**Why the plain version is parked:**

- **It collides with the scoring model, not just the UI.** A task's
  points come from `rank_in_unit`, and a unit's weight is *fully spent*
  across its ranked tasks (ADR-0003 §5, with the 1-point floor and
  uncovered-weight reallocation on top). Scored subtasks mean a second
  ranking layer inside an already-allocated weight, a two-level
  largest-remainder pass per unit, and a second denormalized
  points-earned table beside `task_completion`. Unscored subtasks are
  notes — see 1.
- **It is the product's first anti-reference, on the surface least able
  to carry it.** PRODUCT.md names "Jira/Notion-style density, nested
  configuration"; DESIGN.md says Groups never nest; design principle 2
  puts the daily surface at under a minute. ADR-0007 §3 already refused
  recursive trees for goals, which have a stronger claim to them than
  tasks do.
- **The motivating example argues against itself.** Cleanser → serum →
  moisturiser → SPF is one decision, not five. Nobody does the cleanser
  and skips the moisturiser as a scored choice, so five taps record one
  action — friction, not information.

**The one case a description doesn't cover:** losing your place
mid-session in a genuinely long routine (six physio exercises). That
wants *ephemeral* tick state — not persisted, not scored, discarded on
completion — which is a smaller and different feature. Worth waiting to
see whether it's actually missed.

**Prerequisite before revisiting 2:** ADR-0008 calibration data, the
trigger already written for ADR-0014.

## Wrapped-style monthly and yearly recaps

*Raised 2026-07-26.*

**The idea:** a Spotify-Wrapped-style recap — a designed, celebratory
retrospective of the month or year, rather than a table of numbers.

**Status: aligned with existing direction, blocked on
infrastructure.** This is the most compatible of the three. Design
principle #5 ("the log is a record of a life") and vision.md's
long-term framing both point here, and the rosy-retrospection entry
above already sketched the same instinct: "year-in-review reads like
memory does, not like an audit."

**What it needs first** — none of it exists yet:

- A look-back / history surface at all. `journal_entry`, `photo`, and
  `achievement` rows are currently written and never read back
  outside the day they belong to.
- The monthly review ritual (ADR-0002 decision 5), still unbuilt —
  `loadMonthGrade` has no caller.
- Memory flags and special days to have accumulated enough history to
  have something to resurface. A recap over six weeks of data is a
  thin experience; this wants a year.

**Constraints to carry into the design:**

- ADR-0008: celebration may condition on **positive events only**.
  A recap must not surface "your worst month" or lead with a low
  number — and it has to read identically well after a bad year, which
  is the hard part of the brief.
- The backburner entry above applies directly: render distance
  softly, but never falsify the stored numbers.
- PRODUCT.md excludes social comparison by design. Wrapped's actual
  engine is shareability and implicit ranking against other people;
  strip that and what remains is a personal retrospective — which is
  the thing worth building, but it is a genuinely different artifact
  from its reference. Worth being clear that only the *form* is being
  borrowed.

## Satisfaction: rated 1–10, not ranked

*Raised 2026-08-02. **Accepted the same day** — shipped as
[ADR-0022](adr/0022-satisfaction-is-rated-not-ranked.md). Kept here for
the working-out.*

**The idea:** keep priority ranked, but return satisfaction to an
absolute 1–10 rating — reversing half of
[ADR-0005](adr/0005-diagnostic-snapshots-and-history.md) §7.

**Status: recommended, and the arithmetic is decisive.** Both axes run
the same `rankToScore` over the same 18 units, so they produce
*identical multisets of values*. Verified: `Σ I = Σ S = 99` and the mean
of `I − S` is exactly 0, every diagnostic, for every user. Therefore
`Σ max(0, I − S) = ½ Σ|I − S|` — **the gap term measures only the
disagreement between the two orderings.** Whether the user is actually
satisfied cancels out by construction.

Three stated commitments this breaks:

- **vision.md's mechanism is currently false.** "As satisfaction
  improves in later diagnostics, the boost naturally shrinks and points
  flow to the next gap." It cannot: if life improves uniformly and the
  order holds, `S` is bit-identical and so are the derived weights.
- **The portfolio graph's x-axis is pinned.** ADR-0005 and vision.md
  both call watching bubbles migrate toward the top-right "the
  emotional payoff of the whole system." Under ranked satisfaction the
  x-axis is a permutation of the same 18 values every snapshot —
  bubbles swap places, the cloud never drifts right. A year of real
  improvement renders as a reshuffle. **The asymmetry is the point:**
  y being a permutation is *correct*, because a priority shift genuinely
  is a reordering and there is no absolute scale of "how important is
  friendship." x being a permutation is a defect.
- **Forced spread invents a crisis and hides a real one.** Someone
  always ranks last, so some unit always sits at S=1 — manufacturing a
  large gap boost in a life where nothing is wrong. In reverse, the
  least-bad thing in a bad life sits at S=10 and gets no boost at all.

**ADR-0005 already wrote down the distinction that justifies this.** Its
2026-07-30 amendment, explaining why re-ranking is priority-only:
"Satisfaction is an assessment rather than a preference." That is the
argument for rating it.

**Why the original reason for ranking doesn't carry over.** §7 adopted
ranking to kill ceiling-clustering — "most units genuinely feel
important, most dials land 6–10." Clustering on **importance is
measurement failure**: you cannot discriminate between things that are
all genuinely important. Clustering on **satisfaction is a finding** —
it means life is going well, and the correct response is flatter gap
boosts with importance driving, which is what the formula already does
unaided. The defect ranking fixed is specific to the priority axis.

**Costs, honestly:**

- **History gains a scale boundary — the significant one.** A stored
  satisfaction of 3 means "3rd-lowest of 18" before and "quite
  dissatisfied" after. Snapshots are immutable (ADR-0002) and compare
  mode and playback tween *across* the changeover, so bubbles will jump
  on x for reasons that aren't life. Do **not** rewrite history — that
  invents data. `snapshot.formula_version` already stamps per snapshot,
  so mark the boundary in the scrubber and compare mode.
  `FORMULA_VERSION` bumps 3 → 4: the arithmetic is unchanged, but the
  inputs change meaning. How much this costs depends entirely on how
  many real snapshots exist at the time of the change.
- **Self-report drift.** S=6 in January versus June assumes a stable
  internal ruler — precisely what ranking sidestepped. The obvious
  mitigation (prefill last month's value) is anchoring bias against a
  fresh assessment, so satisfaction should stay cold-start even once
  priority carry-over prefill ships.
- **The flow goes asymmetric** — priority ranked, satisfaction rated.
  `NumberDial` already exists and ships in `calibration.tsx` and
  `DayKindSheet`, so component cost is ~0, but eighteen dials needs a
  shape. Six screens of three, grouped and hued by area, matches the
  existing `ProgressDots` step model — and is one more *presentational*
  job for SLAs, tying into the entry below.

**What it simplifies:** the satisfaction half of the ranking machinery
retires — `DiagnosticAxis` collapses toward priority-only,
`suggestOverallOrder`/`combineHierarchicalRank` lose their satisfaction
caller, and `buildSequence` drops from five steps to three.
`weightsForPriorityOrder` already takes satisfaction as a
`ReadonlyMap` carried from the snapshot, so the re-rank path is
*already* shaped for satisfaction-as-absolute.

**No migration.** `rating.satisfaction` is already `real` (widened by
§7); integers store in it fine.

**Next step:** an ADR amending ADR-0005 §7 and bumping
`FORMULA_VERSION` to 4. Open question for that ADR beyond the decision
itself: how the graph presents the pre/post scale boundary.

## Demoting SLAs: areas as presentation, not structure

*Raised 2026-08-02. **Accepted the same day** — shipped as
[ADR-0021](adr/0021-areas-are-presentational.md). Kept here for the
working-out.*

**The idea:** units are what matter; areas are really just a way to
categorize them. Make SLAs cosmetic, or remove them.

**Status: the first half already happened, twice, without anyone
writing it down.** Areas contribute **nothing to any stored score
today**. The evidence, in the code rather than the docs:

- The diagnostic calls
  `buildEntriesFromRanking(areas, {}, areaOrder, finalOrder)` — the
  `unitOrderByArea` argument is literally `{}`. The per-area unit
  ranking passes were removed (see `buildSequence`'s header comment in
  `apps/mobile/src/app/diagnostic.tsx`), because a strict area-primary
  composition can put a low unit of a top area above the best unit of a
  lower one anyway. What scores is `finalOrder`: **one flat list of 18
  units**, per axis.
- [ADR-0005](adr/0005-diagnostic-snapshots-and-history.md)'s 2026-07-30
  amendment removed the Portfolio tab's area-level re-rank mode
  *because it destroyed data* — any area-level move has to regroup
  units into contiguous blocks, silently discarding every cross-area
  decision behind it. The flat list determines the weights, so the
  hierarchical representation lost.

So the live question is not "should areas be cosmetic" — they are. It
is **"what is an area still allowed to determine, and is that written
down anywhere?"** It isn't, which is how the area re-rank mode got
built and shipped.

**What areas still genuinely do, and should keep doing:**

- **Colour. This is the big one and it is a hard limit, not a
  preference.** DESIGN.md's entire secondary palette is six categorical
  area hues at matched perceptual weight, AA in both themes, carrying
  identity everywhere — checklist circles, task pips, bubbles, legend,
  the NumberDial readout. Eighteen mutually distinguishable hues that
  survive light *and* dark and stay AA does not exist. **Areas are the
  colour system**, and removing them means either 18 indistinguishable
  colours or no colour identity at all.
- **Grouping.** Plan, Goals, the diagnostic diff and the weight summary
  all render 6 collapsible sections rather than 18 flat rows.
- **The diagnostic's cold-start seed.** Ranking 6 areas orders the
  18-unit list you then drag. This is the one removal that would
  actually cost something: dragging 18 units into order from nothing,
  twice per diagnostic.
- **The 6-area rollup** on the portfolio graph (ADR-0005 §5).
- **Taxonomy completeness** — vision.md's "the app always starts from
  this structure so nothing important is silently forgotten." Six areas
  is the mental checklist that makes 18 units feel surveyed rather than
  arbitrary.

**The evolution worth building instead of a removal.** The area step
isn't earning its place as a permanent fixture; it's earning it as a
*cold-start* seed. ADR-0005 §7 already names the replacement as an
acknowledged gap — "carry-over prefill for rankings… not built this
pass," with drag-to-reorder from the previous order as the likely
shape. Ship that, and the area ranking fires only on a first-ever
diagnostic, where there is no prior order to seed from. Every
subsequent diagnostic opens on last month's order, which is both a
better seed than an area composition and the convenience the dial era
had and the ranking era lost.

**The decision that should be written down either way**, because it is
an invariant and it has already been violated once in shipped code:

> An area may determine **colour, grouping, and the diagnostic's
> opening seed**. It may never determine weight, rank, points, or any
> stored value.

**What that unlocks** — and this is the real product payoff, not
tidiness: `life_unit.area_id` becomes a *soft* attribute. Units can be
re-homed freely, custom units can be filed anywhere (or nowhere, into
an "Other" bucket), and areas can be renamed or reordered, all with
zero scoring consequence. vision.md already promises this ("the
taxonomy is the default, not a cage"); today it's quietly risky,
because area order feeds the seed.

**What not to do:** drop the `life_area` table. It is the colour key,
the grouping key, and the presentation of every historical snapshot.
Deleting it is a destructive migration with no upside — "cosmetic"
means demoted, not removed.

**Next step:** this is architecturally significant (it constrains what
may influence scoring), so it wants an ADR rather than a code change —
**ADR-0021, "Strategic Life Areas are presentational."** Reserved
numbers 0012 and 0014–0018 stay reserved for their own triggers; 0021
is the next free slot, following the precedent set when 0019 and 0020
were written ahead of them.

## The daily number is too generous, and 80 doesn't mean much

*Raised 2026-08-13, from real use — after
[ADR-0023](adr/0023-planned-work-is-what-pays.md), not instead of it.*

**The report:** a day with 5 of 10 daily tasks done and 3 weekly tasks
knocked out scored **78**, on a day that felt bare-minimum and
unproductive. ADR-0023 closed the *unplanned* leaks (activities and
special days); this is a separate one, and it is in the planned side
of the formula.

**The mechanism, exactly.** ADR-0004 §4 (formula v2) made the day's
denominator the weekly commitment spread evenly — `dayShare` is
`point_value × times_per_week ÷ 7` — while a completion still earns
its **full `point_value`** on the day it happens. So for a task of
frequency `f`, completing it pays

    payout ÷ its share of the day = p ÷ (p·f/7) = 7 ÷ f

| Frequency | A completion pays |
|---|---|
| 7×/week (daily) | 1× its daily share — fair |
| 3×/week | **2.3×** |
| 1×/week | **7×** |
| fortnightly (`f = 0`) | **14×** |

Three weekly tasks in one day can therefore out-earn five skipped
daily tasks several times over, which is exactly the reported day.

**This is not a bug — it is self-consistent over a week.** A 1×/week
task contributes `p/7` to each of seven denominators (total `p`) and
pays `p` once. The week balances exactly, which is what makes the
weekly grade the plain average of daily grades. **The day is where it
goes wrong:** an amortized denominator against un-amortized payouts is
lumpy by construction, and the lump lands on whichever day you
happened to do the weekly work.

**A second, independent compression.** `MISSED_DAY_CREDIT = 0.5` means
a day you never opened contributes 50% to weekly and monthly grades.
The constant's own comment already flags the incentive problem; the
effect here is that aggregates live in a **50–100 band**, so 78 sits
much closer to "did nothing" than it reads. If 80 is to hold weight,
the floor matters as much as the ceiling.

**Directions, none chosen:**

- **Pay weekly tasks their daily share on the day, and the remainder
  on the week.** Keeps "every check moves the number" but makes the
  day honest. Most faithful to the current model; the arithmetic for
  the remainder needs care.
- **Grade the day on daily tasks only**, weekly work landing in the
  weekly grade. This is what ADR-0004 §4 said *before* the v2
  amendment superseded it — worth re-reading that section before
  reinventing it, including why it was dropped.
- **Show two numbers**: the day's planned-work completion and its
  points. Presentation-only, changes no arithmetic.
- **Revisit `MISSED_DAY_CREDIT`.** The constant already documents the
  one-line alternative: `{ earned: 0, possible: dailyPossible / 2 }`
  softens a missed day without paying you to skip one.

**RESOLVED 2026-08-18 by
[ADR-0027](adr/0027-coverage-decides-the-ceiling.md)** (formula v7).
The trigger was the same complaint arriving with a number attached: a
day of finished work read **112**. The two bands replace `dayShare`
outright, so nothing is amortized and no completion can pay more than
its band holds. The second compression noted above went a different
way than this entry guessed — `MISSED_DAY_CREDIT` was retired on
2026-08-13 (a missed day is a zero, ADR-0004 §5), so the 50–100 band
problem is gone rather than softened.

~~**Why it's parked, not fixed:** it is a third formula version in a
fortnight (v4 → v5 already landed on 2026-08-13), each one a seam in
history that cannot be re-derived. Worth batching with ADR-0008's
calibration data, which is the instrument that can actually say
whether the number tracks how the day felt — which is the complaint.~~
The seam argument held for five days and then stopped holding: a
number that can exceed its own maximum cannot be calibrated against
anything, so waiting for calibration data was waiting on an instrument
the bug had already broken. ADR-0027 §5 pays the seam cost explicitly —
history keeps its old numbers and there is no longer any way to
re-derive them.

**2026-08-16: fill-first was briefly queued here, and is now closed.**
Restoring it was decided on the reading that vision.md described
intended behaviour and the code had drifted. That was backwards —
ADR-0023 removed fill-first *on purpose*, and vision.md was simply
never updated. Building it proved the point: a day with no planned work
done and two activities logged scored **100**. vision.md has been
corrected; ADR-0023 stands as written. See
[ADR-0025 §12](adr/0025-communal-units-are-dimensions.md).

**2026-08-16: the batch ran, and only one of the three shipped.**

- **Communal weight — shipped as `FORMULA_VERSION` 6.** Landed as a
  *definition* rather than an exemption: a communal unit is covered,
  because tagging is always available to it. ADR-0003 §5 amended.
- **Fill-first — built, pulled, and now closed for good.** It scored a
  day with no planned work done and two activities logged at **100**,
  which is the failure ADR-0023 exists to prevent. The premise behind
  restoring it turned out to be backwards: ADR-0023 *deliberately*
  removed fill-first and vision.md was simply never updated, so there
  was no drift to correct and no question to answer. **vision.md is now
  fixed** — along with two other passages the same version left stale
  (special-day grading, and rest days). ADR-0023 stands as written.
- **The daily denominator — untouched**, because it was never decided.
  The four directions below are still four directions.

So the seam count is one, not three, and the two open items below are
open *questions* rather than queued work.

### The scale this should be tuned against

*Henry, 2026-08-13.* The target meaning of a daily grade. This is the
objective function for any retune — the arithmetic above is the
mechanism, this is the goal:

| Grade | Means |
|---|---|
| **50** | Standard. You did the basic things — a pass, and it doesn't hurt you. |
| **60** | Solid. Basic upkeep plus one or two bonus items. |
| **70** | Good. All your basic upkeep, plus some of the week's other tasks. |
| **80** | Very good. |
| **90** | Amazing — working or doing something basically the whole day. |

**The gap is large, and it is not a rounding issue.** Under the
current formula, a day where every daily task is done and *no* weekly
work happens scores

    Σ_daily p ÷ (Σ_daily p + Σ_weekly p·f/7)

which for a plan split evenly between daily and weekly work at an
average `f` of 2–3 lands near **75–80**. On the scale above that same
day is a **60**. ADR-0004 §4's v2 amendment did intend "only your
dailies" to sit below 100 — but it sits far higher than intended, and
the top of the range is consequently unreachable in any meaningful
sense: if bare upkeep is 78, there is nowhere for "amazing" to go.

### ~~Missed days should be N/A, not 50%~~ — **done 2026-08-13, as a zero**

**Shipped**, but stricter than N/A. It went out as true N/A first;
within the hour the incentive was reconsidered — N/A makes skipping
free, and the weekly and monthly numbers should reward showing up
every day. An unrecorded elapsed day now takes a **full denominator
and earns nothing**. `MISSED_DAY_CREDIT` is gone either way; the
argument against 50 (it reports a passing day that never happened)
was what killed it and still stands.

The opt-out is a **declared day off**, which leaves the aggregate
entirely and can be set on any past day — `isEditable` is
`date <= today`, with no lock. Recorded as an amendment to
[ADR-0004 §5](adr/0004-grade-lifecycle-and-aggregation.md). Needed no
`FORMULA_VERSION` bump. The original reasoning follows.

*Henry, 2026-08-13.* `MISSED_DAY_CREDIT = 0.5` is not merely generous,
it **collides with the scale above**: 50 is defined as "you did the
basic things and passed," and a day the user never opened is scored at
exactly that. The fill silently asserts the one thing it has no
evidence for.

The counter-argument is real and is written into `periodDays`: drop
missed days entirely and a week with four good days and three ignored
ones grades like a flawless four-day week, so skipping becomes free.
Three ways out, none chosen:

- **True N/A** — `{0, 0}`, excluded exactly like a day off. Matches
  the request most literally; makes skipping free. Probably needs a
  companion signal (days-graded count shown beside the grade) so an
  aggregate can't quietly rest on two days.
- **Half weight, no credit** — `{0, dailyPossible / 2}`. The
  alternative `MISSED_DAY_CREDIT`'s own comment already names. A
  missed day drags, at half force, and can never *pay* you.
- **Full weight, no credit** — `{0, dailyPossible}`. Honest and harsh;
  probably too harsh for a product whose first invariant is that it
  never shames.

**Cheap to change, and seam-free.** `MISSED_DAY_CREDIT` is not part of
weight derivation, so moving it does **not** bump `FORMULA_VERSION` —
the constant says so explicitly. It only affects how finished days
aggregate, so unlike the rest of this section it could ship on its own
without adding a version boundary to history.

## Timetable import

*Parked 2026-08-21, by Henry's call, while
[ADR-0035](adr/0035-commitments-are-custom-units.md) was being drafted.*

**The idea:** stop making people type a timetable in. Henry's first
framing was "a local AI that is pre-trained on reading university
schedules."

**Why it's parked, not rejected:** the need is real and the ordering
is wrong. Three things, in the order they should happen:

- **`.ics` first, and it may be most of the answer.** Canvas, Moodle,
  Blackboard and Banner all publish a calendar feed or export. Parsing
  one is exact rather than probabilistic, testable off-device, needs no
  model, and runs in Expo Go. `fixed_commitment` is already the
  expanded form an importer produces — an `RRULE` with `EXDATE`s maps
  onto `weeks` plus one-off `specific_date` rows.
- **The seam is already paid for** (ADR-0035 §7): `source` and
  `external_id` are two inert nullable columns, and every commitment is
  written through one `createCommitment()`. An importer is a second
  caller of one function, not a second write path.
- **On-device extraction is the second pass**, for the PDF and the
  screenshot `.ics` misses. Apple's Vision framework does the OCR with
  nothing bundled; a structured-extraction pass over the text is the
  part that wants a model. Note that "pre-trained on reading
  university schedules" is not what would actually happen — you do not
  train, you prompt with a schema and validate the result.

**What it must not do.** [privacy.md](privacy.md) promises no server,
no analytics and no third-party SDK that phones home, and the app's
whole disposition rests on that being simply true. A cloud call would
send someone's timetable — which is to say their location, hour by
hour, for four months — off the device. So: on-device only, and
**bundling a model or calling a network service reopens the privacy
story rather than extending it.** Planned **ADR-0017** already reserves
the on-device-LLM question and is where this lands.

Note also that custom native code means **no Expo Go**, the same
constraint ADR-0020 put on backup and for the same reason. That is a
real cost for a feature whose whole promise is "this is quick."

## The draggable weight pie

*Parked 2026-09-11, by Henry's call — "that was a side thought."*

**The idea:** replace the pairwise ranking board with a pie of the
active units that the user drags directly, setting each unit's share of
the 100 by hand.

**Why it is worth keeping.** The write path already exists:
`applyPriorityOrder` (`apps/mobile/src/db/ranking.ts:218`) takes a
user-arranged ordering, writes the result to `unit_weight.override`,
recomputes every task's points and recaches day scores;
`resetToDiagnostic` drops the overrides. The schema already says
*"Effective weight = override ?? derived."* And it is already a product
invariant that every derived value is overridable with the recommended
value still shown — which a pie renders beautifully: **the dragged
slice with a ghost mark where the diagnostic put it.**

**What parked it:** it is orthogonal to the commitment work that this
branch is actually for, and it is the kind of change that would
otherwise quietly become the main event.

**Two things to settle before it is built:**

- **It would be the first thing to bypass `deriveWeights`.** Today's
  override still runs *through* the formula — the ranking board turns
  an ordering into synthetic importance via `rankToScore` — so the
  satisfaction-gap boost still applies. A pie sets the weight directly,
  which trips the AGENTS.md invariant *"importance first,
  satisfaction-gap boost second."* Recommended framing: the pie is the
  **override editor**, not a replacement for the diagnostic, which
  keeps the diagnostic's importance and satisfaction feeding the
  portfolio graph.
- **A literal pie is probably the wrong control.** Eighteen-plus slices
  on a phone puts several units under 3% — about 10° of arc — against
  44pt hit targets, 200% Dynamic Type and AA contrast across eighteen
  colours from a six-hue palette. ADR-0021 carries the relevant scar:
  *"No UI may let the user re-rank, re-weight, or reorder areas into a
  stored value; that has been built once and it destroyed data."*
  Likely shape: **pie as the display, a row per unit as the editor.**
  Also needs a rule for what absorbs a drag — proportionally across the
  rest, from a neighbour, or with locks. `largestRemainder` already
  keeps the integers summing to 100.

**Not needed by the commitment work.** The commitment band has its own
controls — a slider for the band and a share per commitment — and the
18 life units keep the diagnostic and the existing ranking board. This
orphans nothing.
