# ADR-0041: Priorities are tiers

> **Status:** Accepted\
> **Date:** 2026-10-13\
> **Deciders:** Henry

## Context

The diagnostic asks you to rank all 18 units in order and rate your
satisfaction with each from 1 to 10 (ADR-0022). The ranking sets the
weights (ADR-0028). Satisfaction no longer changes any weight, but it is
plotted on the portfolio graph (ADR-0005) and read by `unitProfile`
when choosing suggestions.

The redesign is aimed at strangers on the App Store, who need to reach
a usable plan in a few minutes ([research-brief.md](../design/research-brief.md),
P18). Ranking 18 things and rating 18 more takes several minutes before
anything useful happens. Henry, 2026-10-12: "We need to reconsider the
18 unit diagnostic. I honestly believe that the rating part is not
needed and we can just have the ranking."

In the design review he chose:

- to drop the portfolio graph, since it needs satisfaction for its
  x-axis
- to sort units into tiers and fine-tune the order inside each, rather
  than rank 1 to 18
- that "Not now should have 0 weight. A unit that is in not now should
  have no tasks or points."
- to offer a look at the tiers in the first weekly pass of each month

ADR-0028 §2 kept a 2:1 spread between the top and bottom units so
priority would still show in the numbers, without any unit becoming too
small to hold a worthwhile task. Tiers are coarser than a ranking, so
the spread can be wider.

## Open questions

1. How are the 18 units placed?
2. How do tiers become weights?
3. What does Not now mean?
4. What happens to satisfaction and the graph?
5. When does the app suggest revisiting priorities?

## Options considered

- **Keep the full ranking and make it quicker to use.** Most precise,
  but it is still 18 decisions before any value.
- **Pick your top 5 and share the rest equally.** Fast, but it says
  nothing about the bottom of the list.
- **Four tiers, with order inside a tier as a fine adjustment** (chosen
  in the design review). About 30 seconds, with every unit placed.

## Decision

### 1. Four tiers

Top, Important, Background and Not now. You drag units between tiers
and within them. With VoiceOver, the context menu has Move to tier and
Move up/down. Onboarding starts from a suggested sort.

### 2. Weights come from tier, then order

Each tier has a base value. The first unit in a tier gets ×1.1 and the
last ×0.9, spread evenly in between, and a lone unit gets ×1.0. The
results are scaled to add up to 100 across the units in the plan.

| Tier | Base | Share per unit, with 4 / 6 / 5 / 3 units |
|---|---|---|
| Top | 1.6 | about 10.4% |
| Important | 1.0 | about 6.5% |
| Background | 0.6 | about 3.9% |
| Not now | 0 | 0 |

The table shows tier averages. Individual units vary by the ×1.1 to
×0.9 adjustment, so the last Background unit in that example gets
about 3.5%.

This replaces the `WEIGHT_SPREAD` flattening in ADR-0028 §2, and the
spread is wider than its 2:1: about 3:1 in the example. With most units
in Top, a Background unit can fall to about 2.3% (12 Top, 3 Important,
3 Background). ADR-0028 kept a narrow spread so that no unit was too
small to hold a worthwhile task. Henry decided against a floor
(2026-10-13): the tiers decide, and a unit you put in Background has
tasks worth a little less.

Weights are still overridable, and an override always shows the
recommended value beside it (AGENTS.md).

This is the next formula version, together with ADR-0044. ADR-0032 §4's
2026-10-01 amendment names a version 11 that the code doesn't have yet
(`FORMULA_VERSION` is 10). Whichever change ships first takes 11.

### 3. Not now is out of the plan

Not now is the existing "Not in my plan" switch
(`include_in_scoring = false`, which survived ADR-0028 §3's withdrawal
of ADR-0027 §2) shown as a tier. A unit there has no
weight, no tasks and earns no points.

- Moving a unit that has tasks into Not now asks first. Its tasks are
  paused (archived with a marker) and their pins are removed. Moving it
  back restores the tasks without the pins.
- A Not now unit can't take new tasks. The unit picker greys it out,
  and title suggestions, the idea library and onboarding skip it.
- If every unit is in Not now, Priorities won't save: "Keep at least
  one unit in your plan."

### 4. Satisfaction is no longer asked

The diagnostic no longer has satisfaction steps. Ratings already given
stay in their snapshots, read-only (ADR-0022 §3). `unitProfile` uses
tier where it used satisfaction. The weekly contentment question
(ADR-0008) is now the app's only check on whether the plan is working.

### 5. The portfolio graph is removed

Life shows each unit's share of everything you completed in the last 4
weeks instead. It's a bar with no target, because weights live on the
Priorities screen.

A snapshot is saved once, when you tap Done on Priorities, not on each
drag. Moving units into or out of Not now is part of that save. Saving
keeps your weight overrides. Afterwards a short review lists any
override whose recommended value changed, so you can keep or reset
each one. The old rule reset overrides with every diagnostic
(ADR-0002 decision 4), and a full diagnostic was the only way to save
a snapshot (ADR-0005 §1).

### 6. Revisiting

The monthly diagnostic prompt (ADR-0005 §1) becomes an optional step in
the first weekly pass of each month: "Still happy with your tiers?"
Priorities is also always available from Life.

## Consequences

- **Easier.** Setting priorities takes about 30 seconds. The app has one
  fewer concept to explain.
- **Harder.** Losing satisfaction and the graph removes the app's only
  visual of where life stands against where you want it. The contentment
  question has to carry that role alone.
  `recommendedTaskRange` (ADR-0028 §2) needs its thresholds rescaled to
  the new spread.
- **Revisit** the tier bases after a month of use, and add a floor if
  small units turn out to hold tasks that aren't worth doing.

**Amends, on acceptance:**

| ADR | What changes |
|---|---|
| ADR-0005 | §1 the monthly prompt moves into the weekly pass, and a snapshot can come from a Priorities save rather than only a full diagnostic. §§3–4 the graph is removed; effort is shown as shares on Life |
| ADR-0002 | Decision 4: saving priorities keeps overrides and reviews them, rather than resetting them |
| ADR-0022 | §1 satisfaction is no longer asked. §4 the rating screens go |
| ADR-0028 | §2 tiers replace `WEIGHT_SPREAD`. §3's `include_in_scoring` becomes the Not now tier |
| ADR-0011 | The diagnostic step becomes the tiers step (see ADR-0045) |

## Action items

1. [ ] `deriveWeights` from tiers, with tests: weights add to 100,
       Not now gives 0, a lone unit, and all units in one tier
       (EC-39, EC-40).
2. [ ] Schema: `life_unit.tier` and the tier on snapshots.
3. [ ] The Priorities screen. Remove the satisfaction steps and the
       portfolio graph. Add the effort bars on Life.
4. [ ] `unitProfile` and `recommendedTaskRange` use tiers.
5. [ ] Amend ADR-0002, 0005, 0022 and 0028. Update vision.md (core
       loop, diagnostic, graph) and AGENTS.md (Diagnostic, Portfolio
       graph, Weight, and the weight-derivation invariant).
