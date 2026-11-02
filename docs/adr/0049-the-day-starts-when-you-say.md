# ADR-0049: The day starts when you say, and times run overnight

> **Status:** Accepted (Henry, 2026-11-02)\
> **Date:** 2026-11-02

## Context

The day rolled over at a fixed 3am (`ROLLOVER_HOUR`), and no time could
run past it: a window, event or task ended by 3am at the latest, and
the pickers stopped at 23:59. ADR-0004 §1 had always said the rollover
would be configurable. Henry, testing (2026-11-02):

> We shouldn't restrict the length of anything at all … when you
> consider someone that might work night shifts or just live on a
> shifted schedule from the norm, why would we dictate when that
> person's day begins or ends. I think we need some functionality for
> the user to control when a day begins and ends. Also, I think a task
> that overlaps into the next day should probably only belong to the day
> that you started it in.

Asked, he chose one "Day starts at" setting over a start per weekday.

## Open questions

1. How is the day start set, and what does it change?
2. How long may something run, and which day does it belong to?
3. What happens to stored times when the day start changes?
4. Does a change touch today's score or settled grades?

## Options considered

**A day start per group of weekdays,** for rotating shifts. More
flexible; much more to explain. Not chosen.

**One setting, any hour** (chosen).

**Leave stored times alone on a change.** Simple, but a 9am class with
the day starting at 2pm would sit before its day begins and could never
be current. Rejected for re-basing (§3).

## Decision

### 1. One setting: Day starts at

Settings → Your days → **Day starts at**, any whole hour, default 3am.
The day runs 24 hours from there. It replaces `ROLLOVER_HOUR` everywhere
the app asks what day it is: `lib/calendar.ts` holds it, read once at
launch (`loadDayStart`), and every "what day is it" goes through it.

### 2. Anything may run for up to a day, and belongs to its start

Times stay minutes from the date's midnight. A start must fall inside
its day (before the next day starts); an end may run past midnight and
past the next day's start, for up to 24 hours. An end earlier on the
clock than its start is the next day (shown "+1"). Something that runs
into the next day **belongs to the day it started**: a 10pm–6am shift is
one event on the day it began. The tail of an overnight event keeps the
next day's windows clear.

Writes are checked against the current day start; reads accept any, so
a change never drops a stored range.

### 3. A change moves stored times onto the new day

Changing the day start re-bases every stored time (working hours, day
overrides, window edits, pin anchors, task and event times) so each
keeps its clock time as the new day counts it. With the day starting at
2pm, a 9am class becomes 33:00 of the day before it: where someone on
nights lives it. Parts of the day follow, either side of midnight.

### 4. Today's share is kept; no grade is touched

Before anything moves, today's starting hours are kept, so the
commitment share of a day already begun doesn't change (ADR-0044 §5).
Grades aren't marked stale: no score reads the day start. Settled
grades are never touched.

## Consequences

- Night workers and shifted sleepers can set their day to match it.
- Moving the day start later can make "today" yesterday for a few
  hours. The setting steps one hour at a time and saves when you stop,
  so it's never changed by accident.
- Achievements that read the hour of a tick (early bird, night owl)
  read past ticks under the current day start; ranks already earned are
  kept.
- A skip's `made_on` is a date stamped under the day start of its time;
  a change across midnight could in rare cases read a same-day skip as
  made ahead.
- Supersedes ADR-0039 §1's "past midnight up to the 3am rollover".
