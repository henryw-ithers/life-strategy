# Planning Note — The hour grid

> Status: planned, not built (2026-08-21). The decisions live in
> [ADR-0028](../adr/0028-schedule-mode.md) (the mode),
> [ADR-0029](../adr/0029-the-academic-module.md) (the model) and
> [ADR-0030](../adr/0030-commitments-carry-times-plans-carry-cues.md)
> (times, the grid, and cue-based placement). Read those first; this is
> the phase plan and the surface detail, in the shape
> [calendar-and-day-planning.md](calendar-and-day-planning.md) set.

## The idea

Henry, 2026-08-21:

> In my vision, you have classes and quizzes and assignments and then
> in the free time the regular tasks appear. You choose which tasks
> appear in which time period.

Two layouts for one day, chosen by a control in the date header:

- **List** — today's checklist, grouped by part of day. Unchanged.
- **Day** — hour rows, with commitments as blocks, the gaps between
  them named, and tasks placed into those gaps.

The Day layout exists only in Schedule mode (ADR-0028 §2.1). Off, there
is no timetable to draw and an hour grid is an empty ruler.

## What the grid shows

    07  ─────────────────────────
    08  ─────────────────────────
    09  ┌───────────────┐
        │ COMP2521      │  Lecture · CLB 7
    11  └───────────────┘
        ╌╌ Free · 2h ╌╌╌╌╌╌╌╌╌╌╌╌
        · Reading — week 4
    13  ┌───────────────┐
        │ MATH1231 lab  │  Quad G026
    15  └───────────────┘
        ╌╌ Free · 4h ╌╌╌╌╌╌╌╌╌╌╌╌
        · Gym
        · Call Dad
    19  ─────────────────────────

Three kinds of row, three grammars:

**Blocks** are commitments and timed exams, positioned by their minutes
(ADR-0030 §2). Course hue as a **wash with an Ink label**, never a
solid hue behind small text — four of the six hues fall under AA that
way in light theme (DESIGN.md, Colors). Inert: tapping opens the
course, dragging does nothing (ADR-0030 §5).

**Free intervals** are gaps of 30 minutes or more, captioned with their
length, reusing the existing `FREE_LABEL`. They are drop targets even
when empty — that is most of the point, since "do this in the gap"
matters most when the gap is empty and there is no row to drop beside.

**Buffer** is a gap shorter than the minimum. It renders as a hairline,
not as free time. Fifteen minutes between two lectures across campus is
not time you have, and a grid that offers it is lying to the person
reading it.

## The window

> **Superseded 2026-09-11** — see
> [commitments-and-the-day.md](commitments-and-the-day.md) §3g. The
> grid draws the span of the day's *windows* (not a fixed range, and
> not just its blocks); the stretches before the first and after the
> last collapse to one row each; and the planning surface shows all 24
> hours. A day with nothing planned draws its three parts of day rather
> than an empty ruler. The paragraph below is the original assumption,
> kept for the record.

~~Default **07:00–22:00**, widened to contain any block, so an empty day
is one screen and a 6am lab still renders.~~ `MINUTE_PX` derives from a
passed-in `fontScale` — the way `checklistLayout` takes `gap` as an
argument rather than importing tokens — so an hour row survives Dynamic
Type instead of clipping. A `MIN_BLOCK_PX` floor keeps a fifteen-minute
tutorial tappable.

**The window is not the day.** The rollover hour is 3am (`ROLLOVER_HOUR`,
ADR-0004 §1); a 1am session belongs to the previous day. The window is
a display concern and the two must not be confused.

## Where tasks go

A placement is **cued, not timed** (ADR-0030 §4): `task_placement`
stores which commitment the task follows, never a start time. "After
the 11am lecture" survives the lecture moving to 2pm; "12:15" would
silently become wrong.

An unplaced task sits in its part-of-day lane, ordered by
`compareForDay`. Tasks pinned to other days get their own group below
the periods and outside the drag, exactly as they do on the checklist —
ADR-0024's 2026-08-20 amendment settled that, and a day arranged one
way here and another way on Home is the same day disagreeing with
itself.

`PART_OF_DAY_BOUNDS` decides where a lane label sits. **Display-only.
Never written back.** See ADR-0030 §3 — it is the sharpest invariant
risk in the module.

## Build phases

1. **The mode.** `mode.schedule` in `app_setting`, the Settings row,
   and one gate read that five surfaces share. Nothing else visible.
2. **Terms and courses.** Schema, `db/academic.ts`, the
   `Goals · Courses` segment, `study/term.tsx`. Fix `reset.ts` while
   in there — it is already three tables behind.
3. **Commitments and the timetable math.** `fixed_commitment`,
   `packages/scoring/src/timetable.ts` with `occursOn` as the single
   answer to "does this block happen on this date." Vitest only; no
   device needed.
4. **The grid.** `dayGridLayout.ts` (pure, tested), `DayGrid.tsx`, the
   layout toggle. Read-only for arrangement.
5. **Placement.** `task_placement`, drag into and between gaps, on the
   weekly pass and the look-ahead planner.
6. **Assessments**, then **study sessions and the semester score**,
   then **term end**. See the ADRs.

## Things deliberately not in this note

- **Backwards planning from a deadline** — proposing work sessions
  across the gaps between now and a due date. Henry's call on
  2026-08-21 was that free intervals are *shown, not filled*. It is the
  strongest single argument for the whole feature and it stays parked
  until the grid is in real use.
- **Auto-placement.** Same call, and it is the direct route to the
  taskmaster PRODUCT.md names as an anti-reference.
- **A load meter.** That is planned ADR-0026's business (task size and
  day load), and ADR-0024 §6 defers to it by name. The grid makes it
  more obviously worth building, not less.
- **Commitment reminders.** ADR-0030 §6 — a course name on the lock
  screen is what ADR-0010 §3 exists to prevent.
