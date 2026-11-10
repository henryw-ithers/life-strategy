# User stories

Every way someone could use, or might want to use, Life Strategy, as
of 2026-11-10, after the Suspect fixes on
fix/user-story-suspects. "Every possible" has no literal end,
so this is every user action crossed with every state that changes
what happens, plus what people might want that the app can't do.

**Works means the code says so.** These come from reading the code
and docs; nothing here was run on a device.

449 stories: 371 Works, 55 Gap, 0 Suspect, 23 Parked.

## How to read this

Each story has an ID (area, number), a status, the story and its
outcome. IDs are numbered in order, so adding a story mid-area renumbers
the rest of that area.

- **Works**: the code does this today.
- **Gap**: someone might want it and the app can't do it. The outcome
  says whether that's excluded on purpose or just not built.
- **Suspect**: looks broken, stale or unreachable in the code.
- **Parked**: depends on windows or working hours (ADR-0051).

## Who uses it

- The reflective planner, who wants a reason behind the checklist.
- The catch-up user, who opens it once or twice a day and ticks in bulk.
- The light planner, who never sets a time, and the precise planner.
- The student or worker with up to three commitments.
- The shift worker, whose events change week to week.
- The night owl or shifted sleeper (Day starts at).
- The returner, back after weeks away, with no guilt.
- The VoiceOver or large-text user.
- The tester reporting a problem.

## ONB: First run and onboarding

### Happy path

**ONB-001 · Works**
As a new user, I want to read what the app is for in a few short pages, so
that I know what I'm starting.
*Outcome:* Six pages: welcome, tiers, how a day works, time, where to start,
reminders. "Get started", then "Next".

**ONB-002 · Works**
As a new user, I want to turn on a daily reminder on the last page, so that
the app can nudge me.
*Outcome:* "Turn on" asks iOS for permission. "Skip" finishes without it.

**ONB-003 · Works**
As a new user, I want to land where I should start, so that I'm not left on
an empty screen.
*Outcome:* With no priorities saved it opens Life; with priorities saved it
opens Today.

**ONB-004 · Works**
As a new user, I want to sort my 18 units into tiers, so that my plan
reflects what matters to me.
*Outcome:* Life shows "Unsorted" with "Drag each unit into a tier. Not now
is a tier too." The plan saves once all 18 are placed.

**ONB-005 · Works**
As a new user with priorities set, I want to add my first task, so that the
day has something to ask.
*Outcome:* Today reads "Your daily budget is set. Now give it something to
do." with "Plan your tasks".

### Variations

**ONB-006 · Works**
As someone who closed the app during onboarding, I want to pick up where I
stopped, so that I don't repeat pages.
*Outcome:* It resumes at the stored step.

**ONB-007 · Works**
As someone who already answered the iOS reminder prompt, I want not to be
asked again, so that the last page isn't pointless.
*Outcome:* The last page shows "Done" and no "Skip".

**ONB-008 · Works**
As someone who has used the app for a while, I want to reread the
introduction, so that I can remind myself how it works.
*Outcome:* Settings, "How it works". No confirmation, and all data stays.

### Edge cases

**ONB-009 · Works**
As a new user opening Today before sorting, I want to be told what to do, so
that I'm not staring at nothing.
*Outcome:* "Sort your units into tiers to start your plan." with "Sort your
units".

**ONB-010 · Works**
As a new user tapping + Task or Event before sorting, I want to end up
somewhere useful, so that the sheet doesn't open with nothing to file under.
*Outcome:* The sheet closes and Life opens, with no message.

**ONB-011 · Works**
As a new user tapping Log something before sorting, I want to record what I
did anyway, so that I can still capture it.
*Outcome:* The activity sheet opens; there is no plan check on this path.

**ONB-012 · Works**
As a new user whose reminder request fails, I want still to finish
onboarding, so that a permission problem doesn't block me.
*Outcome:* Onboarding completes anyway.

**ONB-013 · Works**
As a new user whose save fails during onboarding, I want to be told, so that
I can try again.
*Outcome:* Alert "That didn't work".

**ONB-014 · Works**
As someone following a glide:// link before onboarding, I want not to reach
a half-set-up screen, so that the first run stays in order.
*Outcome:* Every route goes to onboarding until it is done.

**ONB-015 · Works**
As someone sorting units in two sittings, I want my half-sorted board to be
kept, so that I don't start again.
*Outcome:* A half-sorted board is kept as a draft and comes back as you left
it.

**ONB-016 · Works**
As a new user, I want to go back a page in onboarding, so that I can reread
something.
*Outcome:* Back on every page after the first.

**ONB-017 · Gap**
As a new user, I want starter templates or suggested tasks at setup, so that
I begin faster.
*Outcome:* Excluded on purpose: onboarding only explains (ADR-0048).
Templates are deferred in vision.md.

**ONB-018 · Gap**
As someone with two devices, I want an account that syncs them, so that my
plan follows me.
*Outcome:* Excluded on purpose: no account, no server (Privacy screen,
ADR-0012 parked).

**ONB-019 · Gap**
As an Android user, I want the app on my phone, so that I can use it.
*Outcome:* Excluded on purpose: iOS only (ADR-0020, ADR-0046).

## TOD: Today: seeing and moving through the day

### Happy path

**TOD-001 · Works**
As someone opening the app, I want to see today's work in the parts of the
day, so that I know what's next.
*Outcome:* Morning, Afternoon, Evening and Anytime always show, and Night
when it holds something. Events and timed tasks sit there by the clock;
tasks follow your order.

**TOD-002 · Works**
As someone glancing at the day, I want to see which part is now and how long
is left, so that I can pace myself.
*Outcome:* Labels such as "NOW · Evening" and "2 h 40 left". Finished parts
read "Over" and fold.

**TOD-003 · Works**
As someone reading the list, I want to see each task's progress this week,
so that I know where it stands.
*Outcome:* Captions such as "2nd of 5 this week" and "12 days".

**TOD-004 · Works**
As someone who scrolls a long day, I want the title to fold away, so that I
have room for tasks.
*Outcome:* Native large title that collapses as you scroll.

**TOD-005 · Works**
As someone curious about the score, I want to see how the day adds up, so
that the number makes sense.
*Outcome:* Tap the grade: "How {day} adds up", with "Your plan" and "Things
you logged".

**TOD-006 · Works**
As someone reviewing the week, I want to see this week's average so far, so
that I get the trend.
*Outcome:* "This week, through yesterday · N%" with the number of days it
rests on. Today is left out until it's over.

**TOD-007 · Works**
As someone planning ahead, I want to see any day up to four weeks out, so
that I can look at what's coming.
*Outcome:* Swipe forward up to today + 28 days; beyond that it springs back.

**TOD-008 · Works**
As someone looking back, I want to open any past day, so that I can see what
I did.
*Outcome:* Swipe back without limit, or tap the date and pick from the month
grid.

**TOD-009 · Works**
As someone away from today, I want one tap back to today, so that I don't
swipe back through days.
*Outcome:* A "Today" button shows on any other day.

### Variations

**TOD-010 · Works**
As someone on a past day, I want to see what got done, so that the record is
clear.
*Outcome:* Shows a Done list, with "＋ Add something you did that day".

**TOD-011 · Works**
As someone on a future day, I want to see and edit what's planned, so that I
can prepare.
*Outcome:* Parts show; rows tap to edit and tasks drag. No ticking, notes,
photos or log button.

**TOD-012 · Works**
As someone viewing a settled day, I want to know its grade is final-ish but
still fixable, so that I'm not afraid to correct it.
*Outcome:* "Settled. You can still edit it." and " · settled" by the date.

**TOD-013 · Works**
As someone in the evening, I want a prompt to record the day, so that I
reflect while it's fresh.
*Outcome:* From 6 pm the note and photo controls sit under "How was today?"
with "Day type ›". Earlier they sit plainly at the end.

**TOD-014 · Works**
As someone who has folded a part, I want to open it again, so that nothing
is lost.
*Outcome:* Tap the header. Folded parts still count their tasks.

**TOD-015 · Works**
As someone scanning Done, I want to see what's finished without clutter, so
that the open list stays short.
*Outcome:* "Done (n)" is folded by default and opens on tap.

**TOD-016 · Works**
As someone reading the footer, I want a reminder that scores aren't a
verdict, so that I don't take a number too hard.
*Outcome:* "Grades are guidelines, not judgments."

### Edge cases

**TOD-017 · Works**
As someone with a part holding nothing, I want to see where I can put work,
so that the empty space has a purpose.
*Outcome:* "Drag a task here."

**TOD-018 · Works**
As someone whose day has nothing due and nothing else open, I want to be
told plainly, so that I don't hunt for work.
*Outcome:* "Nothing's due today."

**TOD-019 · Works**
As someone on a day off, I want to know nothing counts, so that I can relax.
*Outcome:* "Nothing counts today; anything you do still logs." The grade
area shows "Day off".

**TOD-020 · Works**
As someone on a rest day, I want to see how it's scored, so that the day
feels earned.
*Outcome:* "Rest day. It starts at 70."

**TOD-021 · Works**
As someone Away, I want to see that it's known, so that I'm not nagged.
*Outcome:* "Away · label · back Weekday".

**TOD-022 · Works**
As someone with an unscored day so far, I want no misleading 0%, so that the
empty day doesn't read as failure.
*Outcome:* A dormant normal day's grade can't be tapped.

**TOD-023 · Works**
As someone viewing a settled day's grade, I want the stored total, so that
the past isn't restated.
*Outcome:* The score sheet is unavailable: a settled day keeps only its
total.

**TOD-024 · Works**
As someone with every open task, I want each to appear exactly once, so that
nothing is double-listed or lost.
*Outcome:* Parts plus Not on today hold each open task once. (EC-19)

**TOD-025 · Works**
As someone on the day loading slowly, I want a sign it's working, so that I
don't tap around.
*Outcome:* Spinner, with the toolbar already present.

**TOD-026 · Works**
As someone tapping a future cell in the month grid, I want to go there, so
that the calendar is a shortcut.
*Outcome:* Future cells are disabled and › stops at the current month, so
future days are swipe-only.

**TOD-027 · Works**
As someone planning next month, I want to jump straight to a future date, so
that I don't swipe many times.
*Outcome:* The month grid opens any day up to four weeks out, and goes
forward a month when that reaches it.

**TOD-028 · Gap**
As someone planning further ahead, I want to view beyond four weeks, so that
I can plan a term.
*Outcome:* Not built. The limit is today + 28.

**TOD-029 · Gap**
As someone who liked the old Week tab, I want a seven-day overview, so that
I can see the week at once.
*Outcome:* Removed on purpose by Henry on 2026-11-07. Later work is under
Not on today and swipeable days.

**TOD-030 · Gap**
As someone sharing my day, I want to show friends my score, so that we can
compare.
*Outcome:* Excluded on purpose: grades are private, no comparison
(AGENTS.md).

## TCK: Ticking tasks

### Happy path

**TCK-001 · Works**
As someone who did a task, I want to tick it with one tap, so that recording
costs nothing.
*Outcome:* Tap the row. It moves to Done and the grade updates.

**TCK-002 · Works**
As someone catching up at night, I want to tick everything from earlier, so
that the day reflects what I did, whenever I open the app.
*Outcome:* Each is one tap. The time of the tap doesn't change the score or
where it's filed.

**TCK-003 · Works**
As someone who tapped by mistake, I want to untick, so that the record stays
right.
*Outcome:* Tap the row in Done; the points come back off.

**TCK-004 · Works**
As someone who did only some of a task, I want to log part of it, so that I
get fair credit.
*Outcome:* Hold, "How much of it you did": A quarter, Half, Three quarters,
All of it or Finish it, with "Takes you to N%". Only on tasks with part
credit on.

**TCK-005 · Works**
As someone who forgot yesterday, I want to tick it now, so that yesterday's
grade is honest.
*Outcome:* On a past day, "＋ Add something you did that day" opens "Add
something you did".

### Variations

**TCK-006 · Works**
As someone who already met a task's weekly goal, I want to do it again and
tick it, so that extra effort still shows.
*Outcome:* It stays in its usual place, captioned "Extra", at half the usual
rate.

**TCK-007 · Works**
As someone with a part-done row, I want one tap to finish it, so that I
don't reopen the sheet.
*Outcome:* Tapping a part-done row finishes it.

**TCK-008 · Works**
As someone who ticked a task on an earlier day this week, I want to see
that, so that I don't do it twice.
*Outcome:* Caption "Done ahead · Tue". Tapping unticks the original day.

**TCK-009 · Works**
As someone who changed their mind about a part-done amount, I want to clear
what I logged today, so that the record is right.
*Outcome:* "Clear what I logged today" appears if a fraction was picked
today.

**TCK-010 · Works**
As someone ticking a communal task, I want to say where else it counted, so
that it reflects the whole of what happened.
*Outcome:* On a ticked task, hold, "Where else it counts", when communal
units exist. It changes no score.

**TCK-011 · Works**
As someone ticking an event, I want to mark that I attended, so that it
counts like a task.
*Outcome:* Events tick and pay like tasks. Nothing counts ones not ticked.

**TCK-012 · Works**
As someone doing a task on the wrong day, I want full credit anyway, so that
the week is what matters.
*Outcome:* A run pinned to another day, done early, pays what its planned
day would have paid.

### Edge cases

**TCK-013 · Works**
As someone double-tapping quickly, I want only one tick, so that the count
stays right.
*Outcome:* The check and the write share a transaction, so one lands.

**TCK-014 · Works**
As someone with a 2-a-week task ticking it a third time, I want that to
count, for less, so that the app doesn't stop me.
*Outcome:* Runs past the goal go to the extra-run route, at 0.5, outside the
band.

**TCK-015 · Works**
As someone with an unfinished repeating task on Saturday night, I want a
fresh start on Sunday, so that old weeks don't pile up.
*Outcome:* It doesn't carry over the week's end, and its count starts again.
(EC-48)

**TCK-016 · Works**
As someone who does a carried one-off two days late, I want fair pay for it,
so that lateness isn't punished.
*Outcome:* It pays what its original day would have paid, uncapped, and is
never added to the later day's load. (EC-49)

**TCK-017 · Works**
As someone with a one-off done in parts over several days, I want the
fractions to add up, so that it finishes when it's finished.
*Outcome:* Fractions sum, and can never pay more than the task is worth.

**TCK-018 · Works**
As someone ticking on a future day, I want to be stopped, so that the record
stays true.
*Outcome:* Rows there can't be ticked. A forced write is refused: "That day
hasn't happened yet."

**TCK-019 · Works**
As someone editing a very old day, I want to still be able to, so that
mistakes can be fixed.
*Outcome:* Any elapsed day is editable, and editing a settled day rescores
it.

**TCK-020 · Works**
As someone ticking an Extra row on a day with nothing else due, I want to
see it count, so that extra effort isn't ignored.
*Outcome:* The extra run makes it a rest day: 70, plus the run at half rate
(ADR-0037, amended 2026-11-10).

**TCK-021 · Gap**
As someone logging time spent, I want to enter how long a task took, so that
hours are accurate.
*Outcome:* Excluded on purpose by Henry: ticking stays one tap.

**TCK-022 · Gap**
As someone with many ticks to make, I want to select several and tick them
together, so that catching up is faster.
*Outcome:* Not built.

**TCK-023 · Gap**
As someone wanting a sense of adherence, I want a completion rate for each
task, so that I can see how consistent I am.
*Outcome:* Excluded on purpose: no adherence rate (AGENTS.md, ADR-0024 §2).

## MOV: Moving and arranging

### Happy path

**MOV-001 · Works**
As someone rearranging the day, I want to see which rows can move, so that
the feature is discoverable.
*Outcome:* A three-line grip at the end of each movable row.

**MOV-002 · Works**
As someone who wants a task this evening, I want to drag it to Evening, so
that the day matches my real plan.
*Outcome:* Hold 350 ms and drag; it moves for today only.

**MOV-003 · Works**
As someone with a preferred order, I want to drag within a part, so that the
list reads my way.
*Outcome:* The order is kept for future days.

**MOV-004 · Works**
As someone with a long day, I want the page to scroll as I drag, so that I
can reach any part.
*Outcome:* Only the middle band stays still; speed ramps up towards either
edge.

**MOV-005 · Works**
As someone holding a row without dragging, I want its menu, so that I can
act on one task.
*Outcome:* Letting go without moving opens the row's actions.

### Variations

**MOV-006 · Works**
As someone with a few actions on a task, I want a menu listing only what
applies, so that I'm not offered nonsense.
*Outcome:* One action runs directly; more open an action sheet.

**MOV-007 · Works**
As someone unsure where it will land, I want to see before I let go, so that
I place it right.
*Outcome:* A lifted copy follows the finger and a line shows the landing
spot.

**MOV-008 · Works**
As someone who puts a task back where it was, I want nothing to happen, so
that no needless save.
*Outcome:* Nothing is written.

**MOV-009 · Works**
As someone dragging a task to Night, I want that to be allowed, so that late
work has a place.
*Outcome:* Night appears and holds it, though no task can be set to Night.

**MOV-010 · Works**
As someone viewing a future day, I want to arrange it in advance, so that
the day is ready.
*Outcome:* Tasks drag there too.

### Edge cases

**MOV-011 · Works**
As someone moving tasks around, I want the score not to change, so that
arranging is free.
*Outcome:* Where a task sits never changes what's due or any score. (EC-20)

**MOV-012 · Works**
As someone trying to drag a timed task or event, I want it to stay put, so
that its time means something.
*Outcome:* Not draggable: no grip shows.

**MOV-013 · Works**
As someone trying to drag a ticked task, I want it to stay in Done, so that
the record stays.
*Outcome:* Only unticked tasks that aren't done ahead can drag.

**MOV-014 · Works**
As someone on a day that's Away or cleared, I want tasks not to drag, so
that the day's status is respected.
*Outcome:* Dragging is off.

**MOV-015 · Works**
As someone whose drag fails to save, I want to be told, so that I can retry.
*Outcome:* "That didn't save".

**MOV-016 · Works**
As a VoiceOver user, I want another way to change a day, so that I'm not
locked out of arranging.
*Outcome:* Each row's hold menu is a rotor action, and it has "Move to…" for
the parts of the day.

**MOV-017 · Gap**
As someone with windows off, I want to move a task to a precise time by
dragging, so that my day is a timetable.
*Outcome:* Not built. Timed tasks are edited, not dragged.

**MOV-018 · Gap**
As someone moving work between days, I want to drag a task onto another day,
so that rescheduling is fast.
*Outcome:* Not built. Use Add to today, Not today, or edit its days.

## NOT: Not on today and Not today

### Happy path

**NOT-001 · Works**
As someone with work from other days, I want to see it apart from today's
list, so that today isn't muddled.
*Outcome:* "Not on today (n)" starts closed, with groups Earlier this week,
With a deadline and Later this week.

**NOT-002 · Works**
As someone with spare time, I want to pull work onto today, so that I can
get ahead or catch up.
*Outcome:* "Add to today" pins it in its part of the day. It never changes
its date or any score.

**NOT-003 · Works**
As someone with a Thursday task on Friday, I want to see it isn't really
today's, so that I don't confuse it for due work.
*Outcome:* It sits under Earlier this week, not in Anytime.

**NOT-004 · Works**
As someone with a deadline task and no day, I want to find it, so that it
doesn't get lost.
*Outcome:* It sits under With a deadline.

**NOT-005 · Works**
As someone not doing a task today, I want to set it aside without deleting
it, so that the list reflects reality.
*Outcome:* Hold, "Not today". Undo bar: "X: not today".

**NOT-006 · Works**
As someone who changes their mind, I want to bring a set-aside task back, so
that the choice isn't final.
*Outcome:* It's listed under "Set aside today"; "Add to today" removes the
skip.

### Variations

**NOT-007 · Works**
As someone skipping a task a day or more ahead, I want that day to stop
asking for it, so that I can plan around a busy day.
*Outcome:* The skip counts: that day's load drops, and flexible work falls
to the days left.

**NOT-008 · Works**
As someone skipping a task on the day itself, I want it out of sight, so
that the list is honest about today.
*Outcome:* It leaves the list but still counts, so its points are lost.
Skipping can never raise the day you're in.

**NOT-009 · Works**
As someone who skipped by mistake, I want to undo at once, so that a slip
costs nothing.
*Outcome:* The undo bar lasts about 5 seconds, with no timeout under
VoiceOver.

**NOT-010 · Works**
As someone ticking straight from Not on today, I want that to work, so that
I don't need to add it first.
*Outcome:* Rows there are tickable.

### Edge cases

**NOT-011 · Works**
As someone skipping ahead a task that empties the day, I want the day to
rest, so that planning a light day is allowed.
*Outcome:* Skipped ahead, the day can be a rest day and score 70. (EC-24)

**NOT-012 · Works**
As someone whose every-day task is set aside on the day, I want no reward
for it, so that the day stays honest.
*Outcome:* It stays due, so the day's denominator keeps its weight.

**NOT-013 · Works**
As someone with a carried one-off added to today, I want fair pay, so that
late work isn't inflated.
*Outcome:* It's pinned and keeps its own date, so it's paid what its day
would have paid and never joins today's load.

**NOT-014 · Works**
As someone on an Away or cleared day, I want not to be offered Add to today,
so that the day's status holds.
*Outcome:* Add to today is hidden there.

**NOT-015 · Works**
As someone with a ticked task, I want no Not today option, so that the
record stays consistent.
*Outcome:* The option needs an unticked task, not a one-off, today or later.

**NOT-016 · Works**
As someone with only a later-dated one-off, I want to see it on Today, so
that every open task is findable.
*Outcome:* The section counts later one-offs before they load, so it shows
even when they are all it holds.

**NOT-017 · Works**
As someone with a task under Set aside today, I want sensible hold actions,
so that the menu fits the state.
*Outcome:* A set-aside row offers Add to today, not Not today.

**NOT-018 · Gap**
As someone setting aside a one-off, I want Not today on it, so that one-offs
behave like other tasks.
*Outcome:* Not built. Not today excludes one-offs; change its date instead.

**NOT-019 · Gap**
As someone wanting to postpone, I want "move to tomorrow" in one tap, so
that deferring is quick.
*Outcome:* Not built.

## TSK: Creating and editing tasks

### Happy path

**TSK-001 · Works**
As someone with a new habit, I want to add a task from the + menu on any
tab, so that I can capture it anywhere.
*Outcome:* + then Task opens New task; from other tabs it switches to Today
first.

**TSK-002 · Works**
As someone naming a task, I want the app to guess its unit, so that filing
takes no thought.
*Outcome:* From 3 characters: "Suggested from the title. Tap another to
change it." (EC-35)

**TSK-003 · Works**
As someone with a weekly habit, I want to say how often, so that the plan
fits my life.
*Outcome:* Repeats: pick weekdays, or "Any days instead" with a stepper from
0 to 7. Default is Every day.

**TSK-004 · Works**
As someone with a single job, I want to add it once, so that it doesn't
repeat.
*Outcome:* Once: "Do it on" and "Due by", "Both optional", with Clear.

**TSK-005 · Works**
As someone sizing a task, I want to say how big it is, so that the app knows
roughly what it takes.
*Outcome:* How big: Quick, Normal or Big.

**TSK-006 · Works**
As someone fixing a task, I want to edit everything in one sheet, so that I
don't hunt through screens.
*Outcome:* Hold, "Edit task". Title, units, schedule and Delete in the same
order as New task.

**TSK-007 · Works**
As someone done with a task, I want to delete it, so that it stops
appearing.
*Outcome:* Delete task, no confirmation, with a 5-second Undo. Today updates
at once.

### Variations

**TSK-008 · Works**
As a light planner, I want to leave the time open, so that I'm not forced
into a schedule.
*Outcome:* Anytime is the default; nothing asks for a time.

**TSK-009 · Works**
As someone with a part of day in mind, I want to choose Morning, Afternoon
or Evening, so that the task sits where I'll do it.
*Outcome:* When: Anytime, Morning, Afternoon, Evening or At a time.

**TSK-010 · Works**
As a precise planner, I want to give a task a clock time, so that it sits at
its time.
*Outcome:* At a time: Starts and Ends, with the end at least 15 minutes
after the start. Allowed on any task, required on none.

**TSK-011 · Works**
As someone with fortnightly work, I want to do it every two weeks, so that
the plan matches.
*Outcome:* Stepper 0 means once every two weeks, spread over the fortnight,
or pinned to a half with "This week · switch".

**TSK-012 · Works**
As someone with work serving two areas, I want to tag up to three units, so
that it counts where it belongs.
*Outcome:* Up to 3 units; the first is its home. "Up to 3 units — past that,
it isn't really one task."

**TSK-013 · Works**
As someone wanting part credit, I want to allow partial completion, so that
half-done work counts.
*Outcome:* A part-credit switch on the task.

**TSK-014 · Works**
As someone with a commitment task, I want to pick its days, so that it's
scheduled work.
*Outcome:* Days are required: "Pick the days it happens. Commitment work is
paid on the days it is scheduled." The Any-days stepper is hidden.

**TSK-015 · Works**
As someone adding from a unit, I want the unit already chosen, so that it's
quicker.
*Outcome:* "Add task" on Life or "+ Add task" on the unit screen.

**TSK-016 · Works**
As someone wanting inspiration, I want ideas for a unit, so that I'm not
starting cold.
*Outcome:* "Need ideas?" on units with a task library.

**TSK-017 · Works**
As someone reordering a unit's tasks, I want to drag them, so that the list
reads my way.
*Outcome:* Drag on the unit screen; swipe to Delete with Undo.

### Edge cases

**TSK-018 · Works**
As someone with a long task name, I want to know the limit, so that I'm not
cut off by surprise.
*Outcome:* Capped at 60 characters; "N left" appears from 10 remaining.

**TSK-019 · Works**
As someone whose title matches no unit, I want to choose by hand, so that it
still gets filed.
*Outcome:* No suggestion; a unit is required to save. (EC-34)

**TSK-020 · Works**
As someone picking a Not now unit, I want to learn why I can't, so that I
can fix it.
*Outcome:* "{unit} is in Not now. Move it up in Priorities to add tasks."

**TSK-021 · Works**
As someone with a one-off with a deadline, I want it to weigh on the days
before, so that it doesn't all land on one day.
*Outcome:* Spread over the days until it's due; all of it once due or
overdue.

**TSK-022 · Works**
As someone with a one-off with neither day nor deadline, I want no pressure
from it, so that it doesn't drag down a day.
*Outcome:* Counts only on the day it's done.

**TSK-023 · Works**
As someone with an every-day task on a day off, I want no penalty, so that a
day off is a day off.
*Outcome:* A day off is out of totals.

**TSK-024 · Works**
As someone setting an end before the start, I want it to mean the next day,
so that late tasks work.
*Outcome:* An earlier end on the clock means the next day.

**TSK-025 · Works**
As someone with a task in a commitment, I want no double pay, so that the
day can't be inflated.
*Outcome:* It may tag a life unit only as a note, never a scoring slot.

**TSK-026 · Works**
As someone reading the Not now message, I want the right place to go, so
that I can act on it.
*Outcome:* "Drag it into a tier on Life to add tasks."

**TSK-027 · Works**
As someone on a Not now unit on Life, I want a consistent answer, so that
I'm not confused.
*Outcome:* Not now units offer no Add task on Life.

**TSK-028 · Works**
As someone editing a one-off's date, I want the button to say what it does,
so that I trust it.
*Outcome:* Date, deadline and size changes on a one-off count as edits, so
it reads Save.

**TSK-029 · Gap**
As someone with a monthly task, I want a monthly cadence, so that the plan
fits.
*Outcome:* Not built. Fortnightly is the longest repeat.

**TSK-030 · Gap**
As someone with sub-steps, I want a checklist inside a task, so that big
jobs are clearer.
*Outcome:* Excluded on purpose: the daily surface stays checklist-simple.

**TSK-031 · Gap**
As someone wanting tags or projects, I want project-style organisation, so
that I can group work my way.
*Outcome:* Excluded on purpose: no project-management density (PRODUCT.md).

**TSK-032 · Gap**
As someone wanting reminders per task, I want a notification for one task,
so that I don't forget it.
*Outcome:* Not built. There is one daily reminder.

## EVT: Events

### Happy path

**EVT-001 · Works**
As a student, I want to add my weekly class, so that it's on the right days.
*Outcome:* + then Event. Every week by default; pick a day and a time
(defaults 09:00, plus 60 minutes).

**EVT-002 · Works**
As someone with an appointment, I want a one-time event, so that it appears
once.
*Outcome:* One time, on a date.

**EVT-003 · Works**
As someone in a 12-week term, I want the event to end by itself, so that I
don't clean up later.
*Outcome:* For weeks (default 12, range 1–52), Until a date, or No end.

**EVT-004 · Works**
As someone who usually adds one-offs, I want new events to default to once,
so that I change less.
*Outcome:* Settings, "New events happen once".

**EVT-005 · Works**
As someone skipping one class, I want to skip just that occurrence, so that
the rest stay.
*Outcome:* Hold, "Skip this event", then "Skip this one".

**EVT-006 · Works**
As someone changing a class, I want to choose what the change applies to, so
that I don't rewrite history.
*Outcome:* "Change which events?": This event only, This and following, All
events.

### Variations

**EVT-007 · Works**
As someone with a term break, I want to skip whole weeks, so that the break
is planned.
*Outcome:* Edit event, Skip weeks: a 26-week list, with started weeks
locked.

**EVT-008 · Works**
As someone with a late shift, I want an event past midnight, so that it
stays on the day it began.
*Outcome:* An end before the start means the next day; it belongs to its
start day. Up to 24 hours.

**EVT-009 · Works**
As someone with two things at once, I want to see both, so that I decide
what happens.
*Outcome:* Clash alert: Replace, Keep both, Cancel. Both show and both can
be ticked. (EC-09)

**EVT-010 · Works**
As someone viewing a future day, I want to edit an event there, so that I
can prepare.
*Outcome:* Tap the row to edit.

**EVT-011 · Works**
As someone tagging an event, I want to choose where it belongs, so that it
counts for the right thing.
*Outcome:* A unit is required: "Choose where it belongs."

### Edge cases

**EVT-012 · Works**
As someone starting a 12-week series mid-week, I want the first partial week
to count, so that it ends when expected.
*Outcome:* The partial week is week 1; it ends on the 12th Saturday. (EC-21)

**EVT-013 · Works**
As someone ticking early before a skipped week, I want fair credit, so that
skipped weeks don't confuse it.
*Outcome:* The tick takes the value of the next real session. (EC-22)

**EVT-014 · Works**
As someone skipping a week that has started, I want a clear limit, so that I
know what's possible.
*Outcome:* Started weeks can't be skipped whole; single events from today on
can. (EC-25)

**EVT-015 · Works**
As someone whose series has ended, I want its history kept, so that the past
remains.
*Outcome:* It keeps its history and is archived once its end date falls
before the edit window. The spec says "the next day"; see Findings. (EC-26)

**EVT-016 · Works**
As someone editing "This and following" on a series with skips, I want the
skips to stay, so that I don't redo them.
*Outcome:* Skips from that date move to the new series. (EC-27)

**EVT-017 · Works**
As someone leaving a field empty, I want to know what's missing, so that I
can finish.
*Outcome:* "Give it a name.", "Pick the days it repeats on, or the one day
it happens.", "An event needs a start and an end."

**EVT-018 · Works**
As someone with a very short event, I want to be told the minimum, so that
it's clear.
*Outcome:* "It has to end at least 15 minutes after it starts."

**EVT-019 · Works**
As someone with a very long event, I want to be told the maximum, so that
it's clear.
*Outcome:* "An event can run for a day at most."

**EVT-020 · Works**
As someone whose save fails, I want to be told, so that I can retry.
*Outcome:* "It wasn't saved"; a failed skip says "It wasn't skipped".

**EVT-021 · Works**
As someone who misses an event, I want nothing said about it, so that
there's no guilt.
*Outcome:* A missed event is never counted or mentioned.

**EVT-022 · Works**
As someone choosing "Skip this week" on the hold menu, I want that option to
appear when it can work, so that the menu is honest.
*Outcome:* The hold menu offers "Skip this one". Whole weeks are skipped
from the event's own sheet.

**EVT-023 · Works**
As someone editing a later occurrence from a future day with "This event
only", I want that day's event to change, so that I change the one I'm
looking at.
*Outcome:* It changes that day's event, or today's if that day has passed.

**EVT-024 · Gap**
As someone with a location, I want to save where an event is, so that I know
where to go.
*Outcome:* Excluded on purpose: events have no location (AGENTS.md).

**EVT-025 · Gap**
As someone with a calendar, I want to import from iOS Calendar, so that I
don't retype my timetable.
*Outcome:* Not built.

**EVT-026 · Gap**
As a student wanting attendance figures, I want an attendance rate, so that
I can track it.
*Outcome:* Excluded on purpose: never computed, stored or shown (ADR-0035,
ADR-0038).

**EVT-027 · Gap**
As a student wanting marks, I want to record a grade for a course, so that
progress is in one place.
*Outcome:* Excluded on purpose: no mark or result in the commitment model
(ADR-0035).

## DAY: Kinds of day

### Happy path

**DAY-001 · Works**
As someone taking a day off, I want to declare it, so that nothing is
expected.
*Outcome:* ⋯, Day type, Day off. Scores nothing and stays out of totals.

**DAY-002 · Works**
As someone with a memorable day, I want to mark it special, so that it
stands out in the record.
*Outcome:* Special day, with optional "What made it special?" and "How was
it?" 1–10. Card reads "Rated N of 10 · worth P points".

**DAY-003 · Works**
As someone overwhelmed today, I want to clear the day, so that I'm not faced
with a full list.
*Outcome:* ⋯, Clear today. Alert offers "Clear today", "Make it a day off
instead" and Cancel. Unticked events go; life work stays due.

**DAY-004 · Works**
As someone with nothing due and nothing open later, I want a rest day
automatically, so that an empty day isn't blank.
*Outcome:* Scores 70. Activities add up to 30 at three times the rate, and
early work is paid on top.

### Variations

**DAY-005 · Works**
As someone who regrets clearing, I want to undo it, so that nothing is lost.
*Outcome:* "Today's cleared." with Undo, today only. (EC-28)

**DAY-006 · Works**
As someone changing a past day's type, I want to correct it, so that the
record is right.
*Outcome:* Day type is available on any day that has begun, and rescores it.

**DAY-007 · Works**
As someone on a special day, I want the rating to count a little, so that
the day feels recognised.
*Outcome:* Bonus = rating ÷ 10 × 10, sharing the unplanned pool.

**DAY-008 · Works**
As someone on a commitment-only day, I want to know the ceiling, so that the
score makes sense.
*Outcome:* It tops out at the commitment's share; activities pay nothing.

**DAY-009 · Works**
As someone with work and commitments, I want the band and life work
combined, so that one number covers both.
*Outcome:* Band share, plus 90 × the life share, plus unplanned. A 40 band
reaches 94 before unplanned.

**DAY-010 · Works**
As someone logging on a day off, I want for it still to be kept, so that the
record isn't lost.
*Outcome:* "Day off. This logs without credit."

**DAY-011 · Works**
As someone logging on a special day, I want to keep it in the story, so that
it's remembered.
*Outcome:* "Special day. This logs as part of the story."

### Edge cases

**DAY-012 · Works**
As someone clearing after ticking an event, I want ticked work to keep its
credit, so that effort isn't erased.
*Outcome:* Ticked commitment work keeps its share and points. (EC-29)

**DAY-013 · Works**
As someone who empties a day on the day itself, I want no easy 70, so that
the score stays honest.
*Outcome:* A day emptied by Clear today is ungraded, never a rest day.
(EC-29)

**DAY-014 · Works**
As someone with an empty day but work open later, I want no grade, so that
an empty day isn't judged.
*Outcome:* Ungraded, unless they do something early, which makes it a rest
day.

**DAY-015 · Works**
As someone doing early work on an empty day, I want the rest day and the
pay, so that getting ahead is rewarded.
*Outcome:* Rest day at 70, with early work on top, uncapped, at its planned
day's value.

**DAY-016 · Works**
As someone clearing during an every-day run, I want to know the choice
matters, so that I pick the right one.
*Outcome:* A cleared day ends the run if the task wasn't done; "Make it a
day off instead" keeps it. (EC-51)

**DAY-017 · Works**
As someone clearing while Away or already cleared, I want a sensible answer,
so that nothing breaks.
*Outcome:* Settings' Clear today says so in an alert, or offers Undo. The ⋯
menu hides it in those states.

**DAY-018 · Works**
As someone with no plan yet and an empty day, I want no grade, so that a
blank start isn't scored.
*Outcome:* Ungraded.

**DAY-019 · Works**
As someone who never opened yesterday, I want the right score for it, so
that gaps aren't all zeros.
*Outcome:* Recent elapsed days are scored when next read; a day with work
due and nothing done is 0.

**DAY-020 · Gap**
As someone wanting to set a future day off, I want to mark it ahead of time,
so that I can plan a day off.
*Outcome:* Not built from Day type, which needs a day that has begun. Use
Time away.

**DAY-021 · Gap**
As someone wanting a streak freeze, I want to protect a run, so that a slip
doesn't end it.
*Outcome:* Excluded on purpose: no loss-aversion mechanics (AGENTS.md).

## SCO: The score as you see it

### Happy path

**SCO-001 · Works**
As someone doing what the day asked, I want to get full marks for it, so
that a good day reads as one.
*Outcome:* Planned work pays up to 90; the other 10 is the unplanned pool.

**SCO-002 · Works**
As someone with a busy week of flexible work, I want it spread out, so that
no single day is overloaded.
*Outcome:* Flexible work is pooled and divided over the days the week has
left, at most one run a day.

**SCO-003 · Works**
As someone adding more tasks to a unit, I want the day still to add to 100,
so that the scale stays meaningful.
*Outcome:* A task's points are 90 × weight ÷ that day's load, worked out per
day.

**SCO-004 · Works**
As someone reading a task's worth, I want to see it on past days, so that I
understand what paid.
*Outcome:* Trailing points on other days; Quick or Big on today.

### Variations

**SCO-005 · Works**
As someone who logs spontaneous things, I want some credit, so that
unplanned effort counts a little.
*Outcome:* Activities draw on the unplanned pool, at most 10, scaled on
commitment days.

**SCO-006 · Works**
As someone exceeding the unplanned pool, I want to know it was logged, so
that I don't feel ignored.
*Outcome:* "{n} more logged past the day's limit…"

**SCO-007 · Works**
As someone doing extra runs, I want credit above 100, so that going further
shows.
*Outcome:* Extra runs and off-day planned work are the only uncapped routes.

**SCO-008 · Works**
As someone opening the score sheet first time, I want an explanation, so
that I learn how it works.
*Outcome:* An explainer appears on first open only.

**SCO-009 · Works**
As someone with a big and a small task, I want neither to dwarf the other,
so that every task matters.
*Outcome:* Weights are evened half-way toward the average task (ADR-0050).

### Edge cases

**SCO-010 · Works**
As someone with a low score, I want no alarm or scolding, so that I'm not
put off.
*Outcome:* Neutral presentation, the same copy on good and bad weeks. Never
conditioned on a low grade.

**SCO-011 · Works**
As someone with a score of 0 earned on a normal day, I want no 0% staring
back, so that the start of a day isn't failure.
*Outcome:* A dormant day shows no number until something is earned.

**SCO-012 · Works**
As someone with a settled day after a formula change, I want the old number
kept, so that the past isn't restated.
*Outcome:* Settled days keep the score they had.

**SCO-013 · Works**
As someone whose plan changes, I want recent grades to follow, so that the
calendar agrees with the day.
*Outcome:* Plan edits mark grades stale; the next read rescores unsettled
days.

**SCO-014 · Works**
As someone with a task whose unit moved to Not now, I want the 100 to hold,
so that the scale stays right.
*Outcome:* Its tasks pause and the other weights adjust to 100.

**SCO-015 · Gap**
As someone wanting a pass or fail, I want a clear good-or-bad verdict, so
that I know how I did.
*Outcome:* Excluded on purpose: scores are guidelines (AGENTS.md).

**SCO-016 · Gap**
As someone wanting a hard week target, I want a required weekly score, so
that I hold myself to it.
*Outcome:* Excluded on purpose: no debts or plan-completion figures
(ADR-0029 §3).

**SCO-017 · Gap**
As someone wanting to edit the formula, I want to set my own point values,
so that scoring matches me.
*Outcome:* Partly: weights can be overridden on each unit. Point values are
per-day and can't be set (AGENTS.md).

## REC: Activities, notes and photos

### Happy path

**REC-001 · Works**
As someone who did something unplanned, I want to log it, so that it counts
and is remembered.
*Outcome:* + then Log something, or "Log an activity". Title, up to 3 units,
and how much it counted.

**REC-002 · Works**
As someone logging quickly, I want units suggested for me, so that it takes
seconds.
*Outcome:* Tags are auto-suggested until touched. "Where it counts · up to
3".

**REC-003 · Works**
As someone reflecting, I want to write a note on the day, so that I remember
it.
*Outcome:* "A note on {day}". Save is disabled when blank.

**REC-004 · Works**
As someone with a photo, I want to attach it to the day, so that the log has
pictures.
*Outcome:* Photo opens the library, and the image is copied into the app.

### Variations

**REC-005 · Works**
As someone unsure of the size, I want to choose how much it counted, so that
credit is fair.
*Outcome:* A little, Fairly, Very, or Just log it.

**REC-006 · Works**
As someone fixing a note, I want to edit or delete it, so that the record is
right.
*Outcome:* Tap edits; ••• or hold gives Edit and Delete.

**REC-007 · Works**
As someone removing a photo, I want to delete it, so that it's gone.
*Outcome:* Full screen or hold; Undo for about 5 seconds.

**REC-008 · Works**
As someone changing an activity, I want to edit or delete it, so that it's
accurate.
*Outcome:* "Edit activity"; delete has no confirmation and uses Undo.

**REC-009 · Works**
As someone adding to a settled day, I want to still be able to, so that
memories aren't locked.
*Outcome:* Notes, photos and flags stay addable after a day settles.

**REC-010 · Works**
As someone logging from a future day, I want it to land on today, so that
the record is true.
*Outcome:* Log something jumps to today first.

### Edge cases

**REC-011 · Works**
As someone after a restore, I want a clear sign a photo's gone, so that it
doesn't look broken.
*Outcome:* "Photo not in this backup".

**REC-012 · Works**
As someone whose units don't fit, I want to log without tags, so that I'm
not blocked.
*Outcome:* Tags aren't forced; "Just log it" gives no credit.

**REC-013 · Works**
As someone on a future day, I want no notes or photos, so that the record
stays true.
*Outcome:* Those controls are absent; writes are refused.

**REC-014 · Works**
As someone wanting to mark a day worth remembering, I want a way to flag it,
so that it comes back in look-back views.
*Outcome:* Today has "Remember" beside Note and Photo; hold an activity for
"Worth remembering". The Log keeps flagged days.

**REC-015 · Gap**
As someone captioning a photo, I want to add a caption, so that the picture
has context.
*Outcome:* Not built. The unused caption display was removed (Henry,
2026-11-10).

**REC-016 · Gap**
As someone with a camera moment, I want to take a photo in the app, so that
I don't leave to capture it.
*Outcome:* Not built. Library only.

**REC-017 · Gap**
As someone naming who was there, I want to tag people on an activity, so
that I remember who I was with.
*Outcome:* Excluded on purpose: units only, never named people (ADR-0025).

**REC-018 · Gap**
As someone keeping long notes, I want formatting or attachments, so that
it's a proper journal.
*Outcome:* Not built.

## WKP: Weekly pass

### Happy path

**WKP-001 · Works**
As someone starting a week, I want a short guided look at it, so that the
week has a plan.
*Outcome:* Card "Plan this week · about 5 min" with Start and Not now, or ⋯,
"Plan this week" at any time.

**WKP-002 · Works**
As someone in the pass, I want to see where last week went, so that I can
adjust.
*Outcome:* "Here's where last week went": bars by share, and "You logged N
things."

**WKP-003 · Works**
As someone in the pass, I want to see what's different this week, so that
surprises are handled.
*Outcome:* "Anything different this week?" lists events; a switch turns one
off for the rest of the week.

**WKP-004 · Works**
As someone at the start of a month, I want to be asked about tiers, so that
priorities stay current.
*Outcome:* "Still happy with your tiers?" with "Open your units", on the
first pass of the month.

**WKP-005 · Works**
As someone reflecting on the week, I want to say how content it felt, so
that the app can check grades against how weeks feel.
*Outcome:* "How content did last week feel?" with a 1–10 dial. It saves on
Next; skipping is fine.

### Variations

**WKP-006 · Works**
As someone busy on Sunday, I want the card to wait, so that I can do it
later.
*Outcome:* Shows Sunday from 6 pm, then all Monday.

**WKP-007 · Works**
As someone not wanting it this week, I want to dismiss it, so that it stops
asking.
*Outcome:* Not now hides it for the week.

**WKP-008 · Works**
As someone partway through, I want to stop, so that I'm not trapped.
*Outcome:* Finish is always in the toolbar; Back from step 2; Next, Skip or
Done.

**WKP-009 · Works**
As someone with shifts that change, I want to copy last week's events, so
that I don't retype them.
*Outcome:* "Copy last week's events", shown when new events default to once.
"Nothing to copy" or "Copied".

**WKP-010 · Works**
As someone away next week, I want to set it from the pass, so that it's all
in one place.
*Outcome:* "Time away" and "Add an event" links.

### Edge cases

**WKP-011 · Works**
As someone who closes the app in the pass, I want nothing lost, so that
interruptions are fine.
*Outcome:* What was saved stays; the pass starts again at step 1. (EC-43)

**WKP-012 · Works**
As someone with an empty last week, I want no judgement, so that a quiet
week isn't a failure.
*Outcome:* "Nothing completed to show from last week."

**WKP-013 · Works**
As someone with no events this week, I want to be told, so that the step
isn't confusing.
*Outcome:* "No events this week."

**WKP-014 · Works**
As someone Away or viewing another day, I want no card, so that it only
shows when useful.
*Outcome:* Today only, not while Away.

**WKP-015 · Works**
As someone whose pass fails to load, I want to retry, so that I'm not stuck.
*Outcome:* "This screen couldn't load" with "Try again".

**WKP-016 · Gap**
As someone wanting a monthly review ritual, I want a guided end-of-month
pass, so that the month gets its due.
*Outcome:* Not built as a flow. Month review is on Log, and tiers are asked
in the first weekly pass.

**WKP-017 · Gap**
As someone wanting a pass on another day, I want to choose when it appears,
so that it fits my week.
*Outcome:* Not built. Weeks are fixed Sunday to Saturday.

## LIF: Life: priorities and units

### Happy path

**LIF-001 · Works**
As someone setting priorities, I want to drag units between tiers, so that
the plan matches my values.
*Outcome:* Top, Important, Background and Not now. Saved as you go, at most
one snapshot a day.

**LIF-002 · Works**
As someone ordering within a tier, I want to drag up and down, so that order
means something.
*Outcome:* Order within a tier adjusts weight from ×1.1 to ×0.9.

**LIF-003 · Works**
As someone looking at balance, I want to see where effort went, so that I
can notice drift.
*Outcome:* Effort share over 28 days, each bar relative to the largest unit,
with no target.

**LIF-004 · Works**
As someone exploring a unit, I want to expand it in place, so that I see its
tasks.
*Outcome:* Tap a unit: tasks open the edit sheet, plus "Add task".

**LIF-005 · Works**
As someone wanting detail, I want the unit's own screen, so that I see what
it holds.
*Outcome:* (i) opens it: tier, "N of the day's 100", recommended value,
achievements link and "What X covers ›".

### Variations

**LIF-006 · Works**
As someone disagreeing with a weight, I want to set my own, so that the app
fits me.
*Outcome:* Hold, "Your weight": 1–99, or "Use recommended". The recommended
value stays beside it.

**LIF-007 · Works**
As someone moving a unit without dragging, I want a menu, so that it's
quicker or more accessible.
*Outcome:* Hold and let go: "Move to {tier}".

**LIF-008 · Works**
As someone with the Not now tier, I want it out of the way, so that the
board stays short.
*Outcome:* "Not now (n)" starts collapsed.

**LIF-009 · Works**
As someone curious about a commitment or weight, I want an explanation, so
that I understand the idea.
*Outcome:* Info buttons on Your units and Commitments.

**LIF-010 · Works**
As someone with an empty tier, I want to see it's a target, so that I know I
can use it.
*Outcome:* "Drag a unit here".

**LIF-011 · Works**
As someone wanting a badge view, I want medals on rows, so that I see
progress at a glance.
*Outcome:* Streak flame, medal and task count on unit rows.

### Edge cases

**LIF-012 · Works**
As someone moving a unit with tasks to Not now, I want to be warned, so that
I don't pause work by accident.
*Outcome:* "Move {name} to Not now?". Its tasks pause and their pins go;
moving it back restores the tasks without the pins. Other weights adjust to
100. (EC-39)

**LIF-013 · Works**
As someone putting all 18 in one tier, I want that to work, so that the app
doesn't force a spread.
*Outcome:* Weights still add to 100. (EC-40)

**LIF-014 · Works**
As someone moving every unit to Not now, I want to be stopped, so that the
plan isn't empty.
*Outcome:* "That can't be saved": "Keep at least one unit in your plan."

**LIF-015 · Works**
As someone over-assigning weights, I want to be told, so that the total
stays 100.
*Outcome:* "Your weights add up to…" or "Those weights leave no room…".

**LIF-016 · Works**
As someone typing a weight out of range, I want immediate feedback, so that
it's clear.
*Outcome:* "A whole number from 1 to 99." and Save is disabled.

**LIF-017 · Works**
As someone whose save fails, I want to be told, so that I don't assume it
worked.
*Outcome:* "Your priorities weren't saved".

**LIF-018 · Works**
As someone saving several times in one day, I want one history entry, so
that the history stays readable.
*Outcome:* Same-day saves fold into one snapshot.

**LIF-019 · Works**
As someone on a Not now unit's screen, I want to know why it's empty, so
that I can change it.
*Outcome:* A panel replaces the screen, with "Open your units".

**LIF-020 · Works**
As someone on a deleted unit, I want not to crash, so that I can go back.
*Outcome:* "This unit isn't in your list any more."

**LIF-021 · Works**
As someone re-homing or renaming through a taxonomy update, I want their
history kept, so that nothing is lost.
*Outcome:* Unit ids are preserved; retired units are archived, never
deleted.

**LIF-022 · Works**
As someone looking at areas, I want colour and grouping only, so that areas
don't skew the score.
*Outcome:* Areas never affect weight, rank or points.

**LIF-023 · Works**
As someone in the weight sheet, I want Move up and Move down to work, so
that the controls do what they say.
*Outcome:* The weight sheet holds tier and weight only; order is set by
dragging.

**LIF-024 · Works**
As someone reading the Commitments info, I want accurate copy, so that I'm
not confused.
*Outcome:* It says each commitment takes its share of the day.

**LIF-025 · Gap**
As someone wanting custom life units, I want to add a 19th unit, so that it
covers my life.
*Outcome:* Partly: commitments are custom units. The 18 are fixed.

**LIF-026 · Gap**
As someone ranking the six areas, I want to reorder areas, so that the
groups reflect me.
*Outcome:* Excluded on purpose: built once and it destroyed data (ADR-0021).

**LIF-027 · Gap**
As someone wanting a target share, I want a goal for each unit's effort, so
that I can steer.
*Outcome:* Excluded on purpose: effort share has no target (ADR-0041).

**LIF-028 · Gap**
As someone rating satisfaction, I want to rate each unit, so that I can see
gaps.
*Outcome:* Excluded on purpose: satisfaction is no longer asked (ADR-0041).

## COM: Commitments

### Happy path

**COM-001 · Works**
As a student, I want to add School as a commitment, so that set work has its
own share of the day.
*Outcome:* "Add a commitment", name required. Up to three.

**COM-002 · Works**
As someone with courses, I want sub-commitments under School, so that each
course is separate.
*Outcome:* Sub-commitments are uncapped, two levels only.

**COM-003 · Works**
As someone with commitment work on a day, I want the day to divide fairly,
so that commitments don't crowd out life.
*Outcome:* Its share is its time that day ÷ 10 hours, kept between 10 and 70
(80 with three).

**COM-004 · Works**
As someone with a colour in mind, I want to colour a commitment, so that I
recognise it everywhere.
*Outcome:* Automatic plus 12 colours, saved on tap; its tasks follow it on
every screen.

**COM-005 · Works**
As someone finishing a term, I want to archive a commitment, so that it
stops without losing history.
*Outcome:* ••• Archive, with confirmation. "Unarchive" brings it back.

### Variations

**COM-006 · Works**
As someone who wants a set share, I want to override it, so that the balance
suits me.
*Outcome:* "Share of your day": Automatic or Set my own, step 5, 10–70% (80
at three).

**COM-007 · Works**
As someone with a break, I want to skip a commitment's week, so that its
work stops for that week.
*Outcome:* "Skip a week…": the next 26 weeks, saved per switch.

**COM-008 · Works**
As someone adding the first sub-commitment, I want existing work kept, so
that nothing is lost.
*Outcome:* It moves into one called General, which can be renamed or
deleted.

**COM-009 · Works**
As someone removing the last sub-commitment, I want work brought back, so
that it isn't lost.
*Outcome:* "Removed "X". Its work is back here."

**COM-010 · Works**
As someone creating with sub-commitments from the start, I want it set up,
so that I skip a step.
*Outcome:* A switch on create, which seeds General.

**COM-011 · Works**
As someone renaming, I want to tap the title, so that it's quick.
*Outcome:* Rename from the title or the menu.

**COM-012 · Works**
As someone doing commitment work early, I want credit once, so that nothing
double-pays.
*Outcome:* An early session stands for the next one, paid at that value, and
that session is done on its own day.

### Edge cases

**COM-013 · Works**
As someone adding a fourth commitment, I want to be told why not, so that I
know what to do.
*Outcome:* "Three commitments is the most at once. Archive one to add
another."

**COM-014 · Works**
As someone in a skipped commitment week with a life task, I want the life
task to carry on, so that only the commitment pauses.
*Outcome:* Commitment skips cover that commitment's work only. (EC-23)

**COM-015 · Works**
As someone with no commitments, I want an example, so that I know what it's
for.
*Outcome:* "None yet. For example: School, Work, Basketball club."

**COM-016 · Works**
As someone adding a commitment with no work inside, I want no General made,
so that the screen stays clean.
*Outcome:* General is only made when there's work to move.

**COM-017 · Works**
As someone deleting from a sub-commitment row, I want a way back, so that a
slip costs little.
*Outcome:* No alert, but Undo. Deleting from the page confirms, with no
Undo.

**COM-018 · Works**
As someone viewing an archived commitment, I want read-only rows, so that
it's clearly finished.
*Outcome:* Rows are read-only and add rows are hidden.

**COM-019 · Works**
As someone with a commitment day and a carried one-off, I want it not to
enlarge the band, so that late work doesn't inflate today.
*Outcome:* Carried one-offs are outside the band and paid their own day's
worth.

**COM-020 · Works**
As someone with an undated commitment one-off, I want it counted only when
ticked, so that it doesn't weigh on empty days.
*Outcome:* It counts only on the day it's ticked.

**COM-021 · Works**
As someone over the share limit, I want the limit to hold, so that life
always keeps some of the day.
*Outcome:* The total stays between 10 and 70, 70 or 80.

**COM-022 · Works**
As someone unarchiving when three are live, I want the limit to hold, so
that the app's rule is consistent.
*Outcome:* Unarchive refuses a fourth: "Three commitments is the most at
once. Archive one to add another."

**COM-023 · Works**
As someone viewing an archived commitment, I want only actions that make
sense, so that I'm not misled.
*Outcome:* An archived commitment shows no Name, Colour, Share or Skip rows
until it is unarchived.

**COM-024 · Works**
As someone reading the create sheet, I want an honest note, so that I can
trust it.
*Outcome:* "Classes, shifts or teams. You can add them later too."

**COM-025 · Works**
As someone whose commitment write fails, I want to be told, so that I don't
assume it saved.
*Outcome:* A failure says "That didn't save" and the screen reloads.

**COM-026 · Gap**
As someone with a fourth area of obligation, I want more than three
commitments, so that everything fits.
*Outcome:* Excluded on purpose: the cap is the app having an opinion
(ADR-0035 §1).

**COM-027 · Gap**
As someone with a nested course structure, I want three levels, so that
units within courses fit.
*Outcome:* Excluded on purpose: two levels only (ADR-0035 §1).

## ACH: Achievements

### Happy path

**ACH-001 · Works**
As someone doing the work, I want recognition when I pass a milestone, so
that effort feels seen.
*Outcome:* Card "You earned an achievement" with See all and Done, once per
rank.

**ACH-002 · Works**
As someone browsing, I want all achievements in one place, so that I can see
what's possible.
*Outcome:* Everything, Your units, Areas, Commitments and "From before", in
horizontal rows.

**ACH-003 · Works**
As someone looking at one badge, I want its detail, so that I know what's
next.
*Outcome:* "{Rank} earned" or "Not earned yet", "x / y toward {Rank}", and
five ranks with dates.

**ACH-004 · Works**
As someone with a long habit, I want high peaks to aim for, so that it stays
interesting for years.
*Outcome:* Five ranks, Bronze to Diamond, peaking near 1,000.

### Variations

**ACH-005 · Works**
As someone earning several at once, I want not to be flooded, so that the
moment stays nice.
*Outcome:* Top 3 and "and N more".

**ACH-006 · Works**
As someone ignoring the card, I want it not to return, so that it isn't
nagging.
*Outcome:* Handed out once, however it's left.

**ACH-007 · Works**
As someone with a run in progress, I want honest progress, so that I can see
where it stands.
*Outcome:* Locked ones show progress, runs included.

**ACH-008 · Works**
As someone logging timed tasks, I want hours to count, so that time badges
mean something.
*Outcome:* Hours come from real durations only: a task with no time logs
none.

### Edge cases

**ACH-009 · Works**
As someone deleting a task with history, I want its ranks kept, so that
earned stays earned.
*Outcome:* Kept under "From before" with the name it had, no longer counted
on. (EC-36)

**ACH-010 · Works**
As someone taking days off during a run, I want the run to survive, so that
rest isn't punished.
*Outcome:* Days off and Away neither count nor break it. (EC-37)

**ACH-011 · Works**
As someone whose run ends, I want nothing said, so that there's no guilt.
*Outcome:* It simply starts counting again.

**ACH-012 · Works**
As someone unticking after earning a rank, I want it not to be taken back,
so that earned stays earned.
*Outcome:* Never revoked.

**ACH-013 · Works**
As someone earning with a commitment, I want it kept separate, so that life
units aren't inflated.
*Outcome:* Commitment ticks never count toward a life unit's or area's.
(EC-41)

**ACH-014 · Works**
As someone with a low day, I want achievements not to affect it, so that the
grade is about consistency.
*Outcome:* Achievements never grade a day.

**ACH-015 · Works**
As someone working towards "days worth remembering", I want a way to
progress, so that the badge is achievable.
*Outcome:* Flagging a day or an activity counts toward it.

**ACH-016 · Gap**
As someone wanting to set their own goal, I want a custom achievement, so
that I can aim at my own thing.
*Outcome:* Excluded on purpose: defined by the app (ADR-0047).

**ACH-017 · Gap**
As someone proud of a rank, I want to share it, so that friends can see.
*Outcome:* Excluded on purpose: no sharing or leaderboards (ADR-0047).

**ACH-018 · Gap**
As someone wanting per-task badges, I want a badge for each task, so that
each habit is recognised.
*Outcome:* Excluded on purpose: retired for unit-level ones (ADR-0050).

## LOG: Log and month review

### Happy path

**LOG-001 · Works**
As someone looking back, I want my notes, photos and achievements in one
list, so that I can see my life.
*Outcome:* Entries by day, each with score (past days only), achievements,
notes and photos.

**LOG-002 · Works**
As someone at the end of a month, I want a summary, so that the month gets a
moment.
*Outcome:* Month review: score, "out of 100, across all N days", what you
wrote and "Earned this month".

**LOG-003 · Works**
As someone searching for a kind of thing, I want to filter, so that I find
it fast.
*Outcome:* Everything, Notes, Photos, Reached, Kept.

**LOG-004 · Works**
As someone looking at a period, I want to limit the range, so that the list
is manageable.
*Outcome:* This month, 3 months, This year, All time (with 2 or more
months).

### Variations

**LOG-005 · Works**
As someone viewing a photo, I want to see it full screen, so that I can
enjoy it.
*Outcome:* Tap; no delete here.

**LOG-006 · Works**
As someone with special days, I want them kept, so that the big days stand
out.
*Outcome:* A special day's title makes it worth keeping, even without notes.

**LOG-007 · Works**
As someone with filters on, I want a way back, so that I don't think things
vanished.
*Outcome:* "Showing a slice of your log · show everything".

### Edge cases

**LOG-008 · Works**
As someone brand new, I want to be told what will appear, so that the tab
isn't a dead end.
*Outcome:* "Your notes, photos and achievements collect here."

**LOG-009 · Works**
As someone whose filter matches nothing, I want a way out, so that I'm not
stuck.
*Outcome:* "Nothing here matches that." with "Show everything".

**LOG-010 · Works**
As someone with an ungraded month, I want no false score, so that it isn't
judged.
*Outcome:* "Nothing graded yet." and "—".

**LOG-011 · Works**
As someone with no notes, I want no scolding, so that I'm not made to feel
bad.
*Outcome:* "Nothing written down this month." is neutral.

**LOG-012 · Works**
As someone whose log fails to load, I want to retry, so that I'm not stuck.
*Outcome:* "This screen couldn't load" with "Try again".

**LOG-013 · Works**
As someone reading the empty Log, I want the right tab name, so that I can
find it.
*Outcome:* It says "on Today".

**LOG-014 · Works**
As someone wanting to jump from an entry to its day, I want to open that
day, so that I can edit it.
*Outcome:* Tap an entry's date to open that day on Today.

**LOG-015 · Gap**
As someone searching my notes, I want free-text search, so that I find an
old note.
*Outcome:* Not built.

**LOG-016 · Gap**
As someone keeping records elsewhere, I want to export notes or photos, so
that I own my writing.
*Outcome:* Partly: backup is the whole database and leaves out photos. No
readable export.

## TIM: Time: day start, clocks, travel, weeks

### Happy path

**TIM-001 · Works**
As a night owl, I want my day to end when I go to bed, so that 2 am still
counts as today.
*Outcome:* "Day starts at" in Settings, 12 am to 11 pm, default 3 am.

**TIM-002 · Works**
As someone on shifts, I want my day to begin in the afternoon, so that the
app matches my life.
*Outcome:* Any whole hour, saved after 700 ms. A day runs 24 hours from it.

**TIM-003 · Works**
As someone up past midnight, I want to still be on yesterday's list, so that
I can finish it.
*Outcome:* Before the day starts it is still the previous day. (EC-07)

### Variations

**TIM-004 · Works**
As someone changing Day starts at, I want my times to stay right, so that
nothing shifts by surprise.
*Outcome:* Stored times are rebased to the same clock time, and no grade
changes. Today can become "yesterday".

**TIM-005 · Works**
As someone with an event at 1 am, I want it in the right part, so that the
list reads naturally.
*Outcome:* It sits in Night, which runs 12 to 5 and shows only when it holds
something.

**TIM-006 · Works**
As someone starting something before the next day begins, I want it to stay
on the day it started, so that late sessions aren't split.
*Outcome:* It belongs to the day it started, for up to a day.

**TIM-007 · Works**
As someone watching the week change, I want Sunday to start a new week, so
that counts reset predictably.
*Outcome:* Weeks run Sunday to Saturday, fixed.

### Edge cases

**TIM-008 · Works**
As someone up when the clocks go forward, I want the date to be right, so
that ticks land on the right day.
*Outcome:* The day turns over by the wall clock, so 3:30 am after the change
is the new day. (EC-03)

**TIM-009 · Works**
As someone up when the clocks go back, I want nothing twice, so that the
record stays clean.
*Outcome:* Date logic reads the wall clock. Nothing appears twice. (EC-04)

**TIM-010 · Works**
As someone flying across time zones, I want the day to follow my phone, so
that I'm on the local day.
*Outcome:* The day follows the phone's local date. (EC-05)

**TIM-011 · Works**
As someone with the app open across a clock or zone change, I want the day
to update, so that it isn't stale.
*Outcome:* "Now" is worked out again when the app comes to the front.
(EC-44)

**TIM-012 · Works**
As someone with a day older than last week's Sunday, I want to know it's
settled, so that old grades stay put.
*Outcome:* Settled means before last week's Sunday, so 7–13 days back. It's
a marker, not a lock.

**TIM-013 · Works**
As someone at a month boundary, I want the weekly and month totals right, so
that numbers match.
*Outcome:* Weeks cross months freely; month review counts its own days.

**TIM-014 · Works**
As someone using the app at the exact start of the day, I want one clear
answer, so that the day doesn't flicker.
*Outcome:* At the start hour it is already the new day.

**TIM-015 · Gap**
As someone travelling often, I want a home time zone, so that my days stay
consistent.
*Outcome:* Not built. The phone's date is the app's date.

**TIM-016 · Gap**
As someone whose week starts on Monday, I want to set the week start, so
that counts match how I think.
*Outcome:* Not built. The spec's EC-08 describes it; no such setting exists.

## AWY: Time away

### Happy path

**AWY-001 · Works**
As someone going on holiday, I want to set the dates, so that nothing is
expected while I'm gone.
*Outcome:* Settings, Time away, "Add time away": First day, Last day,
optional label.

**AWY-002 · Works**
As someone back early, I want to edit or remove it, so that the record is
right.
*Outcome:* Coming up and Past rows open the same sheet. Remove asks first.

### Variations

**AWY-003 · Works**
As someone naming a trip, I want a label, so that it reads well.
*Outcome:* Shown on Today as "Away · label · back Weekday". Blank falls back
to "Away".

**AWY-004 · Works**
As someone adding Away from the weekly pass, I want a shortcut, so that it's
quick.
*Outcome:* "Time away" link.

### Edge cases

**AWY-005 · Works**
As someone away for part of a week, I want flexible work to adjust, so that
I'm not punished.
*Outcome:* Flexible runs spread over the other days; if none are left, they
lapse. (EC-30)

**AWY-006 · Works**
As someone setting Away from today after ticking, I want today kept, so that
work done still counts.
*Outcome:* Today is still graded; the form defaults to starting tomorrow.
(EC-31)

**AWY-007 · Works**
As someone correcting past Away days, I want to change them, so that the
record is right.
*Outcome:* Past Away days can change until they settle. The spec says 14
days; see Findings. (EC-32)

**AWY-008 · Works**
As someone picking dates backwards, I want to be guided, so that I can't
save nonsense.
*Outcome:* A first day after the last pulls the last forward; Save is
disabled if the end is before the start.

**AWY-009 · Works**
As someone adding Away too far back, I want to be told, so that I know the
limit.
*Outcome:* "Away can only start from last week on."

**AWY-010 · Works**
As someone with events during Away, I want none due, so that I'm not asked.
*Outcome:* No events are due on an Away day.

**AWY-011 · Works**
As someone Away with an unfinished run, I want no break, so that time off
isn't a failure.
*Outcome:* Away days neither count nor break runs.

**AWY-012 · Works**
As someone logging while Away, I want it kept, so that I can still record
things.
*Outcome:* Things can still be logged.

**AWY-013 · Gap**
As someone with regular time off, I want a repeating Away, so that I don't
re-add it.
*Outcome:* Not built.

## SET: Settings, reminders, calibration

### Happy path

**SET-001 · Works**
As someone wanting a nudge, I want a daily reminder at a time I pick, so
that I remember to open it.
*Outcome:* Daily reminder switch, then Time (default 09:00). One local
notification, from 4 gentle lines.

**SET-002 · Works**
As someone reflecting weekly, I want to say how content I felt, so that the
app can check its grades against that.
*Outcome:* A step in the weekly pass, or Settings, Calibration: dial 1–10.

**SET-003 · Works**
As someone curious, I want to see how grades track contentment, so that I
know whether the plan works.
*Outcome:* Insight appears with 8 samples over 6 weeks; before that, "Still
learning your rhythm…" or "Not enough overlapping weeks yet…".

### Variations

**SET-004 · Works**
As someone who has finished today, I want no pointless reminder, so that it
isn't noise.
*Outcome:* If every actionable task is done, or the day is rest or special,
the next reminder is tomorrow.

**SET-005 · Works**
As someone who denied notifications in iOS, I want to be told how to fix it,
so that I'm not confused.
*Outcome:* "Notifications are off at the system level." and "Open system
settings".

**SET-006 · Works**
As someone who missed last week's check-in, I want to answer it, so that the
data is complete.
*Outcome:* It targets "Last week" while unanswered, otherwise "This week",
which can be changed.

**SET-007 · Works**
As someone answering the weekly question, I want to skip it, so that it
never nags.
*Outcome:* Next moves on with no answer; nothing is tracked as missed.

### Edge cases

**SET-008 · Works**
As someone with a low contentment rating, I want no special treatment, so
that the app isn't targeting me.
*Outcome:* No copy or prompt conditions on low contentment.

**SET-009 · Works**
As someone needing support, I want to find resources, so that help is always
there.
*Outcome:* Static Support lines in Settings, never surfaced reactively.

**SET-010 · Works**
As someone starting over, I want to reset everything, so that I can begin
again.
*Outcome:* "Reset everything?" offers "Export a backup first", then a second
alert: "There's no way back from this."

**SET-011 · Works**
As someone turning the time wheel then leaving at once, I want the time to
be saved, so that my reminder is right.
*Outcome:* A time still waiting to save is saved as you leave.

**SET-012 · Works**
As someone tapping a reminder, I want to land on Today, so that the nudge is
useful.
*Outcome:* Tapping the reminder opens Today.

**SET-013 · Works**
As someone whose calibration save fails, I want to be told, so that I can
retry.
*Outcome:* A failure says "That didn't save", and Save comes back.

**SET-014 · Gap**
As someone offered a suggestion, I want Accept to work, so that the feature
does something.
*Outcome:* Not built: suggestions were removed (Henry, 2026-11-10). Formula
v8 left nothing for one to change, so Calibration shows insight only.

**SET-015 · Works**
As someone wanting the weekly question, I want to be asked it, so that I
don't have to remember.
*Outcome:* The weekly pass asks it as a step, the same way every week.
Calibration still has it.

**SET-016 · Gap**
As someone wanting several reminders, I want more than one a day, so that
morning and evening both work.
*Outcome:* Not built.

**SET-017 · Works**
As someone wanting a theme choice, I want to pick light or dark, so that the
app suits me.
*Outcome:* Settings, Appearance: System, Light or Dark.

**SET-018 · Gap**
As someone with a Lock Screen habit, I want a widget, so that I can see
today without opening the app.
*Outcome:* Not built.

## DAT: Backup, restore and privacy

### Happy path

**DAT-001 · Works**
As someone careful with data, I want to back up, so that I won't lose it.
*Outcome:* "Back up now" writes life-strategy-{date}.lsbk and opens the
share sheet.

**DAT-002 · Works**
As someone with a new phone, I want to restore, so that my history comes
with me.
*Outcome:* "Choose a backup file", shows its details, then "Restore this
backup?" and "Replace my data".

**DAT-003 · Works**
As someone wondering about privacy, I want to know where data lives, so that
I can trust it.
*Outcome:* "Where your data lives": on this device, no account, no server.

### Variations

**DAT-004 · Works**
As someone restoring the wrong file, I want a way back, so that a slip isn't
fatal.
*Outcome:* The current database is written as `.pre-restore` before
replacing. There's no button to use it.

**DAT-005 · Works**
As someone cautious about a backup's contents, I want to be warned, so that
I keep it safe.
*Outcome:* "The file isn't locked with a passphrase, so anyone who has it
can read what's in it."

**DAT-006 · Works**
As someone restoring from an older version, I want it to upgrade, so that
old backups work.
*Outcome:* Older schemas migrate forward on relaunch.

### Edge cases

**DAT-007 · Works**
As someone picking a random file, I want to be told, so that nothing is
replaced.
*Outcome:* "That file isn't a Life Strategy backup."

**DAT-008 · Works**
As someone with a damaged backup, I want nothing replaced, so that my data
is safe.
*Outcome:* "This backup is damaged and can't be restored."

**DAT-009 · Works**
As someone restoring a newer backup into an older app, I want to be told, so
that I update first.
*Outcome:* "This backup came from a newer version of the app. Update first,
then restore."

**DAT-010 · Works**
As someone with a passphrase-era backup, I want an honest message, so that I
know why.
*Outcome:* It explains that this version can't open it.

**DAT-011 · Works**
As someone cancelling the picker, I want nothing to happen, so that it's
harmless.
*Outcome:* Silent.

**DAT-012 · Works**
As someone with a full disk during restore, I want nothing broken, so that
my data survives.
*Outcome:* The incoming file is written first, so a full disk fails before
the live file is touched.

**DAT-013 · Works**
As someone after a restore, I want to know what to do, so that I don't use
old data.
*Outcome:* "Close the app completely and open it again. It's still running
on the old data until you do."

**DAT-014 · Works**
As someone with photos after a restore, I want no crash, so that the rest
works.
*Outcome:* Photos aren't in backups; the day shows a placeholder.

**DAT-015 · Works**
As someone tapping Done after a restore, I want not to keep using stale
data, so that nothing is lost.
*Outcome:* After a restore the screen keeps its relaunch message, with no
Done.

**DAT-016 · Works**
As someone reading Privacy, I want accurate scope, so that I know what's
backed up.
*Outcome:* Privacy says a backup holds everything except photos.

**DAT-017 · Gap**
As someone wanting peace of mind, I want automatic or iCloud backup, so that
I don't have to remember.
*Outcome:* Parked: ADR-0012's call.

**DAT-018 · Gap**
As someone wanting photos backed up, I want them in the file, so that
nothing is lost.
*Outcome:* Not built: "Photos aren't included yet."

**DAT-019 · Gap**
As someone wanting encryption, I want a passphrase on backups, so that my
file is safe.
*Outcome:* Excluded on purpose: any cryptography has legal consequences
(ADR-0020, ADR-0046).

## SUP: Feedback, problems and failures

### Happy path

**SUP-001 · Works**
As a tester with an idea, I want to send feedback, so that it reaches the
developer.
*Outcome:* Send feedback: An idea, Confusing or Not working, up to 2000
characters. Opens Mail.

**SUP-002 · Works**
As a tester with a bug, I want to see and send the problem log, so that it
gets fixed.
*Outcome:* Problem log: counts and entries; "See exactly what gets sent";
"Send log".

### Variations

**SUP-003 · Works**
As someone with no Mail set up, I want another way, so that it still sends.
*Outcome:* Falls back to the share sheet, then an inline error.

**SUP-004 · Works**
As someone part-way through writing, I want my draft kept, so that I don't
lose it.
*Outcome:* The draft stays on leaving; "Clear my note" removes it.

**SUP-005 · Works**
As someone worried about what's sent, I want to read it first, so that I can
decide.
*Outcome:* "See exactly what gets sent".

### Edge cases

**SUP-006 · Works**
As someone with a long message, I want a warning, so that I'm not cut off.
*Outcome:* "n characters left" under 200.

**SUP-007 · Works**
As someone with a clean log, I want to be told, so that I know it's fine.
*Outcome:* "Nothing here yet." with a Send feedback link.

**SUP-008 · Works**
As someone clearing the log, I want to do so, so that it's mine.
*Outcome:* "Clear the log", no confirmation.

**SUP-009 · Works**
As someone whose database won't open, I want calm information, so that I
don't panic.
*Outcome:* "Couldn't open your data": "Nothing is lost. Closing and
reopening the app usually fixes this."

**SUP-010 · Works**
As someone whose screen crashes, I want to recover, so that I'm not stuck.
*Outcome:* "This screen ran into a problem" with "Try again".

**SUP-011 · Works**
As someone whose screen fails to load, I want to retry, so that I'm not
stuck.
*Outcome:* "This screen couldn't load" with "Try again".

**SUP-012 · Works**
As someone whose write fails, I want to be told, so that I don't assume it
saved.
*Outcome:* "That didn't save".

**SUP-013 · Works**
As someone following an unknown link, I want no crash, so that the app holds
up.
*Outcome:* Unknown `?add=` values are ignored and the parameter is cleared.

**SUP-014 · Works**
As someone hitting a commitment race, I want readable copy, so that I
understand it.
*Outcome:* It reads "Three commitments is the most at once. Archive one to
add another."

**SUP-015 · Works**
As someone sharing feedback by the share sheet, I want an honest state, so
that I know it went.
*Outcome:* A dismissed share sheet goes back to writing; nothing is marked
sent.

**SUP-016 · Works**
As someone whose feedback draft fails to load, I want the screen to work, so
that I can still write.
*Outcome:* A draft that won't load starts the box empty.

**SUP-017 · Gap**
As someone needing help now, I want in-app chat or support, so that I can
ask someone.
*Outcome:* Excluded on purpose: no server; support lines only.

## A11: Accessibility and devices

### Happy path

**A11-001 · Works**
As a VoiceOver user, I want every row to be readable and tickable, so that I
can use the app fully.
*Outcome:* Rows are checkboxes with a title and caption. The grip is hidden;
hold actions do the work.

**A11-002 · Works**
As a VoiceOver user, I want to move between days, so that I don't need
swipes.
*Outcome:* Previous and next day actions on the date.

**A11-003 · Works**
As someone with larger text, I want nothing cut off, so that I can read it.
*Outcome:* Rows wrap and the size label moves under the title. (EC-46)

**A11-004 · Works**
As someone with Reduce Transparency or Increase Contrast, I want solid,
high-contrast surfaces, so that it's legible.
*Outcome:* Glass becomes solid and higher-contrast colours are used. (EC-45)

**A11-005 · Works**
As someone with Reduce Motion, I want calm animation, so that I'm
comfortable.
*Outcome:* The lifted row doesn't scale, and day changes stay simple.

### Variations

**A11-006 · Works**
As a VoiceOver user using Undo, I want time to reach it, so that I don't
miss it.
*Outcome:* The undo bar has no timeout under VoiceOver.

**A11-007 · Works**
As a VoiceOver user on Life, I want a menu alternative to dragging, so that
I can sort my units.
*Outcome:* "Tier and weight" action, plus Move to {tier} in the hold menu.
(EC-47)

**A11-008 · Works**
As someone on the smallest iPhone, I want everything to fit, so that I'm not
excluded.
*Outcome:* Today's rows and grip checked at 320 points wide in the web
preview. Not checked on a device.

**A11-009 · Works**
As someone using a large iPhone, I want sensible layout, so that space isn't
wasted.
*Outcome:* Layouts are fluid. Not checked at this width in the latest build.

**A11-010 · Works**
As someone in dark mode, I want it to follow the system, so that it matches
my phone.
*Outcome:* Light and dark themes from the system setting.

### Edge cases

**A11-011 · Works**
As a VoiceOver user on Today, I want a way to move a task to another part,
so that I'm not locked out.
*Outcome:* "Move to…" in the hold menu lists the other parts of the day;
VoiceOver reaches it through the row's action.

**A11-012 · Gap**
As someone on an iPad, I want a layout built for it, so that it uses the
space.
*Outcome:* Not built as a target.

**A11-013 · Gap**
As someone on a Mac or the web, I want to use it there, so that I can plan
at a desk.
*Outcome:* Excluded on purpose: the web is a development preview only
(AGENTS.md).

## PRK: Parked while windows are set aside

### Windows and working hours (ADR-0051)

- **PRK-001 · Parked** Set weekly working hours, like iOS Sleep schedules.
- **PRK-002 · Parked** Work from a day cut into windows: hours minus events,
  with a 10-minute buffer.
- **PRK-003 · Parked** Open the app at a window boundary; the minute belongs
  to the next window.
- **PRK-004 · Parked** An event fills a whole working range, leaving no
  window.
- **PRK-005 · Parked** Buffers leave under 30 minutes, shown as a buffer.
- **PRK-006 · Parked** A task bigger than every window goes under "Doesn't
  fit today".
- **PRK-007 · Parked** No hours set: three default windows and a banner.
- **PRK-008 · Parked** A day in no schedule lists events and all open tasks.
- **PRK-009 · Parked** Change hours "this week and after" mid-week; earlier
  days keep theirs.
- **PRK-010 · Parked** A window with pins is removed or shortened; pins move
  on.
- **PRK-011 · Parked** An event inside a window with pins splits it.
- **PRK-012 · Parked** 40 tasks in one window: "Show all (40)".
- **PRK-013 · Parked** Hours changed mid-week keep settled commitment
  shares.
- **PRK-014 · Parked** Add a window outside working hours.
- **PRK-015 · Parked** An added window overlaps an event and is trimmed.
- **PRK-016 · Parked** A day edit saved with "Repeat every Wednesday".
- **PRK-017 · Parked** An added window overlaps another; the new one takes
  the overlap.
- **PRK-018 · Parked** A window added at lunch keeps the commitment share.
- **PRK-019 · Parked** Move a task with "Move it", or swap with ⇄.
- **PRK-020 · Parked** File a tick under another window with "Done in…".
- **PRK-021 · Parked** Pull in another task, or add from open.
- **PRK-022 · Parked** The weekly pass's windows step and "Change hours this
  week".
- **PRK-023 · Parked** Do N of these: a choice saved earlier still scores;
  nothing can create one.

## Coverage of the spec's edge cases

Each EC from `redesign-spec.md` §7, by story or reason.

- EC-01: Void: the 3 am cap went with ADR-0049.
- EC-02: Void: overnight events are allowed now (see EVT).
- EC-03: TIM-008
- EC-04: TIM-009
- EC-05: TIM-010
- EC-06: PRK-003
- EC-07: TIM-003
- EC-08: Void: weeks are fixed Sunday to Saturday; no such setting exists.
- EC-09: EVT-009
- EC-10: PRK-004
- EC-11: PRK-005
- EC-12: PRK-006
- EC-13: PRK-007
- EC-14: PRK-008
- EC-15: PRK-009
- EC-16: PRK-010
- EC-17: PRK-011
- EC-18: PRK-012
- EC-19: TOD-024
- EC-20: MOV-011
- EC-21: EVT-012
- EC-22: EVT-013
- EC-23: COM-014
- EC-24: NOT-011
- EC-25: EVT-014
- EC-26: EVT-015
- EC-27: EVT-016
- EC-28: DAY-005
- EC-29: DAY-012, DAY-013
- EC-30: AWY-005
- EC-31: AWY-006
- EC-32: AWY-007
- EC-33: Void: Day type can only be set on a day that has begun.
- EC-34: TSK-019
- EC-35: TSK-002
- EC-36: ACH-009
- EC-37: ACH-010
- EC-38: Void: nothing can set "Took about" any more.
- EC-39: LIF-012
- EC-40: LIF-013
- EC-41: ACH-013
- EC-42: Void: withdrawn 2026-10-19.
- EC-43: WKP-011
- EC-44: TIM-011
- EC-45: A11-004
- EC-46: A11-003
- EC-47: A11-007
- EC-48: TCK-015
- EC-49: TCK-016
- EC-50: PRK-013
- EC-51: DAY-016
- EC-52: PRK-014
- EC-53: PRK-015
- EC-54: PRK-016
- EC-55: PRK-017
- EC-56: PRK-018

## Findings for triage

### Suspect stories

None open: all 30 found on 2026-11-08 are fixed or now Gap.

### Where the docs and code disagree

- EC-01, EC-02 and EC-07 still state the 3 am cap (ADR-0049 replaced it).
- EC-08 describes a week-start setting that does not exist.
- EC-26 says a finished series is archived the next day; the code waits
  until its end date is before the edit window (`db/seriesRules.ts:96`).
- EC-32 and ADR-0040 §5 say a 14-day window; settling is 7 to 13 days back,
  and it is a marker, not a lock.
- vision.md:174 says a 60 to 80% share and spec §8.2 names
  `commitmentBandMax`; the code uses `shareLimit`, 70, 70 or 80.
- Spec §4.7 says flexible work spreads "as with a day off"; only Away leaves
  the divisor.
- ADR-0047 §3 counts hours from a tick's size; the code counts only real
  time.
- vision.md:133 and ADR-0029's one-off pool are superseded by ADR-0050;
  vision.md still describes windows and per-task series.
