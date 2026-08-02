/**
 * The device's `BackupCrypto` (ADR-0020).
 *
 * Adapts the `glide-crypto` native module to the interface
 * `@glide/backup` asks for. Everything here is Apple's: AES-256-GCM
 * from CryptoKit, PBKDF2-HMAC-SHA256 from CommonCrypto.
 *
 * **Nothing in this file may fall back to a JavaScript implementation.**
 * A fallback would be the obvious fix the day someone hits the "needs a
 * development build" error in Expo Go — and it would silently put a
 * bundled cipher back in the binary, making the app export-controlled
 * again and the `usesNonExemptEncryption: false` declaration in
 * app.json false. Backup is unavailable in Expo Go; that is the design,
 * not a gap.
 */
import type { BackupCrypto, KdfParams } from "@glide/backup";

import * as GlideCrypto from "../../modules/glide-crypto";

export { isAvailable as isCryptoAvailable } from "../../modules/glide-crypto";

export const deviceCrypto: BackupCrypto = {
  deriveKey(passphrase: string, salt: Uint8Array, kdf: KdfParams) {
    return GlideCrypto.deriveKey(passphrase, salt, kdf.iterations);
  },

  seal({ key, nonce, aad, plaintext }) {
    return GlideCrypto.seal(key, nonce, aad, plaintext);
  },

  open({ key, nonce, aad, ciphertext }) {
    return GlideCrypto.open(key, nonce, aad, ciphertext);
  },
};
