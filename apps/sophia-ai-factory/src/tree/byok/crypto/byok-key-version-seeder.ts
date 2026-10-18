/**
 * BYOK Key Version Seeding & Master Key Generation Helpers
 *
 * Layer: tree/byok/crypto
 */

import { getD1 } from '@/seed/db/client';
import {
  KEY_LEN_BYTES,
  ByokMissingMasterKeyError,
  ByokInvalidMasterKeyError,
  base64ToBytes,
  bytesToBase64,
} from './types';

function isDuplicateKeyVersionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed: key_versions\.(key_type, version)|SQLITE_CONSTRAINT_UNIQUE/.test(msg);
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
    await db
      .prepare(
        `INSERT INTO key_versions (key_type, version, encrypted_key, is_active)
         VALUES (?, ?, ?, 1)`,
      )
      .bind('master', version, bytesToBase64(bytes))
      .run();
  } catch (e) {
    if (!isDuplicateKeyVersionError(e)) throw e;
  }
}

/**
 * Generate a fresh base64-encoded master key.
 */
export async function generateMasterKey(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_LEN_BYTES));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
