# ADR-0039: Work windows come from your hours

> **Status:** Proposed\
> **Date:** 2026-10-13\
> **Deciders:** Henry

## Context

ADR-0033 divided the day into windows: the gaps between commitments,
or morning, afternoon and evening on a day without them. Testing the
build in October 2026 showed that this wasn't the planning Henry had in
mind. In his words, the Plan ahead screen "doesn't at all encapsulate
the vision I had for planning your week around windows", and there was
no way to say when you're actually free to work.

What he described, 2026-10-12:

- You decide when your working time is. "Should they choose not to
  specify custom task windows, in the onboarding screen the app will ask
  for your working/tasking hours and build the windows around that and
  the sessions that are in those hours."
- The app fills the windows for you unless you choose. "If you choose
  not to, the app will automatically suggest and fill this for you and
  updated future windows when certain tasks get completed."
- A weekly routine is optional. "On a sunday or once at the start of
  the week, you can choose to go through each of the available windows
  and sort through which tasks appear then."
- Task size decides what fits. "When you create a task, you select if
  it will take 1 hour or less, 1-2 hours, or 3+ hours and based on how
  much time there is in a given window … we automatically filter what
  tasks show up in that window."

Further decisions came out of the design review (2026-10-12 and 13):

- Working hours are set the way iOS sets Sleep schedules.
- Gaps between windows are breaks and can be named. Work windows have
  no names: "a task/work window is always a work window".
- Suggestions are worked out live and never saved. Anything you pin
  stays where you put it.
- When the shown tasks are done, the next one is pulled in.
- Pinning happens where you plan, not on today's rows.
- You can add, change or remove a window for one day from Home or Plan.
- Home has one layout.

The evidence is in
[research-brief.md](../design/research-brief.md). Several apps already
have blocks you fill later (Akiflow, Morgen, Reclaim). Schedulers that
move what you placed lose people's trust (Motion). Placing work at a
time is enough to get most of the benefit of planning (Gollwitzer &
Sheeran, 2006). The full behaviour is in
[redesign-spec.md](../design/redesign-spec.md) §§3–4.

## Open questions

1. Where do windows come from?
2. How do tasks get into a window, and who controls that?
3. What can be changed for one day, and from where?
4. What happens to work that isn't done?
5. What does Home show outside any window?
6. Can any of this change a score?

## Options considered

- **Keep ADR-0033's derived windows.** Windows stay as the gaps between
  commitments or the three parts of the day. There's nothing to set up,
  but it can't express "I work 9 to 5" or "I'm free tonight", which is
  the point of the request.
- **Draw blocks fresh each day** (like Structured). This is flexible
  but means planning every day, and the weekly routine has nothing to
  repeat.
- **A weekly template of working hours, minus events, filled by live
  suggestions you can pin.** This is the option chosen in the design
  review.
- **A full auto-scheduler that writes the plan** (like Motion). This
  was rejected: it moves things people placed, and it needs durations
  and deadlines up front (X1 and X3 in the brief).

## Proposed decision

*Becomes the Decision when accepted.*

### 1. Working hours are a weekly template

A schedule is a set of weekdays and one or more time ranges, set the
way iOS Sleep schedules are. A weekday belongs to at most one schedule.
A range may run past midnight up to the 3 am rollover and counts as
part of the day it starts on. A day in no schedule has no windows.

The template repeats each week. Edits ask "Just this week" (overrides
for those dates) or "This week and after" (a new version from that
date), so past days keep their hours.

### 2. Windows are what's left

    windows = working ranges
              − events, widened by 10 minutes each side
              − named gaps
              − pieces under 30 minutes, which show as buffers

Events outside working hours still show but make no window. Before any
hours are set, a day has three default windows (9–12, 1–5, 6–9), and
those count as its working hours (ADR-0044).

Windows have no names and are shown by their times. A gap can be given
a name, such as Lunch.

### 3. One day's windows can be changed from Home and Plan

You can add a window, change its times or remove it, for that day only.
A switch adds the change to the weekly template instead. An added window
may sit outside working hours.

- If it overlaps an event, it's trimmed around the event and its
  buffer.
- If it overlaps another window, it takes that time, and the other
  window is shortened or split.
- When a window is removed or shortened, its pinned tasks move to the
  next window, or to Other open tasks. They are never lost.

### 4. Sizes have hours, used only for fitting

Quick counts as 0.5 hours, Normal as 1 and Big as 2 (`SIZE_HOURS`
changes from 0.25 / 0.5 / 1). New tasks start as Normal rather than
unset, and older tasks with no size count as Normal. A size never
prices one task against another (ADR-0026 §2). The one place size
reaches the score is the size of a commitment's share (ADR-0044).

### 5. Suggestions are live and never saved

Each time Home or Plan opens, open tasks are placed into windows:

1. Pinned tasks go first.
2. A task with a clock time goes into the window that contains it.
3. The rest go in ranked order:
   1. due today
   2. carried forward
   3. linked to an active goal
   4. part-of-day match
   5. unit tier
   6. your order
   7. oldest first

Each task goes into the earliest window with room left, filling it to
80% of its length.

Points are never used to rank (as ADR-0033 §3 reasoned). Work planned
for a later day is not suggested, but it can still be pinned
(ADR-0037 §3). A flexible task is offered every day until its runs for
the week are done (ADR-0029 §1). A window shows up to 5 tasks, fewer if
it's short, and each suggestion gives a one-line reason.

### 6. Pins are yours, and set where you plan

You pin in Plan's day view, in the weekly pass, or from the list of all
open tasks. Today's rows on Home can be ticked, swapped or moved, but
have no pin button. While its window is current or still to come, a
pinned task stays where you put it. It moves only if you change that
window (§3), or after the window has ended (§8). The app never warns
when you move a task.

"Do N of these" on a window is the pool from ADR-0033 §3 and keeps its
rules: up to 3 tasks, all of equal value, and the planned count sets
the ceiling. Only the user can create one.

### 7. Refilling

When the visible tasks in the current window are done and there's
room, the next ranked task comes in as "Next up". When the window is
full, it says "That's this window" and offers "Pull in another".

### 8. Carrying forward, bounded by the week

Henry, 2026-10-13: "any time a task for a given day isn't completed or
is delayed, it should be carried forward to the next day/window."
Unfinished work moves to the next window that fits, then to the next
day, with the reason line "Still open". It is never called overdue or
missed. As in ADR-0033 §2, this changes only where a task appears.
Nothing is written, and nothing counts what was carried.

- One-offs keep moving until done.
- Repeating tasks stop at the end of their week. Next week their count
  starts again, and last week's leftovers don't follow (ADR-0029 §3).
- Tasks with a clock time carry like any other task.
- Events never carry.

**Late work is paid like early work** (Henry, 2026-10-13). A carried
task is paid, on the day you do it, what its planned day would have
paid. That pay sits on top of the day's score and outside the 100 cap,
as early work already is (ADR-0037 §3). A carried task is not added to
the later day's load, so it can't count twice. This is a new uncapped
route, and the AGENTS.md list of uncapped routes gains it.

### 9. Outside windows, one list

Before, after and between windows, on a day without windows, and after
Clear today (ADR-0040), Home shows all open tasks with a sort control:
suggested, due date, size, points or priority. Sorting by points is
display only.

### 10. One Home

The List/Hours toggle and the hour grid go, which supersedes
ADR-0033 §4. Home stacks the day's windows vertically, with the current
one open. Swiping changes the day. A future day opens Plan's day view,
and a past day opens its record. Part of the day stays as a task
preference, so ADR-0024 §3's sections are replaced by windows.

### 11. The weekly pass

This builds the pass ADR-0024 §4 planned. It is offered from a time you
choose (Sunday 6 pm by default) until the week's first window, and has
three steps:

1. last week, as shares of what you did
2. changes to this week's events and hours
3. the windows, with their suggestions to accept, swap or pin

Once a month it adds an optional look at your tiers (ADR-0041).
Skipping the pass is never mentioned.

### 12. None of this changes a score

Windows, pins, suggestions, refilling, carrying forward and sorting
never change what's due or what a day is worth. There are two
exceptions, both things you choose:

- a "Do N of these" choice (ADR-0033 §3)
- the commitment share (ADR-0044), which reads that day's working hours
  as they stood at the start of the day, and the sizes of commitment
  tasks scheduled for that day; pins never count toward it

A test checks that the same day with different pins scores the same.

## Consequences

- **Easier.** The app knows when you're free. The day is planned in a
  way a new user understands. Changing your mind mid-day takes a few
  taps.
- **Harder.** There's new stored data: hours, overrides, pins and
  choices. Suggestions have to be fast enough to work out on every
  open. The ranking will need tuning after real use.
- **Revisit** the 80% fill and the 10-minute buffer after a month of
  use.

**Amends, on acceptance:**

| ADR | What changes |
|---|---|
| ADR-0033 | §1 superseded (windows come from hours, not commitments). §2 amended: carrying stops at the week's end, clock-timed tasks carry, and action item 2's "no label" becomes "Still open". §3 kept as "Do N of these". §4 superseded (no grid). §5 kept (drag; events can't be dragged) |
| ADR-0029 | §3 a missed pinned run is shown again later in the same week, though never counted as owed |
| ADR-0037 | §3 extended: late work is paid like early work |
| ADR-0024 | §3 grouping replaced by windows. §4 weekly pass defined here |
| ADR-0026 | §1 sizes gain hour values, and new tasks default to Normal. §3 fitting is now used, still with no warnings |
| ADR-0036 | A pin is a placement, not a clock time |
| AGENTS.md | The uncapped routes gain late work. The Window entry: clock-timed tasks now carry |

## Action items

1. [ ] Pure functions in `packages/scoring/src/windows.ts`:
       `workWindows`, `currentWindow`, `resolvePlacement`,
       `suggestFill`, and new `SIZE_HOURS`. Tests for EC-01–EC-20 and
       EC-52–EC-56 in the spec.
2. [ ] Schema: `work_block`, `work_day_override`, `window_placement`
       and `window_choice`, copying data across from
       `planned_occurrence`, `pool` and `pool_member`.
3. [ ] Home, Plan, the hours editor and the weekly pass (spec §5).
4. [ ] Remove `DayGrid`, `dayGridLayout`, the `today.layout` setting
       and the old Plan ahead screen.
5. [ ] Amend ADR-0024, 0026, 0029, 0033, 0036 and 0037. Update the
       AGENTS.md vocabulary (Window, Pool) and invariants.
