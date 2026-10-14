/**
 * Base64 encoding/decoding and constant-time comparison helpers.
 * Zero Node Buffer dependency.
 * @module tree/mekong/crypto/encoding
 */

import { MekongPayloadError } from './errors';

/**
 * Universal base64 encoder without Node Buffer dependency.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Universal base64 decoder without Node Buffer dependency.
 */
export function base64ToBytes(b64: string): Uint8Array {
  try {
    const binary = atob(b64.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    throw new MekongPayloadError(`Invalid base64 string: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Constant-time string equality check using bitwise XOR to prevent timing side-channel attacks.
 */
export function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
