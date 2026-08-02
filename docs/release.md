# Release

How Glide gets onto a device that isn't the dev machine. Deliberately
not an ADR — release operations were excluded from the ADR set (see the
[ADR index](adr/README.md)); this is the runbook.

## Distribution model

**TestFlight**, external testers. Chosen over ad-hoc/EAS internal
distribution because ad-hoc bakes an allowlist of device UDIDs into the
signed binary: every new tester means collecting a UDID via a
configuration profile they install by hand, then a fresh build.
TestFlight moves that check to Apple's servers against Apple IDs, so
adding a tester costs nothing and never needs a rebuild.

The trade: Apple is the gatekeeper. The first build goes through Beta
App Review (usually a day or two; later builds normally skip it),
builds expire 90 days after upload, and there's an upload-and-process
step before a build becomes installable.

## Identity — do not change after the first upload

| | |
|---|---|
| Display name | Glide |
| Bundle identifier (iOS) | `com.glide.app` |
| Expo slug | `glide` |
| URL scheme | `glide://` |

**iOS only** since [ADR-0020](adr/0020-backup-cryptography-and-export-exemption.md).
The Android package name is gone along with the `android` block; if
Android ever returns it needs a new ADR, because the export exemption
above is Apple-specific and a second platform forfeits it.

Changing the bundle identifier after a build reaches App Store Connect
means a new app record and a reinstall for every tester — their local
data does not come with it.

Three names are **older than the rename and must stay** — they are
compatibility surfaces, not branding:

- `life-strategy.db` — the on-device SQLite filename. Renaming it
  orphans the user's data and silently opens an empty database.
- `LSBK` magic bytes and the `.lsbk` extension — the backup file
  format identifier. Renaming invalidates every backup already
  written.

## Versioning

`eas.json` sets `appVersionSource: "remote"`, so EAS owns the build
number and the `production` profile auto-increments it. `version` in
`app.json` (currently `1.0.0`) is the user-facing string and moves by
hand.

Settings shows `Glide <version> (<build>)` at the bottom, selectable —
ask testers for that line when triaging a report, since they will not
all be on the same build.

## Build profiles

| Profile | Use |
|---|---|
| `development` | Dev client, internal. Required for any backup work — see below. |
| `preview` | Internal distribution; iOS simulator build for a quick check on the Mac. |
| `production` | Store build; what goes to TestFlight. Auto-increments. |

**Expo Go is still the day-to-day workflow, but it no longer covers
everything.** The SDK 54 pin keeps it working
([ADR-0001](adr/0001-platform-and-tech-stack.md)) and `npm run mobile`
remains the default loop. What changed is that
[ADR-0020](adr/0020-backup-cryptography-and-export-exemption.md) put
the backup cryptography in a native module, and Expo Go cannot load
custom native code — so **backup and restore only work in a
`development`, `preview`, or TestFlight build.** The screen says so
rather than failing at the passphrase prompt.

Anything touching `packages/backup`, `src/backup/`, or
`modules/glide-crypto` therefore needs a dev client to verify. That
build is also the only place the Swift runs at all: the vitest suite
pins the envelope format against Node's AES-GCM and PBKDF2, which
catches format drift but never executes CryptoKit.

## First run through

Steps 1–2 are external and block everything else.

1. **Enrol in the Apple Developer Program** ($99/yr, individual is
   fine). Identity verification can add days — start it first.
2. **Create the app record** in App Store Connect using
   `com.glide.app`.
3. `eas init` — writes `extra.eas.projectId` into `app.json`. Commit it.
4. `eas build --platform ios --profile production`
5. `eas submit --platform ios --profile production`
6. In App Store Connect, add the build to TestFlight, fill the test
   details, and submit for **Beta App Review**.
7. Once approved, enable the **public link** and send it to testers.
   They need the TestFlight app and an Apple ID; nothing else.

Submit an installable build for review early — before onboarding and
the starter plan are finished. The first build only has to pass review,
and later builds inherit the approval.

Credentials: EAS can manage signing automatically. The app schedules
**local** notifications only, so no APNs push key is needed.

## Export compliance

`app.json` declares `ios.config.usesNonExemptEncryption: false`, which
answers App Store Connect's export-compliance question on every upload
instead of leaving each build flagged "Missing Compliance" until
someone clicks through the questionnaire.

**It says `false` because every cryptographic operation in the app is
Apple's own** — AES-256-GCM from CryptoKit and PBKDF2-HMAC-SHA256 from
CommonCrypto, through the `glide-crypto` module in
`apps/mobile/modules/`. Cryptography performed via Apple's frameworks
is squarely inside the exemption, so there is no BIS filing, no
self-classification report, and no annual return.

**This is a decision, not a default, and it is load-bearing.** The same
flag previously read `false` by inheritance while the app shipped
Argon2id and AES from `@noble` — which was simply wrong, and would have
been an inaccurate declaration attached to the developer account. The
full reasoning is [ADR-0020](adr/0020-backup-cryptography-and-export-exemption.md).

**What would break it.** Adding *any* bundled third-party cryptographic
implementation — a JS cipher, a hashing library used for anything
security-bearing, an SDK that encrypts — makes the app
export-controlled again and this declaration false. It would then need
`true` plus a mass-market self-classification (ECCN 5D992.c under EAR
§740.17(b)(1)): a CSV to BIS and the ENC Request Coordinator, then an
annual filing. Neither is onerous; both are silent failures if nobody
notices the flag no longer matches the binary.

So: **if a change adds a crypto dependency, it also changes this
file.** `packages/backup` carries the same warning at the top of
`envelope.ts` and in its package description, and
`src/backup/crypto.ts` names the specific tempting mistake — adding a
JS fallback so backup works in Expo Go again.

Apple declines to interpret the EAR and puts liability for an
inaccurate claim on the developer, so if the crypto stack ever moves
back off Apple's frameworks, confirm the classification with someone
qualified rather than inheriting it from this file.

## Where tester feedback arrives

**Settings → Send feedback** composes an email and opens the tester's
own mail app; nothing is transmitted by the build
([ADR-0013](adr/0013-crash-reporting-and-telemetry.md)). Subjects are
tagged so an inbox filter can sort them:

    Glide feedback (idea|confusing|not working) — <version> (<build>)

Mail goes to **glidefeedback@gmail.com** — a dedicated inbox, not a
personal one, because the address is compiled into every distributed
binary. It lives in one place: `FEEDBACK_ADDRESS` in
`apps/mobile/src/app/feedback.tsx`.

**Set up forwarding into your everyday inbox, and reply from the
feedback account, not from your own.** A reply sent from a personal
address hands it to the tester and undoes the point of having a separate
one. Worth moving to an address at Glide's own domain if there is ever a
store listing — but note that the App Store requires unique app names
and "Glide" is already a well-known product, so the domain question and
the naming question resolve together.

**Changing the address needs a new build**, and old TestFlight builds
stay installable for 90 days, so a stale address quietly keeps
collecting mail nobody reads. Expire old builds after such a change, the
same rule migrations get below.

Two things worth knowing when a report doesn't arrive:

- A tester who taps Send feedback has *opened a draft*, not sent one.
  The screen says so, and their note stays in the app either way, but
  silence is not evidence they had nothing to say.
- On a phone with no mail account the screen falls back to the share
  sheet, so feedback can arrive over Messages instead.

## Getting a report out of a tester

There is no crash reporting service and there will not be one
([ADR-0013](adr/0013-crash-reporting-and-telemetry.md)) — nothing
arrives on its own. When a tester says the app broke:

1. **Settings → Problem log**, then **Send log**. It opens the share
   sheet and they pick where it goes; the text is plain and visible
   before they send it. That beats a screenshot, which loses the stack.
   The log also lists the feedback they have sent — timestamps and
   topics only, never the message — which is often how you find out a
   crash and an email are the same story.
2. If that page says "Nothing here yet," the app did not crash — it
   misbehaved, and the description in their own words is the only
   evidence there is.
3. The report carries its own version and build, so the
   `Glide <version> (<build>)` line at the bottom of Settings is only
   needed for bugs that never produced an entry.

**Keep the source map for anything you ship.** Release stacks are
minified, so without the map for that exact build a frame in a report
reads as `<anonymous>:1:284913` and tells you nothing. Pull it from the
build artifacts and keep it alongside the build number — this is the
only part of ADR-0013 that lives here rather than in code, and the one
step that cannot be done retroactively.

## Shipping a build that contains a migration

Migrations are forward-only ([ADR-0002](adr/0002-data-model-and-persistence.md)).
Old TestFlight builds stay installable, so a tester *can* go backwards
onto code older than their database — additive migrations usually
survive that, anything that renames or drops will not.

**Rule: when a build contains a new migration, expire the previous
builds in App Store Connect.** That is the only thing stopping a
downgrade.

## Housekeeping

- Builds expire after 90 days. If a test runs longer, push a fresh
  build even when nothing has changed, or testers get locked out.
- Updating preserves data; **deleting the app does not.** Point testers
  at Settings → Your data to export a `.lsbk` before anything drastic.
- `src/app/dev/graph.tsx` is gated behind `__DEV__` and redirects home
  in a release build. Any future dev-only route needs the same gate —
  Expo Router bundles every file under `src/app/`, linked or not.
