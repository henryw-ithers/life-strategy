# Design Brief — Task Setup (Plan screen)

> Shaped and confirmed 2026-07-17 via /impeccable shape. Implemented as
> `apps/mobile/src/app/plan/` (index + [unitId]) with
> `src/components/plan/AddTaskModal.tsx`; data layer `src/db/tasks.ts`.

## Summary

A durable Plan surface: `/plan` lists the six areas and their units
with current weights and plan state ("3 tasks" / "no tasks yet");
`/plan/[unitId]` is a unit's ranked task list. Tasks attach directly
to units (goals ship as their own build, ADR-0007). User-created tasks
only for now; library suggestions come with ADR-0006's content
package.

## Core interaction: the Beli comparison

Adding a task to a unit that already has tasks runs the ranking
ritual — "Which matters more right now?" with two large cards, binary
insertion in ~⌈log₂(n+1)⌉ taps, haptic per choice. Points re-derive
from rank shares (`taskPointValues`) on every change, transactionally,
future days only. First task takes the whole unit weight.

## Direction

DESIGN.md throughout: faint constellation behind /plan (overview),
each unit detail washed in its area's hue, tokens/AppText/Button
everywhere. The ADR-0003 weight-band guidance appears as one gentle
caption per unit ("A unit this size carries 1–2 tasks well"), never as
enforcement. Unplanned units read as information, not guilt.

## Mechanics

Add (title + daily/weekly chip → comparisons → ranked list); archive
via long-press with confirm (points re-share); cadence toggles on the
row chip. Rank compaction and recompute in one transaction. Excluded
units shown muted, task-add disabled. Empty state without a snapshot
points to the diagnostic. Entries: home link and the diagnostic
results rows (each weight row opens its unit's plan).

## Deferred

Dedicated re-rank gesture (remove-and-re-add covers v1; a proper
re-rank belongs to the monthly review build); library-recommended
tasks; goals.
