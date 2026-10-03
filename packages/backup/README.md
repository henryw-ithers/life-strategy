# @glide/backup

The file format for Life Strategy's encrypted backups: building the
header, sealing a database image into a backup file, and opening one
again.

## It does no cryptography itself

AES-256-GCM and PBKDF2 are passed in as a `BackupCrypto` object. On a
phone that object is Apple's CryptoKit and CommonCrypto, through the
`glide-crypto` native module in `apps/mobile/modules/`. In tests it is
Node's own implementation.

This split exists for a legal reason as well as a testing one. Using
only Apple's cryptography keeps the app exempt from US export-control
reporting, and lets `app.json` declare
`usesNonExemptEncryption: false` truthfully
([ADR-0020](../../docs/adr/0020-backup-cryptography-and-export-exemption.md)).
**Do not add a JavaScript cipher to this package**, even as a fallback
so backups work in Expo Go: it would make that declaration false. See
[docs/release.md](../../docs/release.md#export-compliance).

## Format

One byte string: a plaintext header, then the AES-256-GCM ciphertext of
the whole SQLite database. The key comes from the user's passphrase
through PBKDF2-HMAC-SHA256 (600,000 iterations by default, OWASP's
recommended minimum).

The header is readable without the passphrase, so the restore screen
can show where and when a backup was made before asking for it. It is
also passed to GCM as additional authenticated data, so editing any
header byte makes the file fail to open. It holds no personal data.

The KDF settings are stored in each file's header, so the iteration
count can be raised later without breaking older backups. The full
byte layout is documented at the top of `src/envelope.ts`.

The magic bytes `LSBK` and the `.lsbk` extension come from the app's
original name and must not change: renaming them would make every
existing backup unopenable.

## Tests

```bash
npm test -w packages/backup         # or `npm test` from the root
npm run typecheck -w packages/backup
```

The tests check the format against Node's AES-GCM and PBKDF2. That
catches changes to the format, but it never runs the Swift code; a
backup has to be made and restored in a development build to test
that.
