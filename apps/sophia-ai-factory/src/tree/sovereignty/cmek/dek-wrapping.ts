/**
 * CMEK DEK Wrapping, Unwrapping & Cryptographic Shredding
 *
 * Layer: tree/sovereignty/cmek
 * @module tree/sovereignty/cmek/dek-wrapping
 */

import {
  AES_ALGORITHM,
  IV_LENGTH_BYTES,
  CmekCryptoError,
} from './envelope-types';
import {
  bytesToBase64,
  base64ToBytes,
  importAesGcmKey,
} from './web-crypto-primitives';

export async function wrapDek(
  rawDek: Uint8Array,
  rawKek: Uint8Array,
): Promise<{ wrappedDekBase64: string; dekIvBase64: string }> {
  const kekCryptoKey = await importAesGcmKey(rawKek);
  const iv = new Uint8Array(IV_LENGTH_BYTES);
  crypto.getRandomValues(iv);

  const wrappedBuffer = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv: iv as unknown as BufferSource },
    kekCryptoKey,
    rawDek as unknown as BufferSource,
  );

  return {
    wrappedDekBase64: bytesToBase64(new Uint8Array(wrappedBuffer)),
    dekIvBase64: bytesToBase64(iv),
  };
}

export async function unwrapDek(
  wrappedDekBase64: string,
  dekIvBase64: string,
  rawKek: Uint8Array,
): Promise<Uint8Array> {
  const kekCryptoKey = await importAesGcmKey(rawKek);
  const iv = base64ToBytes(dekIvBase64);
  const ciphertext = base64ToBytes(wrappedDekBase64);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: AES_ALGORITHM, iv: iv as unknown as BufferSource },
      kekCryptoKey,
      ciphertext as unknown as BufferSource,
    );
    return new Uint8Array(decryptedBuffer);
  } catch {
    throw new CmekCryptoError(
      'Failed to unwrap DEK: Invalid KEK, corrupted wrapped DEK, or key has been shredded',
      'DEK_UNWRAP_FAILED',
    );
  }
}

export function cryptoShredDek(): {
  shreddedDekBase64: string;
  shreddedAt: number;
} {
  const randomEntropy = new Uint8Array(64);
  crypto.getRandomValues(randomEntropy);

  return {
    shreddedDekBase64: bytesToBase64(randomEntropy),
    shreddedAt: Date.now(),
  };
}
