/**
 * Export and restore (ADR-0002 "Backup (v1)", action item 3).
 *
 * Everything cryptographic lives in `@life-strategy/backup`; this file
 * is only the device half — getting a consistent database image out,
 * handing the sealed bytes to the share sheet, and putting a restored
 * image back safely.
 *
 * Scope, deliberately: **manual, local, database-only.** No storage
 * provider, no account, no automatic upload — those are ADR-0012's
 * call and stay parked. Photos are excluded (ADR-0002 lists them as a
 * separately toggleable, much larger payload); `photo.file_uri` rows
 * survive a restore pointing at files that do not, which the day view
 * renders as a missing-photo placeholder rather than crashing.
 */
import {
  BackupError,
  openBackup,
  readHeader,
  sealBackup,
  type BackupMeta,
} from "@life-strategy/backup";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import migrations from "../../drizzle/migrations";
import { sqlite } from "../db/client";

/** `drizzle/migrations.js` ships `{ journal, migrations }`; the
 *  journal's entry count is the schema generation a file was written
 *  at. Restoring a newer generation into an older app would leave the
 *  schema ahead of the code, so the restore path refuses it. */
function migrationCount(): number {
  return migrations.journal.entries.length;
}

function appVersion(): string {
  return Constants.expoConfig?.version ?? "unknown";
}

function stamp(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface ExportResult {
  fileName: string;
  bytes: number;
}

/**
 * Seal the database and hand it to the share sheet. `serializeAsync`
 * is SQLite's own serialize: it yields a consistent image of the live
 * connection, so there is no file copy to race and no `-wal` sidecar
 * to miss.
 *
 * The passphrase is not stored anywhere. That is the whole point — a
 * key sitting in this device's keychain would die with this device,
 * which is the case a backup exists for.
 */
export async function exportBackup(passphrase: string): Promise<ExportResult> {
  const payload = await sqlite.serializeAsync();

  const sealed = sealBackup({
    payload,
    passphrase,
    meta: {
      appVersion: appVersion(),
      migrationCount: migrationCount(),
      createdAt: new Date().toISOString(),
    },
    randomBytes: Crypto.getRandomBytes,
  });

  const fileName = `life-strategy-${stamp(new Date())}.lsbk`;
  const target = new File(Paths.cache, fileName);
  if (target.exists) target.delete();
  target.create();
  target.write(sealed);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target.uri, {
      mimeType: "application/octet-stream",
      dialogTitle: "Save your Life Strategy backup",
      UTI: "public.data",
    });
  }

  return { fileName, bytes: sealed.length };
}

export interface BackupPreview {
  uri: string;
  meta: BackupMeta;
  /** True when the file came from a build whose schema is ahead of
   *  this one — restoring it would leave the database newer than the
   *  code that reads it. */
  tooNew: boolean;
}

/**
 * Let the user pick a backup and read its provenance — deliberately
 * before asking for a passphrase, so "wrong file" is discovered by
 * looking rather than by failing to decrypt. Returns null if the
 * picker was dismissed.
 */
export async function pickBackup(): Promise<BackupPreview | null> {
  const picked = await File.pickFileAsync();
  const uri = (Array.isArray(picked) ? picked[0] : picked)?.uri;
  if (!uri) return null;

  const header = readHeader(await new File(uri).bytes());
  return {
    uri,
    meta: header.meta,
    tooNew: header.meta.migrationCount > migrationCount(),
  };
}

export type RestoreOutcome =
  /** Written. The app must be relaunched before anything reads it. */
  | { status: "restored"; restoredFrom: string }
  | { status: "refused"; reason: string };

/**
 * Decrypt, verify, and swap in the restored database.
 *
 * Order matters, and it is chosen so a failure never costs data:
 *
 * 1. Decrypt and authenticate **before** touching anything on disk —
 *    a wrong passphrase leaves the device untouched.
 * 2. Refuse a schema newer than this build.
 * 3. Write the current database beside itself as `.pre-restore` — the
 *    undo for someone who restores the wrong file.
 * 4. Close the live connection, replace the file, and delete the
 *    `-wal`/`-shm` sidecars, which belong to the old database and
 *    would corrupt the new one.
 *
 * The connection cannot be reopened in place (`db` in db/client.ts is
 * a module-level singleton every screen already holds), so this
 * returns having invalidated it: the caller's only correct next move
 * is to tell the user to relaunch.
 */
export async function restoreBackup(
  preview: BackupPreview,
  passphrase: string,
): Promise<RestoreOutcome> {
  const envelope = await new File(preview.uri).bytes();
  const opened = openBackup(envelope, passphrase); // throws BackupError

  if (opened.meta.migrationCount > migrationCount()) {
    return {
      status: "refused",
      reason:
        "This backup came from a newer version of the app. Update first, then restore.",
    };
  }

  const dbPath = sqlite.databasePath;
  const live = new File(dbPath);

  const rescue = new File(`${dbPath}.pre-restore`);
  if (rescue.exists) rescue.delete();
  if (live.exists) live.copy(rescue);

  await sqlite.closeAsync();

  if (live.exists) live.delete();
  live.create();
  live.write(opened.payload);

  for (const sidecar of [`${dbPath}-wal`, `${dbPath}-shm`]) {
    const f = new File(sidecar);
    if (f.exists) f.delete();
  }

  return { status: "restored", restoredFrom: opened.meta.createdAt };
}

/** Turn a thrown `BackupError` into something worth reading. Anything
 *  else is a real bug and should surface as itself. */
export function describeBackupError(error: unknown): string | null {
  if (!(error instanceof BackupError)) return null;
  switch (error.code) {
    case "not-a-backup":
      return "That file isn't a Life Strategy backup.";
    case "unsupported-format":
      return "This backup was written by a newer version of the app. Update first, then restore.";
    case "bad-passphrase-or-corrupt":
      return "That passphrase didn't open this backup. If you're sure it's right, the file may be damaged.";
  }
}
