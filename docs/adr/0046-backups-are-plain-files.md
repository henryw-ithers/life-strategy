# ADR-0046: Backups are plain files

> **Status:** Accepted\
> **Date:** 2026-10-16 (decided 2026-10-13)\
> **Deciders:** Henry\
> **Supersedes:** [ADR-0020](0020-backup-cryptography-and-export-exemption.md)
> (backup cryptography). **Amends:**
> [ADR-0002](0002-data-model-and-persistence.md) (Backup v1)

## Context

ADR-0002 made a backup an encrypted file, and its 2026-07-26 amendment
made the passphrase mandatory: it was the only key. ADR-0020 then moved
the cipher and the key derivation onto Apple's CryptoKit and
CommonCrypto, through a local native module (`glide-crypto`), so the
app stayed exempt from US export-control reporting.

On 2026-10-13, testing the SDK 57 development build, Henry found the
passphrase "so unnecessary." Every backup asked for one, twice, and
every restore asked again, for a file he made and kept himself. The
cost of a forgotten passphrase was the whole backup, with no way back.
Nobody else uses the app, so no one else's backups depend on the
format.

## Open questions

1. Is the passphrase optional, or gone?
2. What replaces the integrity check the encryption gave for free?
3. What happens to a backup written with a passphrase?

## Options considered

### Keep the passphrase, optional

A backup could be plain or locked, the user's choice. It keeps the
native module, the second code path and the export reasoning, for a
choice Henry had already made: he wanted none of it.

### Keep encryption, store the key in the Keychain

No passphrase to type: Face ID unlocks a key kept on the phone. But a
backup exists for the day the phone is gone, and a key that lives on
the phone goes with it. ADR-0002's amendment rejected this for that
reason, and it still holds.

### Plain files (chosen)

A backup is the database as it is, behind a short header. No
passphrase, no cryptography, no native module.

## Decision

**A backup is a plain file. There is no passphrase.**

- **Format 3.** The magic `LSBK` and the `.lsbk` extension stay: they
  name the format, not the product. The header holds the format
  version, a CRC-32, and the metadata it already had (app version,
  migration count, date, size). Then the SQLite image, as it is.
- **Integrity is a checksum.** GCM's tag used to catch a damaged file,
  header included. Now the CRC-32 covers the metadata and the image
  together, and the restore checks it, the length and that the image
  is a SQLite database, before anything on the phone is touched. A CRC-32
  catches accidents (a download cut short, a changed byte), not
  someone editing the file on purpose; anyone who can edit the file
  can already read it, so there is nothing a stronger hash would
  protect.
- **Formats 1 and 2 are not read.** They were encrypted. The restore
  screen names them as backups made with a passphrase that this
  version can't open, rather than calling them damaged. Reading them
  would mean shipping the cryptography this ADR removes, for files
  only the developer ever wrote.
- **The screens say what a plain file means.** Backup and the privacy
  statement both say that anyone with the file can read it, and to
  keep it somewhere private.
- **`glide-crypto` is removed**, and `@glide/backup` takes no crypto
  argument. The app ships no cryptography of its own at all.

## Consequences

- **Easier.** Backing up is one tap and restoring is a file and a
  confirm. Nothing can be locked out by a forgotten passphrase. The
  format is fully testable off the device, and any build can run
  backup, with no native module to load.
- **Harder.** A backup is readable by anyone who gets the file: in
  iCloud Drive, a mail attachment, a shared folder. That is now the
  user's to look after, and the app says so where it matters.
- **Export compliance gets simpler, not riskier.** `app.json` keeps
  `usesNonExemptEncryption: false`, now because the app contains no
  encryption of its own. The rule from ADR-0020 still stands: adding
  any bundled cryptography is a decision with legal consequences
  (docs/release.md).
- **iOS only still holds.** ADR-0020 gave the export exemption as one
  reason for it; the app is built on iOS-only parts now (native tabs,
  SwiftUI sheets, Liquid Glass, ADR-0043), and a second platform would
  still need its own ADR.
- **Revisit** if the app is shared with other people and their backups
  start going places they don't control, or if cloud backup (ADR-0012)
  is ever built: a file the app uploads would need encryption again,
  and its own export answer.
