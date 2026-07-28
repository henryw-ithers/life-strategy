/**
 * Distinct failure modes, because the restore screen has to say
 * something different for each one. "That passphrase didn't work" and
 * "this file isn't a backup" are the same exception to a crypto
 * library and completely different problems to the person holding the
 * phone.
 */

export type BackupErrorCode =
  /** Not a Glide backup at all — wrong magic, or truncated. */
  | "not-a-backup"
  /** A backup, but written by a newer format than this app knows. */
  | "unsupported-format"
  /** Header parsed, but the body failed its authentication tag. Wrong
   *  passphrase or a corrupted/tampered file — indistinguishable by
   *  construction, and deliberately so. */
  | "bad-passphrase-or-corrupt";

export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.name = "BackupError";
    this.code = code;
  }
}
