import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
} from "node:crypto";
import { describe, expect, it } from "vitest";

import { BackupError } from "../errors";
import {
  MAX_KDF_ITERATIONS,
  openBackup,
  readHeader,
  sealBackup,
  type BackupCrypto,
  type BackupMeta,
  type KdfParams,
} from "../envelope";

/**
 * The reference `BackupCrypto` for tests.
 *
 * Node's own AES-256-GCM and PBKDF2-HMAC-SHA256 — the same two
 * standards the `glide-crypto` Swift module calls in CryptoKit and
 * CommonCrypto. Using a real implementation rather than a toy double
 * means these tests pin the *format* against a second, independent
 * implementation of the primitives: a file sealed here and a file
 * sealed on device are byte-identical given the same inputs, so if the
 * Swift ever drifts, a device round-trip fails loudly.
 *
 * `node:crypto` is a test-only import. It never enters the app bundle,
 * so it has no bearing on the export-exemption argument in ADR-0020 —
 * and this is the only place in the package where cryptography is
 * called at all.
 */
const TAG_BYTES = 16;

const nodeCrypto: BackupCrypto = {
  async deriveKey(passphrase, salt, kdf) {
    return new Uint8Array(
      pbkdf2Sync(passphrase, salt, kdf.iterations, 32, "sha256"),
    );
  },

  async seal({ key, nonce, aad, plaintext }) {
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(aad);
    const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return new Uint8Array(Buffer.concat([body, cipher.getAuthTag()]));
  },

  async open({ key, nonce, aad, ciphertext }) {
    const split = ciphertext.length - TAG_BYTES;
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(ciphertext.subarray(split));
    return new Uint8Array(
      Buffer.concat([decipher.update(ciphertext.subarray(0, split)), decipher.final()]),
    );
  },
};

/** PBKDF2 at the real 600,000 iterations would make this suite crawl.
 *  The count travels in the header, so sealing and opening at a low
 *  cost exercises exactly the same code path. */
const fastKdf: KdfParams = {
  kind: "pbkdf2-hmac-sha256",
  iterations: 1000,
};

/** Deterministic "randomness" so a sealed file is reproducible. */
const stubRandom = (length: number) =>
  new Uint8Array(Array.from({ length }, (_, i) => (i * 7 + 3) % 256));

const meta: Omit<BackupMeta, "payloadBytes"> = {
  appVersion: "1.0.0",
  migrationCount: 6,
  createdAt: "2026-07-26T12:00:00.000Z",
};

const payload = new Uint8Array([
  // "SQLite format 3\0" — a plausible database header.
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61,
  0x74, 0x20, 0x33, 0x00, 0xde, 0xad, 0xbe, 0xef,
]);

function seal(overrides: Partial<Parameters<typeof sealBackup>[0]> = {}) {
  return sealBackup({
    payload,
    passphrase: "correct horse battery staple",
    meta,
    kdf: fastKdf,
    crypto: nodeCrypto,
    randomBytes: stubRandom,
    ...overrides,
  });
}

const open = (envelope: Uint8Array, passphrase: string) =>
  openBackup(envelope, passphrase, nodeCrypto);

describe("backup envelope", () => {
  it("round-trips a database image byte for byte", async () => {
    const opened = await open(await seal(), "correct horse battery staple");
    expect(opened.payload).toEqual(payload);
    expect(opened.meta.migrationCount).toBe(6);
    expect(opened.meta.payloadBytes).toBe(payload.length);
  });

  it("does not leave the payload readable in the file", async () => {
    const sealed = await seal();
    const hay = Array.from(sealed).join(",");
    const needle = Array.from(payload).join(",");
    expect(hay).not.toContain(needle);
  });

  it("rejects a wrong passphrase rather than returning garbage", async () => {
    await expect(open(await seal(), "not the passphrase")).rejects.toThrow(
      BackupError,
    );
    try {
      await open(await seal(), "not the passphrase");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BackupError).code).toBe("bad-passphrase-or-corrupt");
    }
  });

  it("detects a flipped bit anywhere in the ciphertext", async () => {
    const sealed = await seal();
    const last = sealed.length - 1;
    sealed[last] = sealed[last]! ^ 0x01;
    await expect(open(sealed, "correct horse battery staple")).rejects.toThrow(
      /didn't open this backup|damaged/,
    );
  });

  it("detects tampering with the plaintext header, which is authenticated", async () => {
    const sealed = await seal();
    // Rewrite the migration count inside the metadata JSON.
    const text = new TextDecoder().decode(sealed);
    const at = text.indexOf('"migrationCount":6');
    expect(at).toBeGreaterThan(-1);
    sealed[at + '"migrationCount":'.length] = "9".charCodeAt(0);
    await expect(open(sealed, "correct horse battery staple")).rejects.toThrow(
      BackupError,
    );
  });

  it("reads provenance without the passphrase", async () => {
    const header = readHeader(await seal());
    expect(header.meta.appVersion).toBe("1.0.0");
    expect(header.meta.createdAt).toBe("2026-07-26T12:00:00.000Z");
    expect(header.kdf).toEqual(fastKdf);
  });

  it("opens with whatever parameters the file was written with", async () => {
    // A file sealed at different cost still opens — the header, not a
    // constant, decides. This is what lets the defaults be raised.
    const other: KdfParams = { ...fastKdf, iterations: 2000 };
    const opened = await open(
      await seal({ kdf: other }),
      "correct horse battery staple",
    );
    expect(opened.payload).toEqual(payload);
  });

  it("refuses a file that is not a backup", () => {
    const notABackup = new Uint8Array(200).fill(0x41);
    try {
      readHeader(notABackup);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BackupError).code).toBe("not-a-backup");
    }
  });

  it("refuses a truncated file", async () => {
    try {
      readHeader((await seal()).subarray(0, 10));
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BackupError).code).toBe("not-a-backup");
    }
  });

  it("refuses a format version from the future", async () => {
    const sealed = await seal();
    sealed[4] = 99;
    try {
      readHeader(sealed);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BackupError).code).toBe("unsupported-format");
    }
  });

  it("refuses the retired Argon2id format rather than pretending to read it", async () => {
    // Format 1 shipped to nobody (ADR-0020), and no reader for it will
    // ever exist — supporting it would mean bundling Argon2id again.
    const sealed = await seal();
    sealed[4] = 1;
    sealed[5] = 1;
    try {
      readHeader(sealed);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BackupError).code).toBe("unsupported-format");
    }
  });

  it("refuses an unknown key-derivation id", async () => {
    const sealed = await seal();
    sealed[5] = 77;
    try {
      readHeader(sealed);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BackupError).code).toBe("unsupported-format");
    }
  });

  it("refuses an iteration count past the ceiling before deriving a key", async () => {
    const sealed = await seal();
    new DataView(sealed.buffer, sealed.byteOffset).setUint32(6, MAX_KDF_ITERATIONS + 1);
    try {
      readHeader(sealed);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BackupError).code).toBe("not-a-backup");
    }
  });

  it("refuses a file whose ciphertext is shorter than a GCM tag", async () => {
    const sealed = await seal();
    const header = readHeader(sealed);
    const stunted = sealed.subarray(0, header.headerBytes + 4);
    try {
      await open(stunted, "correct horse battery staple");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BackupError).code).toBe("not-a-backup");
    }
  });

  it("gives every backup a fresh salt and nonce", async () => {
    const base = { payload, passphrase: "pw", meta, kdf: fastKdf, crypto: nodeCrypto };
    const a = await sealBackup(base);
    const b = await sealBackup(base);
    expect(a).not.toEqual(b); // real randomness, not the stub
    expect((await open(a, "pw")).payload).toEqual(payload);
    expect((await open(b, "pw")).payload).toEqual(payload);
  });

  it("handles an empty database image", async () => {
    const sealed = await seal({ payload: new Uint8Array(0) });
    expect((await open(sealed, "correct horse battery staple")).payload).toEqual(
      new Uint8Array(0),
    );
  });
});
