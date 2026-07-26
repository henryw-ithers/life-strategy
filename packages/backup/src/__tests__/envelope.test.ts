import { describe, expect, it } from "vitest";

import { BackupError } from "../errors";
import {
  openBackup,
  readHeader,
  sealBackup,
  type BackupMeta,
  type KdfParams,
} from "../envelope";

/** Argon2id at real cost would make this suite take minutes. The
 *  parameters travel in the header, so sealing and opening at a low
 *  cost exercises exactly the same code path. */
const fastKdf: KdfParams = {
  kind: "argon2id",
  memoryKiB: 256,
  iterations: 1,
  parallelism: 1,
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
    randomBytes: stubRandom,
    ...overrides,
  });
}

describe("backup envelope", () => {
  it("round-trips a database image byte for byte", () => {
    const opened = openBackup(seal(), "correct horse battery staple");
    expect(opened.payload).toEqual(payload);
    expect(opened.meta.migrationCount).toBe(6);
    expect(opened.meta.payloadBytes).toBe(payload.length);
  });

  it("does not leave the payload readable in the file", () => {
    const sealed = seal();
    const hay = Array.from(sealed).join(",");
    const needle = Array.from(payload).join(",");
    expect(hay).not.toContain(needle);
  });

  it("rejects a wrong passphrase rather than returning garbage", () => {
    expect(() => openBackup(seal(), "not the passphrase")).toThrowError(
      BackupError,
    );
    try {
      openBackup(seal(), "not the passphrase");
    } catch (e) {
      expect((e as BackupError).code).toBe("bad-passphrase-or-corrupt");
    }
  });

  it("detects a flipped bit anywhere in the ciphertext", () => {
    const sealed = seal();
    const last = sealed.length - 1;
    sealed[last] = sealed[last]! ^ 0x01;
    expect(() => openBackup(sealed, "correct horse battery staple")).toThrowError(
      /didn't open this backup|damaged/,
    );
  });

  it("detects tampering with the plaintext header, which is authenticated", () => {
    const sealed = seal();
    // Rewrite the migration count inside the metadata JSON.
    const text = new TextDecoder().decode(sealed);
    const at = text.indexOf('"migrationCount":6');
    expect(at).toBeGreaterThan(-1);
    sealed[at + '"migrationCount":'.length] = "9".charCodeAt(0);
    expect(() => openBackup(sealed, "correct horse battery staple")).toThrowError(
      BackupError,
    );
  });

  it("reads provenance without the passphrase", () => {
    const header = readHeader(seal());
    expect(header.meta.appVersion).toBe("1.0.0");
    expect(header.meta.createdAt).toBe("2026-07-26T12:00:00.000Z");
    expect(header.kdf).toEqual(fastKdf);
  });

  it("opens with whatever parameters the file was written with", () => {
    // A file sealed at different cost still opens — the header, not a
    // constant, decides. This is what lets the defaults be raised.
    const other: KdfParams = { ...fastKdf, iterations: 2 };
    const opened = openBackup(seal({ kdf: other }), "correct horse battery staple");
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

  it("refuses a truncated file", () => {
    try {
      readHeader(seal().subarray(0, 10));
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BackupError).code).toBe("not-a-backup");
    }
  });

  it("refuses a format version from the future", () => {
    const sealed = seal();
    sealed[4] = 99;
    try {
      readHeader(sealed);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as BackupError).code).toBe("unsupported-format");
    }
  });

  it("gives every backup a fresh salt and nonce", () => {
    const a = sealBackup({ payload, passphrase: "pw", meta, kdf: fastKdf });
    const b = sealBackup({ payload, passphrase: "pw", meta, kdf: fastKdf });
    expect(a).not.toEqual(b); // real randomness, not the stub
    expect(openBackup(a, "pw").payload).toEqual(payload);
    expect(openBackup(b, "pw").payload).toEqual(payload);
  });

  it("handles an empty database image", () => {
    const sealed = seal({ payload: new Uint8Array(0) });
    expect(openBackup(sealed, "correct horse battery staple").payload).toEqual(
      new Uint8Array(0),
    );
  });
});
