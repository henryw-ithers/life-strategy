# Redesign spec: windows, Plan, Home and Life

Draft for Henry's review, 2026-10-12, revised 2026-10-13. None of this
is built. Where it disagrees with an accepted ADR, the ADR stands until
the new ADRs in §9 are written and accepted. The evidence behind it is
in [research-brief.md](research-brief.md), which this spec cites as
P1–P20 (principles), A1–A14 (patterns from other apps) and X1–X12
(things to avoid).

§10 lists the questions raised during review and how each was
answered.

## 0. Summary

You sort the 18 parts of your life into tiers. You add your
commitments (school, a job, a team) and their events (classes,
shifts). You set your working hours the way iOS sets a sleep schedule.
From those, the app works out your **windows**: the free time inside
your working hours, between events. It suggests a few tasks for each
window. You can pin your own choices instead, once a week or whenever
you like. Each day you open Home, see the window you're in and tick
things off. A score out of 100 shows how much of the day's plan you
did.

The core loop is the same five steps as before. Step 1 now uses tiers
and step 4 happens in windows:

1. Diagnose (tiers)
2. Derive (weights)
3. Plan
4. Do (in windows)
5. Review

## 1. Concepts

### 1.1 What a new user learns

Seven ideas, each introduced with one sentence the first time it
appears:

| Concept | What the app says |
|---|---|
| Priorities | "Sort your life into what matters most right now." |
| Unit | "One part of your life, like Exercise or Friendship." |
| Commitment | "Something with set hours: school, a job, a team." |
| Event | "A set time you show up for, like a class or a shift." |
| Task | "Something you do, once or on repeat." |
| Working hours | "When you're free to get things done." |
| Window | "Free time inside your working hours, between events." |

Goals (§5.6), activities ("+ Log something", §5.1) and sub-commitments
(§5.5) stay out of sight until someone goes looking.

### 1.2 How the pieces fit

    WHAT you do                            WHEN you do it
    ───────────                            ──────────────
    Area (colour and grouping only)        Working hours (weekly template)
     └ Unit: tier → weight                  − events
        ├ Goal (optional, measurable)       − buffers and gaps
        │  └ linked tasks                   = windows, per day
        └ Task (size, how often)               └ tasks in them, pinned
    Commitment (up to 3): its own share          by you or suggested
     ├ Sub-commitment (optional)
     │  ├ Event (fixed time)
     │  └ Task
     ├ Event
     └ Task

The two sides connect in two places: tasks go into windows, and events
cut windows up.

Points come from the left side. The right side decides where things
show up, not what they're worth. There are three exceptions, all of
them things you choose:

- "Do N of these" choices on a window (§4.4), which keep ADR-0033 §3's
  ceiling rule.
- Day-level changes: skipping an event, Clear today, Away.
- Your working hours on a given day, which set the size of the
  commitment share (§5.5).

Pins, suggestions and window positions never change a score. A test
checks this (INV-1).

### 1.3 Renamed or removed

| Before | After | Notes |
|---|---|---|
| Diagnostic (rank and rate) | Priorities (tiers) | Satisfaction is no longer asked. Old ratings stay in the database |
| Portfolio graph | Removed | Life shows where your effort went instead (§5.4) |
| Pool | "Do N of these" on a window | Same scoring rule as ADR-0033 §3 |
| Goal conditions | Removed | A goal links to tasks directly |
| Parts of the day as plan slots | Windows | Morning/afternoon/evening stays as a task preference |
| List / Hours toggle | Removed | Home has one layout |
| Event location | Removed | Column dropped |
| Rest period | Gap | "Rest day" keeps its ADR-0037 meaning |

## 2. Navigation and look

### 2.1 Tabs

Four tabs in the native iOS 26 tab bar:

| Tab | SF Symbol | Question it answers |
|---|---|---|
| Home | `sun.max` | What should I do now? |
| Plan | `calendar` | Is my week set up? |
| Life | `square.grid.2x2` | What am I working on, and does it match my priorities? |
| Log | `book.closed` | What happened? |

The tab bar shrinks when you scroll on Home and Log. Settings opens
from a toolbar button on Home and Life rather than from a tab, since
Apple's guidelines keep tabs for navigation. A `+` button in the
toolbar on Home, Plan and Life opens a menu: Task, Event, Window, Log
something, and Goal on Life.

### 2.2 System parts

The app uses native components wherever iOS has one: the tab bar, nav
bars with large titles, form sheets with detents and a grabber,
context menus, alerts and compact date pickers. Liquid Glass appears
on those controls only. Cards, rows and the score are plain surfaces.
The bubble backdrop sits behind everything, with fewer bubbles near
the top so the tab bar and nav bar have little to blur at rest.

Anything you can do with a long press can also be done from a •••
button or a swipe. Deleting something shows an Undo toast. A
confirmation dialog appears only when the loss can't be undone, such
as erasing all data or deleting a commitment that has history.

### 2.3 Visual style

Prism was chosen on 2026-10-13. It works in light and dark mode:

- system backgrounds (white and light grey in light mode, black and
  dark grey in dark mode)
- colour comes from units: each checkbox and event bar uses its unit's
  colour
- buttons and highlights use the label colour, black in light mode
  and white in dark mode
- SF for all text
- the bubble backdrop is kept from the old design

Two other directions were considered. Paper used a warm off-white
background, near-black text and rounded numerals. Atlas used cool
greys and a serif for titles.

Some rules hold regardless of style. Text must reach 4.5:1 contrast in
light mode, dark mode and Increase Contrast. Any custom font has to
support Dynamic Type up to 200%. The app icon is a layered Icon
Composer icon built from the bubbles.

Units and commitments take their colour from a palette of 12. Each
colour has light, dark and fill versions, all checked for contrast.
The six area colours are among the 12, and a unit without its own
colour uses its area's. Colour never affects weight, rank or order
(ADR-0021).

## 3. Time

### 3.1 Working hours

Working hours are set like iOS Sleep schedules. A schedule is a set of
weekdays plus one or more time ranges:

    Weekdays   M T W T F · ·    8:30 am – 6:00 pm
    Weekends   · · · · · S S    10:00 am – 2:00 pm
    + Add schedule

Each weekday can be in only one schedule. Days already taken are
greyed out, as in iOS. A schedule can have more than one range, so
someone who works afternoons at a job can mark only their mornings and
evenings. A day in no schedule has no windows. Its events still show,
and its tasks appear in one list (§4.6).

A range can run past midnight, up to the 3 am rollover. It counts as
part of the day it started on.

The template repeats every week until you change it. When you edit it,
the app asks once: "Just this week" or "This week and after". "Just
this week" saves overrides for those dates. "This week and after"
starts a new version of the template from that date, so earlier days
keep the hours they had.

### 3.2 Windows for a day

    windows = working ranges
              − events, each widened by 10 minutes on both sides
              − named gaps
              − anything under 30 minutes, which shows as a buffer

Events outside working hours still show at their time but don't make a
window. Overlapping events are merged for this calculation and both
still show. An event longer than a working range removes that range.
A day with no working hours and no events shows the single list from
§4.6.

Before onboarding has set any hours, a day uses three default windows
(9–12, 1–5 and 6–9) and Home shows a banner offering to set hours.
Once dismissed, the banner doesn't come back; the setting stays in
Settings → Schedule (ADR-0008).

### 3.3 Gaps

The time between two windows is a gap. You don't need to create gaps:
an empty stretch from 12:00 to 1:00 simply isn't a window. You can
name one ("Lunch") in the hours editor, and the name repeats with the
template. When you draw ranges by hand, the editor leaves 15 minutes
between them. Gaps and buffers are drawn as a thin line with a small
label ("· lunch ·", "· 10 min ·"), not as a full row (P3).

### 3.4 Buffer settings

In Settings → Schedule:

| Setting | Default | Range |
|---|---|---|
| Space around events | 10 min | 0–30 |
| Gap when drawing ranges | 15 min | 0–30 |
| Fill windows to | 80% | 60–100 |

### 3.5 Changing one day's windows

You can add, change or remove a window for a single day from Home or
from Plan's day view. Say you decide at lunch to go to the library
from 8 to 10 pm:

1. Tap `+` → Window, or "+ Add window" at the bottom of the day.
2. Set the start and end time.
3. Save. The window appears in the day and fills with suggestions.
   Anything you pin into it stays there.

Windows have no names. A window is a time slot and is shown by its
times ("8:00–10:00 pm"). Only gaps can be named (§3.3).

To change or remove a window, open its ••• menu: Edit times or
Remove. Changes from Home apply to that day only. The edit sheet has a
"Repeat every Wednesday" switch that adds the change to the weekly
template instead.

How day edits behave:

- A day edit is stored as an override for that date (§3.1). The weekly
  template doesn't change unless you turn on the repeat switch.
- An added window can be outside your working hours. That's the point:
  "I'm free tonight after all."
- If an added window overlaps an event, the window is trimmed around
  the event, with the usual buffer. If nothing is left, the sheet says
  so and doesn't save.
- If it overlaps another window, the new window takes that time. The
  old one is shortened, or split in two if the new one sits inside it.
  Pieces under 30 minutes are dropped and their tasks move as below.
- Removing or shortening a window moves its pinned tasks to the next
  window that day, or to Other open tasks. Pins are never lost (EC-16).
- A removed window on Home can be restored with Undo.

## 4. Tasks in windows

### 4.1 Sizes

| Size | Label | Hours used for fitting and time goals |
|---|---|---|
| quick | Quick · under 30 min | 0.5 |
| normal | Normal · about an hour | 1 |
| big | Big · 2 h or more | 2 |

New tasks start as Normal, and the default can be changed in Settings.
Older tasks with no size count as Normal. Saving a Big task offers to
break it into smaller steps (P5).

### 4.2 Which tasks can go in a window

A window draws from today's open tasks, the same set `loadDay` builds
now:

- tasks due today
- flexible tasks with runs left this week
- one-offs dated today or undated
- commitment tasks scheduled today
- unfinished tasks carried forward (§4.5)

Windows only arrange this set. Everything in it shows up exactly once,
either in a window or in Other open tasks (INV-2).

Work planned for a later day is not suggested. It stays in "Planned
for other days" (ADR-0037 §3), and you can pin it into a window
yourself. Doing work early is paid early and uncapped, so it should be
your decision.

### 4.3 How suggestions are made

Suggestions are worked out each time Home or Plan opens and are never
saved. For each day:

1. Pinned tasks go in their windows.
2. A task with a clock time goes in the window that contains that
   time. If no window does, it shows at its time in the day, like an
   event.
3. Everything else is ranked:
   1. due today (pinned to today, every day, or a one-off due by today)
   2. carried forward from an earlier window or day
   3. linked to an active goal
   4. its preferred part of the day matches the window
   5. unit tier, Top first
   6. your order within the unit
   7. oldest first

   Settings → Task defaults → "Suggest tasks by" can put due date or
   priority first instead. Points are never used to rank (ADR-0033):
   the score shouldn't decide what you do.
4. In ranked order, each task goes into the earliest window with room
   for its size. Room is the window's length times the fill setting
   (80%), minus what's already there. A task that fits nowhere goes to
   "Doesn't fit today" (EC-12).
5. A flexible task, such as gym 3 times a week on any days, is offered
   every day until its runs for the week are done, matching how the
   score treats flexible work (ADR-0029). For future days, the Plan
   preview spreads the remaining runs across the days with the most
   room.
6. A window shows up to 5 tasks, and a short window only as many as
   fit (P6). The rest are under "Show all".

Each suggested row has a short reason underneath (P11): "Fits this
hour · Exercise", "Due today", "Still open · School", "For your goal:
Run 30 times". A pinned row shows a pin.

### 4.4 Pinning

Pinning is part of planning, so it happens in planning views: Plan's
day view (also reached by swiping Home to a future day), the weekly
pass, and the list of all open tasks ("Add from open"), which you can
open from anywhere.

On Home, today's windows are for getting things done, so their rows
have no pin button. From Home you can tick a task, swap it (swipe
left), move it (context menu → Move to…), or open "Add from open" to
pin something new into the window.

In the planning views you can:

- **Accept all** to pin every current suggestion. You don't have to;
  suggestions keep working either way.
- **Pin** a task by tapping its pin or dragging it.
- **Swap** a suggestion (swipe left). The next task that fits takes its
  place (A3).
- **Add from open**: a sheet of every open task with search, sort and
  size filters. The one you pick is pinned to the window.
- **Move** a task to another window or day by dragging it, or with
  Move to…, which also works with VoiceOver.
- **Remove** a task from a window. It goes back to open, with Undo.
- **Do N of these**: in the window's ••• menu, "Any N of these" turns
  its pinned tasks into a choice. This is the old pool and keeps its
  rules: at most 3 tasks, all from one commitment, all worth the same,
  with the planned count setting the ceiling (ADR-0033 §3). Only you
  can create one. The option only appears when the pinned tasks
  qualify.

The app never moves a task you pinned, and moving a task never brings
up a warning (X1, X2).

### 4.5 Refilling and carrying forward

**Refilling.** When you've ticked everything showing in the current
window and there's room left, the next ranked task slides in, labelled
"Next up". This repeats until the window is full. Then the window says
"That's this window" with a "Pull in another" button.

**Carrying forward** (decided 2026-10-13). A task that isn't done when
its window or day ends, or on a day you clear, moves on:

- Later the same day, it goes into the next window that fits, or into
  Other open tasks if none does.
- On the next day, it goes into the first window that fits, ranked
  just after what's due that day. It keeps moving forward until it's
  done.
- Its reason line says "Still open · Exercise". The app never calls it
  overdue, missed or late.
- A finished window collapses to what was done: "✓ 2 done".

A carried task is paid on the day you do it, at what its original day
would have paid, uncapped (ADR-0037 §3, ADR-0032 §4). Carrying is only
about where the task appears. Nothing is saved, the original day's
grade doesn't change, and nothing counts how much was carried
(ADR-0033 §2, P7, P8).

Where carrying stops:

- One-offs keep moving until they're done, archived or rescheduled.
  Their due date stays the same.
- Repeating tasks move forward until the end of the week. A task meant
  to happen 3 times a week starts at 0 of 3 again next week, and last
  week's leftovers don't follow it (ADR-0029 §3).
- Events don't carry. They happen at a set time.

A pin holds a task in its window while that window is current or
upcoming. After that, a pinned task moves like any other.

### 4.6 Outside windows

Before your hours start, after they end, in a gap, on a day with no
windows, or after Clear today, Home shows one list of all open tasks
with a sort control. The app remembers your sort.

| Sort | Order |
|---|---|
| Suggested (default) | The ranking from §4.3 |
| Due date | Due today, then by due date, then undated |
| Size | Quick first |
| Points | Most points today first. For display only; suggestions never use it |
| Priority | By unit tier |

Events still show above the list in time order.

### 4.7 Day types and hard days

| Day | How it happens | Windows | Events | Graded |
|---|---|---|---|---|
| Normal | Default | From the template | Shown | Yes |
| Rest day | Automatic when nothing is due (ADR-0037) | Shown | None due | 70 plus activities |
| Special | You set it, before or after | Shown | Shown | Yes, with the special-day bonus |
| Day off | You set it, before or after | Hidden | Hidden | No |
| Cleared | Home ••• → Clear today | Hidden | Skipped | Yes |
| Away | Settings → Time away | Hidden | Not due | No |

**Clear today.** Home ••• → Clear today opens a sheet:

> **Clear today?**
> Today's windows and remaining events are set aside. Your open tasks
> show in one list.
> [Clear today] [Make it a day off instead] [Cancel]

After clearing, Home shows "Today's cleared. Undo" and nothing else
about it. Undo works until the day ends. The next day starts as
normal.

What clearing does:

- Events you haven't ticked are skipped for today, the same as "Skip
  this one".
- Tasks, life and commitment alike, carry forward to tomorrow (§4.5).
  If you do them tomorrow, they're paid what today would have paid.
- Commitment work you already ticked today keeps its share and its
  points. If none was ticked, there's no commitment share today.
- Life work due today is still due, and the day is graded as a normal
  day.
- If nothing is left due, the day becomes an automatic rest day (70)
  under ADR-0037 (EC-29).
- A cleared day still counts as one of the days the week's flexible
  work is spread across.
- The words "cleared", "sick" and "bad day" don't appear in the app.

**Away.** Settings → Time away → Add, with a start date, end date and
optional label ("Japan"). Away days have no windows, no events due and
no weekly pass card, and they aren't graded. Flexible work is spread
over the days you're not away, as with a day off. Home shows "Away ·
Japan · back Thursday", and Log something and the evening card still
work.

**Changing shifts.** Plan's day view and the weekly pass both have
"Copy last week's events". You copy, then adjust the times. For anyone
who picked the shift-work template in onboarding, new events default
to not repeating.

## 5. Screens

The wireframes show layout only; the prototype shows the look. `▢` is
an open task, `✓` a done one, `━` an event and `· ·` a gap or buffer.

### 5.1 Home

Home is a vertical scroll that jumps to the current window when you
open the app.

     Today                                    ⋯   +
     Wed 15 Oct                               62
     ─────────────────────────────────────────────
      8:30–10:50                    ✓ 3 done   ›    (past, collapsed)
     ━ 11:00–12:30  COMP2521 lecture
       · 10 min ·
     ┌ NOW · 12:40–4:00 ────────────── 2 h 40 left ┐
     │ ▢ Essay intro                    Normal   ⇄ │
     │   Due today                                 │
     │ ▢ Laundry                         Quick   ⇄ │
     │   Still open · Living space                 │
     │ ▢ Email tutor                     Quick   ⇄ │
     │   Fits this hour · School                   │
     │                  Show all (5) · Add from open │
     └─────────────────────────────────────────────┘
       · 10 min ·
     ━ 4:10–6:00  Shift · Café job
      6:10–9:30                     3 tasks    ›    (later, collapsed)
     ─────────────────────────────────────────────
     ▸ Other open tasks (9)
     ＋ Log something
     ┌ How was today? ─────────────────────────────┐   (evenings)
     │ Note · Photo · ☆ Remember     Day type ⋯   │
     └─────────────────────────────────────────────┘

Details:

- The scroll jumps to the current window when the app opens or comes
  back to the front. It doesn't move while you're using it.
- Only the current window starts open. Past windows collapse to
  "✓ N done", or to just their times if nothing was done. Later ones
  collapse to "N tasks". Tap a header to open or close it.
- Events sit between windows with their times. Tap to tick. A long
  press offers Edit, Skip this one and Skip this week.
- "2 h 40 left" is the time until the window ends, in plain text.
- Each window's ••• menu has Edit times and Remove (§3.5).
- The score sits in the header with a ring that fills as the day goes.
  Tap it for the breakdown. With Settings → Home → Show score off, the
  number is hidden and the ring stays. It is never shown in red (P8).
- Other open tasks starts closed and loads when opened, as
  `loadPlannedAhead` does now. It has three groups: Doesn't fit today,
  More for today (tasks ranked below what the windows show), and
  Planned for other days.
- Log something opens the activity sheet.
- The evening card has a note, a photo, a ☆ flag and the day type. It
  appears an hour before your last window ends, or at 6 pm on a day
  with no windows. The time can be changed in Settings.
- The `+` menu has Task, Event, Window and Log something. The `⋯` menu
  has Clear today, Day type, Plan this week and Settings.

| Situation | Home shows |
|---|---|
| Before the first window | "First window at 8:30", that window open, then all open tasks |
| In a gap | The gap ("Lunch until 1:00") and the next window open |
| After the last window | The evening card, then all open tasks |
| No windows today | Events in time order, then all open tasks |
| Cleared | "Today's cleared. Undo", then all open tasks |
| Away | The away card, Log something, the evening card |
| Rest day | "Nothing's due today." Planned for other days stays closed (ADR-0037). Score 70 |
| New user, nothing added | One window with three starter tasks from the library, each added with one tap (A7) |
| Window finished | "That's this window" and "Pull in another". No confetti for doing planned work |

**Weekly pass card.** From the time you choose (Sunday 6 pm by
default) until the week's first window, a card sits above the
windows: "Plan next week · about 5 min" with Start and Not now. Not
now hides it until the next week (P15).

### 5.2 Other days

On Home, swiping left or right changes the day. A Today button in the
toolbar brings you back. The week strip is on Plan only.

**A future day** opens the same day view as Plan, in a compact form.
You can see the suggestions, pin and swap tasks, drag them between
windows, add, edit or remove windows, add a one-off, skip an event
once, and set the day type (Special or Day off).

**A past day** opens its record:

     Mon 13 Oct                                 74
     ─────────────────────────────────────────────
     Done
     ✓ Essay outline     ✓ Gym     ✓ COMP2521 lecture
     ＋ Add something you did that day
     ─────────────────────────────────────────────
     Note · Photos · ☆ · Day type
     ▸ Activities (1)

The record shows no windows, since they don't matter after the fact.
It lists only what you did. It never lists what wasn't done, and that
includes events you didn't tick (ADR-0038). "Add something you did
that day" opens a picker of that day's tasks and events so you can
record something you forgot. You can change ticks for 14 days
(`editWindowDays`). After that the day is read-only, apart from the
journal (ADR-0002 amendment). The day type can be changed later.

### 5.3 Plan

A week strip runs across the top: Monday to Sunday, today marked,
swipe for other weeks. A dot marks days with pins, and a line marks
Special days, days off and Away days. Below it is the chosen day:

     ‹  Week of 13 Oct  ›                 Hours  ⋯
      M   T  [W]  T   F   S   S
     ─────────────────────────────────────────────
     Wednesday · 3 windows · about 6 h free
     ┌ 8:30–10:50 ─────────────── 1.5 of 2.3 h ─┐
     │ 📌 Lab report                       Big   │
     │ ▢  Email tutor                    Quick   │  (suggested)
     │ + Add from open (12)    Accept all  ⋯     │
     └───────────────────────────────────────────┘
     ━ 11:00–12:30  COMP2521 lecture        ⋯
       · lunch ·
     ┌ 1:15–4:00 ...                              ┐
     ─────────────────────────────────────────────
     + Add window
     Day type: Normal ›     Copy last week's events ›

"Hours" opens the working-hours editor. The `⋯` menu has Plan this
week, Copy last week's events and Time away. "About 6 h free" adds up
the day's windows. Each window shows a plain bar of how much is
planned in it. There are no warnings about load (P3, ADR-0026 §3).

#### 5.3.1 Working-hours editor

     Working hours                              Done
     ─────────────────────────────────────────────
     ┌ Weekdays ─────────────────────────────────┐
     │ (M)(T)(W)(T)(F) ( )( )                    │
     │ 8:30 am  ───────────────  6:00 pm         │
     │ + Add another time range                  │
     └───────────────────────────────────────────┘
     ┌ Weekends ─────────────────────────────────┐
     │ ( )( )( )( )( )(S)(S)                     │
     │ 10:00 am ───────────────  2:00 pm         │
     └───────────────────────────────────────────┘
     + Add schedule
     ─────────────────────────────────────────────
     Gaps
       Lunch · weekdays 12:00–1:00          ›
       + Name a gap
     ─────────────────────────────────────────────
     Preview: Wednesday
     [8:30 ███ 11 ━━ 12:30 ██ 4:10 ━━━ 6 ███ 9:30]

Day buttons work as in iOS Sleep: a day used by another schedule is
greyed out. Ranges have two handles. Ranges in one schedule can't
overlap, and a dragged handle stops 15 minutes short of the next
range. The preview shows the chosen day's windows with that week's
events and updates as you drag. If the current week has already
started, Done asks "Just this week" or "This week and after";
otherwise it saves from now on.

#### 5.3.2 Weekly pass

Three steps in a full-screen sheet, about five minutes in total.
Finish works at any step.

1. **Last week.** "Here's where last week went." Each unit's share of
   everything you completed, as a bar with no target. Below that, days
   you flagged ☆, goals that moved, and how many activities you logged.
   No missed counts, no percentages of the plan, no comparison with the
   week before.
2. **Anything different this week?** This week's events, each with a
   switch to turn it off for this week and a way to edit it. Then:
   Copy last week's events, Change hours this week, Add a one-off,
   Time away.
3. **Your windows.** One card per day with its windows and their
   suggestions. Accept all, swap, pin, add from open, and add or remove
   windows. A line explains: "Anything you don't pin is still
   suggested. This just locks in your picks."

The first pass of each month has an optional extra step before step
1: "Still happy with your tiers?", which opens Priorities. Skipping it
changes nothing.

If you skip the pass, suggestions cover the week and nothing mentions
it (P15). The card comes back the next week.

### 5.4 Life

Life is a list. Each row opens its own screen and has a context menu.

     Life                                       ＋
     ─────────────────────────────────────────────
     Commitments
       ● School         4 events/wk · 6 tasks    ›
       ● Café job       shifts, week by week      ›
       + Add a commitment (1 more)
     Goals
       ● Run 30 times by December   18 / 30       ›
       + Add a goal
     Your units                     Priorities ›
       Top
        ● Exercise & fitness   4 tasks    ▇▇▇▁
        ● Learning & growth    2 tasks    ▇▇▁▁
       Important
        ...
       Background, Not now (collapsed)

The bars show each unit's share of everything you completed in the
last 4 weeks. They aren't drawn against a target: weights live on the
Priorities screen, so a bar can't read as falling short. The caption
says "Where your time went".

#### 5.4.1 Priorities

     Priorities                                Done
     ─────────────────────────────────────────────
     Drag your units into tiers. Order inside a
     tier fine-tunes it.
     TOP ──────────────────────── about 10% each*
      ≡ Exercise & fitness
      ≡ Learning & growth
     IMPORTANT ──────────────────────────────────
      ≡ Friendship  ≡ Sleep & recovery  ...
     BACKGROUND ─────────────────────────────────
      ...
     NOT NOW ─────────────────── 0% · holds no tasks
      ...
     * Recommended. Tap a unit to set your own.

You drag units between tiers and within them. With VoiceOver, the
context menu has Move to tier and Move up/down.

Not now means out of the plan (decided 2026-10-13): no weight, no
tasks, no points. It's the existing "Not in my plan" switch (ADR-0027
§2, `include_in_scoring = false`) shown as a tier. Moving a unit that
has tasks into Not now asks first:

> **Move Exercise to Not now?**
> Its 4 tasks will be paused. They come back if you move it up again.
> [Pause tasks and move] [Cancel]

Paused tasks are archived with a marker so they can be restored. A Not
now unit can't take new tasks. The unit picker shows it greyed out
with "Move it up to add tasks", and title suggestions, the idea
library and onboarding skip it.

Weights come from the tiers (§8.2). Each unit shows its recommended
weight, and an override is shown next to the recommended value
(AGENTS.md). Weights always add up to 100. Commitments aren't on this
screen because they have their own share of the day (§5.5). Saving
keeps a snapshot, as the diagnostic does now.

#### 5.4.2 Unit screen

The header shows the unit's colour, name, tier and weight. Only custom
units can be renamed. Below that: its tasks in your order (drag to
reorder, which sets how the unit's weight is split, as now), its
goals, "Need ideas?", colour, and the existing information about the
unit.

### 5.5 Commitment screen

     ‹ Life         School                    ⋯
     ─────────────────────────────────────────────
     This week: 4 events · 6 tasks
     Share of your day: auto (about 44% on Wednesdays) ›
     ─────────────────────────────────────────────
     COMP2521                                    ›
     COMP1531                                    ›
     + Add a course
     ─────────────────────────────────────────────
     Events
       ━ Lecture · Mon, Wed 11–12:30 · 12 weeks  ›
       ━ Tutorial · Thu 12–1 · 10 weeks          ›
     Tasks
       ▢ Lab report · Big · due Fri
     ─────────────────────────────────────────────
     Skip a week… · Colour · Delete

Tap the title to rename it. Rename is also in the ••• menu.

There's no switch for sub-commitments. Adding the first one splits
the commitment, and its existing events and tasks move into a
sub-commitment called "General", which you can rename. Removing the
last one puts everything back (ADR-0035, as amended).

**The commitment's share of the day** (decided 2026-10-13).
Commitment tasks and events are scored from the commitment's own pool
of points, separate from the 100 points shared by your 18 units. That
pool is a share of each day the commitment has work on. By default
the app works it out from your own day:

    commitment time = its events today (hours)
                    + its tasks scheduled today (0.5, 1 or 2 h each, by size)
    your day        = today's working hours
                    + any event time outside them
    share           = commitment time ÷ your day

Example: with 8 working hours, a 1.5-hour lecture and two Normal
School tasks, School's share is (1.5 + 2) ÷ 8, about 44%. The rest of
the day, 56%, is scored the usual way.

You can override this. Tap the row and set a fixed share, say 60% for
School, and the auto value stays visible next to yours. The override
applies to every day the commitment has work on, and weekly and
monthly scores are made of those days, as now.

Other rules:

- With more than one commitment on a day, the shares are added up and
  limited to 10% at least and `commitmentBandMax` at most (60, 70 or
  80% for one, two or three commitments). Each keeps its proportion
  inside that.
- On a day with commitment work but no working hours, the share is
  the maximum.
- Within its share, each commitment pays for the share of that day's
  commitment work you did, as now. Size changes how big the share is,
  not how much one task is worth against another.
- A day's share is set from the hours as they stood when the day
  began. Adding, moving or removing a window during the day changes
  where tasks go but not the share (EC-56).
- The share is then fixed when the day's grade settles, so a later
  "This week and after" edit doesn't rescore past days (EC-50).

**Skip a week…** shows the next 26 weeks. Tapping one skips every
event of this commitment that week, including events added later.
Weeks that have started can't be skipped (EC-25).

### 5.6 Goals

Goals are optional. Each one has to be built on something the app can
count:

| Type | Example | Counted from |
|---|---|---|
| Times done | Run 30 times by December | Ticks on the linked tasks |
| Time spent | 40 h of study this term | Each tick's size, or the time you entered when ticking (§5.7) |
| Points earned | Earn 300 Exercise points this term | A running total of points earned in the unit, never a percentage of the points on offer |
| Streak | Meditate every day | Days in a row, using the existing `streak.ts` (ADR-0004 §5) |

For a Times, Time or Points goal you then choose a target, an optional
end date, the unit or commitment, and which tasks count (existing
ones, new ones, or every task in the unit).

Streak goals follow the existing streak rules:

- Only every-day tasks can have one. A task done 3 times a week has no
  days in a row, and counting weeks in a row would compare what you did
  with what you planned.
- One missed day ends the run. Days off and Away days are skipped, and
  an unfinished today doesn't count as missed.
- There's no target and nothing to complete. The 7, 30 and 66-day marks
  are celebrated when you reach them.
- The copy rules in the [copy guide](copy-guide.md) apply: nothing is
  said when a run ends, a past best is never shown next to a shorter
  current run, and nothing shows under 7 days.

Other goal rules:

- Progress is a running total, like "18 / 30 runs".
- There's no "on pace" line, because it shows when you're behind
  without saying so (ADR-0008, INV-4).
- Reaching a target is an achievement. It appears in the monthly
  summary, not the daily grade.
- An active goal moves its tasks up slightly in suggestions (§4.3).
- Goals can be paused, finished early or revised (ADR-0007).
- Goal conditions are retired. Their tasks become the goal's linked
  tasks, and their text is added to the goal's notes.

### 5.7 New and edit task

A native sheet. The half-height view has the common fields; pulling it
up shows the rest.

     New task                          Cancel  Add
     ─────────────────────────────────────────────
     [ Go for a run                            ]
     Exercise & fitness ✎        (suggested from the title)
     Size   ( Quick )( Normal● )( Big )
     How often  ( Once )( Repeats● )
       3 a week  − +     Days: any ›
     ▸ More: time of day · clock time · due date ·
             goal · part credit · notes

The unit is guessed from words in the title, on the device. If there's
no good match, the chip says "Choose a unit". The three relationship
units are ordinary units since ADR-0027 §4, so "dinner with mum" can
suggest Family. AGENTS.md still describes them the old way; that gets
fixed with the ADRs. A clock time stays optional (ADR-0036). A task
with one goes in the window containing that time.

Tap a task to tick it. A long press on a done task opens a menu with
"Took about…" (P4) and the existing tagging (ADR-0025 §4). "Took
about…" records the real time, which only time goals use. It doesn't
change points.

### 5.8 New and edit event

     New event                          Cancel  Add
     ─────────────────────────────────────────────
     [ COMP2521 lecture                        ]
     School › COMP2521 ✎
     Starts 11:00   Ends 12:30        (compact pickers)
     Repeats  ( Once )( Weekly● )
       Days  M [W] ...
       For  ( 12 weeks● | Until a date | No end )
       Skip weeks ›   (week 7 skipped)
     Notes

The time pickers are native and open in place. They stay open until
you tap somewhere else. Skip weeks lists the series' weeks with a
switch for each. There's no location field.

Editing a repeating event asks "This event only", "This and
following" or "All events" (as in Things, A9). "This event only" saves
an exception for that date. "This and following" ends the series and
starts a new one. To skip a single occurrence, long-press the event
and choose Skip this one.

### 5.8a Keyboard

On every text field:

- Sheets keep their height when the keyboard opens, and the field
  you're typing in scrolls into view.
- A bar above the keyboard has ⌄ on the right to hide it, and ‹ › to
  move between fields where that helps.
- Return works as normal: Done or Next on one-line fields, a new line
  in notes.

### 5.9 Log

A month calendar with grades. Days you flagged, photos and notes come
first. Each day opens its record (§5.2). Future days can be marked
Special or Day off. Weekly and monthly summaries include goal
achievements. The weekly contentment question stays (ADR-0008).

### 5.10 Settings

| Section | Contains |
|---|---|
| Schedule | Working hours · Space around events · Gap when drawing · Fill windows to · Week starts on · Day rolls over at |
| Home | Show score · Show done tasks · Show other days' tasks · Evening card time · Section order |
| Look | Light or dark · Unit colours · Density · App icon |
| Task defaults | Default size · Default time of day · Suggest tasks by |
| Weekly pass | Day and time · On or off |
| Notifications | All off by default: window start, morning summary, weekly pass, weekly check-in. None of them mention anything you didn't do |
| Time away | |
| Clear today | Also in Home's ⋯ menu |
| Data | Backup · Restore · Export · Erase |
| About | Privacy · Feedback · Support resources |

### 5.11 Onboarding

Seven short screens. Everything after Priorities can be skipped, and
running onboarding again from Settings deletes nothing.

1. Welcome: "Plan your week around what matters, and the time you
   actually have." One button.
2. Priorities: drag the 18 units into four tiers, starting from a
   suggested sort. About 30 seconds. "Rough is fine. You can change it
   any time."
3. Commitments: "Anything with set hours?" Pick Student, 9–5 job,
   Shift work or Nothing fixed. Add up to 3 commitments with their
   events (weekly, for 12 weeks, by default). The choice also fills in
   step 4.
4. Working hours: the editor from §5.3.1, filled in from step 3, with
   a preview of this week's windows.
5. A few tasks: for each Top unit, 2 or 3 starter tasks to tap, plus
   "Add your own". Nothing is selected for you.
6. Your first week: "This is a suggestion. Pin what you like; the rest
   adjusts as you go."
7. Notifications: an optional morning summary, explained before the
   system prompt. Then Home, at the current window.

The goal is a working Home in under 3 minutes.

## 6. Copy rules

These add to the [copy guide](copy-guide.md).

- Words to use: window, gap, open, done, later, doesn't fit today,
  still open.
- Words not to use: missed, overdue, late, behind, failed, catch up,
  streak broken, on pace, behind pace, and "skipped" about a person
  (it's fine about an event).
- Moving tasks happens without a message. No "3 tasks rescheduled".
- Reasons state facts: "Fits this hour", not "Perfect for you".
- Free time and planned time are stated as amounts ("about 6 h free",
  "2.5 h planned") and never compared with what you did.
- Clear today and Away are ordinary options. The app never says
  "sick mode" or "bad day", and never tells someone who cleared their
  day that it "still counts".

## 7. Edge cases

Each case has a decided behaviour and a test: U for a unit test in
`packages/scoring`, D for a data-layer test, M for a manual check on
the phone.

### Time and calendar

| ID | Case | Behaviour | Test |
|---|---|---|---|
| EC-01 | Working hours end after midnight (8 pm–1 am) | Part of the start day. Allowed up to 3 am; later ends are refused | U |
| EC-02 | An event from 11:30 pm to 12:30 am | Refused, as now (`eventProblem`), with a suggestion to split it | U |
| EC-03 | Clocks go forward (2 am missing) | Windows use wall-clock times. One that spans the change is an hour shorter but keeps its label | U (with `TZ`) |
| EC-04 | Clocks go back | As EC-03. Nothing appears twice | U |
| EC-05 | Travelling across time zones | The day follows the phone's local date (`lib/calendar.ts`). Windows stay at local times | M |
| EC-06 | Opening the app exactly at a window boundary | The boundary minute belongs to the next window | U |
| EC-07 | Between midnight and 3 am | Still the previous day. The current window is a late range if there is one | U |
| EC-08 | Week start changed mid-week | Applies from the next week | D |

### Windows and events

| ID | Case | Behaviour | Test |
|---|---|---|---|
| EC-09 | Overlapping events | Merged when building windows. Both shown and both can be ticked | U |
| EC-10 | An event fills a whole working range | No window there | U |
| EC-11 | Buffers leave under 30 minutes | Shown as a buffer, not a window | U |
| EC-12 | A task bigger than every window | Under "Doesn't fit today". It can still be pinned by hand | U |
| EC-13 | No hours set yet | Three default windows and a banner to set hours | U |
| EC-14 | A day in no schedule | No windows. Events and all open tasks listed | U |
| EC-15 | "This week and after" edit mid-week | Earlier days keep the old hours | D |
| EC-16 | A window with pins is removed or shortened | Pins move to the next window that day, or to Other open tasks. Never lost | D |
| EC-17 | An event added inside a window with pins | The window splits. Each pin stays in the piece containing its spot, or the next piece | U |
| EC-18 | 40 tasks fit in one window | Shows 5 and "Show all (40)". Order stays the same between opens | U |
| EC-19 | Every open task accounted for | Windows plus Other open tasks contain each open task exactly once | U |
| EC-20 | The same day with different pins | Same `DayScore` (INV-1) | U |
| EC-52 | A window added outside working hours | Allowed for that day. Fills like any window | U |
| EC-53 | An added window overlaps an event | Trimmed around the event and its buffer. Not saved if nothing is left | U |
| EC-54 | A day edit with "Repeat every Wednesday" on | Saved to the weekly template from that date on (§3.1) | D |
| EC-56 | A window added at lunch on a School day | The commitment share keeps the value it had when the day began | U |
| EC-55 | An added window overlaps an existing window | The new window takes the overlap. The old one is shortened or split; pieces under 30 minutes are dropped and their tasks move on | U |

### Repeats and skips

| ID | Case | Behaviour | Test |
|---|---|---|---|
| EC-21 | "For 12 weeks" starting mid-week | The first partial week is week 1. The series ends after week 12 | U |
| EC-22 | Ticking early the week before a skipped week | The tick takes the value of the next real session | U |
| EC-23 | A fortnightly life task in a skipped commitment week | Unaffected. Commitment skips cover that commitment's events and tasks only | U |
| EC-24 | A skip leaves a day with nothing due | That day can become an automatic rest day | U |
| EC-25 | Skipping a week that has started | Not allowed for the whole week. Single events from today on can still be skipped | D |
| EC-26 | A series whose end date has passed | Keeps its history and is archived the next day | D |
| EC-27 | "This and following" on a series with skips | Skips from that date on move to the new series | D |

### Hard days

| ID | Case | Behaviour | Test |
|---|---|---|---|
| EC-28 | Clear today, then Undo | Everything comes back. Ticks made in between stay | D |
| EC-29 | Clearing after ticking an event, or clearing a day with only commitment work | Ticked commitment work keeps its share and points. With nothing left due, the day is an automatic rest day (70) | U |
| EC-30 | Away for part of a week | Flexible runs are spread over the other days. If none are left, they lapse | U |
| EC-31 | Away from today after ticking things | Today is still graded and away starts tomorrow. The form defaults to tomorrow | D |
| EC-32 | Editing an away range later | Past away days can be changed back within 14 days | D |
| EC-33 | A day off set on a future day with pins | Pins are kept but hidden, and return if the day off is removed | D |

### Tasks, goals and units

| ID | Case | Behaviour | Test |
|---|---|---|---|
| EC-34 | No unit match for a title | Chip reads "Choose a unit". A unit is needed to save | M |
| EC-35 | "Dinner with mum" | Suggests Family (ADR-0027 §4) | U |
| EC-36 | A goal linked to an archived task | Past ticks still count. The task isn't listed | D |
| EC-37 | A Points goal across days off | A running total, so days off add nothing | U |
| EC-38 | "Took about…" set to 0 or over 12 h | Kept between 1 minute and 12 hours | U |
| EC-39 | A unit with tasks moves to Not now | Its tasks are paused after you confirm, and their pins removed. Moving it back restores the tasks without the pins. Other weights adjust to 100 | U + D |
| EC-40 | All 18 units in one tier | Weights still add to 100 | U |
| EC-41 | A goal on a commitment | Allowed. It counts only that commitment's tasks or time and never creates a scoring `task_unit` (ADR-0035 §3) | U |
| EC-48 | A repeating task unfinished on Sunday night | Doesn't carry into Monday. Its count starts again (§4.5) | U |
| EC-49 | A carried task done two days later | Paid what its original day would have paid, uncapped. That day's grade doesn't change | U |
| EC-50 | Hours changed "this week and after" mid-week | Settled days keep their commitment share. Today on uses the new hours | D |
| EC-51 | Clearing a day during a streak goal | A cleared day isn't a day off, so an every-day task not done ends the run. "Make it a day off instead" keeps it | U |

### Data and system

| ID | Case | Behaviour | Test |
|---|---|---|---|
| EC-42 | Restoring a backup from before the migration | Old placements and pools are copied to the new tables. Past grades don't change | D + M |
| EC-43 | App closed during the weekly pass | Each pin was saved as it was made. The pass starts again at step 1 | M |
| EC-44 | Clock or time zone changes while the app is open | "Now" is worked out again when the app comes back to the front | M |
| EC-45 | Reduce Transparency or Increase Contrast | Glass becomes solid and higher-contrast colours are used | M |
| EC-46 | Largest text size | Rows wrap and the size label moves under the title. Nothing is cut off | M |
| EC-47 | VoiceOver | Every drag has a menu alternative. A window header reads like "Window, 12:40 to 4:00, 3 tasks, collapsed" | M |

## 8. Scoring

### 8.1 Rules the tests must hold

| ID | Rule |
|---|---|
| INV-1 | Windows, pins, suggestions, refilling, carrying forward and sort order never change what's due or any `DayScore`. Two exceptions: a saved "Do N of these" choice (ADR-0033 §3), and working hours, which set the size of the commitment share (§5.5) |
| INV-2 | Every open task is in exactly one window or in Other open tasks |
| INV-3 | Only repeat bounds, skips, Clear today and Away change what's due, through `isDueOn` / `isAnchoredOn` and the day-type path |
| INV-4 | Nothing computes or shows adherence, attendance, missed counts or a percentage of the plan done (AGENTS.md) |
| INV-5 | Unit weights add up to 100 |
| INV-6 | Points are never used to rank suggestions |
| INV-7 | Goal progress never feeds a daily grade |
| INV-8 | The commitment share uses only the day's working hours as they stood at the start of the day, plus its commitment events and commitment task sizes. It is fixed once the day's grade settles |

### 8.2 Changes (formula v11)

**Tier weights.** Each tier has a base value. Within a tier, the
first unit gets ×1.1 and the last ×0.9, with a single unit at ×1.0.
The values are then scaled to add up to 100 across the units in the
plan.

| Tier | Base | Share per unit with 4 / 6 / 5 / 3 units |
|---|---|---|
| Top | 1.6 | about 10.4% |
| Important | 1.0 | about 6.5% |
| Background | 0.6 | about 3.9% |
| Not now | 0 | 0 (out of the plan, §5.4.1) |

This replaces the rank flattening in ADR-0028 (`WEIGHT_SPREAD`). The
spread is wider because tiers are coarser than a full ranking.
`WEIGHT_SPREAD` existed so no unit was too small to hold a worthwhile
task. Background is now the smallest at about 3.9%, close to the
current bottom unit's 4. If every unit is put in Not now, Priorities
won't save and says "Keep at least one unit in your plan".

**Retiring satisfaction.** The ADR has to cover three things.
`unitProfile` reads satisfaction to choose suggestions and will use
tier instead. Old snapshots keep their ratings, read-only. The weekly
contentment question (ADR-0008) becomes the app's only check on
whether the plan is working.

**Commitment share** (§5.5):

    share_c = (event hours_c + task size-hours_c) ÷ (working hours + event hours outside them)
    band    = Σ share_c, kept between 10% and commitmentBandMax, proportions kept
    no working hours that day → band = commitmentBandMax
    an override replaces share_c with the user's figure

This fits the existing commitment model (ADR-0032, ADR-0035).
Commitment tasks are paid from the commitment's own pool, not from the
18 units' 100. AGENTS.md describes this as commitment tasks having "no
weight", meaning no weight in the units' pool; that wording will be
made clearer with the ADRs. What's new is that working hours and task
sizes now set the size of the pool.

Unchanged: the 90/10 split, the unplanned cap, rest days, extra runs,
and paying early or late work what its planned day would have paid.

## 9. ADRs needed

| ADR | Topic | Supersedes or amends |
|---|---|---|
| 0039 | Work windows, suggestions and day edits | Supersedes 0033 §§1, 2, 4, 5. Amends 0024 (§3 grouping, §4 planning pass), 0026 §3 (fitting is now used), 0036 (a pin isn't a clock time) |
| 0040 | Repeat bounds, skips, carrying forward, Clear today, Away | Amends 0029 §3 (display only), 0032 §1, 0037 §1 |
| 0041 | Priorities as tiers (formula v11) | Amends 0022 (satisfaction no longer asked), 0027 §2 (Not now), 0028 |
| 0042 | Measurable goals | Amends 0030 (conditions retired), 0015, 0007 |
| 0043 | Navigation, Liquid Glass and the Prism style | Amends 0021 (user colours), DESIGN.md, the tab bar |
| 0044 | Commitment share from working hours (formula v11) | Amends 0032 |
| — | Event location removed | Amends 0038 §1 |
| — | Onboarding | Amends 0011 |

## 10. Open questions

Answered on 2026-10-13:

- Q1. Unfinished and cleared tasks carry forward (§4.5, §4.7).
- Q2. Not now has no weight and holds no tasks (§5.4.1).
- Q3. The commitment share is measured against your own working hours
  and includes the commitment's tasks as well as its events (§5.5).
- Q9. Repeating tasks don't carry into the next week. Their count
  starts again (§4.5).

- Q4. Points goals are running totals only (§5.6).
- Q5. The evening card appears an hour before the last window ends, or
  at 6 pm (§5.1).
- Q6. Home jumps to the current window only when the app opens or
  comes back to the front (§5.1).
- Q7. Short windows show only as many tasks as fit (§4.3).
- Q8. Onboarding starter tasks are tap to add (§5.11).
- Q10. The commitment share is set from the hours at the start of the
  day. Window edits during the day don't change it (§5.5).
- Q11. The first weekly pass of each month offers a look at your
  tiers (§5.3.2).

Nothing is open. The remaining decisions belong in the ADRs.
