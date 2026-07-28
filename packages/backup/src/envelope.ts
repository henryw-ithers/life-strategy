/**
 * The backup envelope (ADR-0002 "Backup (v1)", action item 3).
 *
 * A sealed backup is one self-describing byte string: a plaintext
 * header, then AES-256-GCM ciphertext of the whole SQLite image. The
 * key is derived from the user's passphrase with Argon2id — see
 * `deriveKey` for why the passphrase is mandatory rather than the
 * optional recovery aid ADR-0002 originally described.
 *
 * Layout (all integers big-endian):
 *
 *     0   4   magic "LSBK"
 *     4   1   format version
 *     5   1   kdf id (1 = argon2id)
 *     6   4   argon2 memory, KiB
 *     10  4   argon2 iterations
 *     11  1   argon2 parallelism
 *     15  16  salt
 *     31  12  nonce
 *     43  2   metadata length
 *     45  n   metadata, JSON/UTF-8
 *     ..  ..  ciphertext, GCM tag included
 *
 * The header is **plaintext but authenticated**: it is passed to GCM
 * as additional data, so a restore screen can show where a file came
 * from and when, before asking for a passphrase — while any edit to
 * those bytes still fails the tag. It carries no personal data; the
 * app version, migration count, date and size are all it exposes.
 *
 * The KDF parameters live in the header rather than in a constant so
 * they can be raised later (after on-device benchmarking, or as
 * phones get faster) without stranding a single existing backup:
 * opening a file always uses the parameters that file was written
 * with.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { argon2id } from "@noble/hashes/argon2.js";

import { BackupError } from "./errors";

// "LSBK" — from the app's former name, kept deliberately. The magic
// bytes and the `.lsbk` extension identify the file format, not the
// product; changing them on the Glide rename would have made every
// backup already written unopenable for no user-visible gain.
const MAGIC = new Uint8Array([0x4c, 0x53, 0x42, 0x4b]);
const FORMAT_VERSION = 1;
const KDF_ARGON2ID = 1;

const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const KEY_BYTES = 32; // AES-256
const HEADER_FIXED_BYTES = 45;

/**
 * OWASP's recommended Argon2id minimum (19 MiB, 2 iterations, 1 lane).
 * Roughly half a second on a laptop; a few seconds on a phone running
 * this in JS. Slow enough to matter against an offline guess of a
 * human-chosen passphrase, fast enough that a backup does not feel
 * broken. Worth re-benchmarking on the actual test device — raising
 * these is safe, since every file records what it used.
 */
export const DEFAULT_KDF: KdfParams = {
  kind: "argon2id",
  memoryKiB: 19456,
  iterations: 2,
  parallelism: 1,
};

export interface KdfParams {
  kind: "argon2id";
  memoryKiB: number;
  iterations: number;
  parallelism: number;
}

/** Provenance, readable without the passphrase (authenticated). */
export interface BackupMeta {
  /** App version that wrote the file. */
  appVersion: string;
  /** How many migrations the writing app had applied. A backup from a
   *  newer schema than the running app cannot be safely restored. */
  migrationCount: number;
  /** ISO-8601 UTC. */
  createdAt: string;
  /** Length of the plaintext SQLite image, for a size display and a
   *  sanity check after decryption. */
  payloadBytes: number;
}

export interface SealedHeader {
  formatVersion: number;
  kdf: KdfParams;
  meta: BackupMeta;
}

/** Injected so the pure package never reaches for a global. The app
 *  passes `expo-crypto`'s; tests pass a deterministic stub. */
export type RandomBytes = (length: number) => Uint8Array;

const webRandom: RandomBytes = (length) => {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
};

function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  kdf: KdfParams,
): Uint8Array {
  return argon2id(passphrase, salt, {
    m: kdf.memoryKiB,
    t: kdf.iterations,
    p: kdf.parallelism,
    dkLen: KEY_BYTES,
  });
}

function encodeHeader(
  kdf: KdfParams,
  salt: Uint8Array,
  nonce: Uint8Array,
  metaJson: Uint8Array,
): Uint8Array {
  const header = new Uint8Array(HEADER_FIXED_BYTES + metaJson.length);
  const view = new DataView(header.buffer);
  header.set(MAGIC, 0);
  header[4] = FORMAT_VERSION;
  header[5] = KDF_ARGON2ID;
  view.setUint32(6, kdf.memoryKiB);
  view.setUint32(10, kdf.iterations);
  header[14] = kdf.parallelism;
  header.set(salt, 15);
  header.set(nonce, 15 + SALT_BYTES);
  view.setUint16(43, metaJson.length);
  header.set(metaJson, HEADER_FIXED_BYTES);
  return header;
}

/**
 * Parse and validate the plaintext header. No passphrase needed, and
 * no authentication yet — nothing here is trusted until `openBackup`
 * verifies the tag over these same bytes.
 */
export function readHeader(envelope: Uint8Array): SealedHeader & {
  headerBytes: number;
} {
  if (envelope.length < HEADER_FIXED_BYTES) {
    throw new BackupError("not-a-backup", "File is too short to be a backup.");
  }
  if (!MAGIC.every((b, i) => envelope[i] === b)) {
    throw new BackupError(
      "not-a-backup",
      "File does not look like a Glide backup.",
    );
  }

  const formatVersion = envelope[4]!;
  if (formatVersion > FORMAT_VERSION) {
    throw new BackupError(
      "unsupported-format",
      `Backup format ${formatVersion} is newer than this app understands (${FORMAT_VERSION}).`,
    );
  }
  if (envelope[5] !== KDF_ARGON2ID) {
    throw new BackupError(
      "unsupported-format",
      `Unknown key-derivation id ${envelope[5]}.`,
    );
  }

  const view = new DataView(
    envelope.buffer,
    envelope.byteOffset,
    envelope.byteLength,
  );
  const metaLength = view.getUint16(43);
  const headerBytes = HEADER_FIXED_BYTES + metaLength;
  if (envelope.length < headerBytes) {
    throw new BackupError("not-a-backup", "Backup header is truncated.");
  }

  let meta: BackupMeta;
  try {
    meta = JSON.parse(
      new TextDecoder().decode(envelope.subarray(HEADER_FIXED_BYTES, headerBytes)),
    ) as BackupMeta;
  } catch {
    throw new BackupError("not-a-backup", "Backup header is unreadable.");
  }

  return {
    formatVersion,
    kdf: {
      kind: "argon2id",
      memoryKiB: view.getUint32(6),
      iterations: view.getUint32(10),
      parallelism: envelope[14]!,
    },
    meta,
    headerBytes,
  };
}

export interface SealInput {
  /** The SQLite image to protect. */
  payload: Uint8Array;
  passphrase: string;
  meta: Omit<BackupMeta, "payloadBytes">;
  kdf?: KdfParams;
  randomBytes?: RandomBytes;
}

/** Encrypt a database image into a self-describing backup file. */
export function sealBackup(input: SealInput): Uint8Array {
  const random = input.randomBytes ?? webRandom;
  const kdf = input.kdf ?? DEFAULT_KDF;
  const salt = random(SALT_BYTES);
  const nonce = random(NONCE_BYTES);

  const metaJson = new TextEncoder().encode(
    JSON.stringify({ ...input.meta, payloadBytes: input.payload.length }),
  );
  const header = encodeHeader(kdf, salt, nonce, metaJson);

  const key = deriveKey(input.passphrase, salt, kdf);
  const ciphertext = gcm(key, nonce, header).encrypt(input.payload);

  const out = new Uint8Array(header.length + ciphertext.length);
  out.set(header, 0);
  out.set(ciphertext, header.length);
  return out;
}

export interface OpenedBackup {
  payload: Uint8Array;
  meta: BackupMeta;
  formatVersion: number;
}

/**
 * Verify and decrypt. Throws `BackupError` with a code the UI can turn
 * into the right sentence; a wrong passphrase and a corrupted file are
 * the same code on purpose, since GCM cannot tell them apart and
 * guessing would only mislead.
 */
export function openBackup(
  envelope: Uint8Array,
  passphrase: string,
): OpenedBackup {
  const { kdf, meta, formatVersion, headerBytes } = readHeader(envelope);
  const header = envelope.subarray(0, headerBytes);
  const salt = envelope.subarray(15, 15 + SALT_BYTES);
  const nonce = envelope.subarray(15 + SALT_BYTES, 15 + SALT_BYTES + NONCE_BYTES);

  const key = deriveKey(passphrase, salt, kdf);
  let payload: Uint8Array;
  try {
    payload = gcm(key, nonce, header).decrypt(envelope.subarray(headerBytes));
  } catch {
    throw new BackupError(
      "bad-passphrase-or-corrupt",
      "That passphrase didn't open this backup, or the file has been damaged.",
    );
  }

  // The tag already proves this, but a mismatch here would mean the
  // format and the writer disagree — worth failing loudly, not later.
  if (payload.length !== meta.payloadBytes) {
    throw new BackupError(
      "bad-passphrase-or-corrupt",
      "Backup contents do not match its header.",
    );
  }

  return { payload, meta, formatVersion };
}
