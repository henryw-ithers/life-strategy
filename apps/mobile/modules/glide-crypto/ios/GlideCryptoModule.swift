// Glide's backup cryptography (ADR-0020).
//
// Two primitives, both Apple's: AES-256-GCM from CryptoKit and
// PBKDF2-HMAC-SHA256 from CommonCrypto. The envelope format, the
// header, the parameter choices and every decision about when to call
// these live in `packages/backup` — this file is a bridge and nothing
// more.
//
// **Do not add a third-party algorithm here.** The entire reason this
// module exists is that shipping only Apple-provided cryptography
// keeps the app export-exempt; a bundled cipher would put the app back
// under EAR reporting and quietly invalidate the
// `usesNonExemptEncryption: false` declaration in app.json.

import CommonCrypto
import CryptoKit
import ExpoModulesCore

/// AES-256. The envelope enforces this too; both ends check because a
/// silently short key is the kind of bug that still "works" in a happy
/// path and destroys the security property.
private let keyByteCount = 32
private let gcmTagByteCount = 16

internal final class KeyDerivationFailedException: Exception {
  override var reason: String {
    "PBKDF2 key derivation failed."
  }
}

internal final class InvalidKeySizeException: GenericException<Int> {
  override var reason: String {
    "Expected a \(keyByteCount)-byte key, received \(param)."
  }
}

internal final class CiphertextTooShortException: GenericException<Int> {
  override var reason: String {
    "Ciphertext is \(param) bytes, shorter than the \(gcmTagByteCount)-byte GCM tag."
  }
}

public class GlideCryptoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GlideCrypto")

    // Derive a key from a human passphrase.
    //
    // Runs on Expo's worker queue rather than the JS thread: at the
    // 600,000 iterations `DEFAULT_KDF` asks for this takes roughly half
    // a second, which would be a visible freeze on the main thread.
    AsyncFunction("deriveKey") { (passphrase: String, salt: Data, iterations: Int) -> Data in
      try pbkdf2(passphrase: passphrase, salt: salt, iterations: iterations)
    }

    // AES-256-GCM. Returns ciphertext with the 16-byte tag appended,
    // which is the layout `packages/backup` writes to disk.
    AsyncFunction("seal") { (key: Data, nonce: Data, aad: Data, plaintext: Data) -> Data in
      guard key.count == keyByteCount else {
        throw InvalidKeySizeException(key.count)
      }
      let sealed = try AES.GCM.seal(
        plaintext,
        using: SymmetricKey(data: key),
        nonce: try AES.GCM.Nonce(data: nonce),
        authenticating: aad
      )
      return sealed.ciphertext + sealed.tag
    }

    // AES-256-GCM. Throws if the tag does not verify — which is both a
    // wrong passphrase and a damaged file, indistinguishable by
    // design. The JS side turns any throw from here into a single
    // `bad-passphrase-or-corrupt`, so nothing below should try to
    // explain which it was.
    AsyncFunction("open") { (key: Data, nonce: Data, aad: Data, ciphertext: Data) -> Data in
      guard key.count == keyByteCount else {
        throw InvalidKeySizeException(key.count)
      }
      guard ciphertext.count >= gcmTagByteCount else {
        throw CiphertextTooShortException(ciphertext.count)
      }
      let split = ciphertext.count - gcmTagByteCount
      let box = try AES.GCM.SealedBox(
        nonce: try AES.GCM.Nonce(data: nonce),
        ciphertext: ciphertext.prefix(split),
        tag: ciphertext.suffix(gcmTagByteCount)
      )
      return try AES.GCM.open(box, using: SymmetricKey(data: key), authenticating: aad)
    }
  }
}

/// PBKDF2-HMAC-SHA256 via CommonCrypto.
///
/// CryptoKit has no password-based KDF — its only KDF is HKDF, which
/// expects a high-entropy input and would be actively wrong for a
/// human passphrase. CommonCrypto's `CCKeyDerivationPBKDF` is the
/// Apple-provided option, which is why the envelope uses PBKDF2 rather
/// than something memory-hard (ADR-0020).
private func pbkdf2(passphrase: String, salt: Data, iterations: Int) throws -> Data {
  let passwordBytes = Array(passphrase.utf8)
  let saltBytes = [UInt8](salt)

  // CommonCrypto dereferences both pointers regardless of length, so an
  // empty passphrase or salt would be undefined behaviour rather than an
  // error. The UI requires a passphrase and the envelope always supplies
  // a salt; this is the backstop for when one of those stops being true.
  guard !passwordBytes.isEmpty, !saltBytes.isEmpty else {
    throw KeyDerivationFailedException()
  }

  var derived = [UInt8](repeating: 0, count: keyByteCount)

  let status = derived.withUnsafeMutableBufferPointer { out in
    saltBytes.withUnsafeBufferPointer { saltPtr in
      passwordBytes.withUnsafeBufferPointer { passPtr in
        passPtr.baseAddress!.withMemoryRebound(
          to: CChar.self,
          capacity: passPtr.count
        ) { passChars in
          CCKeyDerivationPBKDF(
            CCPBKDFAlgorithm(kCCPBKDF2),
            passChars,
            passPtr.count,
            saltPtr.baseAddress,
            saltPtr.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
            UInt32(iterations),
            out.baseAddress,
            out.count
          )
        }
      }
    }
  }

  guard status == kCCSuccess else {
    throw KeyDerivationFailedException()
  }
  return Data(derived)
}
