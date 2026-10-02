# ADR-0010: Notifications and reminders

> **Status:** Accepted\
> **Date:** 2026-07-17\
> **Deciders:** Henry

## Context

The daily checklist build is starting, which is the trigger this ADR
was reserved for: reminders are part of the daily loop, and the
ADR-0001 platform choice (real app over PWA) was partly justified by
first-class notifications.

Constraints already in force:

- **Ambient kindness** (ADR-0008): a reminder must never read as
  "you're behind." No "you missed X" follow-ups, ever. Celebration may
  condition on positive events; nothing may condition on negative ones.
- **Never nagged** (ADR-0008 §3): the weekly check-in is skippable
  indefinitely — at most a quiet invitation, never a re-ping.
- **Intentions, not obligations** (calendar planning note): a
  pinned-day reminder may say "you planned Friendship today," never
  "you missed Monday."

  > **Noted 2026-10-02:** weekday pins landed in ADR-0024, which is the
  > trigger this section anticipated. It was answered there with **no
  > change** to this ADR — the rule above already covers a pinned day.
- **On-device privacy** (ADR-0001/0002): no server, therefore **local
  scheduled notifications only** (`expo-notifications`). Zero
  infrastructure, and the one-sentence privacy story is untouched —
  nothing about reminders leaves the phone.

## Decisions

### 1. Reminder set: exactly one

v1 ships a single reminder — the **daily checklist nudge**. Everything
else is explicitly deferred, each with a revisit trigger:

- **Weekly check-in invite** — revisit if calibration (ADR-0008) stays
  data-starved because check-ins are simply forgotten rather than
  skipped on purpose.
- **Monthly review invite** — revisit if reviews go unvisited once the
  review exists.
- **Pinned-day task reminders** — revisit at calendar phase 2 (weekday
  pinning), which gives them their anchor.

Deferring these keeps the notification surface as quiet as the app's
tone demands; a product this gentle earns attention, it doesn't
request it three ways.

### 2. Daily nudge mechanics

- **One user-set time**, default **9:00**, adjustable in settings.
  Enabled by default once permission is granted — asking for
  permission and then staying silent would make the grant pointless.
- **Suppressed when the day is already handled**: all of today's tasks
  done, or today is a declared rest/special day. Implementation is
  cancel-and-reschedule of the local notification on the in-app events
  that make a day handled (completions, rest-day declaration) — and
  since those events only happen with the app open, rescheduling is
  reliable by construction. If the app hasn't been opened, the day
  isn't handled and firing is correct.
- Scheduled against local wall-clock time; a timezone change moves the
  nudge with the clock, no special handling.

### 3. Copy: generic invitation only

- Notification copy **never includes task names, unit names, or
  counts**. Task and unit names are among the most sensitive strings
  in the app (faith, mental health, relationships) and a notification
  sits on the lock screen; a remaining-count ("3 left") is a status
  report that brushes the you're-behind line.
- Tone: a neutral, forward-looking invitation — "Today's list is
  ready." A small rotating pool of equivalent lines is fine; all must
  read identically well on a good day and a bad one (the ambient-
  kindness test). The lines live in the copy guide alongside the
  ADR-0008 copy rules.
- Tapping the notification opens today's checklist. Nothing else.

### 4. Permission flow: in-app ask first

- A contextual in-app screen explains what the reminder does and asks
  first; the OS permission dialog only appears after an in-app yes.
  This preserves the effectively one-shot OS prompt. The screen sits
  in the onboarding slot ADR-0011 reserves ("… → starter plan →
  notification ask"); until onboarding exists it appears on first run
  of the checklist.
- An in-app "no" is final until the user visits settings — no re-asks.
  If permission was denied at the OS level, the settings toggle
  deep-links to the system settings page, since the app can no longer
  prompt.

### 5. Quiet hours: moot by design

Every v1 notification fires at a user-chosen time, so a quiet-hours
window would have nothing to suppress. No setting is added. This
question **reopens automatically if any system-triggered notification
is ever proposed** — that is the line quiet hours exist to protect.

### 6. Settings surface and storage

- Settings for v1: one toggle (reminder on/off) and one time picker.
  Granularity grows per-reminder as deferred reminders arrive (§1) —
  each future reminder gets its own toggle, never a single master
  switch that hides them.
- Preferences are stored as local settings keys (no ADR-0002 schema
  amendment needed). They are **device-scoped by intent**: if
  multi-device sync ever arrives (ADR-0016), reminder time and toggle
  state do not sync.

## Consequences

- **Easier:** zero notification infrastructure and nothing to operate;
  the privacy story is unchanged; the settings surface is two
  controls; copy discipline is structural — generic-only means there
  is no code path that could leak a task name or a tally onto the lock
  screen.
- **Harder:** the app is quiet by design, so re-engagement rests on a
  single generic nudge — if the daily loop fades, no mechanic pulls
  the user back (accepted deliberately; a tool, not a taskmaster);
  suppress-when-handled makes notification scheduling stateful rather
  than schedule-and-forget.
- **Revisit when:** any deferred reminder's trigger fires (§1); any
  system-triggered notification is proposed (§5 reopens quiet hours);
  real use shows the 9:00 default is wrong for most days.

## Action items

1. [x] Wire `expo-notifications`: daily scheduled notification,
       cancel-and-reschedule on completion and rest-day events.
       (Shipped: `apps/mobile/src/notifications/dailyNudge.ts`
       — `syncDailyNudge` cancels and re-derives the single scheduled
       occurrence on every `reload()` in `apps/mobile/src/app/index.tsx`,
       which already runs after every completion/rest-day mutation.)
2. [x] Build the in-app permission pre-screen (first-run of the
       checklist until ADR-0011 onboarding exists). (Shipped:
       `components/notifications/PermissionPrescreen.tsx`, triggered
       from `index.tsx` on first focus when
       `notifications.permissionAsked` is unset.)
3. [x] Add the settings controls (toggle + time picker) and the
       OS-denied deep-link path. (Shipped: `apps/mobile/src/app/settings.tsx`
       — one `Switch` + `@react-native-community/datetimepicker`,
       `Linking.openSettings()` when `canAskAgain` is false.)
4. [x] Write the nudge copy pool into the copy guide next to the
       ADR-0008 ambient-kindness rules. (Shipped:
       `docs/design/copy-guide.md`, seeded with this pool; the full
       ADR-0008 rules land there when that ADR is built.)
5. [x] Update the ADR index: 0010 accepted. (Already correct in
       `docs/adr/README.md` — this item was stale bookkeeping.)
