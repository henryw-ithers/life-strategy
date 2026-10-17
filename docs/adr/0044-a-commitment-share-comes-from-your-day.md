# ADR-0044: A commitment's share comes from your day

> **Status:** Accepted\
> **Date:** 2026-10-13\
> **Deciders:** Henry

## Context

On a day with commitment work, commitments get their own share of the
day (ADR-0032 §1). How it works now:

- You set the share yourself, from 10 up to a cap of 60, 70 or 80 for
  one, two or three commitments.
- Several commitments split it by percentages you also set (ADR-0032
  §3, amended).
- Commitment tasks and events are paid from that share, not from the
  100 points the 18 units share. The units take the rest of the day.

For a stranger this is hard to set. Nothing tells them whether School
should be 30 or 50. Henry chose to work it out automatically and keep it
adjustable. He described the intent on 2026-10-13: commitment tasks
"have a score from the pool of points that is dedicated to that
commitment which is automatically calculated but can also be
customized so that for ex 'School' tasks and events can take up 60% of
a days/weeks score if a user wants."

On how it's worked out: "The commitment share of the day should be
based around the total working hours, and how many tasks and events
the commitment has. 10% doesn't make sense to me because that assumes
the work day is 10 hours … just shape it around whatever they choose."

He also decided that changing windows during a day doesn't change that
day's share.

AGENTS.md says commitment tasks have "no weight". That means no weight
in the 18 units' 100 points, and stays true: they're paid from the
commitment's own share.

## Open questions

1. How is the share worked out by default?
2. How does a user override it?
3. How do several commitments divide it?
4. When is a day's share fixed?

## Options considered

- **Keep the user-set band.** No formula to explain, but a new user has
  no basis for picking a number.
- **A fixed amount per hour of events**, such as 10% an hour. Simple,
  but it assumes a 10-hour day and ignores commitment tasks. Henry
  rejected it.
- **The commitment's time as a share of your own working day** (chosen).
  It follows the hours you set and counts both events and tasks.

## Decision

### 1. The default share

    commitment time = its events today (hours)
                    + its tasks scheduled today (0.5, 1 or 2 h each, by size)
    your day        = today's working hours + event time outside them
    share           = commitment time ÷ your day

For example, with 8 working hours, a 1.5-hour lecture and two Normal
School tasks, School's share is (1.5 + 2) ÷ 8, about 44%. The other 56%
is the usual 90/10 day (ADR-0029, ADR-0032 §1).

"Scheduled today" means due today by the task's own schedule: pinned to
today's weekday, a one-off dated today, or that day's run of a
repeating task. Pinning a task into a window, or carrying it in from an
earlier day, doesn't count, so planning can't change the share.

More scheduled work makes a bigger share. With only a 1.5-hour lecture,
the same day is about 19% School. Two Big School tasks on top take it
to about 69%. Henry confirmed this on 2026-10-13: a day full of School
work is mostly a School day.

### 2. Limits

The shares of all commitments that day are added up and kept between
10% and `commitmentBandMax` (60, 70 or 80%). Each commitment keeps its
proportion inside that.

A day you've set with no working hours, but with commitment work, gets
the maximum, since the commitment is the whole of that day's planned
time. Before any hours are set at all, the three default windows count
as working hours (ADR-0039 §2).

### 3. Override

On a commitment's screen, "Share of your day" shows the automatic value
for a typical day. You can set a fixed share instead, such as School at
60%, and the automatic value stays visible beside it (AGENTS.md). The
override applies on every day the commitment has work, within the same
limits. Weekly and monthly totals are still the days added up, so a 60%
share on School days carries through to the week.

### 4. Inside a commitment, nothing changes

A commitment still pays for the share of that day's commitment work you
did, divided across its eligible tasks and events (ADR-0032 §3). Task
size only changes how big the share is, not what one task is worth
against another. Sub-commitments still price nothing.

### 5. Hours are fixed at the start of the day; the share settles with the grade

A day's share uses the working hours as they stood when the day began.
Adding, moving or removing a window that day changes where tasks go,
not the share.

> **Clarified 2026-10-17 (Henry).** "As they stood when the day began"
> includes window edits made for that day ahead of time, and not those
> made on the day itself. A Wednesday evening window added on Monday
> counts toward Wednesday's hours; one added at lunch on Wednesday
> doesn't (EC-56; docs/design/windows-and-pins.md §1.4).

The share can still change during the day when what's due changes:
skipping an event, Clear today (ADR-0040), or adding commitment work
for today. The share is fixed for good when the day's grade settles
(ADR-0004 §1), so a later "This week and after" edit doesn't rescore
past days.

### 6. Formula version

This is the next formula version, together with ADR-0041's tier
weights (see ADR-0041 §2 on whether that is 11 or 12). History is not
restated, as with every earlier formula change.

### 7. Sub-commitments without a switch

Decided in the design review (2026-10-12: "keep, simplify UI"). The
split switch (`uses_sub_commitments`) leaves the screen. Adding the
first sub-commitment splits the commitment, and its own events and
tasks move into a sub-commitment called General, which can be renamed.
Removing the last one puts the work back, using the restore rule ADR-0035
§1 already has. Sub-commitments still price nothing.

## Consequences

- **Easier.** A new user never has to choose a number. The share
  follows how much of their day the commitment actually takes.
- **Harder.** Working hours and task sizes now affect the score through
  this share, which is the one way the time side of the app touches
  points (ADR-0039 §12). Tests must check that window edits during the
  day don't move it.
- **Revisit** after a month of use, especially for days with a long
  event and short working hours, where the share runs into the cap.

**Amends, on acceptance:**

| ADR / doc | What changes |
|---|---|
| ADR-0032 | §1 the share is worked out per day. §2 the user-set size becomes an override. §3 shares between commitments come from time, unless overridden |
| ADR-0026 | §2 a commitment task's size sets the size of its commitment's share, though never its value against other tasks |
| ADR-0029 | §2 for commitments only: how much work a day schedules changes how big the commitment's share is. The 18 units are unaffected |
| ADR-0035 | §1 the split switch is removed; adding or removing sub-commitments splits and un-splits |
| AGENTS.md | The commitment band invariant is reworded: an automatic share with an override, and "no weight" clarified as no weight in the units' 100 |

## Action items

1. [ ] `commitmentShare(day)` in `packages/scoring/src/bands.ts`, with
       tests: the 44% example, the limits, the no-hours day, overrides,
       several commitments, and a mid-day window edit (EC-50, EC-56).
2. [ ] Store each day's starting hours alongside the grade, so the share
       can be recalculated exactly.
3. [ ] "Share of your day" on the commitment screen. The old band sheet
       goes.
4. [ ] Amend ADR-0032. Update AGENTS.md.
