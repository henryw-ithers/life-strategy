export type { BackupErrorCode } from "./errors";
export { BackupError } from "./errors";
export type {
  KdfParams,
  BackupMeta,
  SealedHeader,
  SealInput,
  OpenedBackup,
  RandomBytes,
} from "./envelope";
export { DEFAULT_KDF, sealBackup, openBackup, readHeader } from "./envelope";
