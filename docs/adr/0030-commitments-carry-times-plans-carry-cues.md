# ADR-0030: Commitments carry times; plans carry cues

> **Status:** Proposed\
> **Date:** 2026-08-21\
> **Deciders:** Henry

> **Reopening notice.** ADR-0024 §1 states: *"No time picker exists
> anywhere in the app, and none is added later without reopening this
> ADR."* This is that reopening. ADR-0025 §7 recorded the same
> decision reaffirmed under challenge. Both stand except where §2
> below amends them, and the amendment is a closed list.

> **What Henry decided (2026-08-21), and what is drafted around it.**
> Two calls are his: clock times arrive **narrowly** — on fixed
> commitments and deadlines, never on ordinary tasks — and free
> intervals are **shown, not filled** (no backwards planning from a
> deadline, no auto-placement). He then described the day he wants:
> *"you have classes and quizzes and assignments and then in the free
> time the regular tasks appear. You choose which tasks appear in which
> time period."* §4 is the answer to that sentence, and the cue model
> in it is drafted, not decided.

## Context

ADR-0024 §1 refused clock times and gave a **functional** reason, not
only a psychological one:

> Henry argued for times on the strength of real cases — a weekly band
> practice, a Tuesday night movie tradition, a tee time — and the
> argument that carried for holding the line was **functional, not
> psychological: a clock time would drive nothing this app does.**
> There are no per-task reminders and no time-slot calendar, so the
> only thing a time could affect is checklist ordering, which
> part-of-day already provides.

That reason was true when it was written and is no longer true. ADR-0029
adds a timetable, and an hour grid is a thing a clock time drives. The
ADR's own logic is what licenses the amendment: the premise changed.

The psychological finding is separate and still holds:

- **Tonietto & Malkoc 2016** (13 studies): scheduling a leisure
  activity makes it feel more work-like and reduces enjoyment — and
  "rough scheduling" eliminates the effect. What they manipulated was
  **self-imposed scheduling of discretionary activity**. A 9am lecture
  is neither self-imposed nor discretionary. The finding does not reach
  it.
- **Gollwitzer & Sheeran 2006**, quoted in ADR-0024's own Context: the
  effective form of an implementation intention specifies **a cue, not
  a clock**. §4 leans on this rather than working around it.

Constraints already in force:

- **Plans never touch the grade** (ADR-0024 §2) — an invariant, not a
  default.
- **The daily surface stays checklist-simple** (PRODUCT.md principle 2)
  and **read-mostly with respect to planning** (ADR-0024 §4).
- **A mode is presentation and grammar, never arithmetic**
  (ADR-0028 §3).
- Notification copy carries no task names, no unit names, no counts
  (ADR-0010 §3, reaffirmed by ADR-0024 §5).

## Open questions

1. What, exactly, may carry a clock time?
2. What stops that list growing?
3. What does a day look like when it has both a timetable and a plan?
4. How does a task get into a free interval without acquiring a time?
5. What may be dragged on the grid?
6. Do commitments get reminders?

## Options considered

### How much of ADR-0024 §1 to reopen

- **Full reversal — any task may carry a start time.** Most
  calendar-like; the grid becomes a true scheduler. Rejected: it
  discards the Tonietto & Malkoc protection on exactly the tasks the
  app most wants people to do, and it makes part-of-day a vestigial
  second answer to a question that now has two.
- **Times optional on any task, off by default.** Rejected for the
  failure mode ADR-0024 §3's 2026-08-17 amendment already fixed once:
  two groupings for one list, and which you got depended on a field you
  may never have opened.
- **Times only on things somebody else set.** **Chosen.** The line is
  *who set the time*, which is a fact about the object rather than a
  preference, so it cannot drift.

### How a task reaches a free interval

- **Give it a start time.** The obvious answer, and it is full reversal
  by another name.
- **Leave it in part-of-day and let the user read the gap.** What the
  first draft of this work proposed. Rejected by Henry's sentence: he
  wants to *choose* which tasks appear in which period, and reading a
  gap is not choosing.
- **Cue it to the commitment it follows.** **Chosen** — §4.

## Decision

### 1. Only things somebody else set may carry a clock time

The line is **who set the time.** A lecture, a lab, a shift and a
submission deadline are external facts about a week. "I will do this at
three" is an intention about it, and intentions stay rough.

This is a fact about the object, not a user preference, so there is no
setting and no per-task escape hatch.

### 2. The complete list of clock-time columns

    fixed_commitment.start_minute
    fixed_commitment.end_minute
    assessment.due_minute

**That is the entire list.** A fourth requires reopening *this* ADR,
the same way §1 above reopened ADR-0024.

Times are **integer minutes from local midnight**, not `"HH:MM"`. The
grid does arithmetic on them constantly; integers sort correctly,
compare correctly and cannot be malformed. It also makes the boundary
structural rather than merely stated: `task` has no integer-minute
column, and nothing on the task path reads one.

`task.one_off_due` stays **date-only**. A deadline's time lives on the
assessment; the task that works toward it does not inherit it.

Three enforcement mechanisms, listed so a reviewer knows what to check:

- No minute column on `task`, `goal`, `activity` or `planned_occurrence`.
- `PART_OF_DAY_BOUNDS` (§3) is display-only and never written back.
- The time control appears on commitment and assessment screens only —
  never on `TaskEditSheet`, `AddTaskModal` or `SchedulePicker`.

### 3. The day grid: two grammars, side by side

Schedule mode (ADR-0028 §2.1) gives Home's day surface a second layout,
chosen by a two-segment control in the date header beside the existing
*Plan ahead* affordance. The preference is `app_setting` key
`today.layout`, default `checklist`.

The grid renders a day as hour rows across a window (default
07:00–22:00, widened to contain any block):

- **Commitments and timed exams are blocks**, positioned by their
  minutes, in course hues — as a **wash with an Ink label**, never a
  solid hue behind small text (DESIGN.md).
- **Gaps of 30 minutes or more are free intervals**, rendered as
  captioned empty bands reusing the existing `FREE_LABEL`. Shorter gaps
  render as **buffer**, not free: fifteen minutes between two lectures
  across campus is not time you have, and a grid that claims otherwise
  is lying to the person reading it.
- **Tasks sit in the free intervals** (§4), or in part-of-day lanes
  when unplaced.

The day shows its **terrain** and its **intentions** in one view, and
"Free until this afternoon" — the sentence ADR-0024's 2026-08-17
amendment called the most useful thing that screen can say — becomes
literally visible.

`PART_OF_DAY_BOUNDS` (`morning` up to 12:00, `afternoon` to 17:00,
`evening` after) decides where a lane label sits. **It is display-only.
It is never written to a task, never read back into `task.part_of_day`,
never persisted and never offered as a picker.** The moment it becomes
a write path, a task has acquired a clock time and §1 is broken in fact
even though no time picker exists. This is the sharpest invariant risk
in the whole module.

The rollover hour is 3am (`ROLLOVER_HOUR`, ADR-0004 §1). The grid's
window is a display concern and must not be confused with the day
boundary.

### 4. A task is placed by cue, not by clock

Placing a task into a free interval stores **what it follows**, not
when it starts:

    task_placement — id, task_id, local_date,
                     after_commitment_id (nullable),
                     slot_index, order_in_slot

"After the 11am lecture," not "at 12:15." Three reasons, and the second
is the one that decides it:

1. **The research asks for exactly this.** Gollwitzer & Sheeran, quoted
   in ADR-0024's own Context, found the effective implementation
   intention specifies **a cue, not a clock**. A placement cued to the
   end of a lecture is a *better* implementation intention than
   part-of-day, not a weaker one.
2. **It survives a timetable change.** Move the lecture to 2pm and
   "after the lecture" moves with it. `12:15` would silently become
   wrong, and nothing would say so. A clock time cannot do this, and
   this is the functional argument §1 requires.
3. **§1 stays literally true.** The task points at a commitment; the
   commitment carries the time.

`slot_index` covers the gaps no commitment bounds — before the first
block, after the last — so every interval is addressable.

**A placement refines `task.part_of_day`; it never replaces it.** A
task always has a part-of-day answer, so turning Schedule mode off
reveals a coherent checklist rather than a pile of unplaced rows
(ADR-0028 §3).

**ADR-0024 §2 is untouched and restated here because §4 is exactly
where it would be lost:** a placement is an intention. It never touches
the grade. Doing the task in a different gap, on a different day, or
not at all is scored identically. An unfulfilled placement **lapses
silently** — not surfaced, not counted, never mentioned. No adherence
rate, plan-completion percentage or streak is computed or stored.

### 5. Tasks may be dragged; commitments may not

You may move what you set. Dragging a lecture would assert that the
lecture moved, which is false — and false in exactly the way §1 exists
to prevent.

So: tasks drag into and between free intervals, reusing the drag
grammar ADR-0024 §3's 2026-08-18 amendment already built; commitment
blocks are inert and open their course on tap. Empty free intervals are
drop targets, for the reason that amendment gives — "do this in the
gap" matters most when the gap is empty, which is exactly when there is
no row to drop beside.

Placement happens on the **weekly pass and the look-ahead planner**
(ADR-0024 §4), not as a running obligation. The daily surface stays
read-mostly: you may complete anything at any time regardless of where
it sits, and nothing on the day asks you to re-plan.

### 6. Commitments get no notifications

*"Your lecture starts in 15 minutes"* puts a course name on the lock
screen, which is precisely the disclosure ADR-0010 §3's copy rule
exists to prevent and which ADR-0024 §5 declined to reopen for pinned
days. Having a clock time does not change that argument; it only makes
the feature possible, which is not the same as making it right.

ADR-0010's reminder set stays at one. Adding commitment reminders means
reopening ADR-0010 §3.

## Consequences

**Easier.** A timetable can be honest about a week. Free time becomes a
thing the app can point at rather than infer. And a placement now
carries the cue that the research says makes an implementation
intention work, which part-of-day only approximated.

**Harder.** "No clock times" was a rule anyone could check in one
sentence, and it is now a rule with a three-item list attached. §2 is
written as a closed list precisely because a rule with exceptions
decays into a rule with more exceptions.

**Accepted cost.** A cue-based placement is more machinery than a
timestamp, and it is genuinely harder to explain in a tooltip. It also
has a failure mode a timestamp does not: delete the commitment and the
placement loses its anchor. It falls back to `slot_index` on that date
and, failing that, to the task's part of day — never to nothing.

If this ADR proves wrong, it will be §4 that was wrong, and the symptom
will be people asking for a start time anyway.

**Revisit when:** a fourth clock-time column is proposed; or real use
shows the cue model is understood as a time by the person using it,
which would mean the distinction is only real to the schema.

## Action items

1. [ ] `packages/scoring/src/timetable.ts` — `termWeek`, `parseWeeks`,
       `inBreak`, `occursOn`, `overlapGroups`, `freeIntervals`,
       `formatMinutes`. Pure, vitest-covered, no React Native imports.
       `occursOn` is the single answer to "does this block happen on
       this date," as `isDueOn` is for tasks.
2. [ ] `components/today/dayGridLayout.ts` — the pixel walk, RN-free
       and tested, following `checklistLayout.ts`'s precedent and for
       its reason: a misplaced block fails silently.
3. [ ] `components/today/DayGrid.tsx`; `task_placement` and its
       migration; the layout toggle and `today.layout` accessors.
4. [ ] Amend ADR-0024 §1 with a pointer here and the closed list;
       amend §3 with the alternate layout; restate §2 as untouched.
       **Close ADR-0024 action item 4** — no adherence statistic is
       computed anywhere, and ADR-0029 §3 makes it structurally
       impossible.
5. [ ] AGENTS.md invariant: *clock times exist only on the three
       columns in §2; no task, goal, activity, placement or plan may
       carry one.*
6. [ ] Verify at review: no time picker on `TaskEditSheet`,
       `AddTaskModal` or `SchedulePicker`; `PART_OF_DAY_BOUNDS` has no
       write path.
