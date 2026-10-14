/**
 * Credentials Cipher Operations (Encrypt & Decrypt)
 *
 * Layer: tree/credentials
 */

import { getActiveKeyVersion } from '@/tree/byok/byok-crypto';
import {
  ALGORITHM,
  IV_BYTES,
  bytesToBase64,
  parseEncryptedValue,
} from './constants';
import { importKeyByVersion } from './key-manager';

/**
 * Encrypt a plaintext string with optional AAD (userId) binding.
 * Returns "v<version>:<iv_b64>:<ciphertext_b64>" for storage in TEXT column.
 */
export async function encryptValue(
  plaintext: string,
  userId?: string,
  keyVersion?: number,
): Promise<string> {
  if (!plaintext) throw new Error('encryptValue: plaintext is empty');
  const version = keyVersion ?? (await getActiveKeyVersion());
  const key = await importKeyByVersion(version);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const pt = new TextEncoder().encode(plaintext);
  const params: AesGcmParams = userId
    ? { name: ALGORITHM, iv: iv as BufferSource, additionalData: new TextEncoder().encode(userId) as BufferSource }
    : { name: ALGORITHM, iv: iv as BufferSource };
  const ct = new Uint8Array(await crypto.subtle.encrypt(params, key, pt));
  return `v${version}:${bytesToBase64(iv)}:${bytesToBase64(ct)}`;
}

/**
 * Decrypt a "v<version>:<iv_b64>:<ciphertext_b64>" string.
 * Tries AAD-bound decrypt first when userId given; falls back to legacy
 * (no-AAD) ciphertext for backward compatibility with rows written before
 * V-2.1. Throws on tamper, wrong key, or malformed input.
 */
export async function decryptValue(
  encrypted: string,
  userId?: string,
  keyVersion?: number,
): Promise<string> {
  const parsed = parseEncryptedValue(encrypted);
  const version = keyVersion ?? parsed.version;
  const key = await importKeyByVersion(version);
  const ivBuf = parsed.iv as BufferSource;
  const ctBuf = parsed.ct.buffer as ArrayBuffer;

  if (userId) {
    try {
      const pt = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv: ivBuf, additionalData: new TextEncoder().encode(userId) as BufferSource },
        key,
        ctBuf,
      );
      return new TextDecoder().decode(pt);
    } catch {
      // fallthrough to legacy (no-AAD) decrypt
    }
  }

  const pt = await crypto.subtle.decrypt({ name: ALGORITHM, iv: ivBuf }, key, ctBuf);
  return new TextDecoder().decode(pt);
}
