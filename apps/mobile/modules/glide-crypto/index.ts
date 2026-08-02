/**
 * Thin JS face of the `GlideCrypto` native module (ADR-0020).
 *
 * Raw primitives only — no envelope knowledge, no policy. The adapter
 * that turns these into `@glide/backup`'s `BackupCrypto` lives in
 * `src/backup/crypto.ts`, so that this file stays a description of what
 * the Swift exposes and nothing else.
 *
 * `requireOptionalNativeModule` rather than `requireNativeModule`
 * on purpose: the module is iOS-only and absent from the browser
 * development preview (docs/web-preview.md). Importing must not throw
 * there, or every screen dies to keep a feature the preview could never
 * exercise anyway. `isAvailable` is how callers check.
 */
import { requireOptionalNativeModule } from "expo-modules-core";

interface GlideCryptoNativeModule {
  deriveKey(
    passphrase: string,
    salt: Uint8Array,
    iterations: number,
  ): Promise<Uint8Array>;
  seal(
    key: Uint8Array,
    nonce: Uint8Array,
    aad: Uint8Array,
    plaintext: Uint8Array,
  ): Promise<Uint8Array>;
  open(
    key: Uint8Array,
    nonce: Uint8Array,
    aad: Uint8Array,
    ciphertext: Uint8Array,
  ): Promise<Uint8Array>;
}

const native = requireOptionalNativeModule<GlideCryptoNativeModule>("GlideCrypto");

/** False in the web preview, and in any Expo Go build — this module is
 *  custom native code, which is precisely what Expo Go cannot load. */
export const isAvailable = native !== null;

function required(): GlideCryptoNativeModule {
  if (!native) {
    throw new Error(
      "GlideCrypto native module is unavailable. Backup and restore need a development build or a TestFlight build — Expo Go and the web preview cannot load custom native code.",
    );
  }
  return native;
}

/** PBKDF2-HMAC-SHA256 (CommonCrypto) → 32-byte key. */
export function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  return required().deriveKey(passphrase, salt, iterations);
}

/** AES-256-GCM (CryptoKit). Returns ciphertext with the tag appended. */
export function seal(
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  return required().seal(key, nonce, aad, plaintext);
}

/** AES-256-GCM (CryptoKit). Rejects if the tag does not verify. */
export function open(
  key: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  return required().open(key, nonce, aad, ciphertext);
}
