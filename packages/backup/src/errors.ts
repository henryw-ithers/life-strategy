/**
 * Distinct failure modes, because the restore screen has to say
 * something different for each one: "this isn't a backup" and "this
 * backup is damaged" are different problems to the person holding the
 * phone.
 */

export type BackupErrorCode =
  /** Not a Life Strategy backup at all: wrong magic, or too short. */
  | "not-a-backup"
  /** A backup, but written by a newer format than this app knows. */
  | "unsupported-format"
  /** A backup from before ADR-0046, encrypted with a passphrase. */
  | "encrypted-format"
  /** A backup whose contents didn't arrive whole: cut short, a byte
   *  changed, or no database inside. */
  | "damaged";

export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.name = "BackupError";
    this.code = code;
  }
}
