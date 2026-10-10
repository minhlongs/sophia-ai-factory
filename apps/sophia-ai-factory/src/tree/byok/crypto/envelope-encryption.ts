/**
 * Envelope Encryption Low-Level Primitives
 *
 * Wraps Web Crypto AES-GCM-256 packing and unpack logic:
 * `[version (1 byte)][iv (12 bytes)][ciphertext + auth tag]`
 *
 * Layer: tree/byok/crypto
 */

import {
  ALGORITHM,
  IV_BYTES,
  VERSION_BYTES,
  textToPacked,
} from './types';
import {
  importMasterKey,
  importKeyByVersion,
  getActiveKeyVersion,
  ensureKeyVersionRow,
} from './byok-crypto-service';

export async function decryptPackedWithKey(
  packedBytes: Uint8Array,
  key: CryptoKey,
  userId?: string,
  offset = 0,
): Promise<string> {
  const iv = packedBytes.slice(offset, offset + IV_BYTES);
  const ct = packedBytes.slice(offset + IV_BYTES);

  if (userId) {
    try {
      const pt = await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv,
          additionalData: new TextEncoder().encode(userId),
        },
        key,
        ct,
      );
      return new TextDecoder().decode(pt);
    } catch {
      // fallthrough to legacy
    }
  }

  const pt = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export async function decryptLegacyApiKey(
  packedBytes: Uint8Array,
  userId?: string,
): Promise<string> {
  if (!packedBytes || packedBytes.length <= IV_BYTES) {
    throw new Error('BYOK_DECRYPT_MALFORMED: payload too short');
  }

  const key = await importMasterKey();
  return decryptPackedWithKey(packedBytes, key, userId);
}

/**
 * Encrypt a plaintext string (typically a provider API key).
 * Returns a packed `[version][iv][ciphertext+tag]` Uint8Array ready for D1 BLOB.
 */
export async function encryptApiKey(
  plain: string,
  userId?: string,
  keyVersion?: number,
): Promise<Uint8Array> {
  if (!plain) throw new Error('BYOK_ENCRYPT_EMPTY: plaintext is empty');

  const version = keyVersion ?? (await getActiveKeyVersion());
  await ensureKeyVersionRow(version);

  const key = await importKeyByVersion(version);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const pt = new TextEncoder().encode(plain);
  const params: AesGcmParams = userId
    ? {
        name: ALGORITHM,
        iv: iv as BufferSource,
        additionalData: new TextEncoder().encode(userId) as BufferSource,
      }
    : { name: ALGORITHM, iv: iv as BufferSource };

  const ct = new Uint8Array(await crypto.subtle.encrypt(params, key, pt));
  const packed = new Uint8Array(VERSION_BYTES + iv.length + ct.length);
  packed[0] = version;
  packed.set(iv, VERSION_BYTES);
  packed.set(ct, VERSION_BYTES + iv.length);
  return packed;
}

/**
 * Decrypt a packed `[version][iv][ciphertext+tag]` blob. Tries AAD-bound
 * decrypt (userId) first; falls back to legacy (no-AAD) ciphertext for rows
 * written before V-2.1. Throws on tamper, wrong master key, or malformed input.
 */
export async function decryptApiKey(
  packed: Uint8Array | string,
  userId?: string,
  keyVersion?: number,
  legacyFormat = false,
): Promise<string> {
  const packedBytes = typeof packed === 'string' ? textToPacked(packed) : packed;

  if (legacyFormat) {
    return decryptLegacyApiKey(packedBytes, userId);
  }

  if (!packedBytes || packedBytes.length <= VERSION_BYTES + IV_BYTES) {
    throw new Error('BYOK_DECRYPT_MALFORMED: payload too short');
  }

  const version = keyVersion ?? packedBytes[0];
  const key = await importKeyByVersion(version);
  return decryptPackedWithKey(packedBytes, key, userId, VERSION_BYTES);
}
