/**
 * The backup file (ADR-0002 "Backup (v1)", as amended by ADR-0046).
 *
 * A backup is one self-describing byte string: a short header, then
 * the whole SQLite database image, as it is. **It is not encrypted**
 * (ADR-0046): there is no passphrase, and anyone with the file can read
 * what's in it. A CRC-32 over the metadata and the database catches a
 * damaged file before it replaces anything.
 *
 * **Nothing here encrypts, and nothing may** without an ADR: any
 * cryptography in the app changes its export answer (AGENTS.md,
 * docs/release.md). Encrypting backups again is the tempting one.
 *
 * Layout (all integers big-endian):
 *
 *     0   4   magic "LSBK"
 *     4   1   format version (3)
 *     5   1   reserved, zero
 *     6   4   CRC-32 of everything after the first 12 bytes
 *     10  2   metadata length
 *     12  n   metadata, JSON/UTF-8
 *     ..  ..  the database image
 *
 * Formats 1 and 2 were encrypted with a passphrase (ADR-0020) and are
 * not read any more: nobody but the developer ever wrote one, and
 * reading them would mean shipping the cryptography ADR-0046 removed.
 */
import { crc32 } from "./crc32";
import { BackupError } from "./errors";

// "LSBK", from the app's former name, kept deliberately. The magic
// bytes and the `.lsbk` extension identify the file format, not the
// product, so a rename never changes them.
const MAGIC = new Uint8Array([0x4c, 0x53, 0x42, 0x4b]);

const FORMAT_VERSION = 3;
/** Formats 1 and 2 were encrypted (ADR-0020). */
const LAST_ENCRYPTED_FORMAT = 2;
const HEADER_FIXED_BYTES = 12;

/** Every SQLite database starts with these 16 bytes. */
const SQLITE_MAGIC = new TextEncoder().encode("SQLite format 3\0");

/** Provenance, shown before a restore. */
export interface BackupMeta {
  /** App version that wrote the file. */
  appVersion: string;
  /** How many migrations the writing app had applied. A backup from a
   *  newer schema than the running app cannot be safely restored. */
  migrationCount: number;
  /** ISO-8601 UTC. */
  createdAt: string;
  /** Length of the database image, for a size display and a check. */
  payloadBytes: number;
}

export interface BackupHeader {
  formatVersion: number;
  meta: BackupMeta;
  /** CRC-32 of the metadata and the database image. */
  checksum: number;
  /** Where the database image starts. */
  headerBytes: number;
}

/** Write a database image into a backup file. */
export function writeBackup(input: {
  payload: Uint8Array;
  meta: Omit<BackupMeta, "payloadBytes">;
}): Uint8Array {
  const metaJson = new TextEncoder().encode(
    JSON.stringify({ ...input.meta, payloadBytes: input.payload.length }),
  );
  const headerBytes = HEADER_FIXED_BYTES + metaJson.length;
  const out = new Uint8Array(headerBytes + input.payload.length);
  const view = new DataView(out.buffer);
  out.set(MAGIC, 0);
  out[4] = FORMAT_VERSION;
  // byte 5 stays zero: reserved.
  view.setUint16(10, metaJson.length);
  out.set(metaJson, HEADER_FIXED_BYTES);
  out.set(input.payload, headerBytes);
  // Over the metadata as well as the database: the migration count in
  // it decides whether a restore is refused as too new.
  view.setUint32(6, crc32(out.subarray(HEADER_FIXED_BYTES)));
  return out;
}

/**
 * Read and check the header: what the restore screen shows before
 * anything is replaced. Doesn't check the database itself; `readBackup`
 * does.
 */
export function readHeader(file: Uint8Array): BackupHeader {
  if (file.length < HEADER_FIXED_BYTES) {
    throw new BackupError("not-a-backup", "File is too short to be a backup.");
  }
  if (!MAGIC.every((b, i) => file[i] === b)) {
    throw new BackupError("not-a-backup", "File does not look like a Life Strategy backup.");
  }

  const formatVersion = file[4]!;
  if (formatVersion > FORMAT_VERSION) {
    throw new BackupError(
      "unsupported-format",
      `Backup format ${formatVersion} is newer than this app understands (${FORMAT_VERSION}).`,
    );
  }
  if (formatVersion <= LAST_ENCRYPTED_FORMAT) {
    throw new BackupError(
      "encrypted-format",
      `Backup format ${formatVersion} was encrypted with a passphrase, which this app no longer reads.`,
    );
  }

  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const checksum = view.getUint32(6);
  const metaLength = view.getUint16(10);
  const headerBytes = HEADER_FIXED_BYTES + metaLength;
  if (file.length < headerBytes) {
    throw new BackupError("damaged", "Backup header is truncated.");
  }

  let meta: BackupMeta;
  try {
    meta = JSON.parse(
      new TextDecoder().decode(file.subarray(HEADER_FIXED_BYTES, headerBytes)),
    ) as BackupMeta;
  } catch {
    throw new BackupError("damaged", "Backup header is unreadable.");
  }

  return { formatVersion, meta, checksum, headerBytes };
}

export interface OpenedBackup {
  payload: Uint8Array;
  meta: BackupMeta;
  formatVersion: number;
}

/**
 * Read a backup and check that its database arrived whole: the right
 * length, the right checksum, and a SQLite file. Throws `BackupError`
 * with a code the restore screen turns into a sentence.
 */
export function readBackup(file: Uint8Array): OpenedBackup {
  const { meta, formatVersion, checksum, headerBytes } = readHeader(file);
  const payload = file.subarray(headerBytes);
  if (payload.length !== meta.payloadBytes) {
    throw new BackupError("damaged", "Backup is the wrong length; it may be cut short.");
  }
  if (crc32(file.subarray(HEADER_FIXED_BYTES)) !== checksum) {
    throw new BackupError("damaged", "Backup contents don't match their checksum.");
  }
  if (!SQLITE_MAGIC.every((b, i) => payload[i] === b)) {
    throw new BackupError("damaged", "Backup doesn't contain a database.");
  }
  return { payload, meta, formatVersion };
}
