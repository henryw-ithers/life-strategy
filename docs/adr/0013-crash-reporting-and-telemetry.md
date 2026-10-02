# ADR-0013: Crash reporting and telemetry

> **Status:** Accepted\
> **Date:** 2026-07-29

## Context

The trigger reserved for this ADR — "before any distribution beyond the
dev machine" — has fired. Glide is going to friends over TestFlight
([docs/release.md](../release.md)), and
[ADR-0011](0011-onboarding-and-first-run.md) has already built the
first run they will land in.

**What the app can currently tell you when it breaks: nothing.** There
is no error boundary anywhere in `apps/mobile/src`. In a release build
a thrown render error takes down the React tree and an uncaught async
error takes down the process, so the tester's entire report is "it
closed." The database gate in `src/app/_layout.tsx` is the one
exception — it catches migration and seed failures and shows the
message — and it is also the only failure whose message the user can
read back to you.

**What the app currently sends: nothing, verified.** An audit of the
build for this ADR found no crash-reporting, analytics, or attribution
dependency installed; no `expo-updates` and no EAS Insights; no
`fetch`, `XMLHttpRequest`, or `WebSocket` call anywhere in
`apps/mobile/src` or either package; and notifications that are
purely local — nothing requests a push token. The standing default
recorded in the [ADR index](README.md) ("nothing leaves the device,
period") is not just a policy, it is the current behaviour.

Three constraints arrive from elsewhere and are not reopened here:

- **[ADR-0001](0001-platform-and-tech-stack.md) pins Expo SDK 54 and
  keeps Expo Go as the daily workflow.** Every hosted crash reporter
  worth having — `@sentry/react-native` and its peers — is a native
  module, and Expo Go loads only the native modules Expo compiled into
  it. Adopting one moves day-to-day development onto a dev client,
  which is exactly what the pin exists to avoid, and
  [docs/release.md](../release.md) says the `development` profile is
  "there for when a native module eventually forces a dev client, not
  as a replacement for `npm run mobile`."
- **[ADR-0008](0008-contentment-calibration.md) excludes contentment
  data from anything that leaves the device**, and requires
  re-confirmation by any later ADR that opens a network path.
- **[ADR-0002](0002-data-model-and-persistence.md) put the passphrase
  outside the app's reach** — a backup is opaque even to us. A crash
  path that shipped raw rows would be a louder hole than the one that
  ADR carefully closed.

One constraint is new, and it is the decisive one. ADR-0011 put
"everything you write stays on this device" on welcome screen two, *as
the reason to proceed*, and Settings → Privacy expands it to "Glide has
no account and no server, and sends nothing anywhere." Testers are
friends of the author, entering journal entries, photos, and
contentment ratings into a build on that promise. Any telemetry — even
opt-in, even scrubbed — makes that sentence conditional, and the
sentence is load-bearing.

## Open questions

1. Does any telemetry ship at all, and if so, opt-in or opt-out?
2. If nothing is sent, how does a tester's crash reach the developer?
3. What is recorded, and what must never be?
4. Where does a crash leave the user — what do they see?
5. Does anything recorded travel in a backup, or survive Erase all
   data?

## Options considered

| Option | Trade-off |
|---|---|
| **Hosted crash reporting, opt-out** | Best data by a wide margin: symbolicated stacks, grouping, release tracking, breadcrumbs, and reports from crashes the user never mentions. Flatly contradicts the privacy sentence, sends data from people who never agreed to it, and forces the dev client. Not defensible for this product at any stage. |
| **Hosted crash reporting, opt-in** | Same data, honestly obtained, and the industry-normal answer. Still costs the dev client and the SDK-54 workflow; still turns one sentence into a paragraph with an exception in it; still adds a third party to a product whose selling point is that there isn't one. And with a tester pool the size of a group chat, the marginal value over asking them is small. |
| **Zero telemetry, no crash visibility** | Cheapest and purest. Leaves the developer debugging by anecdote at the exact moment the app is first meeting people who did not design it — and a crash a tester can't describe is a crash that never gets fixed. |
| **Zero telemetry, on-device log, user-initiated send** | Keeps the sentence literally true and needs no native module, so Expo Go survives. Gets a real stack instead of "it closed." Costs: reports only arrive when someone bothers to send one, stacks are unsymbolicated, and there is no way to know how often something fails for people who say nothing. |

**Why "opt-in" loses on its merits, not on purity.** Opt-in crash
reporting is the right answer for most apps and would be the right
answer for this one at a few thousand users. At a handful of friends,
the developer can *ask*, the reporter's advantage collapses to
convenience, and its cost — a native module against a deliberate pin,
plus a permanent asterisk on the app's central claim — is paid in full
regardless of scale.

## Decision

### 1. No telemetry, and no third-party SDK

Nothing is sent anywhere, automatically or in the background, in any
build. No crash reporter, no analytics, no attribution, no session
replay, no "anonymous usage statistics." There is no opt-in switch,
because a switch implies a destination and there is none.

"Glide has no account and no server, and sends nothing anywhere" stays
true as written, and stays a sentence.

**This decision is about automatic transmission, not about the user.**
The user may always hand their own data to someone — that is what
export ([ADR-0002](0002-data-model-and-persistence.md)) and the report
below both are. The line is who initiates.

### 2. Crashes are recorded on-device, in a file, not the database

A capped log at `<documents>/diagnostics/problems.json` records what
broke. It is deliberately **not** a SQLite table:

- The database failing to open is one of the failures worth recording,
  and a log inside it is unreadable in exactly that case.
- It needs no migration, so it does not drag in
  [docs/release.md](../release.md)'s "expire the previous builds" rule
  for a debugging aid.
- `expo-file-system`'s `write` is synchronous, so the fatal handler can
  finish writing before the process goes away. An `await` on a dying
  JS thread is a log entry that never lands.

The cap is **10 entries, newest first** — enough to see a pattern,
small enough that it can never become a storage question. Writes are
best-effort and every failure is swallowed: a diagnostics log that can
itself crash the app is worse than no log.

### 3. The log records where, not what

Per entry: timestamp, app version and build, platform and OS version,
device model, which capture caught it (startup, render, or fatal), the
error name, its message, and the top stack frames — plus the route the
user was on, which is the single most useful field for triage.

**Nothing about the user's life is recorded.** The rule that enforces
it is structural, not editorial: only `error.message`, `error.stack`,
and the route are ever read, never surrounding state, arguments, or
rows. On top of that, everything written passes one redactor:

| Shape | Becomes |
|---|---|
| UUIDs (task, goal, snapshot, photo ids) | `<id>` |
| `file:`, `content:`, `ph:`, `assets-library:` URIs | `<uri>` |
| Email addresses | `<email>` |
| Anything after `params:` in a message | dropped |

The `params:` rule is the one that matters most: `expo-sqlite` and
Drizzle put bound values there, so a failed insert is the one realistic
way a journal entry could reach a stack trace. Messages are capped at
300 characters and stacks at 12 frames — both truncate the tail, which
is where accidental payload would sit.

Ratings, grades, contentment check-ins, journal text, and photo
contents cannot appear because nothing reads them. ADR-0008's
exclusion is re-confirmed and, since no network path exists, satisfied
by construction.

**Amendment (2026-07-29): the log also records that feedback was
sent.** Settings → Send feedback arrived after this ADR, and the log
became the natural place to answer "did I already mention this." Each
send appends one entry: timestamp, which topic chip, whether it left by
mail or share sheet, build, device.

**It does not record the message.** The rule above is what forbids it —
the log is shareable in one tap and records what the app did, not what
the user wrote. A screen whose entire selling point is *this is exactly
what gets sent* cannot quietly begin carrying authored prose, and the
message already has a durable home in the email. The entry type has no
text field at all, so this is enforced by shape rather than by
discipline. Caps are per kind, so a run of feedback can never evict the
crashes.

**The redactor is the one part of this ADR that is unit-tested.** It is
also the only part whose failure is silent and unrecoverable — a
message that reaches a bug report cannot be unsent — so it lives in its
own importless module and gets the treatment
[ADR-0001](0001-platform-and-tech-stack.md) reserves for pure logic.
This is what puts a test runner in `apps/mobile` for the first time;
its scope is pure `src/lib` code, and nothing about it makes the rest
of the app testable off-device. `src/lib/logFormat.ts` since joined it
on the same argument — trimming and the report text are the log's other
two silent-failure surfaces, where a dropped or mislabelled entry looks
exactly like no entry.

### 4. A crash leaves the user somewhere kind, and recoverable

An `ErrorBoundary` on the root layout replaces the blank screen with a
titled screen, a **Try again** that re-renders the route, and one line
saying the details were saved on the device and where to find them. Its
copy follows the [copy guide](../design/copy-guide.md) and the
never-shames rule: the app broke, not the user, and the screen does not
apologise three times about it.

Two capture points sit behind it:

- **`ErrorUtils.setGlobalHandler`** — the RN-level hook, for
  everything React never sees: uncaught async rejections, errors in
  timers, native callbacks. It records and then **always delegates to
  the previous handler**, so the dev-time red screen still appears and
  release-build fatality is unchanged. This layer observes, it does not
  swallow.
- **The database gate**, whose existing fatal path now also records.
  It already had the only readable error message in the app; now that
  message is in the log with a version stamp beside it.

> **Amendment (2026-08-19): two of the three capture points did not
> cover what this section claimed.**
>
> An audit found the promise above — "everything React never sees:
> uncaught async rejections" — was false in exactly the build that
> matters.
>
> - **Unhandled rejections never reached `ErrorUtils` at all.** React
>   Native routes them through Hermes' rejection tracker, and
>   `Libraries/Core/polyfillPromise.js` enables that tracker **only
>   under `__DEV__`**. In a release build a rejected promise nobody
>   caught produced nothing: no warning, no log line, no crash. The app
>   fires around ninety of these deliberately (`void reload()` and
>   friends), so a failed write was indistinguishable from a successful
>   one — the screen reloaded the unchanged data either way. The app now
>   installs the tracker itself in release builds and records to this
>   log. Behaviour is unchanged: a failed background write still fails
>   quietly, which is right for a background write. It is now *visible*.
>
> - **The database gate's fatal path was unreachable on device.**
>   `StartupFailure` renders when `openDatabase()` rejects, but on
>   native the connection was opened at module scope, during bundle
>   evaluation, before React existed — so `openDatabase()` was
>   `Promise.resolve()` and the `.catch` behind it was dead code
>   describing a screen no native user could ever see. A database that
>   would not open took the app down with no message and no log entry.
>   Native now opens inside `openDatabase()` as web already did.
>
> **The general lesson, recorded because it will recur:** a capture
> point is only as good as the proof that it fires. Both of these read
> correctly and were wired to the right screens; neither had ever been
> exercised. The startup path was verified this time by forcing
> `openDatabase()` to reject and confirming `StartupFailure` renders
> with the reason.
>
> **The gate's own ordering** — connection, then schema migrations, then
> taxonomy seed and data fixups, then fonts, with every screen held
> behind all four — is a contract this ADR did not previously name and
> now does. It fails **open** on the completion flag alone (ADR-0011);
> everywhere else it fails closed, to `StartupFailure`.

### 5. Sending a report is a user action, shown in full first

Settings → **Problem log** lists what has been recorded, in
plain text, with the exact text that would be sent visible on screen
before anything is shared. Sending is the OS share sheet, so the user
picks the destination and can read it once more in whatever app they
chose. There is no pre-filled address and no upload.

Showing the payload is not decoration. It is what makes "we send
nothing" checkable by the person being asked to trust it, and it is
cheap here precisely because the log is small and readable by
design — a scrubbed JSON blob nobody can parse would satisfy the
letter of this and none of the point.

**Clear** deletes the log and is always available.

### 6. Not in backups, gone on erase

The log is a file outside the database, so
[ADR-0002](0002-data-model-and-persistence.md)'s database-only backup
excludes it without any special case — a restored backup does not carry
a previous device's crashes, which is correct: they describe a build
and a phone, not a life.

`eraseAllData` deletes it. Erase all data means all data, and a
diagnostic file surviving the one destructive action in the app would
be a small lie in the one place the app cannot afford one.

### 7. Trigger to reopen

**Open ADR-0013 again when the tester pool outgrows asking** — roughly,
when there are people using Glide whom the developer cannot message
individually, or when a bug is known to exist and no report of it can
be obtained. Either condition means anecdote has stopped working, and
opt-in hosted reporting becomes the honest next step: it arrives with a
consent screen, a scrubbing policy inherited from decision 3, ADR-0008
re-confirmed, and the privacy sentence rewritten *before* the SDK is
installed, not after.

Also revisit if a native module forces a dev client for unrelated
reasons — the largest cost in the opt-in column disappears, and the
balance is worth re-checking rather than re-assuming.

## Consequences

- **Easier:** a tester who hits a crash can send a real stack trace
  with a build number on it, from a screen that tells them what they
  are sending. The app stops disappearing without explanation. And the
  strongest claim Glide makes stays a single sentence with no
  asterisk — including through the first distribution, which is when
  claims like it usually acquire one.
- **Harder:** there is no aggregate view and no denominator. A crash
  that happens to five testers who all shrug is invisible, and stacks
  are unsymbolicated, so a minified release frame may need a source map
  kept from the build to read. Fixing anything still starts with a
  conversation.
- **Committed to revisit:** the trigger in decision 7. Also the
  redactor, which is written against the failures we can imagine — the
  first real report that arrives carrying something it should have
  removed is a bug in decision 3, and the fix belongs in the redactor
  rather than in a note asking testers to check first.
- Three dependencies surfaced during the audit as imported nowhere
  (`expo-web-browser`, `expo-system-ui`, `expo-status-bar`). None of
  them send anything; they are listed here only so the audit's negative
  result is reproducible, and the cleanup is housekeeping, not part of
  this decision. Two were removed. **`expo-system-ui` was kept:** it is
  used through config rather than imports — its autolinked config plugin
  is what implements `userInterfaceStyle: "automatic"` on Android,
  writing `expo_system_ui_user_interface_style` into `strings.xml`.
  Without the package, `@expo/prebuild-config`'s unversioned fallback
  only logs "Install expo-system-ui in your project to enable this
  feature" and writes nothing, so Android dark mode would silently stop
  being configured at the next prebuild. "Imported nowhere" is not the
  same test as "unused" for any Expo package that ships a plugin.

## Action items

1. [x] Build the on-device log: capped file, redactor, and report
       formatting. *(`apps/mobile/src/lib/problemLog.ts` holds the
       device half — filesystem, build and device labels, the report
       text. The redactor is `src/lib/redact.ts`, which imports
       nothing, with 14 tests in `src/lib/__tests__/`; `npm test -w
       apps/mobile` runs them and the root `npm test` now includes
       them.)*
2. [x] Install the capture points: root-layout `ErrorBoundary`,
       `ErrorUtils.setGlobalHandler` delegating to the previous
       handler, and the database gate's fatal path. *(All in
       `apps/mobile/src/app/_layout.tsx`; the current route is tracked
       by a `usePathname` witness rendered beside the `Stack` so a
       navigation doesn't re-render the gate.)*
3. [x] Build Settings → Problem log: the recorded entries, the exact
       payload, share, and clear.
       *(`apps/mobile/src/app/problem.tsx`. Shipped as "Report a
       problem"; renamed when the feedback amendment above gave the
       screen a second kind of entry to list.)*
4. [x] Delete the log in `eraseAllData`, and confirm the backup path
       does not include it. *(`apps/mobile/src/db/reset.ts`; backup is
       `sqlite.serializeAsync()`, so a file outside the database is
       excluded by construction.)*
5. [x] Update Settings → Privacy so the on-device log is stated rather
       than merely not contradicted, and add the triage note to
       [docs/release.md](../release.md).
6. [x] Keep the release build's source map for anything shipped to
       testers, so a minified frame in a report can be read back. Not
       code — a step in the release runbook, and untestable until the
       first EAS build exists. *(Done 2026-10-02 check: the step is in
       docs/release.md, "Keep the source map for anything you ship.")*
