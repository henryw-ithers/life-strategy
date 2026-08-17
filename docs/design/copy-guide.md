# Copy guide

Referenced by ADR-0008 action item 4 and ADR-0010 action item 4. Standing rules for any copy the app writes, plus concrete pools as they're written.

## Standing rule: kindness is ambient, never targeted (ADR-0008, AGENTS.md)

> "Kindness is ambient, never targeted." People can tell when software noticed their bad week; being reacted to is often more painful than being left alone.

- Encouragement is ambient and untargeted: warm copy reads the same on a good week and a bad one. Nothing consoling is ever conditioned on low grades or low contentment — conditioned comfort reads as surveillance.
- Celebration may condition on positive events (a goal completed, a special day logged) — being noticed at your best is welcome; being noticed at your worst is not.
- The app never shames. Scores are framed as guidelines in all copy; low grades get neutral, kind presentation; no alarm colors, streak guilt, or loss-aversion mechanics (AGENTS.md).

Any copy added to this app — notification text, empty states, error messages, celebratory moments — should read identically well regardless of how the user's day or week is going. If a line would land differently on a bad day than a good one, rewrite it.

## Daily nudge pool (ADR-0010 §3)

Notification copy never includes task names, unit names, or counts — the reminder invites, it doesn't report. `apps/mobile/src/content/notificationCopy.ts` picks one at random per schedule:

- "Today's list is ready."
- "Your day's checklist is waiting, whenever works."
- "A few minutes for today's list."
- "Today's checklist — take a look when you're ready."

Tapping the notification opens today's checklist. Nothing else.

## Unit notes (ADR-0025 §13)

Seven of the eighteen units carry a short note in the unit info sheet, explaining why the app treats them differently. Written in [docs/content/units.md](../content/units.md) under a `### Note` heading; `npm run content:build` generates them.

**Only seven, on purpose.** A note exists to explain a *difference*, so putting one on every unit would turn it into furniture nobody reads. The other eleven behave like the app's default and have nothing to say.

**They must say what the app does and why, then stop.** The line these can't cross is becoming an instruction about how to live — this app has opinions about its own mechanics, not about the reader's evenings. "There's no checklist here, because…" is the app explaining itself. "Make sure you see your friends" is not, and doesn't belong anywhere in the product.

Two shapes:

- **The three communal units** (Significant other, Family, Friendship) explain an *absence*: there is no checklist, and why. The reason is stated in plain terms ("a relationship you keep a tally on is a different relationship"), never as research.

  ⚠️ **Never ask who someone was with.** The app stores only unit ids, but that is half the rule — copy that *asks* "who were you with" suggests people-tracking as the intended use whatever the schema holds, and it was written that way once before being caught. The question is always **where does this count**, matching `ActivitySheet`'s "Where it counts". Recording that an hour counted toward Family is a fact about the user's own life; naming who was there is a record about someone who never agreed to it. Nothing in the product invites that.

  ⚠️ **These units are scored, and the note must not imply otherwise.** ADR-0025 §3 gives them their full diagnostic weight and one tag earns it. What the app declines to build is a *tally of what you did for someone* — not scoring. A first draft of these notes ran "a relationship you're keeping score in…", which reads as the app refusing to score and is simply false about shipped behaviour. Every one of them now ends on the mechanism: you note who you were with, and **a day with real contact earns the unit's points in full**.
- **The four intrinsic units** (Spirituality, Hobbies & projects, Art & media, Adventure & experiences) hold a *tension*, and both halves have to be in the note. These things lose to whatever is urgent, so they need making room for; and they are the easiest things to spoil by turning into a list. A note with only the first half is nagging. A note with only the second is discouraging planning the app otherwise supports. Every one of them lands on the balance rather than a rule — "plan enough that it happens, not so much that it becomes homework."

They sit **last in the sheet and in a quieter block** than the guidelines above them: context for someone who went looking, not a lesson to read first. Nothing surfaces them — the sheet has to be opened, which is ADR-0008's "discoverable always, pushed never."

## Streaks (ADR-0004 §5, built 2026-08-16)

A streak is **shown, never enforced**. It never touches the grade. The rule that matters for copy is narrower and easy to get wrong: **the emotional weight of a streak is almost entirely in the break, not the count**, so the app says as little as possible around a reset.

- **Never remark on a break.** No alarm colour, no "streak lost", no "start again", no sad framing, nothing that implies the number was taken away. A run that ends simply shows a smaller number.
- **Never show a past best beside a current run.** "Best: 30 · Now: 1" is the app pointing at the break. A best is shown **only when the current run is the best** — celebration may condition on positive events, and only on those (ADR-0008).
- **Don't announce small numbers.** On a task row nothing appears below seven days. A row that said "1 day" every time you restarted would be reporting resets.
- **A declared day off is never a break** (ADR-0004 §3) and is never described as one.
- Habit goals are **never offered completion**. They have no target and are meant to be permanent, so "finish it" is not a state they have.

## Calibration copy (ADR-0008)

None of this is ever conditional on the data — the check-in prompt, the insight line, and the suggestion copy all read exactly the same whether the last few weeks ran high or low. Dismissing a suggestion is a neutral, ordinary action, never framed as declining help or correcting a mistake.

**Check-in prompt** (`apps/mobile/src/app/calibration.tsx`): "How content did it feel, 1–10? Skip it any time — nothing here is tracked as missed." Skipping is never nagged; a missed week just stays fillable through the next one, then quietly stops being offered.

**Cold-start state** (before the gate: ≥8 data points spanning ≥6 weeks): "Still learning your rhythm — check in most weeks, and this fills in after a couple of months." Factual, not a countdown or a guilt trip about missed check-ins.

**Insight lines**, one per direction, always plain-language and never alarmed:
- Higher: "Your grades have been running higher than your weeks felt."
- Lower: "Your grades have been running lower than your weeks felt."
- Aligned: "Your grades and how your weeks felt have been lining up."

**Suggestion copy**: the insight line above, paired with a factual, previewable description of the change (e.g. "Would set the satisfaction-gap boost to 0.40.") and two neutral actions, "Accept" / "Dismiss" — never "Yes, fix it" / "No, ignore," which would imply the current state is a problem.

**Support Resources** (`apps/mobile/src/app/settings.tsx`, permanent, unconditional — never surfaced reactively): "These are here anytime, for anyone — not because of anything in your data," followed by the resource list. The framing must never imply "you need this" — it's the same block for every user, every time, visited or not.
