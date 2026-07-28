# ADR-0011: Onboarding and first run

> **Status:** Accepted\
> **Date:** 2026-07-28

## Context

The trigger reserved for this ADR — "anyone other than Henry is about
to install a build" — has fired. Glide is going to a handful of
friends over TestFlight (see [docs/release.md](../release.md)).

What a fresh install does today: the database gate runs migrations and
seeds the taxonomy, then drops the user on the Today screen, where an
empty state reads "Your day starts with a plan. Rate what matters
first" and links to the diagnostic. That is the entire first-run
experience. It is enough for the person who designed the framework and
close to useless for anyone else — nothing explains what a Strategic
Life Unit is, why ranking eighteen of them produces a checklist, or
what the number out of 100 means.

Three constraints arrive from elsewhere and are not reopened here:

- **The app cannot function without a diagnostic.** No snapshot means
  no weights, which means no task point values, no daily checklist,
  and no grade. Every primary surface — Today, Plan, Portfolio — has
  a `hasSnapshot` empty state because there is genuinely nothing to
  show.
- **[ADR-0008](0008-contentment-calibration.md) requires exactly one
  neutral mention of Support Resources during onboarding** — "so the
  user knows it's there," never reactively surfaced. The section
  itself already exists permanently in Settings.
- **[ADR-0010](0010-notifications-and-reminders.md) §4 already placed
  the notification ask.** The in-app pre-screen must precede the OS
  dialog, and ADR-0010 put it "in the onboarding slot ADR-0011
  reserves," noting that until onboarding existed it would appear on
  first run of the checklist. That stopgap is live in
  `apps/mobile/src/app/index.tsx` and this ADR retires it.

One further constraint is new. Friends are being asked to enter
genuinely personal material — contentment ratings, journal entries,
photos — into a build from someone they know personally. The fact
that none of it leaves the device is the strongest thing Glide can
say, and it is currently said nowhere in the app.

## Open questions

1. What steps exist, and in what order?
2. Is the first diagnostic skippable?
3. What does the starter-plan step do, given
   [ADR-0006](0006-task-and-goal-recommendations.md)'s recommendation
   library is accepted but unbuilt?
4. Where do the privacy statement and the Support Resources mention
   sit?
5. Can onboarding be re-run?

## Options considered

### Skippability of the first diagnostic

| Option | Trade-off |
|---|---|
| **Mandatory** | Honest about the dependency; the app does nothing without it. Costs ~5 minutes of pairwise ranking before the user has seen anything they came for. |
| **Skippable, empty app** | Gentlest, and closest to "a tool, not a taskmaster." But a skipper lands in an app where every screen is an empty state, which reads as broken rather than permissive. |
| **Skippable after a preview** | Best conversion — look around, then commit. Requires building and maintaining demo data, and putting fabricated numbers in front of users in a product whose premise is that the log is true. |

### The starter-plan step

| Option | Trade-off |
|---|---|
| **Guided first tasks** | Onboarding scaffolds adding a few tasks by hand. Ships without ADR-0006 and upgrades to generation later without redesigning the step. Hand entry is still hand entry. |
| **Build a minimal library first** | Best first run — a plan appears as if by magic. Reorders the queue and front-loads content authoring before any tester feedback exists to aim it. |
| **No starter-plan step** | Least work. Drops onboarding's payoff and hands the user a blank Plan screen straight after a five-minute diagnostic — the worst possible moment for an empty state. |

### A distinct taxonomy step

The reserved flow named one. The diagnostic's own `intro` phase
already frames the exercise ("Rank each part of your life against the
rest… Six areas · about five minutes"), and any unit row opens a
`UnitInfoSheet` explaining what that unit covers. A separate tour
explains the same model a second time, before the user has a reason to
care about it, and adds a screen between install and payoff.

## Decision

### 1. The flow

    welcome (2 screens) → diagnostic → first tasks → notification ask → done

No distinct taxonomy step. The welcome carries the *why*; the
diagnostic's existing intro carries the *what*; `UnitInfoSheet`
carries per-unit detail on demand, at the moment it is actually
wanted.

### 2. The diagnostic is mandatory, and onboarding resumes

There is no path into the app that skips it, because there is no
usable app on the other side of that path. Onboarding state persists
in `app_setting`, so quitting mid-flow returns to the step the user
left rather than restarting.

**Resumption is at step granularity, not within the diagnostic.**
Rankings live in component state and are written as a snapshot only on
completion; a user who abandons halfway through the ranking begins
that step again. Persisting partial rankings needs a draft-snapshot
schema change, which is not worth paying for a five-minute flow on
speculation. **Trigger to reopen:** testers reporting that they
abandoned the diagnostic partway and did not come back.

### 3. First tasks: guided, skippable, library-ready

After the diagnostic's results, onboarding offers to add up to three
tasks, one at a time, in the three highest-weighted units — the units
the user's own ranking just said matter most. Each prompt names the
unit and its share of the daily points, so the connection between the
ranking and the checklist is visible at the moment it is made.

This step **is** skippable, unlike the diagnostic. Tasks can be added
from the Plan screen at any time, and requiring task creation to enter
the app would be exactly the taskmaster posture design principle 4
rules out.

When ADR-0006's library lands, this step keeps its shape and its
place; only the source of the suggestions changes, from the user's
typing to generated recommendations they accept or edit.

### 4. Privacy up front, Support Resources at the end

**The privacy line belongs on the welcome, not the closing screen.**
"Everything you write stays on this device" is a reason to proceed,
and it is worth nothing said after someone has already typed in the
personal material. It appears on welcome screen two, in one sentence,
with the fuller statement reachable from Settings.

**The Support Resources mention is the last thing onboarding says**,
one neutral line on the done screen pointing at where the section
lives. ADR-0008's rule is satisfied by exactly one mention, framed as
availability and never as suggestion — it must read identically to a
user who is thriving and one who is not. It is not a screen of its
own; a dedicated screen would imply the app expects it to be needed.

### 5. The notification ask moves, and the stopgap is removed

The `PermissionPrescreen` component moves into the onboarding slot
ADR-0010 §4 reserved for it, after first tasks and before done. The
first-run trigger in `index.tsx` is deleted; a user who completes
onboarding has already answered, and ADR-0010's "an in-app no is
final until the user visits settings" still holds.

### 6. Onboarding is re-runnable from Settings

Testers need to see the first run more than once, and so does anyone
debugging it. Re-running replays the welcome and first-tasks steps; it
does **not** clear data or force a second diagnostic, which remains
the monthly ritual's job. Completion is a single `app_setting` key.

## Consequences

- **Easier:** a friend can install the build and understand what they
  are looking at without a conversation first. The diagnostic stops
  being something the user has to discover through an empty state.
  Glide's privacy posture gets said out loud, at the moment it earns
  trust rather than after.
- **Harder:** the first run now has a hard five-minute floor, and
  every second of it is before the payoff. That is the single most
  likely place for a tester to drop, and the thing to watch first in
  feedback.
- **Committed to revisit:** partial-diagnostic persistence (trigger in
  decision 2); the first-tasks step's source of suggestions, when
  ADR-0006's library lands; and the welcome copy itself, which is
  written blind and should be rewritten against what testers actually
  misunderstand.
- The onboarding gate becomes the second thing standing between the
  app and its data, after the database gate. A bug here makes the app
  unopenable, so its failure mode must be to let the user through, not
  to trap them.

## Action items

1. [x] Add the onboarding gate above the router's screens, keyed on an
       `app_setting`, failing open on read error. *(State helpers in
       `apps/mobile/src/db/onboarding.ts`; the gate is a `Redirect` in
       `src/app/index.tsx`, held until the flag resolves so Today never
       flashes first.)*
2. [x] Build the welcome (2 screens: what Glide is; where the data
       lives), the first-tasks step, and the done screen. *(All in
       `apps/mobile/src/app/onboarding.tsx`. The diagnostic runs as the
       normal `/diagnostic` route; return is detected by the snapshot
       appearing, via a focus effect — which also makes the step
       self-skipping when onboarding is re-run.)*
3. [x] Move `PermissionPrescreen` into the flow and delete the
       first-run trigger in `apps/mobile/src/app/index.tsx`.
4. [x] Add the fuller privacy statement to Settings, and the
       re-run-onboarding control. *(Settings → Privacy, and "Run the
       introduction again," which replays the flow without touching
       data.)*
5. [ ] Rewrite the welcome copy against tester feedback once the first
       round comes back (see Consequences).
