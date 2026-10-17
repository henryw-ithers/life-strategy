# @glide/backup

The file format for Life Strategy's backups: writing one from the
database image, and reading one back with its provenance. Pure
TypeScript with no React Native imports (ADR-0001), so it is tested off
the device. The device half (SQLite serialize, the share sheet, the
file picker and the swap) lives in `apps/mobile/src/backup/`.

A backup is **not encrypted** ([ADR-0046](../../docs/adr/0046-backups-are-plain-files.md)).
It is a short header and then the whole SQLite database: anyone with
the file can read it. The header holds the app version, the migration
count, the date and the size, and a CRC-32 of the database, so the
restore screen can show where a file came from and refuse one that
arrived damaged.

The `LSBK` magic and the `.lsbk` extension come from the app's first
name and stay: they name the format, not the product. Formats 1 and 2
were encrypted with a passphrase (ADR-0020) and are no longer read.
