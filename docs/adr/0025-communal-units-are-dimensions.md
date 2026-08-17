# ADR-0025: Communal units are dimensions, not containers

> **Status:** Accepted\
> **Date:** 2026-08-16\
> **Deciders:** Henry

> **Drafting history.** Four passes in one afternoon, each smaller or
> truer than the last. It began as a three-valued motivation kind with
> a *planning ceiling* and hidden point values; Henry dismantled the
> ceiling (§6), rejected hidden points (§10), removed communal units
> from scoring entirely, and then replaced that with the structural
> move this ADR is now named for (§2) — relationships are a **property
> of activities**, not a category of them. Rejected arguments are kept
> in place: knowing why the ceiling failed is what stops someone
> rebuilding it.

> **What Henry decided (2026-08-16), and what is drafted around it.**
> Communal units become **tag-only dimensions** that keep their
> diagnostic weight, earned by **one tag anywhere in the day** (§2, §3);
> tagging is **per-completion via press-and-hold**, never a prompt (§4);
> **never named people** (§4); note-membership is a **general**
> capability (§5); **no unit plans differently** and **no clock times**
> (§6, §7); the social signal surfaces on the **portfolio graph only**
> (§9); points display normally and are never capped (§10); goals are
> unrestricted and gain rough deadlines (§11); fill-first is **deferred**
> (§12); autotelic is **editorial only** (§13). Unit assignments in §1
> are his. §14's recommendation was **taken** — `task.motivation_kind`
> is dropped. Everything else was drafted around those calls and
> **accepted with them on 2026-08-16**.

## Context

[ADR-0024](0024-day-planning-is-intention.md) applies one planning rule
to all 18 units. This ADR asks whether that uniformity is right. For
planning it is. For **structure** it is not — three of the units are
not the same kind of object as the other fifteen.

The research is in
[scheduling-and-motivation.md](../design/scheduling-and-motivation.md).
Three findings were weighed; one survived, and even it turned out to be
answerable structurally rather than by withholding points.

- **Rewards displace reasons** (Deci, Koestner & Ryan 1999, 128
  studies), **d = −0.36** for completion-contingent rewards.
  *Weakened here — see §10.*
- **Measurement alone does it** (Etkin 2016) — but two-sided:
  measurement also increases how much of the activity people do.
  *Weakened — see §6, §10.*
- **Ledgers are exchange-relationship artifacts** (Clark & Mills).
  Communal relationships run on concern for the other's welfare;
  exchange relationships track **your own inputs**, and rising exchange
  orientation predicts *decreases* in relationship satisfaction. **This
  one holds** — and §2 answers it by changing what is being recorded,
  not by refusing to record.

**The observation this ADR turns on, from Henry:** communal units get
tagged onto a great many other tasks and activities. For the users this
app targets, most of what they do — studying included — happens with
other people. Friendship is not a thing you do *instead of* studying;
it is a property of the studying.

## Decision

### 1. Units carry a motivation kind, and it has two values

`life_unit.motivation_kind`: **`instrumental` | `communal`**.

| Kind | Units |
|---|---|
| **communal** | Significant other · Family · Friendship |
| **instrumental** | the other 15 |

**Giving & service is instrumental.** Clark & Mills concerns **dyadic
close relationships**. Service to strangers does not carry the same
risk — counting contributions to a friendship changes the friendship;
counting volunteering hours changes very little — and it is a unit
where a standing shift is a legitimate task. The communal set is now
exactly the Relationships area's three units, a cleaner boundary than
the one it replaces.

Settled the same day: **Spirituality** (autotelic in motive; §13
removed the mechanical consequence), **Nature** (instrumental, taking
vision.md's "Wellness is the maintenance area" at its word), **Mental &
emotional health** and **Learning & growth** (both instrumental).

### 2. Communal units are dimensions, not containers

A communal unit **cannot be a task's home unit and holds no tasks of
its own.** Instead, any task or activity may **tag** it — recording
that the thing you did involved that relationship.

This is what dissolves the Clark & Mills problem, rather than dodging
it. Tagging Friendship on "studied with Sarah" does not record *what
you contributed to a friendship*; it records **who you were with**.
The exchange-orientation risk is specifically about counting your own
inputs to the relationship. This counts none. It is texture, not a
ledger.

Two things follow that no previous draft could reach:

- **The portfolio graph becomes honest on these units.** Bubble size —
  the axis vision.md claims is *measured* rather than estimated —
  becomes *how much of your life had these people in it*. That is a
  far truer account of invested effort than "did I tick call-a-friend."
- **The grade stops being blind to relationships without scoring them
  directly.** A social week that involved doing things scores normally,
  because the doing scored. Nothing has to be done *for* the
  relationship to count.

### 3. They keep their weight, and one tag earns the day

Communal units keep the weight the diagnostic gives them. They are
**exempt from `spendableWeights`' uncovered-weight reallocation**
(ADR-0003 §5 as amended 2026-07-30), which would otherwise hand their
weight to units that hold tasks — leaving nothing for a tag to earn.
A communal unit contributes its full daily share to `possible` every
day.

**A single tag anywhere in the day earns that unit's share in full.**

Not proportional, and deliberately so. Relationships are not
dose-dependent the way training is: one real contact is qualitatively
different from none, and the tenth is not much different from the
second. The alternative — filling the share across two or three tags —
still scores a day with one friend as incomplete, which is the
harshness this rule exists to avoid.

**Why this shape and not the others.** Weight that could *only* be
earned by being with people, filled proportionally, would cap a solo
day structurally — three units at ~20 points means every unsocial day
tops out near 80, permanently, for someone living alone or in a rough
patch. That is the shame surface AGENTS.md forbids, arriving through
arithmetic rather than copy. Keeping the weight full and the bar low
means the number still says relationships matter, and never says you
are failing at them.

Gameable in principle — one tag is cheap. That hardly matters in an app
where every input is already self-reported, and the failure mode of
over-tagging is much less bad than the failure mode of under-counting.

### 4. Tagging: per-completion, by long-press, and never a person

- **Tags are added per completion**, not fixed to the task. "Study" is
  sometimes with friends and sometimes alone, and a persistent
  task-level tag would over-report.
- **The gesture is press-and-hold on the completion.** No prompt fires
  after a tick — that would put a second decision on the daily surface
  and cost the under-a-minute promise (design principle 2). Long-press
  is already this app's established gesture for secondary actions
  (journal edit and delete in the day record), so it is vocabulary the
  user already has.
- **Activities keep their existing per-instance tagging** (ADR-0009),
  which needs no change: logging an activity is already a deliberate
  act, so a tag there costs nothing extra.

> **Never named people. This is an explicit non-goal, not an
> unbuilt feature.** Tagging a *unit* records a fact about the user.
> Tagging a *person* creates records about third parties who never
> consented to being in the database — and the app's privacy story is
> one sentence precisely because everything in it is self-reported
> about the self. A person graph turns that sentence into paragraphs,
> for data that is not the user's to hold. Do not add one as a
> convenience; reopen this ADR.

### 5. Note-membership is a general capability

`task_unit` gains a **membership mode**: `scoring` (the existing
ADR-0019 behaviour — takes a rank slot, earns that unit's share) or
`note` (no rank, no points, feeds effort and the log).

Any unit may be noted, not only communal ones. Plenty of things touch a
unit they should not earn from, and forcing every mention through a
scoring slot is what made the model feel wrong here in the first place.

This does cost ADR-0019 its clean "one row per unit served" invariant,
which gains a mode flag. Accepted deliberately: the alternative is a
second table meaning almost the same thing.

### 6. No unit plans differently. ADR-0024 applies uniformly.

An earlier draft gave "autotelic" units a planning ceiling — cadence
only, no dates, no pins, no part of day. **Rejected.** Henry's
argument:

> A weekly band practice or a Tuesday night movie tradition all seem
> fine to me, along with a Sunday hike or round of golf. The thing with
> a lot of autotelic tasks is that if you don't make time for them it's
> very easy to never do them.

That is the **mere urgency effect** (Zhu, Yang & Hsee 2018): people
choose the urgent over the important even when told the important is
worth more. Enjoyable things are never urgent, so they lose every
prioritisation contest. Making time for them is the fix — and the
premise of the product.

Tonietto & Malkoc do not contradict this. Their comparison was
**scheduled versus impromptu**, and the mechanism is scheduling
*displacing* spontaneity. Band practice with four other people cannot
happen impromptu; a tee time is a booking. The counterfactual is not
"do it spontaneously" but **"never do it."**

> **The rule that replaces the ceiling:** scheduling costs something
> when it *displaces* spontaneity and buys something when it *enables*
> the activity. The app cannot tell which case it is in; the user can.
> So the app never *pushes* structure onto anything — no prompt, no
> empty "when?" field — and never *withholds* it either.

### 7. ADR-0024 §1 reaffirmed: no clock times, anywhere

Challenged and held. The argument that carried is functional: **a clock
time would drive nothing this app does.** No per-task reminders
(ADR-0010 keeps one generic nudge), no time-slot calendar. The only
thing a time could affect is ordering, which part-of-day already
provides.

### 8. Effort stops being derived from points

[`trailingEffort()`](../../apps/mobile/src/db/diagnostic.ts) computes
bubble size by summing `task_completion.points_earned` and
`activity_tag.points_credited`. Under §2 a communal unit's tags carry
no per-tag points, so this returns near-zero and all three units would
render at minimum bubble size — small, high, and left, the quadrant
vision.md defines as *"important, unsatisfying, neglected"* — no matter
how much of the user's life actually involves those people.

**Decision: effort counts tagged days** — distinct local dates on which
the unit was tagged, from a task completion or an activity — for any
unit whose involvement is note-shaped. Scored units keep the
points-based derivation. A tagged day is priced at **the unit's own
weight**, which is what puts the two paths on one scale: a scored unit
accrues roughly its weight on a day it is fully done.

> **Amended 2026-08-16, during implementation.** This section first
> said "logged occurrences … weighted by `activity.size`". Building it
> surfaced the conflict: **§3 decides that one tag anywhere in the day
> earns the unit's full share**, so counting occurrences here would
> make the bubble and the grade tell different stories about the same
> behaviour — five things logged with family on one day reading as five
> days of investment on the chart and one on the score. Days is what §3
> settled on, so days is what §8 measures.
>
> The rule keys on **whether the unit earned points**, not on its
> motivation kind, so nothing here changes when §3 lands: communal
> units simply move onto the points path, with no seam.
>
> Shipped in `packages/scoring/src/effort.ts`, with tests.

This also fixes the same latent hole for any *excluded* unit —
ADR-0003 §2's own worked example ("Online entertainment") has it too.

### 9. The social signal lives on the graph, and nowhere else

Bubble size carries it: a small bubble high on the priority axis is the
finding, rendered rather than stated. **No copy anywhere observes how
social the user has been** — not in the monthly review, not on the
daily surface.

A written observation ("you rated Friendship 9, and 6% of what you
logged involved friends") was considered and rejected. It would have to
read identically well on a month where the answer is 40% and a month
where it is 2%, and it cannot: on the bad month it is the app noticing
your loneliness and mentioning it. That is exactly what ADR-0008's
ambient-kindness rule forbids — celebration may condition on positive
events; nothing may condition on a shortfall. The graph shows the same
truth without addressing the user about it.

### 10. Where points exist, they display normally

No quiet scoring, and no capping of what a unit's tasks may be worth.

Hiding point values was proposed on Deci's boundary condition that
feedback is safe where a visible earned token is not. **Rejected**, on
Henry's argument:

> At the end of the day the reward is a few arbitrary points on this
> app that isn't even shared with others.

Well-founded: the undermining effect scales with how salient, tangible,
and expected a reward is, and these are none of those — private,
non-redeemable, non-transferable, on a scale the user derived
themselves. **The app's existing invariants are the mitigation.** "No
leaderboards, no score comparisons, private by default" was written for
privacy and defuses overjustification as a side effect.

Capping was rejected separately: it would override the user's own
diagnostic and push freed points toward chores.

### 11. Goals are unrestricted, and gain rough deadlines and milestones

ADR-0007 applies uniformly; any unit may carry any goal shape,
including a target with a number in it. An earlier draft proposed
steering intrinsic units toward cadence-shaped goals. **Rejected** —
Etkin measured *continuous output display*, not a target with a horizon
checked occasionally, and PRODUCT.md's tie-breaker settles it: *"When
real use and hypothetical users conflict, real use wins."*

Goals gain **rough deadlines** and **planned or retroactively-tracked
milestones**, which Locke & Latham support directly (specific,
challenging, *time-bounded* goals beat "do your best") and which is
rough scheduling in ADR-0024's sense.

**This is ADR-0015's trigger firing.** Deferred there, with one
question flagged rather than assumed: *"read 24 books this year"* as a
goal is not the Etkin setup, but *"18/24"* rendered on the daily
checklist would be.

### 12. Fill-first is deferred, not decided

Restoring fill-first activity credit was briefly decided earlier the
same day, justified by communal units needing to earn against their own
weight. **§3 supplies that differently**, so the justification is gone.
Fill-first retains an independent case for instrumental units — golf
standing in for a skipped workout — but that does not by itself justify
a fourth `FORMULA_VERSION` in a fortnight.

**Deferred to the parked "daily number is too generous" retune**
([backburner.md](../backburner.md)). vision.md's activity-credit
paragraph is **known-stale until then** and must not be read as
describing shipped behaviour.

### 13. The app explains its thinking — and that is all "autotelic" is

The reasoning about these units should be visible in the app, not only
in this repository. Home: the **unit info sheet**
(`UnitInfoSheet.tsx`), which already carries each unit's description
and guidelines and is reachable wherever a unit is rated — satisfying
ADR-0008's "discoverable always, pushed never."

Two notes, in the copy guide's register — direct, brief, never
prescriptive:

- **The three communal units:** why they are tagged rather than listed.
  The honest one-liner is that keeping score of what you put *into* a
  relationship is what exchange relationships do, so the app records
  who you were with instead.
- **The former autotelic units** — Spirituality, Hobbies & projects,
  Art & media, Adventure & experiences: that these are worth making
  time for *and* worth not letting become a chore. Both halves; the
  tension is the content.

> **"Autotelic" is editorial, not mechanical.** It determines guidance
> copy and nothing else — no planning rule, no point value, no stored
> value. Deliberately the same shape as
> [ADR-0021](0021-areas-are-presentational.md)'s treatment of areas,
> and it therefore needs **no schema**. Do not give it teeth again
> without reopening this ADR; the last time it had them it did not
> survive a day of argument.

### 14. `task.motivation_kind` is dropped

Henry decided earlier the same day that the motivation kind should be
unit-level with a **task-level override**. Every case that justified
the override then dissolved: the volunteering shift, by moving Giving &
service to instrumental (§1); "walk with Dad," by §5's note-membership
and ADR-0019 (§2). And under §2 a communal unit cannot be a task's home
unit at all, so there is no inherited value left for a task to
override.

**Decided 2026-08-16: drop it. The attribute is unit-level only.** The
column was never built — it existed only as a proposal in this ADR's
drafts — so nothing is migrated away and no data is lost. Recorded here
rather than silently deleted because it reverses an earlier call, and
the reason it reversed (three separate decisions each removing one of
its uses) is worth being able to find later.

## Schema

- **`life_unit.motivation_kind`** — text, not null, default
  `'instrumental'`; enum `instrumental | communal`. Backfilled from §1
  by the launch-time taxonomy sync. It exists so a future reader sees
  *why* three units behave differently.
- **`task_unit.membership`** — text, not null, default `'scoring'`;
  enum `scoring | note` (§5).
- **`task_completion_tag`** — completion_id, unit_id (§4). Per-
  completion tags need somewhere to live; `task_completion` has no
  unit column today.

There is deliberately **no `task.motivation_kind`** — see §14.

No new denormalized credit column. §3's earned share is baked into
`day_grade.points_earned` at cache time like everything else, so
ADR-0002's "history never restates" holds without a fourth table.

## Implementation note: this splits cleanly in two

**The structural half ships now, without a formula change.** Note-
membership (§5), per-completion tagging and the long-press gesture
(§4), occurrence-based effort and the honest bubbles (§8), the graph
signal (§9), the guidance copy (§13). Until §3 lands, communal units
are simply uncovered and their weight reallocates exactly as it does
today — no regression, no seam.

**The scoring half joins the retune batch.** §3's reallocation
exemption and the one-tag rule need an ADR-0003 §5 amendment and a
`FORMULA_VERSION` bump. It is now the **second** change queued behind
that batch alongside §12's fill-first, and the batch should carry all
of it in one version rather than three.

## Consequences

**Easier.** Relationships are modelled the way the target user actually
lives, and the Clark & Mills problem is answered by changing what is
recorded rather than by refusing to record. The portfolio graph becomes
honest on these units for the first time. Planning stays uniform, so
ADR-0024 needs no exceptions. §5 and §8 both fix latent problems that
predate this ADR.

**Harder.** Three units become a different *kind* of object — units of
diagnosis and dimension rather than diagnosis and scoring, which
AGENTS.md's vocabulary entry will need to reflect. ADR-0019 loses a
clean invariant to a mode flag. §8's effort calibration is fiddly and
needs a test. §13's copy must convey a real tension without becoming an
instruction about how to live.

**Accepted costs.** §3 is gameable by design. §5 opens note-membership
generally, so someone will eventually note a unit into meaninglessness.
And once one unit is a dimension, others will be proposed — §5's
generality makes that cheap to grant and correspondingly easy to
overdo.

**Revisit when:** real use shows one tag is too low a bar to mean
anything; `instrumental` proves wrong for Mental & emotional health or
Learning & growth; anyone proposes named people (§4) or gives
"autotelic" teeth again (§13).

## Action items

1. [x] Migration: `life_unit.motivation_kind`, `task_unit.membership`,
       `task_completion_tag`; backfill §1 via the taxonomy sync.
       (Shipped: migration `0009`, and `db/seed.ts` syncs
       `motivation_kind` seed-authoritatively like name and area.)
2. [x] Block communal units as task home units; allow them as tags
       everywhere (§2). (Shipped: `plan.tsx`'s `allUnits` filters them
       out of every task-unit picker.)
3. [x] Long-press tagging on completions (§4) — no prompt, ever.
       (Shipped: `components/today/CompletionTagSheet.tsx`, reached by
       `onLongPress` on a *completed* row, plus a `magicTap`
       accessibility action since a long-press is invisible to a
       screen reader. `setCompletionTags` deliberately does not call
       `cacheDayScore` — the scoring half is §3's, and it is batched.)
4. [x] Rework `trailingEffort()` per §8, with a test for magnitude
       comparability against the points-based path. (Shipped:
       `packages/scoring/src/effort.ts` + 10 tests; §8 amended from
       occurrences to days, see the note there.)
5. [x] ADR-0006 library: stop proposing tasks for communal units.
       (Shipped structurally: `scripts/content/build.mjs` fails the
       build if `library.md` puts a task under one, so it cannot be
       forgotten.)
6. [ ] Write the two §13 notes into
       [copy-guide.md](../design/copy-guide.md); surface in
       `UnitInfoSheet`.
7. [ ] **Retune batch:** §3's reallocation exemption + one-tag rule,
       §12's fill-first, and the parked daily-denominator retune — one
       `FORMULA_VERSION`, with an ADR-0003 §5 amendment.
8. [ ] Open ADR-0015 — its trigger fired in §11.
9. [x] Add a line to ADR-0024 recording that §1 was challenged on
       2026-08-16 and reaffirmed (§7 here).
10. [x] Update AGENTS.md's SLU vocabulary entry: three units are
       diagnosed and dimensioned, not scored directly.
11. [x] Rule on §14 — dropped 2026-08-16; the attribute is unit-level
       only and the column was never built.
