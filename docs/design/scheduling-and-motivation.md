# Workshop Note — Scheduling, Duration, and the Motivation Theory

> Status: **workshop** (2026-08-16). Superseded in part the same day —
> the scheduling half is now
> [ADR-0024](../adr/0024-day-planning-is-intention.md) and the
> intrinsic-units half is
> [ADR-0025](../adr/0025-communal-units-are-dimensions.md),
> both Proposed. This note is kept for the working-out and the
> citations; where it disagrees with an ADR, the ADR wins — and it
> disagrees in three places, all decided against this note on
> 2026-08-16:
>
> - **Scheduling intrinsic activities is fine, and often necessary.**
>   The Tonietto & Malkoc penalty is about scheduling *displacing*
>   spontaneity; where scheduling *enables* the thing (band practice, a
>   tee time, a standing tradition) the counterfactual is never doing
>   it at all. The mere urgency effect wins here. ADR-0025 §2.
> - **Etkin is two-sided** — measurement also raises how much you do,
>   which for an under-done activity is the point. ADR-0025 §7.
> - **Overjustification is weak in this app specifically.** The
>   undermining effect scales with how salient and tangible a reward
>   is; private, non-redeemable, uncompared points are close to the
>   floor. ADR-0025 §7.
>
> What survived: Clark & Mills on communal relationships, which is what
> ADR-0025 now rests on.
>
> Original status line: written to explore day-planning beyond
> [calendar-and-day-planning.md](calendar-and-day-planning.md), which
> stands and is not superseded. Where this note proposes something new
> (part-of-day, task size, the load meter, maintenance vs growth) it
> says so; those would amend that note or open an ADR.

## The question

Today a task is a title, a unit, and `times_per_week`. There is no
notion of *which day*, *when in the day*, or *how long*. The proposal:
let the user plan when to do a task and how long to spend on it.

The existing planning note already answers half of this — weekday
pinning and occurrence placement, phases 2 and 3, unbuilt. This note
asks what the *theory* says about the other half, and what it says
about the app as it stands.

## What the research actually supports

### Planning the when: the strongest evidence in the pile

**Implementation intentions** (Gollwitzer & Sheeran 2006, 94 studies,
8,000+ participants): specifying the *when, where, and how* of a goal
in advance produces **d = 0.65** on goal attainment, and **d = 0.77**
on preventing derailment of an ongoing pursuit. The mechanism is that
naming a cue makes the opportunity mentally accessible and automates
the response.

This is the empirical case for the feature, and it is a strong one.
But read the mechanism carefully: **the effective form is a cue, not a
clock.** "If situation Y, then I will do X." "After breakfast" and
"when I get home" are better implementation intentions than "18:30"
for exactly the tasks this app is full of.

**Habit formation** (Lally et al. 2010; Wood & Neal) says the same
thing from the other end: a habit is a *context-cue → response*
association built by repetition **in an unvarying context**. Mean time
to automaticity 66 days, range 18–254, and simple behaviours with a
stable cue automate fastest.

Two things follow:

- **Stable weekday pinning beats flexible "any 3 days"** for anything
  meant to become a habit. That is the evidence for phase 2, and it is
  better evidence than "it would be convenient."
- Lally also found that **missing one occasion did not materially
  affect habit formation.** That is literal empirical support for the
  governing principle already written down — "a missed planned day is
  rearranged, not failed." The research and the product values agree;
  worth citing in the copy guide.

**Plan-making buys mental quiet, separately from getting things done**
(Masicampo & Baumeister 2011, "Consider it done!"). Unfulfilled goals
produce intrusive thoughts and measurably degrade performance on
*unrelated* tasks — the Zeigarnik effect. Making a specific plan
**eliminated the interference without doing the task.**

This is the better pitch for planning in this app's voice. Not "get
more done" — the app has an anti-reference against that register — but
*you can stop carrying the week around*. It is also an argument for a
**single weekly planning pass** rather than scheduling scattered
through the week: the relief comes from the plan existing, once.

### The finding that should decide the granularity

**Tonietto & Malkoc 2016, "The Calendar Mindset" (Journal of Marketing
Research), 13 studies.** Scheduling a leisure activity, versus doing
it impromptu, **makes it feel less free-flowing and more work-like**,
and reduces both anticipated excitement and experienced enjoyment. The
mechanism is loss of perceived autonomy and spontaneity — a scheduled
pleasure becomes an obligation.

Two boundary conditions make this actionable rather than merely
discouraging:

1. **"Rough scheduling" eliminates the effect.** Planning within a
   broad window ("this afternoon") rather than a specific time keeps
   enjoyment at impromptu levels.
2. **The penalty is specific to discretionary/hedonic activities.**
   Utilitarian and work-like tasks show no cost from being scheduled.

Map that onto the taxonomy and it is nearly a build spec. Scheduling
is safe or helpful for Exercise & fitness, Sleep & recovery, Finances,
Job/career, Living space, Hygiene. Scheduling with clock times is
**actively counterproductive** for Friendship, Significant other,
Hobbies & projects, Art & media, Adventure & experiences, Nature —
which is a third of the taxonomy, and the third the app most wants
people to actually do.

**Recommendation: the default planning granularity is a part of the
day, not a clock time.** Morning / Afternoon / Evening / Anytime. It
is a segmented control rather than a time picker (daily simplicity),
it needs no calendar integration, and it is the evidence-backed answer
rather than a taste call. Clock times, if ever, are opt-in per task —
never the model.

### Flow: what the app already does well, and the one thing it lacks

Csikszentmihalyi's preconditions for flow are **clear goals**,
**immediate feedback**, and **challenge–skill balance**.

- **Clear goals — the app is genuinely excellent.** SLA → SLU → Goal →
  Task is a goal-clarity machine, and `task.description` (the
  self-contract, added 2026-08-02) closes the last vague gap.
- **Immediate feedback — excellent.** The number moves on every check.
- **Challenge–skill balance — entirely absent.** The app has no
  representation of how demanding a task is, or whether a given day's
  plan is too much or too little. Above the flow channel is anxiety;
  below it is boredom. An over-planned day and an under-planned day are
  currently indistinguishable to the app, and both are bad days.

**This is the real argument for Henry's duration instinct, and it is
not about time-tracking — it is about load.** The question worth
answering is not "how long did that take" but "is what I have planned
for Thursday actually a Thursday's worth of work."

Two more flow observations that cut *against* current design:

- **Flow needs uninterrupted concentration.** Ten daily checklist items
  is ten context switches. The checklist's granularity is anti-flow by
  construction. The subtasks backburner entry already refused to go
  *more* granular; the inverse question — should tasks ever group into
  a session? — has not been asked. Part-of-day sections deliver a
  version of this for free.
- **The paradox of work** (Csikszentmihalyi & LeFevre 1989, experience
  sampling): people reported flow roughly **three times more often at
  work than at leisure**, and simultaneously reported wanting to be
  somewhere else. Frequency of flow is not the same as wanting to be
  there. A day optimised for flow-productive activity can score well
  and feel wrong — which is precisely the mismatch ADR-0008's
  contentment calibration exists to detect. The instrument for this
  objection is already in the plan.

### Self-Determination Theory: the sharpest critique of the app

Deci & Ryan: autonomy, competence, relatedness.

- **Autonomy — textbook well-handled.** "Every derived value is
  overridable, and every override shows the recommendation beside it"
  is autonomy-supportive design as SDT defines it. Do not let any
  scheduling feature erode this; a plan the app *assigns* is a
  different psychological object from one the user *places*.
- **Competence — served by the grade, but only in aggregate.**
  Per-unit and per-goal progress is thinner than the daily number.
- **Relatedness — deliberately absent.** SDT says that is a real cost,
  not merely a missing feature. It does not overturn "personal over
  social," but it does explain why the accountability-partners entry in
  the backburner keeps feeling live. Note that the sketch that survives
  the invariants best — *share a goal, not a grade* — is also the one
  the commitment/witness research actually supports.

**The overjustification effect is the honest objection to the whole
app.** Rewarding an activity someone already does for its own sake can
reduce their interest in it once the reward frame is established.
Points for "reach out to a friend" is the textbook setup. This is not
fixable by tuning weights. The two real mitigations:

1. Rough scheduling for exactly those units (above), and
2. **Letting a unit sit outside scoring — which already exists.**
   `life_unit.include_in_scoring` is built (ADR-0003 §2). The open
   question is whether the app ever *suggests* it, or only permits it.

### Maslow: weaker than the others, but two parts earn their place

Being straight about it: the strict hierarchy has poor empirical
support, needs are not sequential, and the model encodes Western
individualist assumptions. **The app is already the post-Maslow
design** — it derives each person's weights from their own diagnostic
instead of imposing a universal ordering, which is the correct response
to the main critique.

Two parts are genuinely useful:

**1. Deficiency needs versus being needs — and this maps onto
something the app already discovered by itself.** vision.md says
"Wellness is the maintenance area… low-effort, high-return upkeep…
so the basics have somewhere to live and aren't crowded out by
ambition." That is a D-need/B-need distinction arrived at
independently, and it is currently only a comment about one area.

Named properly it becomes a lever: **maintenance work wants a floor;
growth work wants a ceiling.** Right now every task scores the same
way — points from rank, times per week. If the distinction were
explicit, the parked "daily number is too generous" problem gets an
instrument it currently lacks: **basic upkeep completed = the floor
(Henry's 50 on the 2026-08-13 scale), growth work is what climbs above
it.** The scale Henry wrote down is *already* a maintenance/growth
scale — "you did the basic things" versus "working or doing something
basically the whole day" — and the formula has no term for it.

This is, in my view, the most valuable non-scheduling insight in this
pass, and it is architecturally significant enough to want its own ADR.
It also collides directly with the parked retune, so it should be
batched with it and with ADR-0008 calibration data, not shipped alone.

**2. Self-transcendence** — Maslow's own later amendment
(Koltko-Rivera 2006), the step beyond self-actualisation: service,
devotion to something larger than the self. The taxonomy already
covers it — *Giving & service* and *Spirituality*, framed inclusively.
Nothing to add; it does imply those units should not be scored like
gym sets, which is the maintenance/growth point again.

### Two things the research says not to build

- **Chronotype-aware scheduling.** The synchrony effect (perform better
  at your circadian peak) is intuitive but the evidence is weak and
  inconsistent — a 2023 *Collabra* study found no robust general
  cognitive boost from time-of-day/chronotype interaction. Not worth a
  feature.
- **Minute-level duration estimates.** The planning fallacy is one of
  the most robust findings in the literature: people systematically
  underestimate task duration, and misremember how long past instances
  took, so the bias does not self-correct with experience. Task
  segmentation improves estimates, but the app deliberately refuses to
  segment tasks (subtasks, parked). A load meter built on user-supplied
  minutes would confidently report "4 hours planned" for a 7-hour day.

  **The cheap fix the app is already shaped for: sizes, not minutes.**
  `activity.size` is already `quick | normal | big`. Reusing that
  vocabulary for task effort is consistent, resists false precision,
  and needs no timer.

## What this suggests building, in order

1. **Weekday pinning** — phase 2 of the existing note, unchanged.
   Cheapest, best-evidenced (implementation intentions + context
   stability for habit formation). Shipping it also fires ADR-0010 §1's
   written revisit trigger for pinned-day reminders.

2. **Part of day, not clock time** *(new — would amend the planning
   note)*. Morning / Afternoon / Evening / Anytime as the checklist's
   shape. Rough scheduling per Tonietto & Malkoc; a shape of a day
   rather than a schedule; groups the checklist into fewer, deeper
   blocks, which is the flow-friendly direction.

3. **The weekly planning pass** — phase 3, and the headline. Not
   "schedule every task" but a Sunday ritual: here are the runs you owe
   this week, place them onto days. This is the Masicampo & Baumeister
   payoff, it is once a week so it cannot violate daily simplicity, and
   it fills a genuine structural gap — **the weekly rhythm is currently
   the thinnest of the three.** Daily has the checklist, monthly has the
   full review ritual, weekly has one contentment question. Planning
   gives the weekly cycle a forward-looking half to match the monthly
   review's backward-looking one.

4. **Task size, and a day-load meter** *(new)*. `quick | normal | big`
   on a task; the planner shows the shape of each day's load. This is
   the challenge–skill instrument flow theory says is missing, and the
   honest version of "how long do I want to spend."

   **Hard constraint: load must never be scored.** It informs the plan;
   it never touches the grade. Any other treatment makes it a new
   credit source and ADR-0023's invariant then demands a ruling on
   which side of the planned/unplanned line it falls.

5. **Month calendar** — phase 4, unchanged.

Deliberately not: clock times as the default, timers or time-tracking,
external calendar sync, chronotype scheduling, and anything that lets
duration or adherence move the grade.

## The guardrail, restated

`times_per_week` stays the scoring source of truth. Day plans shape
**presentation and defaults** — what the checklist leads with, where
runs sit on the calendar — and never the grade. Doing your three runs
on entirely different days than planned is a perfect week. Any
scheduling feature that starts to move the number re-opens ADR-0004 and
ADR-0023, and should be an ADR before it is a commit.

## Design choices worth revisiting, separately

Raised by the research, not by the scheduling question:

- **The number competes with the activity.** Immediate feedback is a
  flow condition, so a live score helps. But a number that updates on
  every check trains attention onto the score rather than the doing —
  the opposite of autotelic. Worth asking whether the number should be
  quieter during the day and louder at the end of it. (Not a proposal
  to remove it.)
- **Overjustification on the intrinsic units** — see SDT above. The
  escape hatch is built; the question is whether it is ever offered.
- **Maintenance versus growth is latent and unnamed** — see Maslow
  above. Probably the highest-value item in this note, and the one
  most entangled with work already parked.

## References

- Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions
  and goal achievement: a meta-analysis of effects and processes.
  *Advances in Experimental Social Psychology*, 38, 69–119.
- Tonietto, G. N., & Malkoc, S. A. (2016). The calendar mindset:
  scheduling takes the fun out and puts the work in. *Journal of
  Marketing Research*, 53(6), 922–936.
- Masicampo, E. J., & Baumeister, R. F. (2011). Consider it done! Plan
  making can eliminate the cognitive effects of unfulfilled goals.
  *Journal of Personality and Social Psychology*, 101(4), 667–683.
- Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., & Wardle, J.
  (2010). How are habits formed: modelling habit formation in the real
  world. *European Journal of Social Psychology*, 40(6), 998–1009.
- Csikszentmihalyi, M. (1990). *Flow: The Psychology of Optimal
  Experience.*
- Csikszentmihalyi, M., & LeFevre, J. (1989). Optimal experience in
  work and leisure. *Journal of Personality and Social Psychology*,
  56(5), 815–822.
- Deci, E. L., & Ryan, R. M. (2000). The "what" and "why" of goal
  pursuits: human needs and the self-determination of behavior.
  *Psychological Inquiry*, 11(4), 227–268.
- Koltko-Rivera, M. E. (2006). Rediscovering the later version of
  Maslow's hierarchy of needs: self-transcendence and opportunities for
  theory, research, and unification. *Review of General Psychology*,
  10(4), 302–317.
- Buehler, R., Griffin, D., & Ross, M. (1994), and Forsyth, D. K., &
  Burt, C. D. B. (2008) on the planning fallacy and task segmentation.
- Locke, E. A., & Latham, G. P. (2006). New directions in goal-setting
  theory. *Current Directions in Psychological Science*, 15(5),
  265–268.
