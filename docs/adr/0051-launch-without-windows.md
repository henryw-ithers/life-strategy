# ADR-0051: Launch without windows

> **Status:** Accepted (Henry, 2026-11-04)\
> **Date:** 2026-11-04

## Context

Henry, after testing the windows redesign (ADR-0039–0048): "the whole
'windows' idea still needs a lot of refinement. In the meantime
however, I still want to launch the app to the app store."

Windows never changed a score (ADR-0039 §12). The two exceptions were
"Do N of these", already gone from the UI, and the working hours that
size the commitment share (ADR-0044 §5). Home already had a layout for
a day with no windows: Morning, Afternoon, Evening and Anytime, with
drops and your own order (ADR-0048). So windows can come out of the
app without touching the scoring engine.

## Open questions

1. Do windows go, or only their UI?
2. What replaces them on Home and on the Plan tab?
3. What sizes the commitment share without working hours?
4. Where do events sit in a day with no windows?

## Options considered

- **Delete windows.** A smaller codebase, but the plan is to bring them
  back refined, and the hours, pins and fill code is tested and works.
- **Hide them behind one switch** (chosen). Every screen reads a day
  with no windows. The data and code stay for when they come back.
- **Three tabs (Today, Life, Log)**, with days ahead on Today. Simpler,
  but a week of events and pinned days needs a place to be looked at.
- **Four tabs, Plan becoming Week** (chosen).
- **Share denominator:** keep working hours editable in Settings; a
  fixed day length; or the default hours with no UI (chosen). The last
  changes no formula and needs no new setting.

## Decision

1. **One switch, `WINDOWS` in `apps/mobile/src/lib/features.ts`, set
   to false.** `hoursOn` in `db/dayPlan.ts` gives every day no
   windows, buffers or named gaps. The tables, `pins`, `hours.ts`,
   `fill.ts` and their tests are kept. Screens that only make sense
   with windows (the hours screen, window cards and sheets,
   `PlanDayView`) stay in the repo, unreachable.
2. **The day is in parts:** Morning 5–12, Afternoon 12–5, Evening 5–12
   and Night 12–5. `PART_OF_DAY_BOUNDS.evening` now ends at midnight.
   Night is a section of the app's own (24:00–29:00 in the day's
   minutes, so it always comes after Evening), shown only when it holds
   something. No task is set to Night: it exists for late events and
   for what you drag there. Anytime stays.
3. **Events and timed tasks sit inside their part,** by the clock, above
   that part's tasks. Tasks are in your order (`day_order`), and holding
   one and dragging it moves it to another part for that day (a pin
   anchored at the part's start) or reorders it within one (ADR-0048).
4. **Four tabs: Today, Week, Life, Log.** Home became Today and Plan
   became Week. Routes keep their paths. Week is the week strip and the
   chosen day in its parts (`DayParts`): tap to edit, drag between
   parts, nothing ticked, **nothing counted**. A day ahead on Today
   uses the same view.
5. **Working hours go from the UI** (the hours screen, the onboarding
   step, the weekly pass's Change hours and its windows step, the
   Window item in the + menu). The commitment share still reads
   working hours, which are now always the defaults (9–12, 1–5, 6–9):
   in effect a commitment's time over a fixed 10-hour day, kept between
   10% and the limit, with a set share still overriding it. Spreading
   a flexible task's runs over the days ahead reads the same default
   hours less events, so runs go to the emptier days.

## Consequences

- No score changes: the engine and every grade are as before.
- Clear today now sets aside only the day's remaining events.
- The commitment share can't follow a different week's hours. Anyone
  whose real free time is far from 10 hours sets the share by hand.
- Bringing windows back is turning the switch on and revisiting the UI
  removed here. It needs its own ADR, which should also say whether
  Night stays.
- Amends ADR-0039 (windows are set aside), ADR-0044 §5 (the hours the
  share reads are the defaults) and ADR-0048 (parts replace windows on
  Today).
