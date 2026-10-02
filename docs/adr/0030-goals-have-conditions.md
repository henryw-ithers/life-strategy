# ADR-0030: Goals have conditions

> **Status:** Accepted\
> **Date:** 2026-08-26\
> **Deciders:** Henry

> **What Henry decided (2026-08-26), and what is drafted around it.**
> Three calls are his: the Harada/Ohtani chart's structure belongs in
> **the goal section**, as `goal → condition → task`, with **any number**
> of conditions and any number of tasks under each; a condition **may
> recruit tasks from any unit**, not only the goal's own; and conditions
> **replace milestones** rather than sitting beside them. Everything
> else below — the schema, the scoring containment, the fate of the
> habit ladder, and the order the work happens in — was drafted around
> those calls.

## Context

The research into Shohei Ohtani's 81-cell chart (Mandal-Art via the
Harada Method) found one structure worth taking and three reasons not to
take it literally. The structure is `1 ambition → 8 conditions → 64
actions`, where a *condition* is something that must be true for the
ambition to happen — and where two of Ohtani's eight, Character and
Luck, are not about baseball at all.

The reasons not to take it literally were recorded in that research and
all three are answered by putting it here rather than over the whole
portfolio:

- **The arity does not fit the taxonomy.** Six areas and eighteen units
  do not divide into eights; a whole-portfolio mandala fills 31 of 81
  cells. A *goal's* conditions have no fixed count to satisfy.
- **The two hierarchies point opposite ways.** Ohtani's eight are
  derived *from* the centre; the eighteen units are a fixed inventory of
  a whole life, derived from nothing. A goal is already an instrumental
  object, so decomposing one into conditions is the same direction of
  reasoning, not the opposite of it.
- **Sixty-four actions would break the scoring engine.** ADR-0003 §6
  recommends one to three tasks per unit, and under ADR-0029 unfinished
  flexible work concentrates as the week runs out. That constraint does
  not go away here — see §3.

What the app has today is `SLU → Goal → Task`, with `milestone` as the
goal's only child structure: an ordered list of rungs, one `current` at
a time (ADR-0007 §3, ADR-0015 §5).

## Open questions

1. What is a condition, and how does it differ from a milestone?
2. Can a condition's tasks live outside the goal's unit?
3. How many conditions, and how many tasks under each?
4. Does any of this reach the grade?
5. What happens to milestones, and to what depends on them?

## Decision

### 1. A condition is a goal's parallel prerequisite

`goal_condition` is a new table: `id`, `goal_id`, `title`, `sort_order`,
timestamps. `task.condition_id` is a new nullable column.

**A condition is not a milestone**, and that difference is why this is a
new table rather than a rename:

| | Milestone | Condition |
|---|---|---|
| Shape | A rung on one axis | A prerequisite alongside others |
| Order | Sequential; one `current` | Parallel; all live at once |
| Ends | Completed and left behind | Never — it ends with the goal |
| Example | bench 135 → 185 → 225 | Control · Mental · Character |

Ohtani's eight conditions all stayed live for four years. **So a
condition has no status and no metric**, deliberately: progress on one
is the tasks under it getting done, which the day already measures.
Giving it a completion state would invent a second thing to finish and a
second thing to fall behind on, and this app is careful about how many
of those it has.

`sort_order` is display order — the arrangement the user made — not a
sequence. Nothing reads it as precedence.

### 2. A condition may recruit a task from any unit

This is what makes conditions worth having rather than being section
headers. Ohtani's chart spans body, mind and character; the app's
equivalent is a career goal carrying a *"sleep enough"* condition whose
task lives in Sleep & recovery.

**The task is paid out of its own unit's weight, not the goal's.**
`task_unit` already decouples who pays from who authored (ADR-0019), and
`condition_id` records only where the task was *written*. `taskWeights`
never sees it.

**The cost, stated plainly:** a goal stops being contained in one unit.
The Plan screen's question — *"where are my points going?"* — is still
answered correctly, because that task appears under Sleep & recovery
where it earns. But the goal screen and the plan screen now show the
same task in two places for two different reasons, and the copy has to
make that legible rather than confusing. That is a presentation problem
this ADR creates and does not solve.

### 3. Any number of conditions, and any number of tasks — but the
task guidance still binds

Henry: any number, both levels. The fixed eight is dropped, and it is
the right thing to drop: **eight empty boxes is a completeness surface**,
and the app never shames (AGENTS.md). A condition with no tasks yet is a
statement of intent, not an error.

**Conditions are free; tasks are not.** A condition costs no points and
adding one changes nothing about the grade. A task divides a fixed unit
weight by rank *and* enters the day's expected load (ADR-0029 §1). Five
conditions holding four tasks each is twenty tasks: if they share a unit
worth roughly seven points, the rank tail rounds to zero and the day's
denominator balloons.

So the rule that has to survive: **`recommendedTaskRange` applies per
unit, never per condition.** Otherwise conditions become a way to
smuggle tasks past guidance the app already gives, and a plan that
cannot be finished is a plan that reads as failure every Saturday.

### 4. Conditions never touch scoring

A condition is an authoring and grouping layer, exactly as
`life_unit.area_id` is for units (ADR-0021 §1: an area "may determine
colour, grouping, and the diagnostic's opening seed — never weight,
rank, points, or any stored score").

`packages/scoring` does not import `goal_condition` and must not.
Moving a task between conditions calls no recompute, because nothing
about its value changed.

### 5. Conditions replace milestones — in two steps, not one

Henry's call: one child concept on a goal, not two. The end state is
that `milestone` stops being authored.

**What that costs is larger than it first looked, and is recorded here
because the decision was taken before it was fully surveyed.** There are
156 references across the goal detail screen, `db/goals.ts` and the
content library. Three things depend on milestones:

- **Habit goals' entire structure.** A habit goal has no target by
  design — it is meant to be permanent and never completes (ADR-0015 §1,
  decided 2026-08-16) — so its 7 · 30 · 66 ladder is the *only*
  structure it has, and it is stored as milestone rows seeded from
  `HABIT_LADDER`.
- **The content library's rungs**, on roughly 110 curated goals
  ("Run 1k → 3k → 5k"). These are sequences on one axis and cannot be
  relabelled as conditions without lying about what they are.
- **The prompt-to-advance flow** and the minor achievements it writes
  (`milestonesReached`, `advanceMilestone`, `completeMilestone`).

The resolutions:

- **The habit ladder stops being rows and becomes what it always was.**
  `HABIT_LADDER` is a research constant (66 is Lally's median to
  automaticity) and `streak.longest` already computes the rest. Nothing
  about it was ever user-authored. This comes out *cleaner*, not poorer.
- **Metric rungs collapse into the goal's own `target_value`.** A metric
  goal gets one finish line and its progress entries. Library templates
  lose their intermediate rung titles. **This is the real loss**, and it
  is the one that was accepted.
- **The `milestone` table stays in the schema and stops being written.**
  Forward-only (ADR-0002): existing rows keep rendering in the log and
  in achievements, so history is not rewritten.

**And the work is staged.** Conditions land first, alongside milestones;
milestones retire second. Adding a table and removing 156 references in
one change makes both hard to verify, and this engine has had four
formula versions in nine days. The end state is the one Henry chose;
only the order is drafted.

This amends **ADR-0007 §3** (milestones as the goal's ordered child) and
**ADR-0015 §5** (rungs and the prompt to advance).

## Consequences

**Easier.** A goal can finally say *why* its tasks are the right tasks.
"Ship the app" with a condition of "stay rested" and a task in Sleep &
recovery is a sentence the app could not previously represent at all,
and it is the sentence the Ohtani chart is famous for. Goals also become
renderable as a mandala — `goal → conditions → tasks` is exactly
`1 → 8 → 64` — as a *view* that fits when the shape fits and falls back
to a list when it does not, which is the grid without the empty boxes.

**Harder.** A third level under a goal is a third level to explain, on a
screen that already carries a metric, a target date, progress entries
and a streak. If the goal screen becomes project-management software,
this ADR is what did it — AGENTS.md's line is that complexity belongs in
the periodic strategy layer, and a goal is squarely in that layer, but
there is a limit and this moves toward it.

**Accepted costs.** Goals stop being contained in one unit (§2). Metric
goals lose intermediate rungs (§5). And "condition" is now a word with
two jobs: the Environment area's own description reads *"the conditions
you live in"* — unrelated, and worth a copy pass if it reads oddly in
context.

**Revisit when:** real use shows conditions being created and left
empty, which would mean the concept is being used as a heading rather
than a prerequisite; or when a goal screen carrying both conditions and
a metric proves unreadable.

## Action items

1. [x] Schema: `goal_condition` table and `task.condition_id`; migration
       `0014_spotty_dagger`.
2. [x] `db/goals.ts`: `GoalCondition`, condition CRUD (`addCondition`,
       `renameCondition`, `deleteCondition`, `reorderConditions`,
       `setTaskCondition`), and `loadGoalDetail` returning grouped
       tasks. Deleting a condition **keeps its tasks**, reparenting them
       to the goal.
3. [x] `addTask` takes an optional `conditionId`.
4. [x] Goal detail screen: conditions as the goal's child list, add /
       rename / reorder / delete, and adding a task under a condition
       with a unit picker that defaults to the goal's unit but does not
       require it (§2). Also, from the audit that followed: pulling an
       **existing** task in from any unit (`attachTaskToGoal`,
       `AddExistingTaskSheet`), taking one back off
       (`detachTaskFromGoal`), moving one between conditions, and
       editing one — which routes to the Plan screen rather than
       duplicating its edit sheet, so task mechanics keep one home.
5. [x] Retire milestones (§5). Done 2026-08-26: `advanceMilestone`,
       `MilestoneStatus` and `milestonesReached` are gone from
       `packages/scoring`; `habitMilestonesReached` became
       `habitRungsReached(streak)` reading `HABIT_LADDER`, joined by a
       new `rungReachedOn` so a rung files in the month it was passed.
       `db/goals.ts` lost `addMilestone`, `completeMilestone`,
       `updateMilestone`, `deleteMilestone`, the ladder seeding in
       `setGoalMetric` and `GoalMilestone`; it gained `recordHabitRungs`.
       The `milestones:` field left `library.md`, its parser and the
       generated `library.ts` (42 lines of rungs). The goal screen lost
       its checkpoints section, and `PastDaySheet` — which existed only
       to date a rung — was deleted. The table stays in the schema,
       carries a retirement note, and is still cleared by `deleteGoal`.
6. [x] Decide whether the goal screen renders its conditions as a grid
       when the shape fits (≤ 8 conditions), or always as a list.
       *(Decided 2026-10-02, Henry: **always a list**, the checklist's
       own shape, at any count. That is how it is built.)*
7. [ ] Copy pass on "condition" against the Environment area's
       description, and on how a task belonging to another unit is
       labelled where the goal shows it.
8. [ ] **Discoverability is carried by menus, and menus have a ceiling.**
       A task's actions are a flat list that grows with the goal's
       condition count — six conditions makes a nine-row sheet. If real
       plans get there, the move is a submenu or a drag, not more rows.
