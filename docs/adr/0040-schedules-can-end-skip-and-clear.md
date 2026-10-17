# ADR-0040: Schedules can end, skip a week, or be cleared

> **Status:** Accepted\
> **Date:** 2026-10-13\
> **Deciders:** Henry

## Context

A repeating event (ADR-0038) runs until it is archived. There's no way
to say it lasts a term, or that one week doesn't happen. Henry,
2026-10-12: "When adding sessions, I should be able to choose the
number of times I want a session to repeat. We also need to have some
functionality to have a repeating session skip a week or multiple weeks
for reading week and stuff like that without deleting the rest of the
sessions."

The design review added the hard days:

- Being sick: "There should be some button … to clear all windows and
  events for today and the app will just display all the tasks in a
  sortable order." That day is still graded on what you do.
- Being away: a date range with no windows, no events and no grades.
- Shift work: entering next week's shifts quickly.

He also asked for the event location field to be removed: "it's
basically just a note … I've never used it just delete it."

ADR-0031 had break weeks inside a school term score. It was withdrawn
because the general commitments model has no term (ADR-0035), so skips
here belong to events and commitments, not to a term. ADR-0038 §5 still
applies: nothing counts the events you didn't attend, and that now
includes skipped ones.

The behaviour is in [redesign-spec.md](../design/redesign-spec.md)
§§4.7, 5.5 and 5.8.

## Open questions

1. How does a repeat end?
2. How is a week skipped, and for what?
3. What do Clear today and Away do to the score?
4. What happens to event locations already saved?

## Options considered

- **End date only.** Simple, but people think in weeks ("12 weeks of
  lectures"), and it doesn't cover a gap in the middle.
- **A number of sessions, with skips pushing the rest later.** Keeps the
  count right, but moves sessions that really are fixed in time.
- **For N weeks or until a date, plus weeks you tap off** (chosen in the
  design review). Matches how timetables are written, and the other
  sessions stay where they are.
- **A commitment-wide break.** Kept as well: "Skip a week…" on a
  commitment skips all of its events that week.

## Decision

### 1. Repeats can end

A repeating event can be set to run "For N weeks", "Until a date" or
with "No end". Repeating tasks pinned to weekdays can use the same
setting. Stored as `task.repeat_from` and `task.repeat_until`; "for N
weeks" is turned into a date when saved. When the end date passes, the
task is archived the next day, and its history stays.

### 2. Weeks can be skipped

There are three ways to skip:

- **One event, one week.** In the event sheet, the series' weeks are
  listed with a switch for each.
- **A whole commitment, one week.** "Skip a week…" on the commitment
  skips all its events and commitment tasks that week, including ones
  added later. Life tasks are not affected.
- **One occurrence.** Long-press an event and choose Skip this one.

Only weeks that haven't started can be skipped as a whole week. Single
occurrences can be skipped from today on. Stored in `schedule_skip`.

Editing a series asks "This event only", "This and following" or "All
events". "This and following" ends the series and starts a new one, and
skips from that date on move with it.

### 3. Skips change what's due, through the usual path

A skipped event is not due that day. The change goes through `isDueOn`
and `isAnchoredOn` and nowhere else. So:

- A day whose only commitment work was skipped has no commitment share
  (ADR-0032 §1).
- A day skipped ahead of time that's left with nothing due can be a rest
  day (ADR-0037 §1).
- **A day emptied on the day itself is not a rest day** (Henry,
  2026-10-13). If a same-day skip or Clear today leaves nothing due, the
  day isn't graded, like a day off. Otherwise emptying a day would
  score 70, more than doing its work. A rest day needs a day that had
  nothing due when it started.
- An early tick before a skipped week takes the value of the next real
  session.

Nothing counts, labels or reports skipped events (ADR-0038 §5).

### 4. Clear today

Clear today is in Home's ⋯ menu and in Settings. It:

- skips the day's unticked events
- hides today's windows and shows every open task in one list
  (ADR-0039 §9)
- keeps the points and commitment share of any commitment work already
  ticked; with none ticked, there's no share today
- leaves life work due today due, and the day is graded as normal
- if that leaves nothing due, makes the day ungraded, like a day off;
  it never becomes a rest day (§3)
- keeps the day among those the week's flexible work is spread across

Whatever is still unfinished when the day ends carries forward to
tomorrow, as on any day (ADR-0039 §8).

Home shows "Today's cleared. Undo", and Undo works until the day ends.
The sheet also offers "Make it a day off instead". The words "sick" and
"bad day" don't appear.

### 5. Away

Settings → Time away takes a start date, an end date and an optional
label. Away days are days off (ADR-0004): they're not graded, have no
windows, no events due and no weekly pass card. Flexible work is spread
over the other days of the week. A streak goal (ADR-0042) skips them.

An Away range can include past days only within the 14-day edit window,
and only days whose grades haven't settled (ADR-0004 §1). It can't
remove the grade of a settled day.

### 6. Copying last week's events

Plan's day view and the weekly pass have "Copy last week's events", for
people whose shifts change week to week. Their new events default to
not repeating if they picked the shift-work template in onboarding
(ADR-0045).

### 7. Location is removed

The `task.location` column is dropped in a forward migration (ADR-0002)
and removed from the event sheet and from event captions. Only Henry
has used a build with the field, so nothing is moved into notes.

## Consequences

- **Easier.** A term timetable is entered once. Reading week takes one
  tap. A bad day or a trip doesn't need any workaround.
- **Harder.** "What's due on this date" now depends on bounds and skips
  as well as weekdays. Days that haven't settled yet are recalculated
  with the bounds and skips as they were on that day, so
  `plan_snapshot` must record them. Settled days are never restated.
- **Revisit when** someone needs to skip part of a week for a whole
  commitment. Today that means skipping single occurrences.

**Amends, on acceptance:**

| ADR | What changes |
|---|---|
| ADR-0029 | §1: a task outside its repeat bounds, or in a skipped week, isn't due |
| ADR-0032 | §1: a skipped or cleared day may have no commitment share |
| ADR-0037 | §1: a day skipped ahead of time can be a rest day. A day emptied on the day itself is ungraded instead |
| ADR-0004 | Day-off rules cover Away days and days emptied on the day itself |
| ADR-0038 | §1: location removed. §2: repeating events may end |

## Action items

1. [x] `inScheduleOn`, `untilForWeeks`, and repeat bounds and skips in
       `isDueOn`, `isAnchoredOn` and `weeklyGoal`. Tests for EC-21–EC-33
       and EC-48–EC-51. Done in Phase 4a (`weeklyGoalFor`, Away days in
       `computeDayLoad`, `emptiedToday` in `isRestDay`); the commitment
       cases (EC-22, EC-29's share) come with the commitment share.
2. [ ] Schema: `task.repeat_from`, `task.repeat_until`,
       `schedule_skip`, `day_clear`, `away_range`. Drop
       `task.location`. Record bounds and skips in `plan_snapshot`.
3. [ ] Event sheet: repeat length and skip weeks. Commitment "Skip a
       week…". Clear today sheet. Time away in Settings.
4. [ ] Amend ADR-0029, 0032, 0037 and 0038. Update AGENTS.md.
