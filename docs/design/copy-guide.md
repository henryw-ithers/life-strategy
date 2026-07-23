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
