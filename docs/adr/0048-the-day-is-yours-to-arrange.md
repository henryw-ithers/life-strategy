# ADR-0048: The day is yours to arrange, whenever you check in

> **Status:** Accepted (Henry, 2026-11-02)\
> **Date:** 2026-11-02

## Context

ADR-0039 built Home around someone who ticks tasks as they go: a tick
was filed under the window it was tapped in, a window that ended
carried its unfinished work forward into the next one, and part of the
day was only a ranking hint. Henry tested the TestFlight build and
found it broke for the way people actually use a planner (2026-11-02):

> Most people will probably only check things off once or twice a day
> and the time of day they do that shouldn't matter for when the
> task's completion appears.

His critiques, and his answers when asked:

- A completed task belongs in a Done section at the bottom, not in the
  window it was tapped in. **By default it shows under its planned
  window.**
- A morning task must not be suggested into a 1–5pm window. **A
  morning task stays in the morning, which folds rather than
  disappears; likewise any other part of the day or window.**
- There was no way to put a task in an earlier window. **Any window
  today**, including ones already over.
- Reordering open tasks had been lost. **Tasks should move between
  windows and parts of the day by drag and drop, with an order inside
  each that's easy to change.** A move lasts for **today only**; the
  order is **kept**.
- **"Nothing should ever be fixed; the app should be completely
  editable."**
- The Priorities screen is unnecessary: **do it all from Life's units,
  always editable, saving as you go.**
- Onboarding should **explain the philosophy and how the app works,
  and where to start**, not fill anything in.

## Open questions

1. Where does a tick show, and under which window?
2. What happens to a window's tasks when it ends?
3. Is part of the day a placement rule or a ranking hint?
4. How is a day rearranged, and how long does a rearrangement last?
5. Does recording a tick's window break ADR-0029 §3?
6. What does a folded window that's over say?
7. How are priorities edited without a Done step, and what is a
   snapshot then?
8. What is onboarding for?

## Options considered

**Keep ADR-0039's live day and add a drag.** Ticks would still be filed
by tap time and ended windows would still carry tasks away, so a
night-time catch-up would still find the morning's tasks in the
evening. Rejected: it is the behaviour Henry reported.

**Fix the day's layout when it starts.** Stable, but nothing could be
changed afterwards. Rejected by Henry: "nothing should ever be fixed".

**The clock moves nothing; you move everything** (chosen). The day is
laid out the same at 8am and at 10pm, and changes only when you change
it or the plan changes.

## Decision

### 1. A tick is filed under the window it was done in

Ticking a task files it under the window its row sat in, whatever time
it is (`task_completion.window_start`). The task leaves its window and
appears in **Done**, at the bottom of Home, grouped by window. Press and
hold a done task for **Done in…** to file it under another window. A
tick with no window falls back to the time it was made.

It still uses up that window's room, so ticking never reshuffles the
rest of the day. Display only: it never changes a point (ADR-0039 §12).

### 2. A window that's over keeps its tasks

Supersedes ADR-0039 §6's "after the window has ended" and §8's carrying
forward **within a day**. Pins, timed tasks and suggestions stay in
their window when it ends. On Home it starts **open while it still holds
open tasks** (so they can be ticked tonight) and folds once they're
done; any window can be opened or folded by hand. "Still open" across
days (ADR-0039 §8) is unchanged.

Suggestions are worked out the same way at any time of day: `planDay`
fills every window, ended or not.

### 3. Part of the day is a placement rule

Supersedes ADR-0039 §5's part-of-day ranking step and §10's "a task
preference". A task with a part of the day is suggested **only into
windows that touch that part**. When no window does, it sits in that
part's own section on Home, in time order with the windows. A day with
no windows shows **Morning, Afternoon, Evening and Anytime**, always
all four, so each can take a drop. A day that starts late (ADR-0049)
holds its morning after midnight.

### 4. Drag to rearrange: today's place, your lasting order

Hold a task and drag it:

- **into another window or part of the day**: pinned there **for today
  only** (a once-pin with an order). Its usual part of the day is
  changed in its editor;
- **within its section**: sets **your order**, stored on the task
  (`task.day_order`) and used again on later days;
- **onto Other open tasks**: a pin is taken off for today; a
  suggestion is swapped out of its window.

Hold and let go without moving to get the row's menu, as in Reminders.
**Move it** (now listing every window today, ended ones included) and
the row's VoiceOver actions are the routes that don't need a drag.

Inside a section, rows show in your order first, then in the order the
day was filled. Points never order anything (ADR-0039 §12).

### 5. A tick's window goes with its day

Recording which window a tick was filed under, beside the time it was
made, would let someone work out how often pins were kept: the figure
ADR-0029 §3 forbids and windows-and-pins §7 already prevents by
deleting ended pins. So `window_start` is **cleared for past days** with
the ended pins (`pruneEndedPins`), at launch, on the first load of a new
day, and before a backup is written. It only ever matters on today's
Home.

### 6. A folded window that's over counts nothing undone

Folded, a window still to come says how many tasks it holds. One that's
over says how many were done there once nothing is left open, and
**nothing at all while it still holds open tasks**, so Home never shows
a count of what wasn't done (no shaming, P7, P8).

### 7. Priorities are edited on Life, and save as you go

Amends ADR-0041 §§1 and 5's screen, not its maths. The Priorities
screen is removed. **Life → Your units** is the board: hold a unit and
drag it to another tier or another place in its own tier, and it saves
at once. Hold and let go (or the VoiceOver action) for your own weight
or a tier. Moving a unit that holds tasks to Not now asks first, since
they pause.

A **snapshot** is now **one set of priorities a day**: saves made on the
same day fold into that day's snapshot (same id, weights replaced), so
the history isn't one row per drag. A first run starts every unit
Unsorted and saves once all are in a tier.

The bars keep **no target** (ADR-0041 §5): weights show only in a unit's
sheet, with the recommended value beside your own.

### 8. Onboarding explains; it fills nothing in

Amends ADR-0045. Onboarding is a few short pages, each with one
example: what the app is for, tiers, a day out of 100, windows and
ticking whenever suits you, and where to start. Then the reminder. It
creates nothing: the commitment templates, starter tasks, hours and
first-week steps are removed. It ends on Life to sort your units, or
Home once you have. Settings' "Run setup again" becomes **How it
works**, and changes nothing.

## Consequences

- A night-time catch-up works: the morning's tasks are still in the
  morning, and ticks land where the tasks were.
- Home no longer refills a window as you tick; "Next up" and carrying
  within the day are gone. Pull in another and swaps remain.
- Plan's day view still draws ticks inside windows; it's about future
  days, where there are none.
- Drag needs a phone to check: the web preview can't press and hold.
- Supersedes parts of ADR-0039 (§5 item 4, §6's ended-window rule, §8
  within a day, §10) and amends ADR-0041's screen and ADR-0045.
