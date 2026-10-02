# ADR-0028: Priority is the only input

> **Status:** Accepted\
> **Date:** 2026-08-26\
> **Deciders:** Henry

> **What Henry decided (2026-08-26), and what is drafted around it.**
> Four calls are his and are recorded as made: completing every daily
> task should pay **80 whatever the plan's coverage**; how many tasks a
> unit holds should not change what doing them is worth; the difference
> in weight between units should be **very small**, so that the bottom
> of the portfolio is not decorative; and **priority ranking should be
> the only thing that affects scoring**, with satisfaction demoted to a
> metric that tracks whether the work is landing. The flattening
> constant (2:1) is his, chosen from a table. Everything else below —
> the arithmetic, the fate of ADR-0008's lever, the task-guidance
> rescale, and the action items — was drafted around those calls.

## Context

**The report (2026-08-26, from a week of real use):** every daily task
completed, and the day read **64**.

**The mechanism, exactly.** ADR-0027 §1 pays the routine band per unit
at `0.8 × w`, and §2 forfeits the share of any unit holding no daily
task — "nobody else receives it." At roughly 80 points of coverage that
is `0.8 × 80 = 64`, with the remaining 16 unearnable by anything on the
list. The user did not fall 16 points short of their plan; they
completed their plan, and 16 points of their denominator had nothing in
it to complete.

ADR-0027 §2 named this outcome and accepted it in advance: *"a plan is
not scored on how well you did the plan; it is scored on how much of
your own stated life the plan reaches. That is the whole point of §2,
and it is the sentence to disagree with if this ADR is wrong."* This
ADR disagrees with that sentence.

**Why the escape hatch did not save it.** §2's answer to a hard ceiling
was exclusion: set aside the units you hold no tasks in and the weights
re-derive across what remains. In practice that asks someone to
formally declare that a part of their life does not apply to them in
order to get a fair reading of a day they worked. The valve is for
*"this does not apply to me."* Using it for *"I have not got to this
yet"* makes the portfolio a worse record of the person's life in
exchange for a better-looking number, which is precisely backwards.

**A second finding, from the same week.** The bottom of an 18-unit
portfolio is worth almost nothing. `rankToScore` maps rank onto 10…1
and weight is proportional to it, so the tail comes out at one, two and
three points. Every one of those eighteen units is one the user said
belongs in their life — the ones that do not are excluded outright,
which is a different statement with its own control. The ranking was
supposed to say *these matter less*; the arithmetic said *these do not
matter*.

**And a third, older one.** ADR-0003 §1's gap term
(`raw = I + g × max(0, I − S)`) makes weight a function of two answers
given in the same sitting about the same unit, where the second is the
app's own outcome measure. A unit you are neglecting gets more of your
day *because* you are neglecting it; doing the work raises satisfaction;
raising satisfaction quietly takes the points away again. ADR-0008 needs
satisfaction to be an independent read on whether the plan is working,
and it cannot be that and an input to the plan at the same time.

Constraints already in force:

- **The app never shames** (ADR-0008). No mechanic may condition on a
  shortfall.
- **Planned work is what pays** (ADR-0023). Unplanned work is capped;
  the only uncapped route above 100 is doing more of your own plan.
- **Active SLU weights sum to exactly 100** (AGENTS.md).
- **History never silently restates** (ADR-0002).
- **Grades measure consistency, not achievement** (AGENTS.md).

## Open questions

1. Does satisfaction belong in the weight formula at all?
2. How far apart should the most and least important units be?
3. What happens to a band when some units hold no work of its kind?
4. What does ADR-0008's calibration adjust, once its lever is gone?
5. Does any of this reach back into days already graded?

## Options considered

### The 64

- **Keep the forfeit and lean on exclusion.** ADR-0027 §2's own answer.
  Rejected: it prices an honest portfolio above a flattering one, and
  the two are one tap apart with no way to tell them apart afterwards.
- **Forfeit a fraction rather than the whole share.** Softer, and it
  keeps some pressure toward wide plans. Rejected: it needs a constant
  nothing justifies, and it still charges the user for work they never
  said they would do.
- **Spend each band in full across the units that hold its work.**
  Chosen. See §3.

### The spread

- **Leave it at 10:1.** Today's behaviour, implicit rather than chosen.
- **Flatten to a named ratio.** Chosen — one constant, one dial, and
  10 reproduces the old shape exactly if this proves wrong.
- **Perfectly equal.** Considered and rejected by Henry: priority
  should still be visible in the number, just not brutal.

## Decision

### 1. Satisfaction leaves the weight formula

ADR-0003 §1's gap term is **withdrawn**. The derivation is:

    raw(u)    = flatten(importance)          — see §2
    weight(u) = 100 × raw(u) / Σ raw

`GAP_COEFFICIENT` is retired, along with its per-user override.

**Satisfaction is not retired — it is repositioned.** It is still asked
for in the diagnostic, still stored on every `rating` row, still the
x-axis of the portfolio graph, and still the thing that decides whether
a unit is *gap-closing* or *maintenance* in `unitProfile` (ADR-0006 §1),
which is how the library picks what to suggest. What it no longer does
is move a point.

The distinction the app now draws, and should say in these words:
**priority decides what your day is made of; satisfaction tells you
whether it is working.** Those are different questions and they were
being answered by the same arithmetic.

A consequence worth stating plainly: **the same priority order now
always produces the same weights.** Weight derivation becomes a pure
function of one ordering, which makes a re-rank predictable, makes the
portfolio graph's two axes independent, and gives ADR-0008 an outcome
measure that is not downstream of its own input.

### 2. The spread is flattened to `WEIGHT_SPREAD`, and it is 2

Rank scores are mapped onto a narrow band before normalizing:

    raw(u) = 1 + (WEIGHT_SPREAD − 1) × (importance − 1) / 9

The map is affine and strictly increasing, so the diagnostic's order
survives exactly; only the distance between neighbours changes. At
`WEIGHT_SPREAD = 2` and 18 units the portfolio runs **7 points at the
top to 4 at the bottom**, against 10 to 1 before.

`rankToScore` is deliberately **not** changed. It still maps rank onto
10…1, because that is the number stored on `rating.importance` and
plotted on the portfolio graph's y-axis, and squashing it would restate
what every past snapshot claimed. The flattening lives inside
`deriveWeights`, where it is a statement about *budget* rather than
about *importance*.

**Why 2 rather than 1.** Henry, choosing from a table: the ranking
should still be visible in the number. A perfectly flat portfolio would
make priority affect only ordering and suggestions, and the diagnostic
is the app's central ritual — it should decide something.

**What this costs.** Priority is a weaker lever than it was: moving a
unit from 18th to 1st is now worth about three points of budget rather
than nine. If the diagnostic starts to feel inconsequential, this
constant is the thing to move, and moving it is a one-line change with
a formula-version bump.

**Task-count guidance is rescaled with it.** `recommendedTaskRange`'s
thresholds are absolute point counts calibrated to the old spread; left
alone they would have called the entire bottom third of every portfolio
*light* — one task, weekly-cadence suggestions only — which is the exact
opposite of what flattening is for. The four bands move onto the new
scale (7 / 4 / 2) so they pick out the same *parts of a portfolio* they
always did. This amends ADR-0003 §6's table; the rule is unchanged.

### 3. Each band is spent in full by the units that hold its work

> **Superseded the same afternoon by
> [ADR-0029](0029-a-day-is-the-fraction-you-got-through.md) §§1–2.**
> This section's conclusion holds — plan completion is what is scored,
> coverage is advice — but it reached it inside ADR-0027's
> routine/variable split, which ADR-0029 replaces outright. There is no
> routine band to redistribute any more: a day's denominator is the
> work actually due that day, and the planned band pays the fraction of
> it that got done. **What survives verbatim** is the sentence about
> task count — a unit's weight divides across its tasks by rank, so one
> task carrying 30 and three carrying 10 come to the same thing — and
> `unitCoverage`, which still measures coverage and still caps
> nothing. §§1–2 of this ADR are untouched.

**ADR-0027 §2 is withdrawn.** Both bands now take the same two steps:

1. Split the band between the units holding at least one task of that
   kind, in proportion to weight (largest remainder, so it totals
   exactly).
2. Divide each unit's budget across its own tasks by rank, with
   ADR-0003 §5's one-point floor applied inside it.

The routine band's per-unit `0.8 × w` — and the forfeit that came with
it — is gone. **Completing every daily task pays exactly 80, at any
coverage.** Completing every non-daily task in a week earns the variable
band exactly once, unchanged.

**Task count within a unit does not change what a unit is worth**
(Henry: *"I don't think it should matter how many tasks someone has per
unit"*). One daily task in a unit and five daily tasks in a unit price
the same total; rank orders them inside it. That was already true before
this ADR and is now true of the plan as a whole, because a unit's budget
no longer depends on which *other* units happen to be covered either.

**What survives from ADR-0027 §2, and it is the load-bearing half:**
the routine band pays **only daily tasks**. No amount of redistribution
buys 80 for a plan of weekly work — two weekly tasks still top out at
the variable band's 20. Scope is negotiable; habit is not. §1 of
ADR-0027 is otherwise untouched: two bands, allocated separately, a
constant denominator of 100, and no completion paying more than its
band holds.

**Coverage becomes advice.** It was arithmetic; it is now a bar on the
Tasks screen showing covered weight against total weight, and nothing
else. `dayCeiling` is replaced by `unitCoverage` — the ceiling it
computed is a constant 100 for any plan with a daily task in it, and a
bar drawn against a constant says nothing. The advice was always the
good part: which parts of your life have a daily habit in them is worth
seeing, and is nobody's business to penalise.

**The honest cost.** A plan with one daily task in one unit now scores
80. The app has no way to distinguish a deliberately narrow plan from a
neglected one, and it will not try — that is what the coverage bar is
for, and what the monthly diagnostic is for. ADR-0027 was right that
this is a real loss; it was wrong about which loss is worse. A number
that under-reports a day someone actually worked destroys the number's
meaning faster than one that over-reports a thin plan, because the
first one is wrong about something the user can see for themselves.

### 4. Calibration loses its lever and does not get a new one yet

ADR-0008's one automatic suggestion moved `GAP_COEFFICIENT` up or down
when grades ran persistently higher or lower than the weeks felt. §1
removed that constant, so the suggestion has nothing left to pull.

**The measurement stays; the automation stops.** The cold-start gate,
the mean divergence, and the rank agreement are all still computed and
still shown on the calibration screen. What the app cannot currently do
is offer to act on them. Nothing generates suggestions; a leftover
pending row from before is described honestly and offered only a
*Dismiss*, because an *Accept* that silently applies nothing would be
the app claiming it did something it did not.

**The obvious candidate lever is the 80/20 band split itself** — if
grades run low against felt contentment, the routine is under-paid. That
is a formula change with an ADR's worth of consequences, not a slider,
so this ADR leaves it open rather than repointing the automation at it.
`WEIGHT_SPREAD` is deliberately *not* the replacement: flattening barely
moves a grade, so tying divergence to it would be automation for its own
sake.

This narrows ADR-0008 rather than contradicting it. Its invariants —
kindness is ambient, suggestions apply only on an explicit yes,
dismissed suggestions never return — are untouched and now partly
vacuous.

### 5. Formula version 8, and history is left alone

`FORMULA_VERSION` moves to 8. Days already graded **keep the numbers
they were given**; `day_grade.formula_version` records which era each
belongs to. Grades from formula 7 and formula 8 are not comparable, and
there is no way to make them so. That is the same deliberate loss
ADR-0027 §5 accepted, eight days later — see *Consequences*.

## Consequences

**Easier.** Doing your plan reads as doing your plan. The two bands
become one rule instead of two, and the scoring engine loses the
forfeit, the gap term, `GAP_COEFFICIENT`, its override, `dayCeiling`,
and the last remains of `spendableWeights`. Weight derivation becomes a
pure function of the priority order, so a re-rank is predictable and the
portfolio graph's axes are finally independent of each other.

**Harder.** The number no longer says anything about how much of your
life your plan reaches; only the coverage bar does, and a bar is easier
to ignore than a grade. Someone can now score 80 on a plan of one habit.
The app's answer is that this is a planning problem, addressed in the
monthly diagnostic where planning belongs, rather than a scoring
problem addressed silently every day.

**Accepted costs.** Priority is a materially weaker lever (§2). Activity
credit compresses along with the weights — `0.2 × weight` on a flattened
portfolio ranges over 0.8 to 1.4 points rather than 0.2 to 2.4 — so the
sizes mean less against a high-priority unit and more against a low one;
the mean is unchanged. And this is **the third formula in nine days**
(v7 on the 18th, v8 on the 26th), which is more churn than a scoring
system should take: two of those three eras will hold about a week of
grades each, and no window in the calibration experiment spans a single
formula. That is the price of finding both faults in real use rather
than on paper, but it is a real price, and the next change to this
engine should wait for a fortnight of evidence rather than a bad day.

**Revisit when:** a fortnight of real use shows 80 arriving too easily
— specifically, if grades cluster in the 80s while contentment does not
follow, which is exactly what ADR-0008's divergence measures and the one
question it can still answer without a lever. Or if the diagnostic
starts to feel inconsequential, which is §2's constant.

## Action items

1. [x] `packages/scoring`: drop the gap term and `GAP_COEFFICIENT`; add
       `WEIGHT_SPREAD`; flatten in `deriveWeights`; both bands through
       one `allocateBand`; `dayCeiling` → `unitCoverage`; delete
       `spendableWeights`; rescale `recommendedTaskRange`;
       `FORMULA_VERSION` 8.
2. [x] App: drop the gap-coefficient override from `settings.ts`,
       `diagnostic.ts` and `ranking.ts`; stop generating calibration
       suggestions and hide *Accept* on leftover ones; `CoverageBar`
       reads `unitCoverage`.
3. [x] Amend ADR-0003 §§1/5/6, ADR-0008, ADR-0022 and ADR-0027 §2 with
       pointers here; update the ADR index and AGENTS.md's derivation
       invariant.
4. [x] Onboarding's "Why 100 is hard" page now says something that is
       exactly true rather than approximately — *"do every daily habit
       and you land around 80"* — but the surrounding copy was written
       against a ceiling that could be lower. Re-read it against §3.
5. [ ] Decide what calibration adjusts (§4). Trigger: the first time
       divergence exceeds its threshold and there is nothing to offer.
6. [x] The Tasks screen's coverage bar now shows a number that no
       longer caps anything. Check that nothing beside it still reads
       as a ceiling.

> **Checked 2026-10-02.** (4) The "Why 100 is hard" page was rewritten
> with ADR-0029 and now says exactly that: do what the day asks and you
> land on 90; the last 10 is what you did not plan. (6) Nothing the user
> sees beside the coverage bar reads as a ceiling; its number is the
> weight that has something planned in it. Two stale code comments in
> `plan.tsx` still said "ceiling" and were corrected.
