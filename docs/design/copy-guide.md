# Copy guide

Referenced by ADR-0008 action item 4 and ADR-0010 action item 4. Standing rules for any copy the app writes, plus concrete pools as they're written. Seeded here with the daily-nudge pool (ADR-0010 §3); the full ADR-0008 calibration copy rules land here when that feature is built.

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
