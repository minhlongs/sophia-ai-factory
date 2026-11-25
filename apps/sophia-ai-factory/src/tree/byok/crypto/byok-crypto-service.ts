/**
 * BYOK Key Management Service
 *
 * Implements master KEK importing, envelope DEK version loading, and D1 version tracking.
 *
 * Layer: tree/byok/crypto
 */

import { getD1 } from '@/seed/db/client';
import {
  ALGORITHM,
  KEY_LEN_BITS,
  KEY_LEN_BYTES,
  type KeyVersionRow,
  ByokMissingMasterKeyError,
  ByokInvalidMasterKeyError,
  base64ToBytes,
} from './types';
import {
  KEK_ENVELOPE_PREFIX,
  ensureKeyVersionRow,
  generateMasterKey,
  generateWrappedDek,
  unwrapDekWithMasterKek,
  wrapDekWithMasterKek,
} from './byok-key-version-seeder';

export {
  KEK_ENVELOPE_PREFIX,
  ensureKeyVersionRow,
  generateMasterKey,
  generateWrappedDek,
  unwrapDekWithMasterKek,
  wrapDekWithMasterKek,
};

export async function importKeyMaterial(bytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: ALGORITHM, length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function importMasterKey(): Promise<CryptoKey> {
  const raw = process.env.BYOK_MASTER_KEY;
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

  try {
    return await importKeyMaterial(bytes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ByokInvalidMasterKeyError(`failed to import key material: ${msg}`);
  }
}

export async function loadKeyVersion(version: number): Promise<CryptoKey | null> {
  let db;
  try {
    db = await getD1();
  } catch {
    throw new Error('BYOK_KEY_VERSION_STORE_UNAVAILABLE');
  }
  if (!db) throw new Error('BYOK_KEY_VERSION_STORE_UNAVAILABLE');

  let row: (KeyVersionRow & { key_type?: string }) | null;
  try {
    row = await db
      .prepare(
        `SELECT key_type, version, encrypted_key, rotated_at, is_active
         FROM key_versions
         WHERE version = ?
         LIMIT 1`,
      )
      .bind(version)
      .first<KeyVersionRow & { key_type?: string }>();
  } catch {
    throw new Error('BYOK_KEY_VERSION_STORE_UNAVAILABLE');
  }

  if (!row || typeof row.encrypted_key !== 'string') return null;

  try {
    const dekBytes = await unwrapDekWithMasterKek(
      row.encrypted_key,
      row.version ?? version,
      row.key_type || 'master',
    );
    return await importKeyMaterial(dekBytes);
  } catch (err) {
    if (err instanceof ByokMissingMasterKeyError || err instanceof ByokInvalidMasterKeyError) {
      throw err;
    }
    throw new Error('BYOK_KEY_VERSION_MATERIAL_INVALID');
  }
}

export async function getActiveKeyVersion(): Promise<number> {
  const db = await getD1();
  if (!db) return 1;

  const row = await db
    .prepare(
      `SELECT version
       FROM key_versions
       WHERE is_active = 1
       ORDER BY version DESC
       LIMIT 1`,
    )
    .first<{ version: number }>();

  return row?.version ?? 1;
}

export async function importKeyByVersion(version: number): Promise<CryptoKey> {
  let db = null;
  try {
    db = await getD1();
  } catch {
    db = null;
  }
  if (!db) {
    if (version === 1) return importMasterKey();
    throw new Error('BYOK_KEY_VERSION_STORE_UNAVAILABLE');
  }

  const key = await loadKeyVersion(version);
  if (key) return key;

  if (version === 1) return importMasterKey();

  throw new Error(`BYOK_DECRYPT_VERSION_UNSUPPORTED: version ${version} is outside the dual-decrypt window`);
}
