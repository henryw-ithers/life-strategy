# ADR-0045: Onboarding builds a first week

> **Status:** Accepted\
> **Date:** 2026-10-13\
> **Deciders:** Henry

## Context

Onboarding today has six screens: welcome, method, diagnostic, weights,
rhythm and the notification ask (ADR-0011, amended 2026-08-18). The
diagnostic takes about five minutes and is required. Nothing in the
flow asks about commitments or hours, so a new user lands on a task
list with no windows.

Henry, 2026-10-12: "We also have to redo the entire onboarding screen
and build it around this new organization/workflow." In the design
review he chose this order: priorities, commitments, working hours, a
few tasks, the first week. The research points the same way: a usable
plan within the first session, from a few questions that visibly shape
it, with starter tasks (Structured) rather than an empty screen
([research-brief.md](../design/research-brief.md), P18, A7).

ADR-0011's 2026-08-18 amendment found that cutting all the explanation
left people not knowing how the score works. That finding still
matters here.

## Open questions

1. What are the steps, and which can be skipped?
2. What gets set up for the user?
3. How is the scoring explained?

## Options considered

- **Diagnose, then commitments, hours, a few tasks and the first week**
  (chosen in the design review). Everything the app needs to make a
  real first week, in about three minutes.
- **Schedule first, priorities later.** Faster, but suggestions have no
  priorities to rank by.
- **Minimal: hours only, then guided prompts in the app.** Least up
  front, but the first Home would be mostly empty.

## Decision

### 1. Seven steps

1. **Welcome.** "Plan your week around what matters to you and the time
   you actually have." Under it, the privacy line from ADR-0011 §4:
   everything stays on your phone. One button.
2. **Priorities.** Drag the 18 units into tiers, starting from a
   suggested sort (ADR-0041). Required. About 30 seconds.

   > **Amended 2026-10-21 (Henry).** No suggested sort: you sort every
   > unit into a tier yourself, starting from all of them Unsorted
   > (ADR-0041 §1 as amended).
3. **Commitments.** Pick Student, 9–5 job, Shift work or Nothing fixed.
   Add up to three commitments with their events, defaulting to weekly
   for 12 weeks. With Shift work, events default to not repeating.
4. **Working hours.** The hours editor (ADR-0039 §1), filled in from
   step 3, with a preview of this week's windows.
5. **A few tasks.** Two or three starter tasks from the library for
   each Top unit, plus "Add your own". Nothing is selected for you.
   Not now units are skipped.
6. **Your first week.** The suggested week. "This is a suggestion. Pin
   what you want to keep. The rest updates as you go." One more line
   explains the score: "You'll get a score out of 100 for how much of
   each day's plan you do." The score breakdown sheet on Home explains
   the rest the first time it's opened. This replaces the old method,
   weights and rhythm screens (Henry, 2026-10-13).
7. **Notifications.** An optional morning summary, explained before the
   system prompt (ADR-0010). The same screen ends with the one line
   about Support Resources (ADR-0011 §4, ADR-0008). Then Home, at the
   current window.

Every step after Priorities can be skipped. The aim is a working Home
in under three minutes.

### 2. Resuming and re-running

Onboarding resumes at the step you left (ADR-0011 §2). Running it again
from Settings deletes nothing and doesn't force anything (ADR-0011 §6).
It opens at step 2 with your current tiers, and on a re-run every step
can be skipped, Priorities included.

## Consequences

- **Easier.** A new user's first Home has real windows and real tasks.
- **Harder.** The flow now writes commitments, events and hours as
  well as a snapshot, so a partly finished onboarding has more to
  resume. The method, weights and rhythm screens go. Whether one line
  plus the breakdown sheet explains the score well enough is the thing
  to watch, since the 2026-08-18 amendment found people lost without an
  explanation.

**Amends, on acceptance:**

| ADR | What changes |
|---|---|
| ADR-0011 | §1 the flow is replaced. §2 the required step becomes Priorities. §3 starter tasks return as tap-to-add chips. §4 and §6 are kept: the privacy and Support Resources lines stay, and a re-run forces nothing |

## Action items

1. [x] Rebuild `app/onboarding.tsx` around the seven steps (Phase 11).
2. [x] Templates for Student, 9–5 and Shift work: default hours and
       event defaults (`lib/onboardingTemplates.ts`).
3. [x] Starter tasks per unit from the content library
       (`lib/starterTasks.ts`).
4. [x] A first-open explanation on the score breakdown sheet.
5. [x] Amend ADR-0011 (done on acceptance).
