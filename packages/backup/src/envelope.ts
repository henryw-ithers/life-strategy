/**
 * The backup envelope (ADR-0002 "Backup (v1)", action item 3, as
 * amended by ADR-0020).
 *
 * A sealed backup is one self-describing byte string: a plaintext
 * header, then AES-256-GCM ciphertext of the whole SQLite image. The
 * key is derived from the user's passphrase with PBKDF2-HMAC-SHA256.
 *
 * **This file performs no cryptography.** Both primitives arrive as an
 * injected `BackupCrypto`, which on a device is Apple's CryptoKit and
 * CommonCrypto via the `glide-crypto` native module, and in tests is a
 * deterministic stub. That indirection is the whole point of ADR-0020:
 * shipping only Apple's cryptographic frameworks is what makes the app
 * export-exempt, while the format logic below stays pure TypeScript
 * that runs in vitest on any machine.
 *
 * Layout (all integers big-endian):
 *
 *     0   4   magic "LSBK"
 *     4   1   format version
 *     5   1   kdf id (2 = pbkdf2-hmac-sha256)
 *     6   4   pbkdf2 iterations
 *     10  5   reserved, zero
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
 * with. The five reserved bytes at offset 10 are the room a
 * memory-hard KDF would need if Apple ever ships one — see ADR-0020's
 * consequences.
 */
import { BackupError } from "./errors";

// "LSBK" — from the app's former name, kept deliberately. The magic
// bytes and the `.lsbk` extension identify the file format, not the
// product; changing them on either rename would have made every
// backup already written unopenable for no user-visible gain.
const MAGIC = new Uint8Array([0x4c, 0x53, 0x42, 0x4b]);

/**
 * Format 2 is the CryptoKit envelope (ADR-0020). Format 1 was
 * Argon2id + `@noble`, and **no format-1 file was ever written outside
 * a development machine** — the change landed before the first
 * TestFlight build, which is the only reason a KDF swap was free. There
 * is deliberately no format-1 reader: adding one would mean shipping
 * Argon2id again and would undo the export exemption the swap bought.
 */
const FORMAT_VERSION = 2;
const KDF_PBKDF2_HMAC_SHA256 = 2;

const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const KEY_BYTES = 32; // AES-256
const TAG_BYTES = 16; // GCM tag, appended to the ciphertext
const HEADER_FIXED_BYTES = 45;

/**
 * OWASP's recommended PBKDF2-HMAC-SHA256 minimum (600,000 iterations).
 *
 * PBKDF2 is not memory-hard, so it buys less against a GPU-accelerated
 * offline guess than the Argon2id it replaced — that cost is accepted
 * in ADR-0020, and the iteration count is set at the recommended
 * ceiling rather than a comfortable middle to claw back what it can.
 * CommonCrypto runs this natively in roughly half a second on a modern
 * iPhone, where the old JS Argon2id took several. Worth re-benchmarking
 * on the actual test device; raising it is always safe, since every
 * file records the count it was written with.
 */
export const DEFAULT_KDF: KdfParams = {
  kind: "pbkdf2-hmac-sha256",
  iterations: 600_000,
};

/**
 * The most iterations a header may ask for — about 17× the default.
 *
 * The count is read from the header before anything can authenticate
 * it, and PBKDF2 runs before the tag is checked. Without a ceiling a
 * damaged or hostile file could ask for four billion rounds and leave
 * the restore screen hung for hours. Raise it alongside `DEFAULT_KDF`
 * if the default ever outgrows it.
 */
export const MAX_KDF_ITERATIONS = 10_000_000;

export interface KdfParams {
  kind: "pbkdf2-hmac-sha256";
  iterations: number;
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

/**
 * The two primitives this package refuses to implement.
 *
 * On a device both are Apple's: `AES.GCM` from CryptoKit and
 * `CCKeyDerivationPBKDF` from CommonCrypto, bridged by the
 * `glide-crypto` module in `apps/mobile/modules/`. Keeping them behind
 * an interface is what lets the envelope format stay testable off
 * device — and what stops a well-meaning change from quietly adding a
 * JavaScript cipher back into the bundle, which would make the app
 * export-controlled again (ADR-0020).
 */
export interface BackupCrypto {
  /** Derive a `KEY_BYTES` key from a human passphrase. */
  deriveKey(
    passphrase: string,
    salt: Uint8Array,
    kdf: KdfParams,
  ): Promise<Uint8Array>;
  /** AES-256-GCM. Returns ciphertext with the tag appended. */
  seal(args: {
    key: Uint8Array;
    nonce: Uint8Array;
    aad: Uint8Array;
    plaintext: Uint8Array;
  }): Promise<Uint8Array>;
  /** AES-256-GCM. Must throw if the tag does not verify. */
  open(args: {
    key: Uint8Array;
    nonce: Uint8Array;
    aad: Uint8Array;
    ciphertext: Uint8Array;
  }): Promise<Uint8Array>;
}

const webRandom: RandomBytes = (length) => {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
};

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
  header[5] = KDF_PBKDF2_HMAC_SHA256;
  view.setUint32(6, kdf.iterations);
  // bytes 10–14 stay zero: reserved.
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
      "File does not look like a Life Strategy backup.",
    );
  }

  const formatVersion = envelope[4]!;
  if (formatVersion > FORMAT_VERSION) {
    throw new BackupError(
      "unsupported-format",
      `Backup format ${formatVersion} is newer than this app understands (${FORMAT_VERSION}).`,
    );
  }
  // Format 1 (Argon2id) is gone, not merely old — see FORMAT_VERSION.
  // It never left a development machine, so this reads as
  // "unsupported" rather than "upgrade the app," which would be a
  // promise no future build can keep.
  if (formatVersion < FORMAT_VERSION) {
    throw new BackupError(
      "unsupported-format",
      `Backup format ${formatVersion} is no longer supported.`,
    );
  }
  if (envelope[5] !== KDF_PBKDF2_HMAC_SHA256) {
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
  const iterations = view.getUint32(6);
  if (iterations === 0 || iterations > MAX_KDF_ITERATIONS) {
    throw new BackupError("not-a-backup", "Backup header is unreadable.");
  }

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
    kdf: { kind: "pbkdf2-hmac-sha256", iterations },
    meta,
    headerBytes,
  };
}

export interface SealInput {
  /** The SQLite image to protect. */
  payload: Uint8Array;
  passphrase: string;
  meta: Omit<BackupMeta, "payloadBytes">;
  /** Apple's primitives on a device; a stub in tests. */
  crypto: BackupCrypto;
  kdf?: KdfParams;
  randomBytes?: RandomBytes;
}

/** Encrypt a database image into a self-describing backup file. */
export async function sealBackup(input: SealInput): Promise<Uint8Array> {
  const random = input.randomBytes ?? webRandom;
  const kdf = input.kdf ?? DEFAULT_KDF;
  const salt = random(SALT_BYTES);
  const nonce = random(NONCE_BYTES);

  const metaJson = new TextEncoder().encode(
    JSON.stringify({ ...input.meta, payloadBytes: input.payload.length }),
  );
  const header = encodeHeader(kdf, salt, nonce, metaJson);

  const key = await input.crypto.deriveKey(input.passphrase, salt, kdf);
  if (key.length !== KEY_BYTES) {
    throw new BackupError(
      "not-a-backup",
      `Key derivation returned ${key.length} bytes, expected ${KEY_BYTES}.`,
    );
  }

  const ciphertext = await input.crypto.seal({
    key,
    nonce,
    aad: header,
    plaintext: input.payload,
  });

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
export async function openBackup(
  envelope: Uint8Array,
  passphrase: string,
  crypto: BackupCrypto,
): Promise<OpenedBackup> {
  const { kdf, meta, formatVersion, headerBytes } = readHeader(envelope);
  const header = envelope.subarray(0, headerBytes);
  const salt = envelope.subarray(15, 15 + SALT_BYTES);
  const nonce = envelope.subarray(15 + SALT_BYTES, 15 + SALT_BYTES + NONCE_BYTES);
  const ciphertext = envelope.subarray(headerBytes);

  // GCM output is plaintext + tag, so anything shorter than a tag
  // cannot authenticate — catching it here keeps the native side from
  // having to describe a malformed input.
  if (ciphertext.length < TAG_BYTES) {
    throw new BackupError("not-a-backup", "Backup contents are truncated.");
  }

  const key = await crypto.deriveKey(passphrase, salt, kdf);
  let payload: Uint8Array;
  try {
    payload = await crypto.open({ key, nonce, aad: header, ciphertext });
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
