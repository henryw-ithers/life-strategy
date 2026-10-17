import { describe, expect, it } from "vitest";

import { crc32 } from "../crc32";
import { BackupError, type BackupErrorCode } from "../errors";
import { readBackup, readHeader, writeBackup, type BackupMeta } from "../envelope";

const meta: Omit<BackupMeta, "payloadBytes"> = {
  appVersion: "1.5.0",
  migrationCount: 19,
  createdAt: "2026-10-16T12:00:00.000Z",
};

/** "SQLite format 3\0" and a few more bytes: a plausible database. */
const payload = new Uint8Array([
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61,
  0x74, 0x20, 0x33, 0x00, 0xde, 0xad, 0xbe, 0xef,
]);

const write = () => writeBackup({ payload, meta });

function codeOf(run: () => unknown): BackupErrorCode {
  try {
    run();
  } catch (e) {
    expect(e).toBeInstanceOf(BackupError);
    return (e as BackupError).code;
  }
  throw new Error("expected a BackupError");
}

describe("crc32", () => {
  it("matches the standard check value", () => {
    // The CRC-32 of "123456789" is 0xCBF43926 (IEEE 802.3).
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("is zero for nothing", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("backup file", () => {
  it("round-trips a database image byte for byte", () => {
    const opened = readBackup(write());
    expect(opened.payload).toEqual(payload);
    expect(opened.formatVersion).toBe(3);
    expect(opened.meta).toEqual({ ...meta, payloadBytes: payload.length });
  });

  it("starts with LSBK, the format's name that outlived the app's", () => {
    expect(Array.from(write().subarray(0, 4))).toEqual([0x4c, 0x53, 0x42, 0x4b]);
  });

  it("reads provenance from the header alone", () => {
    const header = readHeader(write());
    expect(header.meta.createdAt).toBe(meta.createdAt);
    expect(header.meta.payloadBytes).toBe(payload.length);
    expect(header.checksum).toBe(crc32(write().subarray(12)));
  });

  it("refuses something that isn't a backup", () => {
    expect(codeOf(() => readBackup(new TextEncoder().encode("hello, this is not one")))).toBe(
      "not-a-backup",
    );
    expect(codeOf(() => readBackup(new Uint8Array([0x4c, 0x53])))).toBe("not-a-backup");
  });

  it("says a passphrase-era backup is encrypted, not damaged", () => {
    for (const version of [1, 2]) {
      const old = write();
      old[4] = version;
      expect(codeOf(() => readHeader(old))).toBe("encrypted-format");
    }
  });

  it("refuses a format newer than it knows", () => {
    const future = write();
    future[4] = 4;
    expect(codeOf(() => readHeader(future))).toBe("unsupported-format");
  });

  it("catches a changed byte in the database", () => {
    const file = write();
    const last = file.length - 1;
    file[last] = file[last]! ^ 0x01;
    expect(codeOf(() => readBackup(file))).toBe("damaged");
  });

  it("catches a changed byte in the metadata, which decides a too-new refusal", () => {
    const file = write();
    const text = new TextDecoder().decode(file);
    const at = text.indexOf('"migrationCount":19');
    expect(at).toBeGreaterThan(-1);
    file[at + '"migrationCount":'.length] = "9".charCodeAt(0);
    expect(codeOf(() => readBackup(file))).toBe("damaged");
  });

  it("catches a file cut short", () => {
    const file = write();
    expect(codeOf(() => readBackup(file.subarray(0, file.length - 3)))).toBe("damaged");
  });

  it("catches a header cut short", () => {
    expect(codeOf(() => readHeader(write().subarray(0, 20)))).toBe("damaged");
  });

  it("refuses a well-formed file with no database inside", () => {
    const notSqlite = new TextEncoder().encode("just some text, not a database");
    expect(codeOf(() => readBackup(writeBackup({ payload: notSqlite, meta })))).toBe("damaged");
  });

  it("reads a backup held at an offset inside a larger buffer", () => {
    const file = write();
    const big = new Uint8Array(file.length + 10);
    big.set(file, 7);
    expect(readBackup(big.subarray(7, 7 + file.length)).payload).toEqual(payload);
  });
});
