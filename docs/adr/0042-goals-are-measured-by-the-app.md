# ADR-0042: Goals are measured by the app

> **Status:** Proposed\
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

## Proposed decision

*Becomes the Decision when accepted.*

### 1. Four kinds of goal

| Kind | Example | Counted from |
|---|---|---|
| Times done | Run 30 times by December | Ticks on the linked tasks |
| Time spent | 40 h of study this term | Each tick's size in hours (0.5, 1, 2), or the time entered with "Took about…" |
| Points earned | Earn 300 Exercise points this term | A running total of points earned in the unit |
| Streak | Meditate every day | Days in a row, from `computeStreak` |

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

### 6. Conditions are retired

Retired the same way milestones were: the table stays and nothing new
is written to it. A condition's tasks become the goal's linked tasks,
and each condition's title is added to the goal's notes, so no text is
lost.

## Consequences

- **Easier.** Every goal shows real progress without typing anything
  in. Goals connect to the weekly plan through suggestions.
- **Harder.** Goals that track something outside the app (a weight, a
  savings balance) can't be made as new goals. Counting several tasks,
  or every task in a unit, reverses ADR-0015 §2's one-task rule (Q2).
- **Revisit when** people ask for goals the app can't count.

**Amends, on acceptance:**

| ADR | What changes |
|---|---|
| ADR-0015 | §1 kinds become the four above. §2 auto-counting widens (Q2) and new manual-entry goals stop (Q3) |
| ADR-0030 | Conditions retired |
| ADR-0007 | §1 a plain goal with no measure can no longer be created |

## Still to decide before acceptance

These are left open on purpose, as the new-adr rules ask:

- **Q2. Which tasks count?** ADR-0015 §2 allowed one nominated task, so
  that changing a goal's task list couldn't silently rewrite its
  history. The spec lets you pick several tasks, or every task in the
  unit.
  - Recommendation: allow several tasks chosen by name, plus "every
    task in this unit" as an explicit choice. Record each counted tick
    as a visible entry, as now, so history doesn't change when the list
    does.
- **Q3. Existing goals.** Some existing goals track a number you type
  in, a target reading, or nothing at all.
  - Recommendation: they keep working as they are, but new goals can
    only be the four kinds. A plain goal shows "Add a measure" on its
    screen, with no other prompt.
- **Library goals.** About 110 goals in the content library use rungs
  ("Run 1k → 3k → 5k") or manual numbers. Each one needs mapping to a
  kind, or removing.
  - Recommendation: map them during the build and drop any that don't
    fit.

## Action items

1. [ ] Goal kinds and progress functions in `packages/scoring/src/goals.ts`,
       with tests (EC-36, EC-37, EC-41, EC-51).
2. [ ] Schema: goal kind and target fields, the goal–task links, and
       `task_completion.actual_minutes`. Migrate conditions.
3. [ ] The New goal sheet and goal screen. Remove the condition UI.
4. [ ] Map or remove the library goals.
5. [ ] Amend ADR-0007, 0015 and 0030. Update vision.md (Goals) and
       AGENTS.md (Goal, Milestone).
