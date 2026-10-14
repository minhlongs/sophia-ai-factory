/**
 * Credentials Key Import and Version Resolution
 *
 * Layer: tree/credentials
 */

import { getD1 } from '@/seed/db/client';
import {
  ALGORITHM,
  KEY_LEN_BITS,
  KEY_LEN_BYTES,
  DUAL_DECRYPT_WINDOW_MS,
  type KeyVersionRow,
  hexToBytes,
  base64ToBytes,
} from './constants';

export async function importKeyMaterial(bytes: Uint8Array): Promise<CryptoKey> {
  if (bytes.length !== KEY_LEN_BYTES) {
    throw new Error(`Expected ${KEY_LEN_BYTES} bytes, got ${bytes.length}`);
  }

  return crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: ALGORITHM, length: KEY_LEN_BITS },
    false,
    ['encrypt', 'decrypt'],
  ) as Promise<CryptoKey>;
}

export async function importMasterKey(): Promise<CryptoKey> {
  const hexKey = process.env.CREDENTIALS_MASTER_KEY;
  const b64Key = process.env.BYOK_MASTER_KEY;

  let raw: Uint8Array;
  if (hexKey) {
    raw = hexToBytes(hexKey);
  } else if (b64Key) {
    raw = base64ToBytes(b64Key);
    if (raw.length !== KEY_LEN_BYTES) {
      throw new Error(`BYOK_MASTER_KEY: expected ${KEY_LEN_BYTES} bytes, got ${raw.length}`);
    }
  } else {
    throw new Error('CREDENTIALS_MASTER_KEY (or BYOK_MASTER_KEY) not set');
  }

  return importKeyMaterial(raw);
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

export async function getPreviousKeyVersion(): Promise<KeyVersionRow | null> {
  const db = await getD1();
  if (!db) return null;

  return db
    .prepare(
      `SELECT version, encrypted_key, rotated_at, is_active
       FROM key_versions
       WHERE is_active = 0
       ORDER BY version DESC
       LIMIT 1`,
    )
    .first<KeyVersionRow>();
}

export async function canUsePreviousVersion(row: KeyVersionRow | null): Promise<boolean> {
  if (!row) return false;
  if (!row.rotated_at) return false;

  const rotatedAt = Date.parse(row.rotated_at);
  if (Number.isNaN(rotatedAt)) return false;

  return Date.now() - rotatedAt <= DUAL_DECRYPT_WINDOW_MS;
}

export async function importKeyByVersion(version: number): Promise<CryptoKey> {
  const key = await loadKeyVersion(version);
  if (key) return key;

  const previous = await getPreviousKeyVersion();
  if (previous && previous.version === version && await canUsePreviousVersion(previous)) {
    const previousKey = await loadKeyVersion(version);
    if (previousKey) return previousKey;
  }

  if (version === 1) return importMasterKey();

  throw new Error(`CREDENTIALS_DECRYPT_VERSION_UNSUPPORTED: version ${version} is outside the dual-decrypt window`);
}
