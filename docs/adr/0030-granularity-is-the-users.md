# ADR-0030: Granularity is the user's

> **Status:** Proposed\
> **Date:** 2026-09-11 (rewritten; first drafted 2026-09-08)\
> **Deciders:** Henry

> **Reopening notice.** ADR-0024 §1 states: *"No time picker exists
> anywhere in the app, and none is added later without reopening this
> ADR."* This is that reopening, and ADR-0025 §7 recorded the same rule
> reaffirmed under challenge. **This ADR supersedes ADR-0024 §1.**

> **This ADR was rewritten, not amended.** Its first draft drew a line —
> *only things somebody else set may carry a clock time* — with a closed
> list of three columns, keeping self-scheduled work rough. Henry
> removed that line on 2026-09-11: *"they can be an explicit time slot
> or just placed in morning, afternoon, or evening. We give the freedom
> to the user to choose how they want to use the tool."* The old §§1–2
> are gone. §4 (cue-based placement) and §6 (no commitment
> notifications) survive and are carried forward below.

## Context

ADR-0024 §1 refused clock times and gave a **functional** reason rather
than only a psychological one:

> the argument that carried for holding the line was **functional, not
> psychological: a clock time would drive nothing this app does.**
> There are no per-task reminders and no time-slot calendar, so the
> only thing a time could affect is checklist ordering, which
> part-of-day already provides.

That premise stopped being true. [ADR-0033](0033-windows-and-pools.md)
puts an hour grid and a timetable in the app, and both are things a
clock time drives. The ADR's own logic licenses the reopening.

The psychological finding is separate and survives:

- **Tonietto & Malkoc 2016** (13 studies): scheduling a leisure
  activity makes it feel more work-like and reduces enjoyment, and
  "rough scheduling" — a broad window, no specific time — eliminates
  the effect. What they manipulated was **self-imposed scheduling of
  discretionary activity.**
- **Gollwitzer & Sheeran 2006**: the effective implementation intention
  specifies **a cue, not a clock**.

An intermediate draft used these to permit times only on externally-set
things. That line is coherent, and it was rejected for a product
reason rather than a research one: it is the app deciding how precisely
somebody may plan their own day.

Constraints already in force:

- **Plans never touch the grade** (ADR-0024 §2) — though
  [ADR-0032](0032-the-commitment-band.md) §4 amends this for commitment
  work specifically.
- **The daily surface stays checklist-simple** (PRODUCT.md principle 2).
- Notification copy carries no task names, unit names or counts
  (ADR-0010 §3, reaffirmed by ADR-0024 §5).

## Open questions

1. What may carry a clock time?
2. What protects the Tonietto & Malkoc finding once anything may?
3. Does cue-based placement survive?
4. Do timed things get reminders?

## Decision

### 1. Any task may carry an explicit time. Nothing requires one.

There is no closed list and no per-object rule. A task may be placed at
a clock time, in a window, in a part of day, or nowhere in particular,
and **none of these is the lesser state**.

This is PRODUCT.md principle 6, added the same day:

> **Granularity is the user's.** The app supports planning a day to the
> minute and planning it not at all, and neither is the lesser use.
> Defaults sit at the light end — `anytime` is first-class, part-of-day
> is the default, nothing requires a time — and every step toward
> precision is offered while none is required. The opinion lives in the
> defaults; the ceiling belongs to the user.

### 2. The defaults protect the research, and are load-bearing

`anytime` and part-of-day remain the **defaults**, and a task is never
prompted for a time. So the Tonietto & Malkoc protection still applies
to everyone who does not reach for one — it becomes the user's to opt
into rather than the app's to enforce.

**This makes the defaults load-bearing rather than incidental.** They
are now the only place the product's opinion about granularity lives,
and letting them drift toward "pick a time" would remove that opinion
without any decision being taken.

### 3. Cue-based placement survives, as a nicety rather than the mechanism

A placement may still store **what it follows** rather than when it
starts — "after the 11am lecture," not "12:15." It is no longer
required, and it is still better where it applies, for a reason a
timestamp cannot match:

**it survives a timetable change.** Move the lecture to 2pm and "after
the lecture" moves with it; `12:15` silently becomes wrong and nothing
says so.

It is also the form Gollwitzer & Sheeran call effective, which is worth
keeping available even when it is not compulsory.

### 4. Timed things still get no reminders

*"Your lecture starts in 15 minutes"* puts a course name on the lock
screen, which is precisely the disclosure ADR-0010 §3 exists to prevent
and which ADR-0024 §5 declined to reopen for pinned days. Carrying a
clock time makes that feature *possible*; it does not make it right.

ADR-0010's reminder set stays at one. Adding time-based reminders means
reopening ADR-0010 §3.

## Consequences

**Easier.** A timetable can be honest about a week, an hour grid can
exist, and nobody has to argue about whether a given object has earned
the right to a time.

**Harder.** "No clock times" was a rule anyone could check in a
sentence. What replaces it is a rule about *defaults*, which is
softer and easier to erode — hence §2 being stated as an invariant
rather than a preference.

**Accepted cost.** The app no longer protects a user from
over-scheduling their own discretionary time. Tonietto & Malkoc says
some will enjoy those activities less as a result. That is the price of
principle 6, taken knowingly: the alternative is the app deciding how
precisely somebody may plan their own day.

**Revisit when:** real use shows people default to times for everything
and enjoy the app less — which would make §2's defaults the thing that
failed, not the permission.

## Action items

1. [x] `task.start_minute` / `end_minute` (migration 0015) with
       `setTaskTime`, and the control itself in `TaskDetailPicker`
       (2026-09-15). It sits behind a **closed** disclosure at the end
       of the schedule block: part-of-day is still the first thing
       asked and the only thing answered by default.
2. [~] The control is optional everywhere it appears, `addTask`
       defaults every field of `TaskDetail` to null, and `clockTimes`
       drops an end with no start rather than storing half a block.
       **The standing risk is §2's, not a bug:** these defaults are now
       the only place the product's opinion about granularity lives, so
       a future change that opens the disclosure by default, or seeds a
       time, removes that opinion without any decision being taken.
       Worth re-reading this section before touching the picker.
3. [x] ADR-0024 §1 carries the superseded notice; §2 and §3 stand.
4. [x] AGENTS.md states the rule as it now is.
