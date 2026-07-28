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
| Package name (Android) | `com.glide.app` |
| Expo slug | `glide` |
| URL scheme | `glide://` |

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
| `development` | Dev client, internal. Not the daily workflow — see below. |
| `preview` | Internal distribution; Android APK for a quick sideload. |
| `production` | Store build; what goes to TestFlight. Auto-increments. |

**Expo Go stays the day-to-day workflow.** The SDK 54 pin exists to
keep it working ([ADR-0001](adr/0001-platform-and-tech-stack.md)); the
`development` profile is there for when a native module eventually
forces a dev client, not as a replacement for `npm run mobile`.

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

## Export compliance — verify this yourself

`app.json` declares `ios.config.usesNonExemptEncryption: false`, which
answers App Store Connect's export-compliance question on every upload
instead of prompting.

The app does ship encryption: AES-256-GCM and Argon2id, used solely to
encrypt the user's own backup file
([ADR-0002](adr/0002-data-model-and-persistence.md) as amended).
Standard cryptography protecting a user's own data at rest is the
textbook exemption, which is why the flag is set that way — **but this
is a legal declaration made in your name, not an engineering default.**
Read Apple's questionnaire once and confirm the answer before the first
submission. If it turns out not to apply, remove the `config` block and
answer in App Store Connect per build.

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
