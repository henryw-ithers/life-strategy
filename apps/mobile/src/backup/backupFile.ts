/**
 * Export and restore (ADR-0002 "Backup (v1)", action item 3, as amended
 * by ADR-0046).
 *
 * The file format lives in `@glide/backup`; this file is only the
 * device half: getting a consistent database image out, handing the
 * file to the share sheet, and putting a restored image back safely.
 * A backup is a plain file, not encrypted (ADR-0046).
 *
 * Scope, deliberately: **manual, local, database-only.** No storage
 * provider, no account, no automatic upload — those are ADR-0012's
 * call and stay parked. Photos are excluded (ADR-0002 lists them as a
 * separately toggleable, much larger payload); `photo.file_uri` rows
 * survive a restore pointing at files that do not, which the day view
 * renders as a missing-photo placeholder rather than crashing.
 */
import { BackupError, readBackup, readHeader, writeBackup, type BackupMeta } from "@glide/backup";
import Constants from "expo-constants";
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
 * Write the database to a backup file and hand it to the share sheet.
 * `serializeAsync` is SQLite's own serialize: it yields a consistent
 * image of the live connection, so there is no file copy to race and
 * no `-wal` sidecar to miss.
 */
export async function exportBackup(): Promise<ExportResult> {
  const payload = await sqlite.serializeAsync();

  const file = writeBackup({
    payload,
    meta: {
      appVersion: appVersion(),
      migrationCount: migrationCount(),
      createdAt: new Date().toISOString(),
    },
  });

  // `.lsbk` predates both renames and stays — see the MAGIC note in
  // packages/backup/src/envelope.ts. Only the prefix follows the name,
  // and it is safe to move: a reader identifies a backup by its magic
  // bytes, never by its filename, so files written under the old prefix
  // still open.
  const fileName = `life-strategy-${stamp(new Date())}.lsbk`;
  const target = new File(Paths.cache, fileName);
  if (target.exists) target.delete();
  target.create();
  target.write(file);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target.uri, {
      mimeType: "application/octet-stream",
      dialogTitle: "Save your Life Strategy backup",
      UTI: "public.data",
    });
  }

  return { fileName, bytes: file.length };
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
 * Let the user pick a backup and read its provenance, so "wrong file"
 * is discovered by looking before anything is replaced. Returns null
 * if the picker was dismissed.
 */
export async function pickBackup(): Promise<BackupPreview | null> {
  // Since SDK 57 this returns `{ canceled, result }` rather than the
  // File itself. Reading `.uri` off the wrapper gave undefined, so every
  // pick looked like a cancel and restore silently did nothing.
  const picked = await File.pickFileAsync();
  if (picked.canceled) return null;
  const uri = picked.result.uri;

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
 * Check, then swap in the restored database.
 *
 * Order matters, and it is chosen so a failure never costs data:
 *
 * 1. Read and check the whole file (length, checksum, a SQLite image)
 *    **before** touching anything on disk: a damaged file leaves the
 *    device untouched.
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
export async function restoreBackup(preview: BackupPreview): Promise<RestoreOutcome> {
  const opened = readBackup(await new File(preview.uri).bytes()); // throws BackupError

  if (opened.meta.migrationCount > migrationCount()) {
    return {
      status: "refused",
      reason:
        "This backup came from a newer version of the app. Update first, then restore.",
    };
  }

  const dbPath = sqlite.databasePath;
  const live = new File(dbPath);

  // The rescue copy comes from SQLite's own serialize, like a backup
  // does: copying the database file would miss whatever is still in its
  // `-wal` journal, and the file is deleted below.
  const current = await sqlite.serializeAsync();
  const rescue = new File(`${dbPath}.pre-restore`);
  if (rescue.exists) rescue.delete();
  rescue.create();
  rescue.write(current);

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
    case "encrypted-format":
      return "This backup was made with a passphrase, before backups became plain files. This version of the app can’t open it.";
    case "damaged":
      return "This backup is damaged and can’t be restored. If you have another copy of it, try that one.";
  }
}
