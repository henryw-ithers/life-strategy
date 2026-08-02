# ADR-0021: Strategic Life Areas are presentational

> **Status:** Accepted\
> **Date:** 2026-08-02\
> **Deciders:** Henry

## Context

The taxonomy is `SLA → SLU → Goal → Task`, and areas have always looked
structural: `life_unit.area_id` is a non-null foreign key, the
diagnostic ranked areas as a first pass, and the portfolio graph offers
a six-area rollup.

They are not structural any more, and nobody wrote that down. **Areas
contribute nothing to any stored score today**, and the drift got there
in two separate steps:

- The diagnostic calls
  `buildEntriesFromRanking(areas, {}, areaOrder, finalOrder)` — the
  `unitOrderByArea` argument is literally `{}`. The per-area unit
  ranking passes were removed because a strict area-primary composition
  can put a low unit of a top area above the best unit of a lower one
  anyway (see `buildSequence`'s header comment in
  `apps/mobile/src/app/diagnostic.tsx`). What scores is `finalOrder`:
  **one flat list of units**, per axis. Ranking the areas only seeds the
  order that list opens in.
- [ADR-0005](0005-diagnostic-snapshots-and-history.md)'s 2026-07-30
  amendment removed the Portfolio tab's area-level re-rank mode
  **because it destroyed data**: the flat list deliberately allows
  interleaving across areas, so any area-level move must regroup units
  into contiguous blocks, silently discarding every cross-area decision
  behind it.

That second one is the reason this ADR exists rather than staying a
note. A feature was designed, built, and shipped on the assumption that
areas were a real level of the hierarchy, and it corrupted user data.
The assumption was reasonable, because nothing said otherwise.

## Open questions

1. Are areas removed, or demoted?
2. If demoted, what may an area still determine — and what may it never
   determine?
3. What does the demotion unlock that is currently blocked?

## Options considered

**Remove `life_area` entirely; units become a flat list of 18.**
Honest about where the scoring already stands, and deletes a level of
the model. It fails on colour, and colour is not a detail here:
DESIGN.md's entire secondary palette is six categorical area hues at
matched perceptual weight, AA in both themes, carrying identity on
every surface — checklist circles, task pips, bubbles, the legend, the
NumberDial readout. **Eighteen mutually distinguishable hues that
survive both light and dark and stay AA does not exist.** Removal means
either eighteen colours nobody can tell apart or no colour identity at
all. It also throws away grouping (6 collapsible sections instead of 18
flat rows on Plan, Goals, the diagnostic diff and the weight summary),
the graph's area rollup, and vision.md's "the app always starts from
this structure so nothing important is silently forgotten." A
destructive migration whose only benefit is tidiness.

**Leave it undocumented.** The status quo. Costs nothing today and has
already cost user data once.

**Demote in writing: areas are presentation, never structure.** Keeps
every job areas actually do, and closes the door that the area re-rank
mode came through.

## Decision

### 1. The invariant

> An area may determine **colour, grouping, and the diagnostic's
> opening seed**. It may never determine weight, rank, points, or any
> stored score.

`life_area` stays as a table, and `life_unit.area_id` stays non-null.
"Cosmetic" here means demoted, not deleted — every historical snapshot's
presentation depends on the area a unit belonged to.

### 2. What areas keep doing

- **Colour.** The six-hue palette is an area-keyed system and remains
  the app's only carrier of categorical identity (DESIGN.md).
- **Grouping.** Plan, Goals, the diagnostic diff, and the weight summary
  render areas as sections.
- **The diagnostic's cold-start seed.** Ranking the six areas orders the
  unit list the user then drags. See §4 — this is temporary.
- **The six-area rollup** on the portfolio graph (ADR-0005 §5),
  computed on demand and never stored (ADR-0002 decision 6).
- **Taxonomy completeness.** Six areas is what makes eighteen units feel
  surveyed rather than arbitrary.

### 3. `life_unit.area_id` becomes a soft attribute

Because no score depends on it, a unit may be re-homed to a different
area, a custom unit may be filed anywhere, and areas may be renamed or
reordered — all with **zero scoring consequence**, and without touching
history. vision.md already promises this ("the taxonomy is the default,
not a cage"); until now it was quietly risky, because area order fed the
seed.

Re-homing is a **label change**, exactly like a rename (ADR-0002): the
unit id is preserved, history displays the current area, and no
snapshot is rewritten. What visibly changes is the unit's colour and
which section it sits in — which is the whole point.

### 4. The area ranking step is a cold-start seed, not a fixture

Ranking six areas exists to order the unit list, and it is the only
thing in the diagnostic that would cost anything to remove. ADR-0005 §7
already names the replacement as an acknowledged gap — "carry-over
prefill for rankings… not built this pass," with drag-to-reorder from
the previous order as the likely shape.

**When carry-over prefill ships, the area pass fires only on a
first-ever diagnostic**, where there is no prior order to seed from.
Every later diagnostic opens on last month's order, which is both a
better seed than an area composition and the convenience the dial era
had and the ranking era lost.

[ADR-0022](0022-satisfaction-is-rated-not-ranked.md) removes the
satisfaction half of this in the same pass: with satisfaction rated
rather than ranked, only the priority axis has an order to seed at all.

### 5. What is now forbidden

Any UI that lets the user act on areas as if they were a scoring level.
Concretely, and by name, because this has been built once already: **no
area-level re-rank, re-weight, or reorder that feeds a stored value.**
If area-level moves are ever genuinely wanted, that means going properly
hierarchical — area order and within-area order stored separately and
composed by `combineHierarchicalRank` — and giving up cross-area
interleaving. That is a product decision reopening ADR-0005 §7, not a UI
convenience.

## Consequences

- **Easier:** the taxonomy becomes genuinely editable, which vision.md
  promised and the implementation quietly didn't support; the
  diagnostic can shed the area pass entirely once prefill lands; a
  whole class of "should this respect areas?" questions has one answer.
- **Harder:** nothing in the code today. The cost is prospective — any
  future feature wanting area-level structure now has to reopen
  ADR-0005 §7 rather than just building it, which is the point.
- **Revisit when:** someone wants area-level structure badly enough to
  give up cross-area interleaving; or if the six-hue palette is ever
  replaced by a system that doesn't key on areas, at which point the
  colour argument in §2 weakens and removal is worth reconsidering.

## Action items

1. [x] Record the invariant in [AGENTS.md](../../AGENTS.md) alongside
       the other product invariants, since it constrains what may
       influence scoring.
2. [ ] Build carry-over prefill for the priority ranking (ADR-0005 §7's
       open gap), then gate the area pass to first-run only.
3. [ ] Allow re-homing a unit to a different area in the taxonomy
       editor — free under §3, and currently not offered.
