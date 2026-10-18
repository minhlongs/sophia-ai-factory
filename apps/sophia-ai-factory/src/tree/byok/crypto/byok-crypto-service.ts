/**
 * BYOK Key Management Service
 *
 * Implements master key importing, version loading, and D1 version tracking.
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

export { ensureKeyVersionRow, generateMasterKey } from './byok-key-version-seeder';

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
  const db = await getD1();
  if (!db) return null;

  const row = await db
    .prepare(
      `SELECT version, encrypted_key, rotated_at, is_active
       FROM key_versions
       WHERE version = ?
       LIMIT 1`,
    )
    .bind(version)
    .first<KeyVersionRow>();

  if (!row) return null;

  try {
    return await importKeyMaterial(base64ToBytes(row.encrypted_key));
  } catch {
    return null;
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
  const key = await loadKeyVersion(version);
  if (key) return key;

  if (version === 1) return importMasterKey();

  throw new Error(`BYOK_DECRYPT_VERSION_UNSUPPORTED: version ${version} is outside the dual-decrypt window`);
}
