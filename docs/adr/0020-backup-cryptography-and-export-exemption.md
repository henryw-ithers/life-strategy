# ADR-0020: Backup cryptography and export exemption

> **Status:** Accepted\
> **Date:** 2026-08-01\
> **Deciders:** Henry\
> **Amends:** [ADR-0002](0002-data-model-and-persistence.md) (Backup v1
> cipher and KDF), [ADR-0001](0001-platform-and-tech-stack.md) (Expo Go
> workflow, target platforms)

## Context

Preparing the first TestFlight submission surfaced a question the code
had already answered by accident. `app.json` carried
`ios.config.usesNonExemptEncryption: false` — an Expo default nobody had
examined — while the app ships AES-256-GCM and Argon2id from `@noble`
to seal backup files (ADR-0002 as amended).

That declaration is not a build setting. US export law (the EAR,
administered by BIS) treats encryption as controlled technology, and
App Store Connect asks the question on every upload so the answer can
be attached to the developer account. Apple explicitly declines to
interpret the regulation and places liability for an inaccurate
exemption claim on the developer.

The exemptions are narrower than the flag's default suggests. They
cover HTTPS/TLS, cryptography performed through *Apple's own*
frameworks (CryptoKit, Keychain, CommonCrypto, Security.framework), and
encryption limited to authentication, signatures, or copy protection.
Shipping a JavaScript AES implementation is none of those. `false` was
simply wrong.

Being non-exempt is not a barrier — both algorithms are published
standards, so the app is self-classifiable as a mass-market item
(ECCN 5D992.c under §740.17(b)(1)): one CSV to BIS, then an annual
filing. Roughly thirty minutes once and five minutes a year.

Two facts made a bigger change worth considering anyway:

- **Cross-platform had stopped paying for itself.** Android was never
  tested on a device and the Play Store was not on any roadmap. The
  cost of keeping the option open exceeded its remaining value.
- **Nothing had shipped.** Zero TestFlight builds meant zero `.lsbk`
  files existed outside a development machine, so the backup format —
  normally a compatibility surface that must never move — was free to
  change. That window closes permanently at the first upload.

## Open questions

1. Accept non-exempt status and file with BIS, or restructure to
   qualify for the exemption?
2. If restructuring: CryptoKit provides no password-based KDF. What
   derives a key from a passphrase?
3. What happens to `packages/backup`'s "no React Native imports" rule,
   which exists so the format is testable off-device?
4. What happens to the Expo Go workflow that ADR-0001's SDK 54 pin
   exists to protect?

## Options considered

### Option A: Keep `@noble`, file the BIS self-classification

No code change. Argon2id stays, Expo Go stays, `packages/backup` stays
pure. Cost is the filing and an annual email, and the declaration in
`app.json` flips to `true`.

Cheapest by a wide margin, and correct. Rejected only because the
project chose to drop cross-platform independently, which changed what
the alternative cost.

### Option B: CryptoKit for AES, keep `@noble` Argon2id

Superficially appealing and **actually incoherent**. Argon2id would
remain a bundled third-party implementation, so the app stays
export-controlled and the filing does not go away — while still paying
the native-module cost. Rejected as achieving nothing.

### Option C: Apple frameworks for both primitives — chosen

AES-256-GCM from CryptoKit, PBKDF2-HMAC-SHA256 from CommonCrypto, via a
local Expo module in `apps/mobile/modules/glide-crypto`. Every
cryptographic operation becomes Apple's, which places the app squarely
in the exemption. No filing, ever.

The cost is real and is accepted below.

## Decision

**Option C.** All backup cryptography moves to Apple's frameworks, the
app becomes iOS-only, and `usesNonExemptEncryption` returns to `false`
— this time as a verified answer rather than an inherited default.

Specifics:

- **AES-256-GCM via CryptoKit**, unchanged as the cipher.
- **PBKDF2-HMAC-SHA256 via CommonCrypto** replaces Argon2id, at
  OWASP's recommended 600,000 iterations.
- **`packages/backup` performs no cryptography at all.** Both
  primitives arrive injected as a `BackupCrypto`. The package keeps its
  no-React-Native rule, and the envelope format stays pure TypeScript
  tested in vitest on any machine.
- **Format version 2.** KDF id 2 = pbkdf2-hmac-sha256; the header's
  Argon2 memory/parallelism fields become five reserved zero bytes.
  Every other offset is unchanged.
- **There is no format-1 reader and never will be.** Writing one would
  mean shipping Argon2id again, which would undo the exemption. Format 1
  reached no user, so this strands nothing.
- **Android and the Play Store are dropped.** The `android` block,
  adaptive icons, and the APK build profile are removed.

### Why PBKDF2 is the weak point, stated plainly

Argon2id is memory-hard; PBKDF2 is not. Against an attacker with a
stolen `.lsbk` file and a GPU, PBKDF2 at 600,000 iterations buys
meaningfully less than Argon2id at OWASP's minimum. **This is a
security regression, accepted knowingly**, and it is the one part of
this decision that trades user protection for a compliance
convenience.

Three things bound the damage, none of which erase it:

- The iteration count is set at the recommended ceiling, not a
  comfortable middle.
- CommonCrypto runs natively, so 600,000 iterations costs roughly half
  a second on a modern iPhone where the JS Argon2id took several — the
  work moves from the user's patience into the attacker's cost.
- The threat requires the attacker to already hold the file, which the
  user chose where to store.

CryptoKit gaining a memory-hard KDF is the trigger to revisit. The
header reserves five bytes for exactly that, and a new KDF id is a
format-compatible change.

## Consequences

**Easier.** No BIS filing, no annual report, no export paperwork ever.
The export-compliance question is answered correctly and permanently.
One platform to design, test, and support. Native crypto is an order of
magnitude faster than the JS it replaces. Dropping `@noble` removed two
dependencies and cut `npm audit` findings from ~39 to 21.

**Harder.**

- **Backup and restore no longer work in Expo Go.** Custom native code
  is exactly what Expo Go cannot load. The rest of the app is
  unaffected, so `npm run mobile` remains the daily workflow — but any
  work touching backup now needs a development build. ADR-0001's SDK 54
  pin still protects that daily workflow; it just no longer covers
  everything.
- **A Mac is now on the critical path** for iterating on the Swift.
  Acceptable because one is available; it would not have been
  otherwise.
- **Crypto correctness is no longer proven by the test suite.** The
  vitest suite pins the *format* against Node's AES-256-GCM and
  PBKDF2 — a second independent implementation of the same standards —
  so a device round-trip catches drift in the Swift. But the Swift
  itself is exercised only on a device.
- **The web preview cannot do backup.** `isCryptoAvailable` is false
  there and the screen says so, rather than failing when someone types
  a passphrase.

**Committing to revisit** if CryptoKit ships a memory-hard KDF, or if
Android ever returns — which would now mean re-solving this from
scratch, since the exemption argument is Apple-specific and a second
platform would drag the filing back in.

**The one-way door:** this had to happen before the first TestFlight
upload or not at all. After that, changing the KDF means stranding real
backups.
