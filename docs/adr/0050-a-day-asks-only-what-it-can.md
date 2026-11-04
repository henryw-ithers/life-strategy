# ADR-0050: A day asks only what can be done in it

> **Status:** Accepted (Henry, 2026-11-04)\
> **Date:** 2026-11-04

## Context

Henry, testing: "on a day where I did 7 tasks, I got a 35% even though
there's probably only about 12 tasks I could have realistically done
that day. The score should just be based on the tasks that actually
exist. Also a commitment task that's due in a few weeks shouldn't have
much of an effect."

An exploration of formula v11 found the day's expected load asking
for more than a day can hold:

1. **Weight, not count.** A unit's only task carried the unit's whole
   weight (about 9 for a Top unit) while five dailies in another unit
   split theirs at 1–2 each, so one task outweighed five.
2. **Backlog piled onto the week's end.** Every run a flexible task
   still owed joined the pool, divided by the days left, uncapped: a
   3×/week task untouched by Saturday asked for three runs that day,
   though it can be ticked once.
3. **Fortnightly work** was spread over the days left in the week, so
   it all landed on the first week's Saturday.
4. **One-offs** loaded every day at up to the whole unit's weight. A
   deadline weeks away was ignored by scoring.
5. **Undated commitment one-offs** took an equal slot of the band every
   day, though their time counted toward the band only on the day they
   were ticked, so assignments due in weeks dragged every day down.

Asked, Henry chose **both** fixing the inflation **and** evening out
what any one task can be worth; that a one-off with neither a day nor
a deadline counts **only on the day it's done**; that **per-task
achievements give way to unit-level ones**; and a layout for
Achievements that names each achievement once with every unit's badge
beneath it, in priority order.

## Decision

Formula **v12**. Grades already settled keep the version they were
scored under; nothing past is rescored.

### 1. Each task is evened half-way toward the average

A task's weight is half what its unit and rank give it (as before) and
half the average task weight (`evenOut`, `EVEN_SHARE = 0.5`), as whole
numbers that keep the same total, none below one. One-offs are evened
toward the same average. Priorities still decide what's worth more;
no single task dwarfs the rest.

This **supersedes** the rule (Henry, 2026-08-26; ADR-0029) that how
many tasks a unit holds never changes what that unit is worth: a
unit's tasks now come to roughly half its weight plus their share of
the average. Unit weights themselves are untouched (ADR-0041).

### 2. Only what can be done today is expected

- A task owes **at most one run a day**: the runs it still owes join
  the pool only up to the days it can still run.
- **Fortnightly** work is spread over the days left in its fortnight.
- A **one-off with a deadline** (`oneOffDue`) is spread over the days
  until it's due; due today or overdue, it's all today's.
- A **one-off with neither a day nor a deadline** asks nothing of any
  day. Ticked, it counts in full on that day, on both sides.
- An **undated commitment one-off** takes a share of the band only on
  the day it's ticked, matching how its time counts toward the band.

### 3. Achievements are for units, areas, commitments and you

The four per-task series (completions, every-day streak, weeks on
target, in a row) are **retired**: nothing new is counted and they leave
the screen. Ranks already earned stay stored and still read in the Log
(ADR-0047 §6: nothing earned is taken back). Units gain **Days in a
row**: a day counts when any of the unit's tasks was done; days off,
Away days and a day all its every-day tasks were skipped bridge it.

Life → Achievements names each unit, area and commitment achievement
once, with every one's badge beneath in a scrollable row, units in your
priority order and areas after their highest unit.

## Consequences

- Seven of twelve due tasks now scores near the share of work done,
  rather than far below it.
- A unit with one task matters less than before, by design; its
  priority still puts it ahead of a unit lower down.
- A one-off with no day and no deadline never costs a day; adding a
  deadline is how to say it's owed.
- Achievement rows are fewer and wider: no row of the same badge
  repeated per task.
- Amends ADR-0029 (§1's weights, the load), ADR-0044's eligibility for
  undated commitment one-offs, and ADR-0047 §3 (the catalogue).
