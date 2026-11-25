/**
 * BYOK Key Version Seeding, Envelope KEK Wrapping & DEK Generation Helpers
 *
 * Wraps every DEK persisted to `key_versions.encrypted_key` under the Worker Secret
 * KEK (`process.env.BYOK_MASTER_KEY`) using Web Crypto AES-256-GCM:
 *   `kek:v1:<iv_b64>:<ciphertext_b64>` with AAD `${keyType}:${version}`
 *
 * Layer: tree/byok/crypto
 */

import { getD1 } from '@/seed/db/client';
import {
  ALGORITHM,
  IV_BYTES,
  KEY_LEN_BITS,
  KEY_LEN_BYTES,
  ByokMissingMasterKeyError,
  ByokInvalidMasterKeyError,
  base64ToBytes,
  bytesToBase64,
} from './types';

export const KEK_ENVELOPE_PREFIX = 'kek:v1:';
const DEFAULT_KEY_TYPE = 'master';

function isDuplicateKeyVersionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed: key_versions\.(key_type, version)|SQLITE_CONSTRAINT_UNIQUE/.test(msg);
}

export async function importKekFromEnv(): Promise<CryptoKey> {
  const raw = process.env.BYOK_MASTER_KEY?.trim();
  if (!raw) throw new ByokMissingMasterKeyError();

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ByokInvalidMasterKeyError(`not valid base64: ${msg}`);
  }
  if (bytes.length !== KEY_LEN_BYTES) {
    throw new ByokInvalidMasterKeyError(`expected ${KEY_LEN_BYTES} bytes, got ${bytes.length}`);
  }

  return crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: ALGORITHM, length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapDekWithMasterKek(
  dekBytes: Uint8Array,
  version: number,
  keyType: string = DEFAULT_KEY_TYPE,
): Promise<string> {
  if (dekBytes.length !== KEY_LEN_BYTES) {
    throw new Error(`BYOK_DEK_INVALID_LENGTH: expected ${KEY_LEN_BYTES} bytes`);
  }
  const kek = await importKekFromEnv();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const aad = new TextEncoder().encode(`${keyType}:${version}`);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv as BufferSource,
        additionalData: aad as BufferSource,
      },
      kek,
      dekBytes as BufferSource,
    ),
  );
  return `${KEK_ENVELOPE_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(ct)}`;
}

export async function unwrapDekWithMasterKek(
  stored: string,
  version: number,
  keyType: string = DEFAULT_KEY_TYPE,
): Promise<Uint8Array> {
  if (!stored.startsWith(KEK_ENVELOPE_PREFIX)) {
    const legacyBytes = base64ToBytes(stored);
    if (legacyBytes.length !== KEY_LEN_BYTES) {
      throw new Error('BYOK_KEY_VERSION_MATERIAL_INVALID');
    }
    return legacyBytes;
  }

  const remainder = stored.slice(KEK_ENVELOPE_PREFIX.length);
  const sepIdx = remainder.indexOf(':');
  if (sepIdx <= 0 || sepIdx === remainder.length - 1) {
    throw new Error('BYOK_KEY_VERSION_MATERIAL_INVALID');
  }

  const iv = base64ToBytes(remainder.slice(0, sepIdx));
  const ct = base64ToBytes(remainder.slice(sepIdx + 1));
  if (iv.length !== IV_BYTES || ct.length <= 16) {
    throw new Error('BYOK_KEY_VERSION_MATERIAL_INVALID');
  }

  const kek = await importKekFromEnv();
  const aad = new TextEncoder().encode(`${keyType}:${version}`);
  const pt = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv as BufferSource,
      additionalData: aad as BufferSource,
    },
    kek,
    ct as BufferSource,
  );
  const dekBytes = new Uint8Array(pt);
  if (dekBytes.length !== KEY_LEN_BYTES) {
    throw new Error('BYOK_KEY_VERSION_MATERIAL_INVALID');
  }
  return dekBytes;
}

export async function generateWrappedDek(
  version: number,
  keyType: string = DEFAULT_KEY_TYPE,
): Promise<string> {
  const dekBytes = crypto.getRandomValues(new Uint8Array(KEY_LEN_BYTES));
  return wrapDekWithMasterKek(dekBytes, version, keyType);
}

export async function ensureKeyVersionRow(version: number): Promise<void> {
  const db = await getD1();
  if (!db) return;

  const existing = await db
    .prepare(
      `SELECT version
       FROM key_versions
       WHERE version = ?
       LIMIT 1`,
    )
    .bind(version)
    .first<{ version: number }>();

  if (existing) return;

  const wrappedDek = await generateWrappedDek(version, DEFAULT_KEY_TYPE);

  try {
    await db
      .prepare(
        `INSERT INTO key_versions (key_type, version, encrypted_key, is_active)
         VALUES (?, ?, ?, 1)`,
      )
      .bind(DEFAULT_KEY_TYPE, version, wrappedDek)
      .run();
  } catch (e) {
    if (!isDuplicateKeyVersionError(e)) throw e;
  }
}

/**
 * Generate a fresh base64-encoded 32-byte random key.
 */
export async function generateMasterKey(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_LEN_BYTES));
  return bytesToBase64(bytes);
}
