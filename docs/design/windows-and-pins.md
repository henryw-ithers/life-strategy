# Windows and pins

Every use of windows and pinning, in one place: what each does, the
edge cases, and where it gets built. It gathers ADR-0039, the
[redesign spec](redesign-spec.md) §§3–4 and the decisions Henry made on
2026-10-17, and it is the checklist Phase 4b's engine tests follow.

Where this file and the spec disagree, this file is newer.

## 1. Windows

### 1.1 Where they come from

- **Working hours** are a weekly template, set like iOS Sleep
  schedules: groups of weekdays, each with one or more time ranges. A
  weekday is in at most one group (ADR-0039 §1).
- **A day in no group** has no windows. Its events show and its tasks
  are one list (§4).
- **Before any hours are set**, a day has three default windows (9–12,
  1–5, 6–9) and a banner offering to set hours. Those count as working
  hours for the commitment share (ADR-0044).
- **Past midnight.** A range may end after midnight, up to the 3 am
  rollover, and belongs to the day it starts on. Later ends are refused.
- **Clocks changing.** Windows use wall-clock times. One that spans the
  change is an hour shorter or longer and keeps its times; nothing
  appears twice (EC-03, EC-04).

### 1.2 What's left after events

    windows = working ranges
              − events, each widened by the buffer (10 min) on both sides
              − named gaps
              − pieces under 30 minutes, shown as buffers

- Overlapping events are merged for this, and both still show (EC-09).
- An event that fills a working range removes that window (EC-10).
- An event outside working hours shows at its time and makes no window.
- Windows have no names; they are shown by their times. Only gaps can
  be named ("Lunch"). A day with its own hours ("Just this week") has
  no named gaps.
- Ranges that overlap are joined; ranges that only touch stay two
  windows.

### 1.3 The current window

- The minute a window starts belongs to it, and the minute it ends
  belongs to whatever comes next (EC-06).
- Between midnight and 3 am it is still the previous day; the current
  window is a late range if there is one (EC-07).
- In a gap, Home shows the gap ("Lunch until 1:00") and the next window
  open.
- "Now" is worked out again whenever the app comes back to the front
  (EC-44).

### 1.4 Changing one day's windows

From Home or Plan's day view, for any day from today on:

- **Add** a window, with a start and end. It may be outside working
  hours ("free tonight after all", EC-52).
- **Edit times** or **Remove**, from the window's ••• menu.
- **Repeat** switch: "Repeat every Wednesday" puts the change in the
  weekly template from that date instead of that day only (EC-54).
- **Overlaps an event:** trimmed around the event and its buffer. If
  nothing is left, it isn't saved, and the sheet says so (EC-53).
- **Overlaps another window:** the new one takes the time; the old one
  is shortened, or split if the new one sits inside it. Pieces under
  30 minutes are dropped (EC-55).
- **Removing or shortening** moves the pins that lived there (§2.6).
  Nothing pinned is ever lost (EC-16). Removing a window on Home can be
  undone.
- Edits made ahead of time count in the hours the commitment share
  reads; edits made on the day don't (ADR-0044 §5, EC-56).

### 1.5 Changing the template

Editing working hours asks "Just this week" or "This week and after"
when the week has started. Earlier days keep their hours (EC-15). Pins
on the days that change find their new window by the rule in §2.6.

## 2. Pins

### 2.1 What a pin is

A pin is an option you chose to prioritise in a window. It is not a
promise to finish it there. So:

- A window can hold more pins than it has time for. That is allowed and
  nothing is shown about it: no capacity text, no warning.
- Pins never change what is due or what a day is worth (ADR-0039 §12).
- Moving or removing a pin never brings up a warning.

### 2.2 Two kinds, one icon

| Kind | What it does | Icon |
|---|---|---|
| Window pin | The task sits in that window. If the window ends and it isn't done, the pin is finished and the task carries forward like any open task (§3.4) | Pin, one colour |
| Pinned until done | The task stays pinned and moves with you, window to window and day to day, until it's ticked (§2.9) | Pin, a second colour |

**Tapping the pin icon cycles it:** not pinned → window pin → pinned
until done → not pinned. One tap is enough for the usual case.

- Dragging a task into a window, or Move to…, makes a window pin.
- With VoiceOver, the pin is one button whose value reads "Not pinned",
  "Pinned to this window" or "Pinned until done", and the row's menu
  offers each state directly. Nothing depends on knowing the cycle.

### 2.3 Where you pin from

- **Plan's day view** (and a future day swiped to from Home): tap a
  pin, drag a task into a window, or Accept all.
- **The weekly pass:** accept, swap or pin each window's suggestions.
- **One task across the week** (Henry, 2026-10-17), in the weekly pass
  and from "Plan it…": pick a task, then see the week's windows as a
  grid, a column per day. Tap the windows you want it pinned to, one per
  day; tapping another window on the same day moves it there, and each
  cell cycles like the pin icon (window pin, pinned until done, off).
  "Every week" saves the choice as a repeating pin on those weekdays
  instead of pins for those dates. One step, however many days. Built
  with the weekly pass (Phase 8).
- **The task itself:** "Plan it…" on any task (its sheet, its menu, a
  goal, a commitment) opens a picker of days and that day's windows.
  This is the direct way to put one task in one future window.
- **Home, today:**
  - Moving a task, by drag or Move to…, pins it where you put it.
  - Each window has a "Pin a task" button: a sheet of every open task,
    today's and future ones, with search, sort and size filters. The
    one you pick is pinned into that window.
  - Rows on Home have no pin icon of their own; they stay tick, swap
    and move.

### 2.4 When

- Any day from today on, as far ahead as Plan opens.
- Not on past days. A past day shows only its record (spec §5.2).

### 2.5 Repeating pins

- Every pin is a pin to a window. When pinning, choose "Just this day"
  or a repeat: one weekday ("Every Monday"), several, or every day. A
  repeating pin lands in the window holding its time on each of those
  days, from that date until you remove it. So "Read" pinned to the
  evening window every day is one pin.
- Changing it on one day asks "Just this day" or "This and following",
  as working hours do. "Just this day" leaves the pattern alone.
- Either kind can repeat: a repeating window pin, or a repeating pin
  until done.
- It ends when you remove it, or when the task is archived or deleted,
  or its unit moves to Not now (§2.11).

### 2.6 What a pin holds on to

A pin remembers its day and a time inside that day: the start of the
window it was pinned into (or, for a repeating pin, that time on each
day). Each time the day is drawn, the pin goes to:

1. the window containing that time;
2. else the next window that day;
3. else Other open tasks.

This one rule covers every way a window can change under a pin: hours
edited for the week or from now on, an event added inside the window
(it splits, and the pin stays in the piece holding its time, EC-17), a
window shortened, split or removed (EC-16), or a day edit.

### 2.7 One window per task per day

A task can be ticked once a day, so it sits in one window a day.
Pinning it into another window that day moves it there.

A window pin holds the task in that window and nowhere else. In every
other window it isn't pinned, though it can still be suggested there
like any open task. To have it pinned somewhere else too, pin it there:
for example, pinned to one window a day, every day of the week (Henry,
2026-10-17).

### 2.8 Pins and the week's runs

- A pin shows while the week still owes the task a run.
- **Spare pins step aside quietly.** Gym is 3 times a week and pinned on
  Monday, Wednesday, Friday and Saturday. Once Monday, Wednesday and
  Friday are done, Saturday doesn't show it. The pin is kept and works
  again next week.
- **An extra run on purpose.** Pinning a life task after its week's
  runs are done is a choice to do another, so that pin shows. It pays
  the extra-run rate when done (ADR-0023 §2), as any extra run does.
  Only a pin for one date can be an extra run: it's a fact about that week,
  so a repeating pin never is, and a pin until done isn't carried as
  one.
- A one-off, once done, has nothing left to pin.

### 2.9 After the window

- **Window pin, not done:** the pin is finished. The task carries
  forward like any open task: the next window that fits later that day,
  then the next day, ranked just after what's due (§3.4).
- **Pinned until done, not done:** it moves, still pinned, into the
  next window that day, then the first window of the next day, ahead
  of suggestions, until it's ticked.
- **Where carrying stops** applies to both: a repeating task stops at
  the end of its week (its count starts again, EC-48); a one-off keeps
  going until done.
- **Done somewhere else:** ticking a pinned task in another window, or
  on another day, satisfies the pin. A window pin is used up; a pin
  until done is finished.

### 2.10 Tasks with a clock time

- A timed task goes in the window holding its time. If none does, it
  shows at its time like an event.
- Pinning it into a different window asks: "Move to 4:00 pm" or "Keep
  at 2:00 pm". Moving changes its time for that day only; keeping
  leaves it where its time is.

### 2.11 What pins can't hold, and what removes them

- **Events** aren't pinned or dragged. They happen at their time; you
  can skip one (ADR-0040).
- **Archived or deleted task:** its pins go.
- **Unit moved to Not now:** its tasks are paused and their pins
  removed. Moving it back restores the tasks without the pins (EC-39).
- **Size or schedule changed:** pins stay. A pin is a placement, not a
  schedule (ADR-0036).
- **Removing a pin** by hand offers Undo.

### 2.12 Commitment work

- Commitment tasks can be pinned like any task, including to a day
  they aren't scheduled.
- A pin never counts toward a commitment's share of the day: only work
  scheduled for that day does (ADR-0044 §1).
- Commitment work has no week count, so it has no spare pins and no
  extra runs (ADR-0032 §4). Done on another day it is paid as the
  session it stands for, and a session done early is the next session
  done early (AGENTS.md).

### 2.13 "Do N of these"

From a window's ••• menu, "Any N of these" turns its pins into a
choice: at most 3 tasks, all from one commitment, all worth the same,
the planned count setting the ceiling (ADR-0033 §3). Only you can make
one, and the option appears only when the pins qualify.

### 2.14 Days that change under pins

- **Day off** set on a day with pins: the pins are kept and hidden, and
  come back if the day off is removed (EC-33).
- **Away:** the same, for each Away day.
- **Clear today:** today's windows are set aside. Window pins are
  finished; pins until done stay pinned. Every open task shows in
  today's one list (§4), and what's still unfinished when the day ends
  carries forward, as on any day (ADR-0040 §4). Undo brings the windows
  and pins back.

## 3. Suggestions

### 3.1 What fills a window

Each time Home or Plan opens, never saved:

1. Pins go into their windows (§2.6).
2. A timed task goes in the window holding its time (§2.10).
3. Everything else is ranked: due today; carried forward; linked to an
   active goal; its part of day matches the window; unit tier; your
   order within the unit; oldest first. Points never rank anything.
4. In that order, each task goes into the earliest window with room:
   the window's length times the fill setting (80%), less what's there.
   Pins count toward the room, so a window full of pins takes no
   suggestions.
5. A task that fits nowhere goes to "Doesn't fit today" (EC-12). It can
   still be pinned by hand.

### 3.2 What can be suggested

Today's open tasks: due today, flexible with runs left this week,
one-offs dated today or undated, commitment work scheduled today, and
carried-forward work. Work planned for a later day is not suggested;
you can pin it (ADR-0037 §3). A flexible task is offered every day
until its runs are done.

### 3.3 Showing them

- Every pin in a window shows. Suggestions fill the rest, up to 5 rows
  in all, or as many as fit a short window. More are under "Show all"
  (EC-18), in the same order each time.
- Each suggestion has a one-line reason: "Due today", "Still open ·
  School", "For your goal: Run 30 times", "Fits this hour · Exercise".
- **Swap** (swipe left) brings in the next that fits.
- **Accept all** makes every current suggestion a window pin.
- **Refill:** when the window's shown tasks are done and there's room,
  the next comes in as "Next up". When it's full: "That's this window"
  and "Pull in another".

### 3.4 Carrying forward

Unfinished work moves to the next window that fits, then to the next
day, with "Still open" as its reason. It is never called overdue or
missed. Nothing is saved and nothing counts what was carried. Done
later, it's paid what its original day would have paid, outside the
cap (ADR-0039 §8).

### 3.5 Future days

Plan shows a future day's windows with suggestions worked out as if it
were that day. Flexible runs still owed are spread across the days with
the most room. Pins on that day show as they will.

## 4. Outside windows

Before the first window, after the last, on a day with no windows, and
after Clear today, Home shows one list of every open task, with a sort
you choose: suggested, due date, size, points (display only) or
priority. Events show above it in time order.

## 5. What never changes a score

Windows, pins of either kind, repeating pins, suggestions, refills,
carrying forward and sorting never change what's due or what a day is
worth (ADR-0039 §12). The same day with different pins scores the same
(EC-20). Two things you choose do: a "Do N of these" choice, and the
working hours that size a commitment's share, as they stood when the
day began (ADR-0044 §5, EC-56).

## 6. Every open task, once

On any day, the windows plus Other open tasks hold each open task
exactly once (EC-19). A pin moves a task; it never copies it.

## 7. Where each part is built

| Part | Phase |
|---|---|
| Windows from hours, events, gaps and day edits; the current window; resolving each pin to its window; suggestions and fill; carrying forward; the one-task-once check; the score test | 4b, pure functions in `packages/scoring` |
| Stored hours and day overrides; day edits, in sequence, marked when made on the day itself; pins (`window_placement`: task, one date or a set of weekdays with its dates, the time it holds, kind, whether it's an extra run, order), one live pin per task per day; "Do N of these"; the full EC-20 test, scoring a day assembled with two different sets of pins | 5, the data layer |
| Plan's day view, the weekly pass, "Plan it…", Home's windows and "Pin a task", the pin icon and its menu | 8 and 9, the screens |

**Old pins aren't kept.** A pin for one date is deleted once its day
has ended, unless it's a pin until done still carrying an open task. A
repeating pin keeps only its pattern and its exceptions, never a record
of which days it was kept. Kept
next to completion times, finished pins would let someone work out how
often pins were kept, which is the adherence figure ADR-0029 §3 says
must not be derivable from what's stored.
