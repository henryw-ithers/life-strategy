/** Photos on a day: copied into app storage and stored by relative
 *  path, so they survive iOS moving the app container. */
import { eq } from "drizzle-orm";
import * as Crypto from "expo-crypto";

import { currentLocalDate } from "../lib/calendar";
import { db } from "./client";
import { photo } from "./schema";

/** Remove a photo, and the file behind it — the row is the only thing
 *  that knows where the copy lives, so leaving the file would orphan
 *  it in app storage forever. A failed unlink is not worth surfacing:
 *  the user asked for the photo to be gone from their day, and it is. */
export async function deletePhoto(id: string): Promise<void> {
  const [row] = await db.select().from(photo).where(eq(photo.id, id));
  await db.delete(photo).where(eq(photo.id, id));
  if (row) {
    const FileSystem = await import("expo-file-system/legacy");
    // Resolved, not stored: the row holds a relative path now, and an
    // old absolute one would point at a container that no longer
    // exists anyway.
    await FileSystem.deleteAsync(await resolvePhotoUri(row.fileUri), {
      idempotent: true,
    }).catch(() => {});
  }
}

/**
 * Where photos live, resolved fresh each launch.
 *
 * **iOS moves the app container.** `documentDirectory` is
 * `file:///var/mobile/Containers/Data/Application/<UUID>/Documents/`,
 * and that UUID is reassigned on reinstall and can change across
 * updates. Anything that stored the absolute path is pointing at a
 * directory that no longer exists — which is exactly why photos
 * vanished after an update. Only the app-relative tail is durable.
 */
async function documentsDir(): Promise<string> {
  const FileSystem = await import("expo-file-system/legacy");
  return FileSystem.documentDirectory ?? "";
}

/** `photos/<id>.<ext>` — what actually goes in the database. Tolerates
 *  the absolute URIs written before 2026-08-13 by keeping only the
 *  tail, so old rows heal on read instead of needing a data migration
 *  that would itself have to guess at a stale container path. */
function toRelativePhotoPath(stored: string): string {
  const marker = "photos/";
  const i = stored.lastIndexOf(marker);
  return i >= 0 ? stored.slice(i) : stored;
}

/** Absolute URI for display, rebuilt against this launch's container. */
export async function resolvePhotoUri(stored: string): Promise<string> {
  return `${await documentsDir()}${toRelativePhotoPath(stored)}`;
}

/** Copies the picked image into app storage (picker URIs are cache)
 *  and records it against the day. Stores the **relative** path — see
 *  `documentsDir`. */
export async function addPhoto(date: string, sourceUri: string): Promise<void> {
  if (date > currentLocalDate()) throw new Error("Can't add a photo to a future day.");
  const FileSystem = await import("expo-file-system/legacy");
  const dir = `${FileSystem.documentDirectory}photos`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const id = Crypto.randomUUID();
  const raw = sourceUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const name = `${id}.${raw.length <= 4 ? raw : "jpg"}`;
  await FileSystem.copyAsync({ from: sourceUri, to: `${dir}/${name}` });
  await db.insert(photo).values({ id, localDate: date, fileUri: `photos/${name}` });
}
