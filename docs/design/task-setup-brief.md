# Design Brief — Task Setup (Plan screen)

> **Design history.** A record of how this was worked out, kept for the
> reasoning. Some details have changed since; where it disagrees with an
> ADR, the ADR is correct. See the [documentation map](../README.md).
> Since this brief: the Plan screen became one screen (`(tabs)/plan.tsx`)
> with units that expand in place, and tasks are ordered by dragging
> rather than by side-by-side comparison.

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

## Task description

> Accepted 2026-08-02. Arrived as "let a task contain sub-tasks"; see
> [backburner.md](../backburner.md#subtasks-breaking-a-task-into-smaller-steps)
> for why the nesting half was refused and this half kept.

**What it's for.** A task title is a promise to yourself, and a vague
one makes the tick dishonest — "Skincare" checked could mean the full
routine or a face wash, and the grade cannot tell. A free-text body
saying what the task consists of is a self-contract. It is *not* a
progress mechanism: it never affects points, and it adds no rows to any
checklist.

**Schema.** `task.description`, `text`, nullable — mirroring
`goal.description`, which already exists. Additive migration via
`npm run db:generate -w apps/mobile`; nothing in `packages/scoring`
changes, and backup is unaffected (it serializes the whole database).

**Data layer** (`src/db/tasks.ts`):

- `PlanTask` gains `description: string | null`; `loadPlan` selects it.
- `renameTask(taskId, title)` becomes
  `setTaskDetails(taskId, title, description)` — its only caller is the
  save handler in `(tabs)/plan.tsx`, and title and description are
  edited in the same sheet, so two round trips would be two writes for
  one gesture.

**UI:**

- `TaskEditSheet` — a 3-line multiline `TextInput` under the title,
  placeholder "What does this involve?". `EditableTask` and the `dirty`
  comparison both gain the field. **The sheet's no-scroll rule is
  load-bearing** (it's in the file's own header comment: a sheet you
  scroll hides its own primary action). Three lines fit; if it needs to
  grow, the field moves behind a row rather than making the sheet
  scroll.
- `plan/TaskRow` — **no new line.** The row already carries title,
  "Also counts toward", cadence and points; a fifth element is how a
  checklist becomes a table. The description is read in the sheet.
- **Not on Today, deliberately.** The checklist row's entire press
  target is the toggle, and a disclosure puts a second target on a row
  whose whole job is one tap (PRODUCT.md principle 2). If it turns out
  to be wanted mid-checklist, that is the signal to design the
  expansion properly, not to bolt it on.
- **Not in `AddTaskModal`, deliberately.** Same reasoning ADR-0003 §5
  used when it moved ranking out of task creation: don't tax the moment
  of capture. Add the task, then say what it means.

**Accessibility.** The input carries an `accessibilityLabel`; nothing
joins `TaskRow`'s label, since the description isn't rendered there.

## Deferred

Dedicated re-rank gesture (remove-and-re-add covers v1; a proper
re-rank belongs to the monthly review build); library-recommended
tasks; goals.

Per-task **checkable** steps, in either form — persistent (partial
credit, which is ADR-0014 and has a written trigger) or ephemeral
(in-session place-keeping for a long routine, discarded on completion).
Both wait on real use of the description field showing which is
actually missed.
