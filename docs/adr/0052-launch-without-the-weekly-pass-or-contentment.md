# ADR-0052: Launch without the weekly pass or contentment

> **Status:** Accepted (Henry, 2026-11-19)\
> **Date:** 2026-11-19

## Context

Henry, on the weekly pass: "the version that exists right now does not
fit the current shape of the app and I don't know if we need it."

The pass (ADR-0039 §11, spec §5.3.2) was built for a week of windows.
With windows set aside (ADR-0051) and the Week tab gone (2026-11-07),
most of its steps had moved elsewhere:

- **Tiers check** (monthly): Life → Your units is always editable
  (ADR-0048).
- **Where last week went**: Life shows effort share over 28 days
  (ADR-0041 §5), and flagged days are in the Log's Kept filter.
- **Anything different this week**: an event's sheet already skips
  weeks (ADR-0040 §2); Add an event and Time away have their own homes.

Two jobs had no other home: the weekly contentment question
(ADR-0008), and Copy last week's events, with its "New events happen
once" setting, for shifts that change week to week (ADR-0040 §6).

## Open questions

1. Does the pass go, or get smaller?
2. Where does the contentment question go?
3. What replaces Copy last week's events?

## Options considered

- **A smaller pass**: contentment and this week's events only. Still a
  weekly chore for someone who checks in once or twice a day.
- **Remove the pass** (chosen).
- **Contentment as a weekly card on Today**, answered in place; or
  **archived** (chosen), its data and code kept behind a switch.
- **Copy last week's events** in the + menu; or **removed** (chosen).
  Henry: "If you are copying last week's events the events should
  already have been set up to run for those two weeks on its planned
  day." What's missing is a way to use a past one-time event again,
  not a copy.

## Decision

### 1. The weekly pass is removed

No card on Today, no ⋯ entry, no screen. Effort share stays on Life,
read through `loadWorkShares` (`db/workShares.ts`), which was the
pass's "last week" query.

### 2. The contentment check-in is archived

A switch, `CONTENTMENT` in `apps/mobile/src/lib/features.ts`, is off:
the question isn't asked anywhere and Calibration leaves Settings.
Stored answers, the table and the code stay, as windows did under
ADR-0051. A special day's 1–10 rating stays: it prices that day's
bonus (ADR-0023), not calibration.

### 3. Events are set up, not copied

- **Copy last week's events is removed**, and so is the "New events
  happen once" setting.
- **A new event defaults to One time** for everyone. Every week is one
  tap away, and runs for N weeks or until a date (ADR-0040 §1).
- **"Again on…"** on a one-time event's sheet makes a new one-time
  event, the same but on the day you pick. The first stays as it was,
  ticks included: moving a past event's date would rewrite history.
- A commitment's or unit's page lists its events as **Coming up** and
  **Past** (folded, newest first), so a past one is there to use again.

## Consequences

- **ADR-0008's check that the plan works has nothing to check with**
  while contentment is archived. AGENTS.md said the weekly question is
  "the only check on whether the plan works"; that is amended to say
  it's archived. Grades are unchanged.
- ADR-0039 §11 (the weekly pass) and ADR-0040 §6 (shift-work tools)
  are superseded.
- Bringing contentment back is turning the switch on and deciding
  where it's asked: the pass it lived in is gone.
- The `calibration_suggestion` table and old check-ins stay unread;
  migrations only go forward (ADR-0002).
