# Planning Note — Calendar & Day Planning

> Status: planned, not built (2026-07-17). Written ahead of the daily
> checklist build so its decisions anticipate this. No schema changes
> yet; additions listed at the bottom land when their phase builds.

## The idea

Two related capabilities:

1. **Plan tasks onto specific days** — a 3×/week task can be pinned to
   Mon/Wed/Fri, or this week's runs can be placed onto chosen days.
2. **A calendar interface** — browse days; see and edit what's planned
   on each; and, for past days, what happened.

## Governing principle: planned days are intentions, not obligations

The times-per-week model stays the source of truth for scoring. Day
plans shape *presentation and defaults* — which tasks the checklist
leads with, where runs sit on the calendar — never the grade. Doing
your 3 runs on entirely different days than planned is a perfect week.
A missed planned day is rearranged, not failed (gentle by design; no
schedule-violation mechanics anywhere).

## Two planning layers

- **Weekday pinning (recurring):** a task may optionally carry
  preferred weekdays (e.g. Mon/Wed/Fri). Picking days sets the
  frequency (3 days picked = 3×/week) — one mental model, no
  contradiction between the two settings. Tasks without pins stay
  flexible ("any 3 days"). Biweekly (0) tasks stay flexible-only for
  now; anchoring "every other Saturday" adds real complexity for
  little value.
- **Occurrence placement (one-off):** placing a specific run of a
  flexible task on a specific date ("long run → Saturday"), typically
  during a week-planning pass. Completions fulfill placements when
  dates match; unfulfilled placements simply lapse.

## The calendar is the temporal spine

One surface, three tenses:

- **Past days:** the life log — day grade, kind (rest/special),
  journal/photo/flag markers, what was completed. Editable within the
  week-aligned edit window (ADR-0004).
- **Today:** the daily checklist.
- **Future days:** planned tasks (pins + placements), declared rest
  days, anticipated special days.

Likely presentation: a week strip above the checklist first (cheap,
high value), a full month grid later. Month cells stay glanceable:
grade tint for past days, small dot-count for planned future days,
markers for special/flagged days.

## Build phases

1. **Checklist build (next) — be calendar-ready:** the checklist gets
   day navigation (back through the edit window) from day one; "today"
   is just the selected day. Weekday pins, if present, order the list
   ("planned today" above "flexible, N left this week").
2. **Weekday pinning:** in the task editor — an optional "on which
   days?" row of weekday chips wired to the FrequencyPicker (picking
   days sets frequency; clearing pins reverts to flexible).
3. **Week planner + placements:** the week strip becomes editable for
   future days; drag/assign this week's remaining runs onto days.
4. **Month calendar:** the full spine; becomes the natural home of
   the life-log browsing experience (and possibly the app's main
   navigation someday).

## Schema additions (when their phase lands)

- `task.planned_weekdays` — nullable text, e.g. `"1,3,5"` (ISO
  weekday numbers). Null = flexible. (Phase 2)
- **`planned_occurrence`** — id, task_id, local_date, created_at;
  archived rather than deleted if the task archives. (Phase 3)
- No changes to scoring tables: grades remain frequency-based
  (ADR-0004 amendment stands).

## ADR touchpoints

- ADR-0004: the checklist build already owes it the daily-denominator
  decision; that decision should account for pins ("due today" display
  ordering, never grade punishment).
- ADR-0010 (notifications, planned): pinned days give reminders a
  natural anchor ("you planned Friendship today") — copy must stay
  ambient-kind, never "you missed Monday."
