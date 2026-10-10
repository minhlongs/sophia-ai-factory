/**
 * CMEK Web Crypto Primitives and Encoding Helpers
 *
 * Layer: tree/sovereignty/cmek
 */

import type { EnvelopeAad } from '@/seed/types/sovereign-vault';
import {
  AES_ALGORITHM,
  KEY_LENGTH_BITS,
  KEY_LENGTH_BYTES,
  CmekCryptoError,
} from './envelope-types';

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim().toLowerCase();
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function canonicalAadJson(aad: EnvelopeAad): string {
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(aad).sort();
  for (const k of keys) {
    if (aad[k] !== undefined) {
      sorted[k] = aad[k];
    }
  }
  return JSON.stringify(sorted);
}

export function generateRawKey(): Uint8Array {
  const keyBytes = new Uint8Array(KEY_LENGTH_BYTES);
  crypto.getRandomValues(keyBytes);
  return keyBytes;
}

export async function importAesGcmKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.byteLength !== KEY_LENGTH_BYTES) {
    throw new CmekCryptoError(
      `Invalid key length: expected ${KEY_LENGTH_BYTES} bytes, got ${rawKey.byteLength}`,
      'INVALID_KEY_LENGTH',
    );
  }

  return crypto.subtle.importKey(
    'raw',
    rawKey as unknown as BufferSource,
    { name: AES_ALGORITHM, length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function computeKeyFingerprint(keyBytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes as unknown as BufferSource);
  return bytesToHex(new Uint8Array(hashBuffer));
}

export function zeroizeKey(buffer: Uint8Array): void {
  buffer.fill(0);
}
