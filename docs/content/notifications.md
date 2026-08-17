# Notification copy

**Source of truth.** `npm run content:build` regenerates
`apps/mobile/src/content/notificationCopy.ts`.

One line is picked at random per schedule. ADR-0010 ships exactly one
reminder — the daily checklist nudge — and this is all of its copy.

## The rules, which are structural here (ADR-0010 §3)

- **Never a task name, a unit name, or a count.** Task and unit names
  are among the most sensitive strings in the app (faith, mental
  health, relationships) and a notification sits on the lock screen. A
  remaining count ("3 left") is a status report that brushes the
  you're-behind line.
- **Every line must read identically well on a good day and a bad
  one** — the ambient-kindness test (ADR-0008). The reminder invites;
  it never reports.
- Tapping opens today's checklist. Nothing else.

Adding a line here is safe. Adding a *variable* is not: there is
currently no code path that could put a task name on the lock screen,
and that is a property worth keeping.

**No em dashes anywhere in app copy** (2026-08-16). They are one of the
clearest tells that a line was generated rather than written. A comma,
a full stop, or a colon does the job in almost every case, and if none
of them fit, the sentence wants rewriting rather than punctuating.

## Lines

- Today's list is ready.
- Your day's checklist is waiting, whenever works.
- A few minutes for today's list.
- Today's checklist is there when you want it.
