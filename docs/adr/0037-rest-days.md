# ADR-0037: Rest days

> **Status:** Accepted\
> **Date:** 2026-10-01\
> **Deciders:** Henry

## Context

[ADR-0029](0029-a-day-is-the-fraction-you-got-through.md) grades a day
on the fraction of its due work done, and **a day with nothing due is
not graded at all** (`base: null`, the shape of a day off). Its own
action item 6 left the consequence open: a week's flexible work done
early leaves the rest of the week blank, and *"the candidate is to keep
grading days with nothing due, at full marks — but that pays for
silence, so it needs its own thinking."*

The commitments work found a sharper edge on the same day. Commitment
work done ahead is paid its scheduled-day worth (ADR-0032 §4), and an
early session *is* the next session, so the later day no longer counts
it. Done on a day with nothing due, that credit had nowhere to land:
the day was ungraded, and the session was paid on neither day.

Henry, 2026-10-01:

> *"On a day where you have nothing scheduled (which would mean you
> have zero daily tasks and zero weekly or x a week tasks leftover) …
> a rest day which gives an automatic 70% and then gives points for
> any one-time activities or early task completions you do that day."*

> *"Rest day should trigger automatically in the scenario we described
> and should not appear otherwise."*

## Open questions

1. When is a day a rest day, and who decides?
2. What does it score?
3. What counts as early work, and what is it worth, on a day whose own
   load is empty?
4. What becomes of Day off?

## Options considered

- **Keep nothing-due days ungraded** (ADR-0029 as written). Honest, but
  leaves early commitment work unpaid and a finished week full of holes.
- **Grade them at full marks.** ADR-0029's candidate; pays 100 for
  doing nothing, which is the "paying for silence" it warned about.
- **A floor of 70, earned up from there** (chosen). Doing your week
  early is rewarded — 70 is a good day, not a perfect one — and the rest
  of the way is the day itself: what you did with time nothing was
  asking for.
- **Make it a day kind the user calls.** Built first, withdrawn the same
  day: Henry wants it automatic, and offering it would be a choice with
  only one sensible answer.

## Decision

### 1. Automatic, and only on a day that asks nothing

A day is a rest day when, measured from the days before it like the
load itself:

- nothing of your own life is due — no every-day task, nothing pinned
  to today, no flexible work left owing this week;
- no commitment work is scheduled (the band is 0); and
- **there is a plan** — the plan's average day expects something
  (`averageDayExpected > 0`). Without this a new account, or any day
  before a task existed, would be handed 70 for having nothing to do.

It is never offered and never chosen; it does not appear in the day-
kind sheet. A **day off** on such a day stays a day off — ungraded —
because the user said so. A **special** day on such a day is a rest day
with its rating bonus in the last 30. A run pinned to *another* day
does not stop a rest day; doing it today is early work.

`isRestDay` in `@glide/scoring` is the one test. A day that stops
qualifying — a task added that is due today — is scored as the
ordinary day it now is.

### 2. Seventy, then the day

- **`REST_DAY_BASE` = 70**, for nothing done.
- **Activities fill the last 30** (`REST_DAY_UNPLANNED`). There is no
  planned band for them to sit beside, so the day's unplanned pool is
  the rest of the day. Activity credit is re-priced at the matching
  rate — `size × 30% × the unit's weight`, three times the ordinary
  10% — so the pool can actually be filled; at the ordinary rate a big
  activity in a weight-8 unit earns one point. Credit is re-priced on
  every edit to the day, since whether it is a rest day can change.
- **Early work is paid on top, uncapped.** It is your own plan done
  ahead, the side of ADR-0023's line extra runs already sit on.

So a rest day with nothing in it is 70; one with a full afternoon of
activities is 100; one with work done ahead can pass 100, as a day with
extra runs can.

### 3. Early work, priced against an average day

A rest day's own load is empty, so `90 × weight ÷ expected` has nothing
to divide by. Life work is priced against **an average day of the
plan** instead — every recurring task's weekly demand over seven
(`averageDayExpected`, one-offs left out as `taskWeights` leaves them
out):

| Done on a rest day | Pays |
|---|---|
| A run owed later this week (pinned to another day) | A full run at the average day's rate |
| A life one-off planned within the next week | A full run at the average day's rate; it is then done when its day comes |
| A run beyond this week's count | The extra-run rate, `EXTRA_RUN_RATE` |
| Commitment work done ahead | Its scheduled-day worth (ADR-0032 §4), unchanged |

Life one-offs planned for later appear on the list **only on a rest
day**, and never enter the load — they are not today's work.

### 4. Day off is unchanged

Still available on any day, still ungraded, still excluded from
aggregates (ADR-0023 §4). Rest day is not a kind and adds no stored
value: `day_grade.kind` is untouched.

## Consequences

- **ADR-0029 action item 6 is answered**: a bunched week leaves 70s,
  not holes.
- **ADR-0032 §4's gap is closed**: commitment work done ahead on a day
  with nothing due lands on that day.
- **ADR-0023 §1 is amended for one kind of day**: on a rest day the
  unplanned pool is 30, not `UNPLANNED_CAP`. The 70 is not unplanned
  credit; it is the grade of a day your plan asked nothing of.
- **Weeks and months read higher** for anyone who works ahead, because
  days that were excluded now count, at 70 or more. That is the intent.
- **Formula v10**, folded in: v10 had reached no device.
- **Revisit when** a fortnight of use shows rest days outscoring the
  ordinary days around them — that would mean 70 is too generous a
  floor for the work that earned it.
