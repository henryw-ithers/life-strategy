# ADR-0038: Events

> **Status:** Accepted\
> **Date:** 2026-10-02\
> **Deciders:** Henry

## Context

A commitment's work is two different kinds of thing. A lecture, a shift
or a practice is **a time you turn up for**: it happens at 9:00 on
Monday and Wednesday whether or not you plan around it. An assignment or
a reading is **work you fit in**. The app had one shape for both — the
task, whose time is optional by design (ADR-0036) — so a class was
entered as a task with a time bolted on, and the commitment screen
listed both together.

Henry, 2026-10-02: *"a task can be an appointment which is just a window
of time where you attend a class or it can be just a task and in the
commitments menu that should be separate and the menu for creating a
task and an appointment should also look different."* Then: an
appointment *"should be able to hold additional info like location"*,
and on the name, *"just make it event everywhere."*

## Open questions

1. Does attending an event earn points?
2. Where can events exist?
3. What does an event hold?
4. How does it sit beside ADR-0036 (no time is ever required) and
   ADR-0035 §4 (no attendance record)?

## Options considered

- **An event as a pure block of time** — drawn on the hour grid,
  splitting the day into windows, but never ticked or paid. Keeps
  ADR-0035 §4 intact. Declined by Henry: attending is part of the work.
- **An event as a task with a kind** (chosen). Ticked and paid exactly
  like a task, so the whole scoring path is reused unchanged; what
  differs is how it is planned and shown.

## Decision

### 1. An event is a task with `kind = 'event'`

Stored on `task`, with a new `kind` column (`task` | `event`, default
`task`) and an optional `location`. Its notes are the task's existing
`description`. It is ticked and paid exactly as a task is — from its
unit's weight in a life unit, from the band in a commitment
(ADR-0032) — so nothing in `@glide/scoring` changes.

**Called "Event" everywhere** — on screen and in code — the word iPhone
Calendar uses for a block of time you attend.

### 2. An event's time is required

An event always has a start and an end, at least 15 minutes apart, and
either the weekdays it repeats on or the one date it happens
(`eventProblem`). **This is the one place a clock time is required.**
ADR-0036's rule — a time permitted on any task, required on none —
stays true of tasks; an event is not one, and its time is what it is.

A repeating event is pinned to its weekdays, so it is due on them
(ADR-0029 §3); a one-time event is a one-off on its date.

### 3. Events live anywhere

In a commitment or sub-commitment, and in any life unit (a doctor's
visit, a booked session). Henry's call.

### 4. Planned differently, listed apart

- **The event sheet** asks *when* first — every week on these days, or
  one time on this date — then a required start and end, then location
  and notes. No size and no part credit: an event is ticked whole.
- **The task sheet** is unchanged.
- **An event looks and works the same wherever it is filed** (Henry:
  *"why would the shape or functionality of events change based on if
  it's in a commitment or not?"*). Every unit on the Tasks tab lists its
  events apart from its tasks, in rows shared with the commitment
  screens (`ItemRow`: name, then "Mon, Wed · 09:00–11:00 · Room 101"),
  and adding one from a unit opens the same sheet a commitment does,
  with no unit to choose. Only the Tasks tab's top *Add event*, which
  has no unit yet, asks where it belongs. In a life unit, events rank
  after the unit's tasks.
- **A commitment's screen lists Events and Tasks as separate
  sections**, each with its own add row. The Tasks tab offers *Add
  task* and *Add event* side by side, and in each unit; tapping an
  event opens the event sheet, not the task editor.
- **On Today**, an event's line says when and where —
  "09:00–11:00 · Room 101" — in place of a weekly count.

### 5. Attendance becomes recordable — and stays uncounted

A ticked event is a record that you attended. Alongside its schedule,
that makes `attended ÷ scheduled` **computable** for the first time,
which ADR-0035 §4 had made structurally impossible. That ADR is amended:
the protection moves from the schema to the rule. **Nothing computes,
stores or shows an attendance rate, a missed-event count, or anything
derived from the events you did not tick.** A missed lecture is never
mentioned, exactly as a missed pinned day lapses silently (ADR-0024 §2,
ADR-0029 §3).

## Consequences

- **Easier:** a timetable reads like one. Classes are entered once, by
  when they are, and the hour grid and windows (ADR-0033) are built from
  them as they already were from timed tasks.
- **Harder:** the attendance rule now rests on discipline rather than
  structure. Any future feature that reads `kind = 'event'` beside the
  schedule is the place it could break.
- **Revisit when** a reason appears to show anything about events not
  attended — it would need this ADR reopened, not a quiet addition.

## Action items

1. [x] `task.kind` and `task.location`; migration `0016`.
2. [x] `addEvent` / `updateEvent`, refused by `eventProblem`.
3. [x] `EventSheet`; Events and Tasks sections on the commitment screen;
       *Add event* on the Tasks tab; events open their own sheet.
4. [x] Today's caption for events.
5. [x] Amend ADR-0035 §4 and ADR-0036; AGENTS.md invariants and
       vocabulary.
