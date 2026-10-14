# ADR-0042: Goals are measured by the app

> **Status:** Accepted\
> **Date:** 2026-10-13\
> **Deciders:** Henry

## Context

A goal today can be a plain goal with no measure, a metric goal with
entries you type in (cumulative, or a target reading such as a
weight), or a habit goal that counts days in a row (ADR-0015). It can
also hold conditions, each with its own tasks (ADR-0030). Henry,
2026-10-12: "Right now I don't see it getting used very much."

In the design review he decided:

- goals are optional, a power feature
- "a goal has to be measurable by some specific stat. Basically this
  means it has to be shaped around some stat or metric that the app can
  measure."
- the measures are times done, time spent, points earned in a unit, and
  streaks ("make sure to include streaks as an option")
- an active goal moves its tasks up slightly in suggestions
- goals and commitments sit together on the Life tab

He didn't choose "a number you log" (a weight, savings, a run time),
which is the manual-entry metric ADR-0015 §2 built.

The research supports this direction. Goals that connect to daily work
get used, and outcome measures with a pace line read as falling behind
([research-brief.md](../design/research-brief.md), P12–P13). The
invariant review of the spec found that a *percentage* of a unit's
points would measure how much of the plan was done, which AGENTS.md
rules out, while a running total of points doesn't.

## Open questions

1. What can a goal measure?
2. Which tasks count toward a goal?
3. What happens to existing goals the new kinds don't cover?
4. What happens to conditions?
5. Does a goal affect planning or scoring?

## Options considered

- **Keep goals as they are and only move them to Life.** Least work,
  but the problem was that goals go unused.
- **Goals as folders of tasks with no measure.** Simple, but nothing
  connects them to progress.
- **Goals built on something the app counts** (chosen in the design
  review): times done, time spent, points earned, streak.

## Decision

### 1. Four kinds of goal

| Kind | Example | What counts | Counted as |
|---|---|---|---|
| Times done | Run 30 times by December | One or more tasks you choose | Ticks |
| Time spent | 40 h of study this term | Tasks you choose, or every task in the unit or commitment | Each tick's size in hours (0.5, 1, 2), or the time entered with "Took about…" |
| Points earned | Earn 300 Exercise points this term | The whole unit, always | A running total of points earned |
| Streak | Meditate every day | Exactly one every-day task | Days in a row, from `computeStreak` |

Which tasks count depends on the kind of goal (Henry, 2026-10-13). The
sheet asks only the question that kind needs. A points goal asks no
task question at all, and a streak asks for a single task.

A tick counts if its task was linked to the goal when it was ticked.
Each counted tick is kept as an entry, so unlinking a task later
doesn't rewrite the goal's history (the reason behind ADR-0015 §2).
"Every task in the unit" includes tasks added later.

A goal belongs to one unit or commitment and has an optional end date.
The first three kinds have a target. A streak has none.

Points earned is a running total only. It is never a percentage of the
points on offer, since that would measure plan completion (AGENTS.md).

### 2. Streak goals keep the existing streak rules

Streak goals use the existing rules (ADR-0004 §5, ADR-0015's
2026-08-16 habit amendment, and the copy guide):

- Every-day tasks only, never events. A run that ended on an unticked
  event would be derived from events not attended, which ADR-0038 §5
  rules out.
- One missed day ends the run. Days off and Away days are skipped, and
  an unfinished today doesn't count.
- No target and nothing to complete. 7, 30 and 66 days are celebrated.
- Nothing is said when a run ends, a past best never sits beside a
  shorter current run, and nothing shows under 7 days.
- A cleared day (ADR-0040) is not a day off, so it can end a run.

### 3. Progress and completion

Progress is a running total ("18 / 30 runs"). There is no pace line,
because it would show being behind without saying so (ADR-0008).
Reaching a target invites completion and does not complete the goal by
itself (ADR-0015 §3, ADR-0007 §2). Achievements go to the monthly
summary, not the daily grade. Goals can still be paused, revised or set
aside (ADR-0007 §1).

### 4. Goals steer suggestions slightly, and never scores

An active goal's tasks rank third in suggestions (ADR-0039 §5), after
due and carried work. Points are unchanged. Goal progress never feeds a
daily grade.

### 5. "Took about…"

A long press on a done task records how long it took
(`task_completion.actual_minutes`). Only time goals read it. It never
changes points.

### 6. Existing goals are erased

Henry, 2026-10-13: goals should "only take the new shape … nobody is
using the app so I don't care about existing goals, they should be
erased."

The migration that introduces the four kinds deletes every existing
goal, along with its progress entries, conditions, milestones and the
achievements that point at it. Tasks are kept: their `goal_id` and
`condition_id` are cleared, so they carry on as ordinary unit tasks.
Restoring an older backup runs the same migration, so its goals are
erased too.

This knowingly breaks ADR-0002's rule that history isn't destroyed,
once, because the app has no users whose data it would lose. The
`goal_condition` and `milestone` tables are dropped rather than
retired, and the metric kinds `cumulative` and `target`, with manual
progress entries, go with them.

### 7. Templates replace the goal library

There are only four kinds of goal now, so the curated goal library
(ADR-0006) is replaced by templates covering them (Henry, 2026-10-13:
"the library should be replaced by one that has all possible templates
essentially").

For each unit, and for each kind of commitment, the library offers one
template per kind that makes sense there. For Exercise, for example:

- Times done: Work out [30] times by [date]
- Time spent: [20] hours of training by [date]
- Points earned: Earn [300] Exercise points by [date]
- Streak: Stretch every day

Each template fills in the kind, the unit and a suggested target. It
also suggests the tasks that count, taken from the task library, which
stays as it is. Everything can be changed before saving. "Start from
scratch" is the same sheet, empty.

## Consequences

- **Easier.** Every goal shows real progress without typing anything
  in. Goals connect to the weekly plan through suggestions.
- **Harder.** Goals that track something outside the app (a weight, a
  savings balance) can't be made at all. Existing goals are lost, which
  is acceptable only because nobody uses the app yet. The goal library
  has to be rewritten as templates.
- **Revisit when** people ask for goals the app can't count.

**Amends, on acceptance:**

| ADR | What changes |
|---|---|
| ADR-0015 | §1 the kinds become the four above. §2 counting follows the goal's kind, and manual progress entries go |
| ADR-0030 | Conditions removed |
| ADR-0007 | §1 a goal must be one of the four kinds. §3 milestones removed |
| ADR-0006 | §1 the goal half of the library becomes templates. The task library stays |
| ADR-0002 | Existing goals are deleted once, by migration |

## Action items

1. [ ] Goal kinds and progress functions in `packages/scoring/src/goals.ts`,
       with tests (EC-36, EC-37, EC-41, EC-51).
2. [ ] Schema: goal kind, scope and target fields, the goal–task
       links, and `task_completion.actual_minutes`. A migration erases
       existing goals and drops `goal_condition`, `milestone` and
       manual progress entries.
3. [ ] The New goal sheet (templates, then the questions for that
       kind) and the goal screen. Remove the condition UI.
4. [ ] Rewrite the goal library as templates in `docs/content/`, and
       regenerate it with `npm run content:build`.
5. [ ] Amend ADR-0007, 0015 and 0030. Update vision.md (Goals) and
       AGENTS.md (Goal, Milestone).
